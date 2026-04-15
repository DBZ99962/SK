/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { GeminiLiveSession, SessionState } from "./lib/live-session";
import { AudioStreamer } from "./lib/audio-streamer";
import { Visualizer } from "./components/Visualizer";
import { Power, Mic, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";

export default function App() {
  const [state, setState] = useState<SessionState>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiKey = process.env.GEMINI_API_KEY;

  useEffect(() => {
    audioStreamerRef.current = new AudioStreamer();
    if (apiKey) {
      sessionRef.current = new GeminiLiveSession(apiKey);
    } else {
      setError("Gemini API Key is missing. Please check your environment variables.");
    }

    return () => {
      sessionRef.current?.disconnect();
      audioStreamerRef.current?.stopMic();
      audioStreamerRef.current?.stopPlayback();
    };
  }, [apiKey]);

  const handleStart = async () => {
    if (!sessionRef.current || !audioStreamerRef.current) return;

    setError(null);
    try {
      await sessionRef.current.connect({
        onStateChange: (newState) => setState(newState),
        onAudioData: (base64) => {
          audioStreamerRef.current?.playAudioChunk(base64);
          setIsSpeaking(true);
          if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
          speakingTimeoutRef.current = setTimeout(() => setIsSpeaking(false), 1000);
        },
        onInterruption: () => {
          audioStreamerRef.current?.stopPlayback();
          setIsSpeaking(false);
        },
        onError: (err) => {
          console.error("Session error callback:", err);
          setError(`Session Error: ${err.message || "Connection failed"}`);
          setState("error");
        },
      });

      await audioStreamerRef.current.startMic((base64) => {
        sessionRef.current?.sendAudio(base64);
        setIsListening(true);
      });
    } catch (err: any) {
      console.error("Initialization error:", err);
      setError(err.message || "Failed to initialize audio or session.");
      setState("error");
    }
  };

  const handleStop = async () => {
    await sessionRef.current?.disconnect();
    audioStreamerRef.current?.stopMic();
    audioStreamerRef.current?.stopPlayback();
    setState("disconnected");
    setIsSpeaking(false);
    setIsListening(false);
  };

  const toggleSession = () => {
    if (state === "disconnected" || state === "error") {
      handleStart();
    } else {
      handleStop();
    }
  };

  const [sessionTime, setSessionTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === "connected") {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      setSessionTime(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col justify-between relative overflow-hidden font-sans selection:bg-[#FF2D55]/30">
      <div className="ambient-bg" />

      {/* Header */}
      <header className="p-10 flex justify-between items-center relative z-20">
        <div className="text-2xl font-bold tracking-[4px] uppercase text-[#FF2D55]">
          SK AI
        </div>
        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full flex items-center gap-2.5 text-xs font-semibold tracking-wider uppercase">
          <div className={cn(
            "w-2 h-2 rounded-full shadow-[0_0_8px]",
            state === "connected" ? "bg-[#34C759] shadow-[#34C759]" : "bg-neutral-500 shadow-transparent"
          )} />
          {state === "connected" ? "Live Streaming" : "Disconnected"}
        </div>
      </header>

      {/* Side Panel */}
      <aside className="absolute left-10 top-1/2 -translate-y-1/2 flex flex-col gap-6 z-20 hidden md:flex">
        <div className="border-l-2 border-[#FF2D55] pl-4">
          <div className="text-[10px] uppercase text-[#8E8E93] tracking-widest mb-1">Latency</div>
          <div className="font-mono text-sm">{state === "connected" ? "142ms" : "---"}</div>
        </div>
        <div className="border-l-2 border-[#FF2D55] pl-4">
          <div className="text-[10px] uppercase text-[#8E8E93] tracking-widest mb-1">Sentiment</div>
          <div className="font-mono text-sm">{state === "connected" ? "Playful" : "---"}</div>
        </div>
        <div className="border-l-2 border-[#FF2D55] pl-4">
          <div className="text-[10px] uppercase text-[#8E8E93] tracking-widest mb-1">Session</div>
          <div className="font-mono text-sm">{formatTime(sessionTime)}</div>
        </div>
      </aside>

      {/* Main Visualizer Area */}
      <main className="flex-1 flex flex-col items-center justify-center gap-10 relative z-10">
        <Visualizer 
          state={state} 
          isSpeaking={isSpeaking} 
          isListening={isListening} 
        />

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-col items-center gap-4 max-w-xs text-center"
            >
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-xl border border-red-400/20">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
              
              {error.includes("denied") && (
                <button
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="text-xs font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors border-b border-cyan-400/30 pb-1"
                >
                  Try opening in a new tab
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="p-10 flex justify-center items-center gap-16 relative z-20">
        <div className="flex flex-col items-center gap-2 opacity-30">
          <div className="w-6 h-6 border border-white rounded" />
          <div className="text-[10px] uppercase tracking-widest">Browser</div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleSession}
          className={cn(
            "w-[100px] h-[100px] rounded-full flex items-center justify-center transition-all duration-500 shadow-[0_0_30px_rgba(255,45,85,0.3)]",
            state === "connected" ? "bg-white text-[#FF2D55]" : "bg-[#FF2D55] text-white"
          )}
        >
          <AnimatePresence mode="wait">
            {state === "connected" ? (
              <motion.div
                key="stop"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
              >
                <Power size={40} />
              </motion.div>
            ) : (
              <motion.div
                key="start"
                initial={{ opacity: 0, rotate: 90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -90 }}
              >
                <Mic size={40} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <div className="flex flex-col items-center gap-2 opacity-30">
          <div className="w-6 h-6 border border-white rounded" />
          <div className="text-[10px] uppercase tracking-widest">Spotify</div>
        </div>
      </footer>
    </div>
  );
}

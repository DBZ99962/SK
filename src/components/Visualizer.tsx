/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { cn } from "../lib/utils";

interface VisualizerProps {
  state: "disconnected" | "connecting" | "connected" | "error";
  isSpeaking: boolean;
  isListening: boolean;
}

export function Visualizer({ state, isSpeaking, isListening }: VisualizerProps) {
  const isActive = state === "connected";

  return (
    <div className="relative flex items-center justify-center w-[320px] h-[320px]">
      {/* Waveform Ring One */}
      <motion.div
        className="absolute w-full h-full border-2 border-[#FF2D55] opacity-30"
        style={{ borderRadius: "42% 58% 70% 30% / 45% 45% 55% 55%" }}
        animate={{
          rotate: 360,
          scale: isSpeaking ? [1, 1.1, 1] : 1,
        }}
        transition={{
          rotate: { duration: 10, repeat: Infinity, ease: "linear" },
          scale: { duration: 0.5, repeat: Infinity },
        }}
      />

      {/* Waveform Ring Two */}
      <motion.div
        className="absolute w-[90%] h-[90%] border-2 border-white opacity-20"
        style={{ borderRadius: "58% 42% 30% 70% / 55% 55% 45% 45%" }}
        animate={{
          rotate: -360,
          scale: isListening ? [1, 1.05, 1] : 1,
        }}
        transition={{
          rotate: { duration: 15, repeat: Infinity, ease: "linear" },
          scale: { duration: 0.8, repeat: Infinity },
        }}
      />

      {/* Core Orb */}
      <motion.div
        className={cn(
          "relative w-[180px] h-[180px] rounded-full z-10",
          isActive 
            ? "bg-[radial-gradient(circle,_#FF2D55_0%,_#700016_100%)] shadow-[0_0_60px_rgba(255,45,85,0.3),_0_0_120px_rgba(255,45,85,0.1)]" 
            : "bg-neutral-800 border border-white/10"
        )}
        animate={{
          scale: isSpeaking ? [1, 1.1, 1] : 1,
        }}
        transition={{
          duration: 0.2,
        }}
      >
        {/* Inner Glow */}
        <motion.div
          className="absolute inset-0 rounded-full bg-white/10"
          animate={{
            opacity: isActive ? [0.1, 0.3, 0.1] : 0,
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      {/* Status Label */}
      <div className="absolute -bottom-16 text-center">
        <motion.h2
          className="text-4xl font-extrabold tracking-tight bg-gradient-to-b from-white to-neutral-500 bg-clip-text text-transparent"
          animate={{ opacity: isActive ? 1 : 0.5 }}
        >
          {state === "connecting" ? "Syncing..." : state === "connected" ? (isSpeaking ? "Speaking" : isListening ? "Listening" : "Ready") : "Offline"}
        </motion.h2>
        <p className="font-serif italic text-lg text-[#8E8E93] mt-2">
          {isActive ? "\"Go ahead, I'm all ears. Try to keep up.\"" : "\"Wake me up when you're ready to talk.\""}
        </p>
      </div>
    </div>
  );
}

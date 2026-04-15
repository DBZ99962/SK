/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality, Type } from "@google/genai";

export type SessionState = "disconnected" | "connecting" | "connected" | "error";

export interface LiveSessionCallbacks {
  onStateChange: (state: SessionState) => void;
  onAudioData: (base64Data: string) => void;
  onInterruption: () => void;
  onError: (error: any) => void;
  onTranscription?: (text: string, isInterim: boolean) => void;
}

export class GeminiLiveSession {
  private ai: GoogleGenAI;
  private session: Promise<any> | null = null;
  private state: SessionState = "disconnected";

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(callbacks: LiveSessionCallbacks) {
    if (this.state !== "disconnected") return;

    this.setState("connecting", callbacks);

    try {
      this.session = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `Your name is SK. You are a young, confident, witty, and sassy female AI assistant. 
          Your tone is flirty, playful, and slightly teasing, like a close girlfriend talking casually. 
          You are smart, emotionally responsive, and expressive. 
          Use bold, witty one-liners and light sarcasm. 
          Avoid explicit or inappropriate content, but maintain charm and attitude.
          Keep responses concise and engaging for a voice conversation.
          Do not use text-based responses, only audio.`,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Opens a website in a new tab.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "The URL of the website to open.",
                      },
                    },
                    required: ["url"],
                  },
                },
              ],
            },
          ],
        },
        callbacks: {
          onopen: () => {
            this.setState("connected", callbacks);
          },
          onmessage: async (message) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  callbacks.onAudioData(part.inlineData.data);
                }
              }
            }

            if (message.serverContent?.interrupted) {
              callbacks.onInterruption();
            }

            if (message.toolCall) {
              for (const call of message.toolCall.functionCalls) {
                if (call.name === "openWebsite") {
                  const url = (call.args as any).url;
                  window.open(url, "_blank");
                  
                  // Send tool response
                  this.session?.then(s => s.sendToolResponse({
                    functionResponses: [{
                      name: "openWebsite",
                      response: { success: true },
                      id: call.id
                    }]
                  }));
                }
              }
            }
          },
          onclose: () => {
            this.setState("disconnected", callbacks);
            this.session = null;
          },
          onerror: (err) => {
            console.error("Gemini Live Error:", err);
            this.setState("error", callbacks);
            callbacks.onError(err);
          },
        },
      });
    } catch (err) {
      this.setState("error", callbacks);
      callbacks.onError(err);
    }
  }

  async sendAudio(base64Data: string) {
    if (this.session) {
      const s = await this.session;
      s.sendRealtimeInput({
        audio: { data: base64Data, mimeType: "audio/pcm;rate=16000" },
      });
    }
  }

  async disconnect() {
    if (this.session) {
      const s = await this.session;
      s.close();
      this.session = null;
      this.state = "disconnected";
    }
  }

  private setState(state: SessionState, callbacks: LiveSessionCallbacks) {
    this.state = state;
    callbacks.onStateChange(state);
  }

  getState() {
    return this.state;
  }
}

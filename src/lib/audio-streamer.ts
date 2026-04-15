/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;
  private sampleRate = 24000;
  private inputSampleRate = 16000;
  private nextStartTime = 0;

  constructor() {}

  async startMic(onAudioData: (base64Data: string) => void) {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported by this browser.");
      }

      this.audioContext = new AudioContext({ sampleRate: this.inputSampleRate });
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
      
      // Using ScriptProcessorNode for simplicity in this environment
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16Data = this.float32ToInt16(inputData);
        const base64Data = this.arrayBufferToBase64(pcm16Data.buffer);
        onAudioData(base64Data);
      };

      this.micSource.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (err: any) {
      console.error("Error starting microphone:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error("Microphone access denied. Please click the camera/mic icon in your browser's address bar and set it to 'Allow'.");
      }
      throw err;
    }
  }

  stopMic() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
  }

  async playAudioChunk(base64Data: string) {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    }

    const arrayBuffer = this.base64ToArrayBuffer(base64Data);
    const int16Data = new Int16Array(arrayBuffer);
    const float32Data = this.int16ToFloat32(int16Data);

    this.audioQueue.push(float32Data);
    if (!this.isPlaying) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.audioQueue.length === 0 || !this.audioContext) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const data = this.audioQueue.shift()!;
    const buffer = this.audioContext.createBuffer(1, data.length, this.sampleRate);
    buffer.getChannelData(0).set(data);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);
    
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;

    source.onended = () => {
      this.processQueue();
    };
  }

  stopPlayback() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
    // In a real app, we might want to track active sources and stop them
  }

  private float32ToInt16(buffer: Float32Array): Int16Array {
    const l = buffer.length;
    const buf = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      buf[i] = Math.min(1, buffer[i]) * 0x7FFF;
    }
    return buf;
  }

  private int16ToFloat32(buffer: Int16Array): Float32Array {
    const l = buffer.length;
    const buf = new Float32Array(l);
    for (let i = 0; i < l; i++) {
      buf[i] = buffer[i] / 0x7FFF;
    }
    return buf;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

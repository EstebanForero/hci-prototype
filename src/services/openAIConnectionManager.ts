import { RealtimeAgent, RealtimeSession, tool, OpenAIRealtimeWebSocket } from '@openai/agents/realtime';
import { z } from 'zod';
import { ConnectionCallbacks, SystemStatus } from '../types/voice';
import { createToolExecutionManager } from '../utils/toolExecution';
import { AudioProcessor } from '../utils/audioProcessor';

export class OpenAIConnectionManager {
  private session: RealtimeSession | null = null;
  private agent: RealtimeAgent | null = null;
  private toolManager: ReturnType<typeof createToolExecutionManager> | null = null;
  private callbacks: ConnectionCallbacks;
  private isConnected = false;

  private audioContext: AudioContext | null = null;
  private audioBuffer: string[] = [];
  private activeSources: AudioBufferSourceNode[] = [];
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private isPlayingSequence = false;
  private nextPlayTime: number | null = null;
  private isSchedulingPlayback = false;
  private pendingAudio: string[] = [];
  private pendingStreamEndCount = 0;
  private pendingTurnComplete = false;
  private readonly playbackLookahead = 0.02;

  private audioProcessor = new AudioProcessor({
    volume: 0.6,
    attenuationFactor: 0.9,
    sampleRate: 24000
  });

  constructor(private callbacks: ConnectionCallbacks) {}

  async connect(
    apiKey: string,
    systemStatus: SystemStatus,
    onStartWash: (config: any) => void,
    onStopWash?: (reason?: string) => void,
    onGetConsumption?: (config: any) => void
  ): Promise<boolean> {
    try {
      const transport = apiKey.startsWith('ek_')
        ? 'websocket'
        : new OpenAIRealtimeWebSocket({ useInsecureApiKey: true });

      this.toolManager = createToolExecutionManager({
        onStartWash,
        onStopWash,
        onGetConsumption,
        onToolExecuted: () => {},
        onToolError: () => {}
      }, systemStatus);

      this.agent = new RealtimeAgent({
        name: 'SmartWash AI',
        instructions: this.buildSystemInstruction(systemStatus),
        tools: this.buildTools()
      });

      this.session = new RealtimeSession(this.agent, {
        transport,
        model: 'gpt-realtime-preview',
        config: {
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 16000 },
              turnDetection: { type: 'server_vad', interruptResponse: true }
            },
            output: {
              format: { type: 'audio/pcm', rate: 24000 },
              voice: 'alloy'
            }
          },
          outputModalities: ['audio', 'text']
        }
      });

      this.registerSessionListeners();
      await this.session.connect({ apiKey });
      this.isConnected = true;
      this.callbacks.onReady();
      this.flushQueuedAudio();
      return true;
    } catch (error) {
      console.error('Failed to initialize OpenAI Realtime session:', error);
      this.callbacks.onError('Failed to initialize OpenAI Realtime session');
      return false;
    }
  }

  private registerSessionListeners() {
    if (!this.session) return;

    this.session.on('history_added', (item: any) => {
      if (item?.role === 'assistant' && Array.isArray(item.content)) {
        const textParts = item.content
          .filter((part: any) => part.type === 'output_text')
          .map((part: any) => part.text)
          .join(' ')
          .trim();

        if (textParts) {
          this.callbacks.onMessage({ text: textParts, type: 'assistant' });
        }
      }
    });

    this.session.on('audio', (event) => {
      const chunk = this.arrayBufferToBase64(event.data);
      this.callbacks.onAudioChunk(chunk, this.audioBuffer.length === 0);
      this.playAudioChunk(chunk, this.audioBuffer.length === 0, 0.85);
    });

    this.session.on('audio_interrupted', () => {
      this.clearAudioBuffer();
    });

    this.session.transport.on('audio_transcript_delta', (delta) => {
      if (delta.delta) {
        this.callbacks.onTranscription(delta.delta);
      }
    });

    this.session.transport.on('turn_done', () => {
      this.pendingTurnComplete = true;
      this.emitTurnCompleteIfReady();
    });
  }

  private buildSystemInstruction(status: SystemStatus): string {
    return `You are SmartWash Pro AI Assistant. Help users control their washing machine.
Current status: ${status.isActive ? `Running cycle ${status.currentCycle}/${status.totalCyclesScheduled}, ${status.timeRemaining} remaining` : 'Idle'} - Health: ${status.overallHealth}%.
Respond concisely and naturally.`;
  }

  private buildTools() {
    const createToolCall = (name: string, schema: any) => tool({
      name,
      parameters: schema,
      description: schema._def.description || '',
      execute: async (args: any) => {
        if (!this.toolManager) return { result: 'Tool manager unavailable' };
        const response = await this.toolManager.executeToolCall({
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          name,
          args
        });
        return response.response;
      }
    });

    const startWashSchema = z.object({
      clothing_type: z.string().optional(),
      temperature: z.string().optional(),
      cycle_type: z.string().optional(),
      extra_rinse: z.boolean().optional(),
      pre_soak: z.boolean().optional()
    }).describe('Start the washing machine with tailored settings.');

    const stopWashSchema = z.object({
      reason: z.string().optional()
    }).describe('Stop the current wash cycle.');

    const getStatusSchema = z.object({
      detailed: z.boolean().optional()
    }).describe('Get current status and progress.');

    const getCyclesSchema = z.object({
      include_history: z.boolean().optional()
    }).describe('Get information about scheduled wash cycles.');

    const getComponentsSchema = z.object({
      component_type: z.string().optional()
    }).describe('Get component diagnostics.');

    const getConsumptionSchema = z.object({
      program: z.string().optional(),
      temperature: z.number().optional(),
      spin_speed: z.number().optional(),
      duration: z.number().optional(),
      water_level: z.string().optional(),
      extra_rinse: z.boolean().optional(),
      pre_wash: z.boolean().optional()
    }).describe('Estimate electricity and water consumption.');

    return [
      createToolCall('start_wash', startWashSchema),
      createToolCall('stop_wash', stopWashSchema),
      createToolCall('get_wash_status', getStatusSchema),
      createToolCall('get_current_cycles', getCyclesSchema),
      createToolCall('get_component_states', getComponentsSchema),
      createToolCall('get_consumption', getConsumptionSchema)
    ];
  }

  sendAudio(base64Audio: string): boolean {
    if (!this.session || !this.isConnected) {
      this.pendingAudio.push(base64Audio);
      return true;
    }

    try {
      this.session.sendAudio(this.base64ToArrayBuffer(base64Audio));
      return true;
    } catch (error) {
      console.error('Error sending OpenAI audio:', error);
      this.pendingAudio.push(base64Audio);
      this.isConnected = false;
      return false;
    }
  }

  sendText(text: string): boolean {
    if (!this.session || !this.isConnected) {
      return false;
    }

    try {
      this.session.sendMessage(text);
      return true;
    } catch (error) {
      console.error('Error sending OpenAI text:', error);
      return false;
    }
  }

  sendAudioStreamEnd(): boolean {
    if (!this.session || !this.isConnected) {
      this.pendingStreamEndCount++;
      return true;
    }

    try {
      this.session.sendAudio(new ArrayBuffer(0), { commit: true });
      return true;
    } catch (error) {
      console.error('Error sending OpenAI audio_stream_end:', error);
      this.pendingStreamEndCount++;
      this.isConnected = false;
      return false;
    }
  }

  sendToolResponse(_responses: any[]): boolean {
    // Realtime agent handles execution internally.
    return true;
  }

  playAudioChunk(base64Audio: string, isFirstChunk: boolean = false, volume: number = 0.8): void {
    this.audioBuffer.push(base64Audio);

    if (this.audioBuffer.length > 500) {
      this.audioBuffer = this.audioBuffer.slice(-500);
    }

    const totalBufferedDuration = this.audioBuffer.reduce((total, chunk) => {
      const estimatedSamples = Math.floor((chunk.length * 3) / 4) / 2;
      return total + (estimatedSamples / 24000);
    }, 0);

    if (!this.isPlayingSequence && (isFirstChunk || totalBufferedDuration >= 0.12)) {
      this.scheduleBufferedPlayback(volume);
    } else if (this.isPlayingSequence) {
      this.scheduleBufferedPlayback(volume);
    }
  }

  clearAudioBuffer(): void {
    this.audioBuffer = [];
    this.isPlayingSequence = false;
    this.nextPlayTime = null;

    if (this.activeSources.length > 0) {
      this.activeSources.forEach(source => {
        try {
          source.stop();
          source.disconnect();
        } catch (_) {}
      });
      this.activeSources = [];
    }

    this.currentAudioSource = null;
  }

  getToolManager() {
    return this.toolManager;
  }

  isReady(): boolean {
    return this.isConnected;
  }

  disconnect(): void {
    this.clearAudioBuffer();
    this.pendingAudio = [];
    this.pendingStreamEndCount = 0;
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this.isConnected = false;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!this.audioContext) {
      const AudioContextCtor = (window.AudioContext || (window as any).webkitAudioContext);
      this.audioContext = new AudioContextCtor();
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    return this.audioContext;
  }

  private scheduleBufferedPlayback(volume: number) {
    if (!this.getAudioContext()) {
      console.error('❌ No audio context for playback');
      return;
    }

    if (this.isSchedulingPlayback || this.audioBuffer.length === 0) {
      if (this.audioBuffer.length === 0 && this.activeSources.length === 0) {
        this.isPlayingSequence = false;
        this.nextPlayTime = null;
        this.emitTurnCompleteIfReady();
      }
      return;
    }

    this.isSchedulingPlayback = true;

    try {
      while (this.audioBuffer.length > 0) {
        const base64Audio = this.audioBuffer.shift()!;
        const chunkInfo = this.audioProcessor.getAudioChunkInfo(base64Audio);
        if (!chunkInfo.isValid) continue;

        const pcmData = this.audioProcessor.base64ToPCM(base64Audio);
        if (pcmData.length === 0) continue;

        const audioBuffer = this.audioProcessor.pcmToAudioBuffer(pcmData, this.audioContext!);
        if (!audioBuffer) continue;

        const source = this.audioProcessor.playAudioBuffer(audioBuffer, this.audioContext!, volume);
        if (!source) continue;

        const currentTime = this.audioContext!.currentTime;
        const baseStart = this.nextPlayTime ?? (currentTime + this.playbackLookahead);
        const safeStart = Math.max(baseStart, currentTime + this.playbackLookahead);

        source.onended = () => {
          this.activeSources = this.activeSources.filter(s => s !== source);
          if (this.activeSources.length === 0 && this.audioBuffer.length === 0) {
            this.isPlayingSequence = false;
            this.nextPlayTime = null;
            this.emitTurnCompleteIfReady();
          } else if (this.audioBuffer.length > 0) {
            this.scheduleBufferedPlayback(volume);
          }
        };

        source.start(safeStart);
        this.activeSources.push(source);
        this.currentAudioSource = source;
        this.isPlayingSequence = true;
        this.nextPlayTime = safeStart + audioBuffer.duration;
      }
    } catch (error) {
      console.error('❌ Error scheduling buffered audio chunk:', error);
      this.isPlayingSequence = false;
      this.nextPlayTime = null;
    } finally {
      this.isSchedulingPlayback = false;
    }
  }

  private flushQueuedAudio() {
    if (!this.session || !this.isConnected) {
      return;
    }

    while (this.pendingAudio.length > 0) {
      const chunk = this.pendingAudio.shift()!;
      this.session.sendAudio(this.base64ToArrayBuffer(chunk));
    }

    while (this.pendingStreamEndCount > 0) {
      this.session.sendAudio(new ArrayBuffer(0), { commit: true });
      this.pendingStreamEndCount--;
    }
  }

  private emitTurnCompleteIfReady() {
    if (this.pendingTurnComplete && this.audioBuffer.length === 0 && this.activeSources.length === 0) {
      this.pendingTurnComplete = false;
      this.callbacks.onTurnComplete();
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    if (typeof atob !== 'undefined') {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
    if (typeof Buffer !== 'undefined') {
      const buffer = Buffer.from(base64, 'base64');
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    throw new Error('Base64 decoding not supported in this environment.');
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    if (typeof btoa !== 'undefined') {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(buffer).toString('base64');
    }
    throw new Error('Base64 encoding not supported in this environment.');
  }
}

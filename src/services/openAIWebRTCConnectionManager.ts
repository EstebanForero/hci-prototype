import { RealtimeAgent, RealtimeSession, tool, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import { z } from 'zod';
import { ConnectionCallbacks, SystemStatus } from '../types/voice';
import { createToolExecutionManager } from '../utils/toolExecution';

export class OpenAIWebRTCConnectionManager {
  private session: RealtimeSession | null = null;
  private agent: RealtimeAgent | null = null;
  private toolManager: ReturnType<typeof createToolExecutionManager> | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isConnected = false;

  constructor(private callbacks: ConnectionCallbacks) {}

  async connect(
    apiKey: string,
    systemStatus: SystemStatus,
    onStartWash: (config: any) => void,
    onStopWash?: (reason?: string) => void,
    onGetConsumption?: (config: any) => void
  ): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        this.callbacks.onError('OpenAI WebRTC mode is only available in browsers.');
        return false;
      }

      this.toolManager = createToolExecutionManager({
        onStartWash,
        onStopWash,
        onGetConsumption,
        onToolExecuted: () => {},
        onToolError: () => {}
      }, systemStatus);

      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioElement = document.createElement('audio');
      this.audioElement.autoplay = true;
      this.audioElement.playsInline = true;
      this.audioElement.style.display = 'none';
      document.body.appendChild(this.audioElement);

      this.agent = new RealtimeAgent({
        name: 'SmartWash AI',
        instructions: this.buildSystemInstruction(systemStatus),
        tools: this.buildTools()
      });

      this.session = new RealtimeSession(this.agent, {
        transport: new OpenAIRealtimeWebRTC({
          mediaStream,
          audioElement: this.audioElement
        }),
        model: 'gpt-realtime-preview',
        config: {
          audio: {
            input: {
              turnDetection: { type: 'semantic_vad', interruptResponse: true }
            },
            output: {
              voice: 'alloy'
            }
          },
          outputModalities: ['audio']
        }
      });

      this.registerSessionListeners();
      await this.session.connect({ apiKey });
      this.isConnected = true;
      this.callbacks.onReady();
      return true;
    } catch (error) {
      console.error('Failed to initialize OpenAI WebRTC session:', error);
      this.callbacks.onError('Failed to initialize OpenAI WebRTC session');
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

    this.session.on('audio_start', () => {
      this.callbacks.onAudioChunk('', true);
    });

    this.session.on('audio_stopped', () => {
      this.callbacks.onTurnComplete();
    });

    this.session.transport.on('audio_transcript_delta', (delta) => {
      if (delta.delta) {
        this.callbacks.onTranscription(delta.delta);
      }
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

  sendAudio(): boolean {
    return true;
  }

  sendText(text: string): boolean {
    if (!this.session || !this.isConnected) return false;
    try {
      this.session.sendMessage(text);
      return true;
    } catch (error) {
      console.error('Error sending OpenAI WebRTC text:', error);
      return false;
    }
  }

  sendAudioStreamEnd(): boolean {
    return true;
  }

  sendToolResponse(): boolean {
    return true;
  }

  playAudioChunk(): void {
    // WebRTC transport handles audio itself
  }

  clearAudioBuffer(): void {
    // Nothing to clear for WebRTC transport
  }

  getToolManager() {
    return this.toolManager;
  }

  isReady(): boolean {
    return this.isConnected;
  }

  disconnect(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    if (this.audioElement) {
      this.audioElement.remove();
      this.audioElement = null;
    }
    this.isConnected = false;
  }
}

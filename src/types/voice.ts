export type VoiceProvider = 'gemini' | 'openai' | 'openai-webrtc';

export interface ConnectionCallbacks {
  onReady: () => void;
  onError: (error: string) => void;
  onMessage: (message: any) => void;
  onTranscription: (text: string) => void;
  onToolCall: (toolCalls: any[]) => void;
  onAudioChunk: (audioData: string, isFirstChunk: boolean) => void;
  onTurnComplete: () => void;
  onStopWash?: (reason?: string) => void;
  onGetConsumption?: (config: any) => void;
}

export interface SystemStatus {
  overallHealth: number;
  isActive: boolean;
  currentCycle: number;
  totalCyclesScheduled: number;
  timeRemaining: string;
  parts: any[];
}

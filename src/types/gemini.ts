/**
 * Types and interfaces for Gemini Live integration
 */

export interface ComponentMetrics {
  name: string;
  health: number;
  status: 'optimal' | 'warning' | 'critical';
  cyclesRemaining: number;
}

export interface GeminiLiveProps {
  parts: ComponentMetrics[];
  overallHealth: number;
  totalCycles: number;
  onStartWash: (config: any) => void;
  isActive: boolean;
  currentCycle: number;
  totalCyclesScheduled: number;
  timeRemaining: string;
}

export interface GeminiResponse {
  text: string;
  action?: {
    type: 'start_wash' | 'stop_wash' | 'get_metrics' | 'configure_wash';
    config?: any;
  };
  confidence: number;
}

export interface ChatMessage {
  text: string;
  timestamp: Date;
  type: 'user' | 'assistant';
}

export interface ToolCall {
  id?: string;
  name?: string;
  function?: {
    id?: string;
    name?: string;
    args?: any;
  };
  args?: any;
}

export interface ToolResponse {
  id: string;
  name: string;
  response: any;
}

export interface GeminiSetupMessage {
  setup: {
    model: string;
    generation_config: {
      response_modalities: string[];
      speech_config: {
        voice_config: {
          prebuilt_voice_config: {
            voice_name: string;
          };
        };
      };
    };
    system_instruction: {
      parts: Array<{
        text: string;
      }>;
    };
    tools: Array<{
      function_declarations: FunctionDeclaration[];
    }>;
  };
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface RealtimeInputMessage {
  realtime_input: {
    text?: string;
    audio?: {
      data: string;
      mimeType: string;
    };
    audio_stream_end?: boolean;
  };
}

export interface ToolResponseMessage {
  tool_response: {
    function_responses: ToolResponse[];
  };
}

export interface GeminiWebSocketMessage {
  setup_complete?: boolean;
  setupComplete?: boolean;
  error?: {
    message?: string;
    code?: string;
  };
  functionCalls?: ToolCall[];
  function_calls?: ToolCall[];
  toolCallCancellation?: {
    ids: string[];
  };
  server_content?: {
    output_transcription?: {
      text: string;
    };
    turn_complete?: boolean;
  };
  [key: string]: any;
}

export interface WashConfig {
  program?: string;
  temperature?: number;
  spinSpeed?: number;
  duration?: number;
  waterLevel?: 'low' | 'medium' | 'high';
  extraRinse?: boolean;
  preWash?: boolean;
  clothing_type?: string;
  temperature_setting?: string;
  cycle?: string;
  extra_rinse?: boolean;
  pre_soak?: boolean;
}

export interface AudioRecordingState {
  isRecording: boolean;
  audioLevel: number;
  isProcessing: boolean;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastErrorTime: number | null;
}

export interface AudioStreamRef {
  buffer: Array<{ base64Audio: string; isFirstChunk: boolean }>;
  isPlaying: boolean;
  scheduleTimeout: number | null;
  nextPlayTime: number | null;
  hasStarted: boolean;
}

export interface AudioStreamState {
  buffer: Array<{ base64Audio: string; isFirstChunk: boolean }>;
  isPlaying: boolean;
  scheduleTimeout: number | null;
  nextPlayTime: number | null;
  hasStarted: boolean;
}

export interface AudioTestResult {
  id: string;
  timestamp: Date;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface GeminiLiveState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isSDKReady: boolean;
  transcript: string;
  responses: ChatMessage[];
  volume: number;
  isSettingsOpen: boolean;
  wakeWordEnabled: boolean;
  autoStartEnabled: boolean;
  error: string | null;
  textInput: string;
  useTextInput: boolean;
  audioLevel: number;
  isAudioTesting: boolean;
  testResults: string[];
  debugLogsEnabled: boolean;
}

// Function parameter types
export interface StartWashParams {
  clothing_type?: string;
  temperature?: string;
  cycle_type?: string;
  extra_rinse?: boolean;
  pre_soak?: boolean;
}

export interface StopWashParams {
  reason?: string;
}

export interface GetWashStatusParams {
  detailed?: boolean;
}

export interface GetCurrentCyclesParams {
  include_history?: boolean;
}

export interface GetComponentStatesParams {
  component_type?: string;
}

// Function response types
export interface WashStatusResponse {
  health: number;
  is_active: boolean;
  current_cycle: number;
  total_cycles: number;
  time_remaining: string;
  parts: ComponentMetrics[] | Array<{ name: string; health: number }>;
}

export interface CurrentCyclesResponse {
  current_cycle: number;
  total_scheduled: number;
  is_active: boolean;
  time_remaining: string;
  machine_health: number;
  next_scheduled: any;
  recent_cycles: Array<{
    type: string;
    completed_at: string;
    duration: number;
  }>;
}

export interface ComponentStatesResponse {
  overall_health: number;
  components: Array<{
    name: string;
    health: number;
    status: string;
    last_maintenance: string;
  }>;
  total_components: number;
  healthy_components: number;
  components_needing_attention: number;
}

export type MessageType = 'text' | 'audio' | 'tool_call' | 'tool_response' | 'setup' | 'error' | 'info' | 'warning' | 'success';

export interface DebugInfo {
  timestamp: Date;
  type: MessageType;
  message: string;
  data?: any;
}
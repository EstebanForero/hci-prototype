/**
 * Tool Call Execution for Gemini Live Integration
 * Handles execution of wash commands, status queries, and component operations
 */

import {
  ComponentMetrics,
  ToolCall,
  ToolResponse,
  StartWashParams,
  StopWashParams,
  GetWashStatusParams,
  GetCurrentCyclesParams,
  GetComponentStatesParams,
  WashStatusResponse,
  CurrentCyclesResponse,
  ComponentStatesResponse,
  WashConfig
} from '../types/gemini';
import { GeminiValidator } from './validation';

export interface ToolExecutionCallbacks {
  onStartWash: (config: WashConfig) => void;
  onStopWash?: (reason?: string) => void;
  onToolExecuted?: (toolName: string, result: any) => void;
  onToolError?: (toolName: string, error: string) => void;
}

export interface SystemContext {
  overallHealth: number;
  isActive: boolean;
  currentCycle: number;
  totalCyclesScheduled: number;
  timeRemaining: string;
  parts: ComponentMetrics[];
}

export class ToolExecutionManager {
  private callbacks: ToolExecutionCallbacks;
  private context: SystemContext;

  constructor(callbacks: ToolExecutionCallbacks, context: SystemContext) {
    this.callbacks = callbacks;
    this.context = context;
  }

  /**
   * Update the system context
   */
  public updateContext(newContext: Partial<SystemContext>): void {
    this.context = { ...this.context, ...newContext };
  }

  /**
   * Execute a tool call
   */
  public async executeToolCall(toolCall: ToolCall): Promise<ToolResponse> {
    const functionName = toolCall.name || toolCall.function?.name || 'unknown';
    const args = toolCall.args || toolCall.function?.args || {};
    const callId = toolCall.id || toolCall.function?.id || 'unknown';

    // Validate tool call parameters
    const validation = GeminiValidator.validateToolCall(functionName, args);
    if (!validation.isValid) {
      const errorMessage = validation.error || 'Invalid tool call parameters';
      console.error(`❌ Tool validation failed for ${functionName}:`, errorMessage);

      const errorResponse: ToolResponse = {
        id: callId || 'unknown',
        name: functionName,
        response: {
          error: `Validation failed: ${errorMessage}`
        }
      };

      this.callbacks.onToolError?.(functionName, errorMessage);
      return errorResponse;
    }

    try {
      let result: any;

      switch (functionName) {
        case 'start_wash':
          result = await this.executeStartWash(args as StartWashParams);
          break;

        case 'stop_wash':
          result = await this.executeStopWash(args as StopWashParams);
          break;

        case 'get_wash_status':
          result = await this.executeGetWashStatus(args as GetWashStatusParams);
          break;

        case 'get_current_cycles':
          result = await this.executeGetCurrentCycles(args as GetCurrentCyclesParams);
          break;

        case 'get_component_states':
          result = await this.executeGetComponentStates(args as GetComponentStatesParams);
          break;

        default:
          throw new Error(`Unknown function: ${functionName}`);
      }

      const response: ToolResponse = {
        id: callId || 'unknown',
        name: functionName,
        response: result
      };

      this.callbacks.onToolExecuted?.(functionName, result);
      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error executing function ${functionName}:`, error);

      const errorResponse: ToolResponse = {
        id: callId || 'unknown',
        name: functionName,
        response: {
          error: `Error executing function: ${errorMessage}`
        }
      };

      this.callbacks.onToolError?.(functionName, errorMessage);
      return errorResponse;
    }
  }

  /**
   * Execute multiple tool calls
   */
  public async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResponse[]> {
    const responses: ToolResponse[] = [];

    for (const toolCall of toolCalls) {
      const response = await this.executeToolCall(toolCall);
      responses.push(response);
    }

    return responses;
  }

  /**
   * Execute start wash command
   */
  private async executeStartWash(params: StartWashParams): Promise<any> {
    const {
      clothing_type = 'everyday',
      temperature = 'auto',
      cycle_type = 'auto',
      extra_rinse = false,
      pre_soak = false
    } = params;

    // Smart recommendations based on clothing type
    let smartTemp = temperature;
    let smartCycle = cycle_type;
    let recommendations: string[] = [];

    if (!temperature || temperature === 'auto') {
      const tempRecommendations: Record<string, string> = {
        'delicates': 'cold',
        'sportswear': 'cold',
        'everyday': 'warm',
        'mixed': 'warm',
        'heavy_duty': 'hot',
        'towels': 'hot'
      };
      smartTemp = tempRecommendations[clothing_type] || 'warm';
      recommendations.push(`${smartTemp} water for ${clothing_type}`);
    }

    if (!cycle_type || cycle_type === 'auto') {
      const cycleRecommendations: Record<string, string> = {
        'delicates': 'delicates',
        'sportswear': 'quick',
        'everyday': 'normal',
        'mixed': 'normal',
        'heavy_duty': 'heavy',
        'towels': 'heavy'
      };
      smartCycle = cycleRecommendations[clothing_type] || 'normal';
      if (!temperature || temperature === 'auto') {
        recommendations.push(`${smartCycle} cycle`);
      } else {
        recommendations.push(`${smartCycle} cycle for ${clothing_type}`);
      }
    }

    // Calculate duration
    const durationMap: Record<string, number> = {
      'quick': 30,
      'delicates': 45,
      'eco': 50,
      'normal': 60,
      'heavy': 90
    };
    const baseDuration = durationMap[smartCycle] || 60;
    const finalDuration = baseDuration + (extra_rinse ? 10 : 0) + (pre_soak ? 15 : 0);

    console.log(`🧺 Starting smart wash: ${clothing_type}, ${smartTemp} water, ${smartCycle} cycle`);

    // Execute the wash start
    const washConfig: WashConfig = {
      clothing_type,
      temperature_setting: smartTemp,
      cycle: smartCycle,
      duration: finalDuration,
      extra_rinse,
      pre_soak
    };

    this.callbacks.onStartWash(washConfig);

    const responseMessage = recommendations.length > 0
      ? `Perfect! I've started your wash with smart settings: ${recommendations.join(', ')}.${extra_rinse ? ' Added extra rinse.' : ''}${pre_soak ? ' Added pre-soak.' : ''}`
      : `Wash cycle started successfully with ${smartTemp} water and ${smartCycle} cycle.`;

    return {
      success: true,
      settings: washConfig,
      message: responseMessage
    };
  }

  /**
   * Execute stop wash command
   */
  private async executeStopWash(params: StopWashParams): Promise<any> {
    const { reason } = params;

    console.log(`🛑 Stopping wash cycle${reason ? ` - ${reason}` : ''}`);

    // Here you would call the actual stop function
    this.callbacks.onStopWash?.(reason);

    return {
      success: true,
      message: reason
        ? `Wash cycle stopped: ${reason}. The machine is now safe to open.`
        : 'Wash cycle stopped successfully. The machine is now safe to open.'
    };
  }

  /**
   * Execute get wash status command
   */
  private async executeGetWashStatus(params: GetWashStatusParams): Promise<WashStatusResponse> {
    const { detailed = false } = params;

    console.log('📊 Getting wash status' + (detailed ? ' (detailed)' : ''));

    return {
      health: this.context.overallHealth,
      is_active: this.context.isActive,
      current_cycle: this.context.currentCycle,
      total_cycles: this.context.totalCyclesScheduled,
      time_remaining: this.context.timeRemaining,
      parts: detailed
        ? this.context.parts
        : this.context.parts.map(p => ({ name: p.name, health: p.health }))
    };
  }

  /**
   * Execute get current cycles command
   */
  private async executeGetCurrentCycles(params: GetCurrentCyclesParams): Promise<CurrentCyclesResponse> {
    const { include_history = false } = params;

    console.log('📋 Getting current cycles' + (include_history ? ' (with history)' : ''));

    return {
      current_cycle: this.context.currentCycle,
      total_scheduled: this.context.totalCyclesScheduled,
      is_active: this.context.isActive,
      time_remaining: this.context.timeRemaining,
      machine_health: this.context.overallHealth,
      next_scheduled: null, // Would come from your scheduling system
      recent_cycles: include_history ? [
        { type: 'normal', completed_at: '2 hours ago', duration: 45 },
        { type: 'quick', completed_at: 'yesterday', duration: 30 }
      ] : []
    };
  }

  /**
   * Execute get component states command
   */
  private async executeGetComponentStates(params: GetComponentStatesParams): Promise<ComponentStatesResponse> {
    const { component_type } = params;

    console.log(`🔧 Getting component states` + (component_type ? ` (${component_type})` : ' (all)'));

    let componentsToShow = this.context.parts;
    if (component_type && component_type !== 'all') {
      componentsToShow = this.context.parts.filter(p =>
        p.name.toLowerCase().includes(component_type.toLowerCase())
      );
    }

    return {
      overall_health: this.context.overallHealth,
      components: componentsToShow.map(p => ({
        name: p.name,
        health: p.health,
        status: p.health > 80 ? 'optimal' : p.health > 50 ? 'acceptable' : 'needs_attention',
        last_maintenance: '2 weeks ago' // Would come from your maintenance system
      })),
      total_components: this.context.parts.length,
      healthy_components: this.context.parts.filter(p => p.health > 80).length,
      components_needing_attention: this.context.parts.filter(p => p.health <= 50).length
    };
  }

  /**
   * Parse commands from text response (for legacy compatibility)
   */
  public parseAndExecuteCommands(response: string): void {
    const lowerResponse = response.toLowerCase();

    // Check for wash start commands
    if (lowerResponse.includes('starting wash') ||
        lowerResponse.includes('wash cycle') ||
        lowerResponse.includes('start wash')) {

      if (!this.context.isActive) {
        let washConfig: WashConfig = {
          program: 'normal',
          temperature: 40,
          spinSpeed: 1200,
          duration: 60,
          waterLevel: 'medium',
          extraRinse: false,
          preWash: false,
        };

        // Parse wash type from response
        if (lowerResponse.includes('quick') || lowerResponse.includes('fast')) {
          washConfig.program = 'quick';
          washConfig.duration = 30;
        } else if (lowerResponse.includes('delicate') || lowerResponse.includes('gentle')) {
          washConfig.program = 'delicate';
          washConfig.temperature = 30;
          washConfig.spinSpeed = 800;
          washConfig.duration = 60;
        } else if (lowerResponse.includes('heavy') || lowerResponse.includes('tough')) {
          washConfig.program = 'heavy';
          washConfig.temperature = 90;
          washConfig.spinSpeed = 1400;
          washConfig.duration = 120;
          washConfig.extraRinse = true;
        } else if (lowerResponse.includes('eco')) {
          washConfig.program = 'eco';
          washConfig.temperature = 40;
          washConfig.spinSpeed = 1000;
          washConfig.duration = 150;
        }

        this.callbacks.onStartWash(washConfig);
      }
    }
  }
}

/**
 * Create function declarations for Gemini Live API
 */
export function createFunctionDeclarations(): any[] {
  const startWashFunction = {
    name: "start_wash",
    description: "Start the washing machine with optimized settings based on clothing type",
    parameters: {
      type: "object",
      properties: {
        clothing_type: {
          type: "string",
          description: "Type of clothes being washed (helps determine optimal settings)",
          enum: ["everyday", "delicates", "heavy_duty", "towels", "sportswear", "mixed"]
        },
        temperature: {
          type: "string",
          description: "Water temperature setting (auto-recommended based on clothing type if not specified)",
          enum: ["cold", "warm", "hot", "auto"]
        },
        cycle_type: {
          type: "string",
          description: "Type of wash cycle (auto-recommended based on clothing type if not specified)",
          enum: ["quick", "normal", "heavy", "delicates", "eco", "auto"]
        },
        extra_rinse: {
          type: "boolean",
          description: "Add extra rinse cycle for better cleaning"
        },
        pre_soak: {
          type: "boolean",
          description: "Add pre-soak for heavily soiled items"
        }
      },
      required: []
    }
  };

  const stopWashFunction = {
    name: "stop_wash",
    description: "Stop the current wash cycle immediately",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for stopping the cycle"
        }
      }
    }
  };

  const getWashStatusFunction = {
    name: "get_wash_status",
    description: "Get current status and progress of the washing machine",
    parameters: {
      type: "object",
      properties: {
        detailed: {
          type: "boolean",
          description: "Include detailed component status and diagnostics"
        }
      }
    }
  };

  const getCurrentCyclesFunction = {
    name: "get_current_cycles",
    description: "Get information about current and scheduled wash cycles",
    parameters: {
      type: "object",
      properties: {
        include_history: {
          type: "boolean",
          description: "Include recent cycle history"
        }
      }
    }
  };

  const getComponentStatesFunction = {
    name: "get_component_states",
    description: "Get detailed health and operational status of all washing machine components",
    parameters: {
      type: "object",
      properties: {
        component_type: {
          type: "string",
          description: "Filter by specific component type (motor, pump, heater, drum, sensors, electronics, all)",
          enum: ["motor", "pump", "heater", "drum", "sensors", "electronics", "all"]
        }
      }
    }
  };

  return [
    startWashFunction,
    stopWashFunction,
    getWashStatusFunction,
    getCurrentCyclesFunction,
    getComponentStatesFunction
  ];
}

/**
 * Create a tool execution manager with default configuration
 */
export function createToolExecutionManager(
  callbacks: ToolExecutionCallbacks,
  context: SystemContext
): ToolExecutionManager {
  return new ToolExecutionManager(callbacks, context);
}
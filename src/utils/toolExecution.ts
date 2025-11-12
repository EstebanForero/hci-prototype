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
  GetConsumptionParams,
  WashStatusResponse,
  CurrentCyclesResponse,
  ComponentStatesResponse,
  ConsumptionResponse,
  WashConfig
} from '../types/gemini';
import { GeminiValidator } from './validation';

export interface ToolExecutionCallbacks {
  onStartWash: (config: WashConfig) => void;
  onStopWash?: (reason?: string) => void;
  onGetConsumption?: (config: any) => void;
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
    const startTime = performance.now();
    const functionName = toolCall.name || toolCall.function?.name || 'unknown';
    const args = toolCall.args || toolCall.function?.args || {};
    const callId = toolCall.id || toolCall.function?.id || 'unknown';

    console.log(`🔧 Executing tool: ${functionName} with args:`, args);

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
          console.log('🧺 Starting wash execution...');
          result = await this.executeStartWash(args as StartWashParams);
          console.log('✅ Wash execution result:', result);
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

        case 'get_consumption':
          result = await this.executeGetConsumption(args);
          break;

        default:
          throw new Error(`Unknown function: ${functionName}`);
      }

      const response: ToolResponse = {
        id: callId || 'unknown',
        name: functionName,
        response: result
      };

      const endTime = performance.now();
      console.log(`⏱️ Tool ${functionName} completed in ${(endTime - startTime).toFixed(2)}ms`);

      this.callbacks.onToolExecuted?.(functionName, result);
      return response;

    } catch (error) {
      const endTime = performance.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error executing function ${functionName} after ${(endTime - startTime).toFixed(2)}ms:`, error);

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

    // Execute the wash start - convert to format expected by App.tsx
    const washConfig: WashConfig = {
      program: smartCycle.charAt(0).toUpperCase() + smartCycle.slice(1), // Capitalize first letter
      temperature: this.convertTemperatureToNumber(smartTemp),
      spinSpeed: this.getDefaultSpinSpeed(smartCycle),
      duration: finalDuration,
      waterLevel: this.getDefaultWaterLevel(smartCycle),
      extraRinse: extra_rinse,
      preWash: pre_soak
    };

    console.log('📞 Calling onStartWash callback with config:', washConfig);
    const callbackStart = performance.now();
    this.callbacks.onStartWash(washConfig);
    const callbackEnd = performance.now();
    console.log(`⏱️ onStartWash callback completed in ${(callbackEnd - callbackStart).toFixed(2)}ms`);

    const responseMessage = recommendations.length > 0
      ? `Perfect! I've started your wash with smart settings: ${recommendations.join(', ')}.${extra_rinse ? ' Added extra rinse.' : ''}${pre_soak ? ' Added pre-soak.' : ''}`
      : `Wash cycle started successfully with ${smartTemp} water and ${smartCycle} cycle.`;

    console.log('📤 Returning wash response:', responseMessage);
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
   * Execute get consumption command
   */
  private async executeGetConsumption(params: any): Promise<ConsumptionResponse> {
    const { program, temperature, spin_speed, duration, water_level, extra_rinse, pre_wash } = params;

    // Calculate resource usage based on parameters (same logic as in App.tsx)
    const baseElectricity = {
      'Quick Wash': 0.5,
      'Daily': 0.8,
      'Heavy': 2.0,
      'Delicate': 0.6,
      'Eco': 0.4,
      'Whites': 1.2,
      'Colors': 0.9,
      'Sportswear': 0.7,
      'Normal': 0.8
    };

    const tempMultiplier = 1 + (temperature - 20) * 0.02;
    const spinMultiplier = 1 + (spin_speed - 800) * 0.0002;
    const extraCosts = (extra_rinse ? 0.15 : 0) + (pre_wash ? 0.25 : 0);

    const programName = program || 'Daily';
    const baseKw = baseElectricity[programName] || 0.8;
    const electricityKw = Math.round((baseKw * tempMultiplier * spinMultiplier + extraCosts) * 10) / 10;

    const baseWater = {
      'Quick Wash': 25,
      'Daily': 45,
      'Heavy': 80,
      'Delicate': 40,
      'Eco': 30,
      'Whites': 50,
      'Colors': 45,
      'Sportswear': 35,
      'Normal': 45
    };

    const baseLiters = baseWater[programName] || 45;
    const waterLevelMultiplier = {
      'low': 0.7,
      'medium': 1.0,
      'high': 1.3
    };

    const waterLiters = Math.round(
      baseLiters * waterLevelMultiplier[water_level || 'medium'] +
      (extra_rinse ? 15 : 0) +
      (pre_wash ? 20 : 0)
    );

    // Calculate estimated costs
    const electricityCostPerKw = 0.15; // Average cost per kWh
    const waterCostPerLiter = 0.004; // Average cost per liter

    const estimatedElectricityCost = electricityKw * electricityCostPerKw;
    const estimatedWaterCost = waterLiters * waterCostPerLiter;
    const totalEstimatedCost = estimatedElectricityCost + estimatedWaterCost;

    return {
      program: programName,
      temperature,
      spin_speed,
      duration,
      water_level,
      extra_rinse,
      pre_wash,
      electricity_usage: {
        kw: electricityKw,
        estimated_cost: estimatedElectricityCost
      },
      water_usage: {
        liters: waterLiters,
        estimated_cost: estimatedWaterCost
      },
      total_estimated_cost: totalEstimatedCost,
      efficiency_rating: electricityKw <= 1.0 ? 'High' : electricityKw <= 1.5 ? 'Medium' : 'Low',
      environmental_impact: {
        co2_emissions_kg: electricityKw * 0.4, // Approximate CO2 emissions per kWh
        water_efficiency: waterLiters <= 40 ? 'Excellent' : waterLiters <= 60 ? 'Good' : 'Fair'
      }
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

  /**
   * Convert temperature string to number
   */
  private convertTemperatureToNumber(temp: string): number {
    const tempMap: Record<string, number> = {
      'cold': 20,
      'warm': 40,
      'hot': 60
    };
    return tempMap[temp.toLowerCase()] || 40;
  }

  /**
   * Get default spin speed for cycle type
   */
  private getDefaultSpinSpeed(cycle: string): number {
    const speedMap: Record<string, number> = {
      'quick': 800,
      'delicates': 600,
      'eco': 1000,
      'normal': 1000,
      'heavy': 1200
    };
    return speedMap[cycle.toLowerCase()] || 1000;
  }

  /**
   * Get default water level for cycle type
   */
  private getDefaultWaterLevel(cycle: string): 'low' | 'medium' | 'high' {
    const levelMap: Record<string, 'low' | 'medium' | 'high'> = {
      'quick': 'low',
      'delicates': 'medium',
      'eco': 'low',
      'normal': 'medium',
      'heavy': 'high'
    };
    return levelMap[cycle.toLowerCase()] || 'medium';
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

  const getConsumptionFunction = {
    name: "get_consumption",
    description: "Calculate electricity and water consumption for wash settings without starting the wash cycle",
    parameters: {
      type: "object",
      properties: {
        program: {
          type: "string",
          description: "Wash program name",
          enum: ["Quick Wash", "Daily", "Heavy", "Delicate", "Eco", "Whites", "Colors", "Sportswear", "Normal"]
        },
        temperature: {
          type: "number",
          description: "Water temperature in Celsius"
        },
        spin_speed: {
          type: "number",
          description: "Spin speed in RPM"
        },
        duration: {
          type: "number",
          description: "Duration in minutes"
        },
        water_level: {
          type: "string",
          description: "Water level setting",
          enum: ["low", "medium", "high"]
        },
        extra_rinse: {
          type: "boolean",
          description: "Whether extra rinse is enabled"
        },
        pre_wash: {
          type: "boolean",
          description: "Whether pre-wash is enabled"
        }
      },
      required: []
    }
  };

  return [
    startWashFunction,
    stopWashFunction,
    getWashStatusFunction,
    getCurrentCyclesFunction,
    getComponentStatesFunction,
    getConsumptionFunction
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
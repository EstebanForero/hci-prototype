/**
 * Validation Utilities for Gemini Live Integration
 * Provides robust validation and error checking
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export class GeminiValidator {
  /**
   * Validate API key format
   */
  static validateApiKey(apiKey: string): ValidationResult {
    if (!apiKey || typeof apiKey !== 'string') {
      return { isValid: false, error: 'API key is required and must be a string' };
    }

    if (apiKey === 'your_gemini_api_key_here' || apiKey === '') {
      return { isValid: false, error: 'Please set your actual Gemini API key' };
    }

    if (apiKey.length < 10) {
      return { isValid: false, error: 'API key appears to be too short' };
    }

    return { isValid: true };
  }

  /**
   * Validate WebSocket URL
   */
  static validateWebSocketUrl(url: string): ValidationResult {
    if (!url || typeof url !== 'string') {
      return { isValid: false, error: 'WebSocket URL is required' };
    }

    try {
      new URL(url);
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `Invalid WebSocket URL: ${error}` };
    }
  }

  /**
   * Validate audio context state
   */
  static validateAudioContext(audioContext: AudioContext): ValidationResult {
    if (!audioContext) {
      return { isValid: false, error: 'Audio context is not available' };
    }

    if (audioContext.state === 'closed') {
      return { isValid: false, error: 'Audio context is closed' };
    }

    if (audioContext.state === 'suspended') {
      return { isValid: false, warnings: ['Audio context is suspended and will need to be resumed'] };
    }

    return { isValid: true };
  }

  /**
   * Validate base64 audio data
   */
  static validateBase64Audio(base64Audio: string): ValidationResult {
    if (!base64Audio || typeof base64Audio !== 'string') {
      return { isValid: false, error: 'Base64 audio data is required' };
    }

    if (base64Audio.length < 100) {
      return { isValid: false, error: 'Base64 audio data is too short to be valid' };
    }

    // Check for valid base64 pattern
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Audio)) {
      return { isValid: false, error: 'Base64 audio data contains invalid characters' };
    }

    return { isValid: true };
  }

  /**
   * Validate PCM data array
   */
  static validatePCMData(pcmData: Int16Array): ValidationResult {
    if (!pcmData) {
      return { isValid: false, error: 'PCM data is null or undefined' };
    }

    if (pcmData.length === 0) {
      return { isValid: false, error: 'PCM data is empty' };
    }

    if (pcmData.length % 2 !== 0) {
      return {
        isValid: false,
        warnings: ['PCM data length is not even, which may indicate processing issues']
      };
    }

    // Check for potential clipping
    let maxAbsValue = 0;
    for (let i = 0; i < pcmData.length; i++) {
      maxAbsValue = Math.max(maxAbsValue, Math.abs(pcmData[i]));
    }

    if (maxAbsValue >= 32767) {
      return {
        isValid: true,
        warnings: ['PCM data contains values at maximum range, potential clipping']
      };
    }

    return { isValid: true };
  }

  /**
   * Validate audio buffer
   */
  static validateAudioBuffer(audioBuffer: AudioBuffer): ValidationResult {
    if (!audioBuffer) {
      return { isValid: false, error: 'Audio buffer is null' };
    }

    if (audioBuffer.numberOfChannels === 0) {
      return { isValid: false, error: 'Audio buffer has no channels' };
    }

    if (audioBuffer.sampleRate <= 0) {
      return { isValid: false, error: 'Audio buffer has invalid sample rate' };
    }

    if (audioBuffer.duration <= 0) {
      return { isValid: false, error: 'Audio buffer has invalid duration' };
    }

    return { isValid: true };
  }

  /**
   * Validate tool call parameters
   */
  static validateToolCall(toolName: string, args: any): ValidationResult {
    if (!toolName || typeof toolName !== 'string') {
      return { isValid: false, error: 'Tool name is required' };
    }

    if (!args || typeof args !== 'object') {
      return { isValid: false, error: 'Tool arguments must be an object' };
    }

    // Tool-specific validation
    switch (toolName) {
      case 'start_wash':
        if (args.clothing_type && typeof args.clothing_type === 'string') {
          const validTypes = ['everyday', 'delicates', 'heavy_duty', 'towels', 'sportswear', 'mixed'];
          if (!validTypes.includes(args.clothing_type)) {
            return {
              isValid: false,
              warnings: [`Unknown clothing type: ${args.clothing_type}`]
            };
          }
        }
        break;

      case 'stop_wash':
        // Stop wash can be called with just a reason
        break;

      case 'get_wash_status':
      case 'get_current_cycles':
      case 'get_component_states':
        // These tools can be called with minimal parameters
        break;

      default:
        return {
          isValid: false,
          error: `Unknown tool: ${toolName}`
        };
    }

    return { isValid: true };
  }

  /**
   * Validate WebSocket message structure
   */
  static validateWebSocketMessage(message: any): ValidationResult {
    if (!message || typeof message !== 'object') {
      return { isValid: false, error: 'WebSocket message must be an object' };
    }

    // Check for common response structures
    if (message.error) {
      return { isValid: false, error: `WebSocket error: ${message.error.message || message.error}` };
    }

    return { isValid: true };
  }

  /**
   * Validate system status
   */
  static validateSystemStatus(systemStatus: any): ValidationResult {
    if (!systemStatus || typeof systemStatus !== 'object') {
      return { isValid: false, error: 'System status must be an object' };
    }

    const requiredFields = ['overallHealth', 'isActive', 'currentCycle', 'totalCyclesScheduled', 'timeRemaining', 'parts'];
    const missingFields = requiredFields.filter(field => !(field in systemStatus));

    if (missingFields.length > 0) {
      return {
        isValid: false,
        error: `Missing required system status fields: ${missingFields.join(', ')}`
      };
    }

    if (typeof systemStatus.overallHealth !== 'number' ||
        systemStatus.overallHealth < 0 ||
        systemStatus.overallHealth > 100) {
      return {
        isValid: false,
        error: 'overallHealth must be a number between 0 and 100'
      };
    }

    if (typeof systemStatus.isActive !== 'boolean') {
      return { isValid: false, error: 'isActive must be a boolean' };
    }

    if (!Array.isArray(systemStatus.parts)) {
      return { isValid: false, error: 'parts must be an array' };
    }

    return { isValid: true };
  }
}
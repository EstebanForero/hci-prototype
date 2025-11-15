/**
 * Modular Wash Program Manager
 * Provides utilities for creating and managing wash configurations
 */

import { WashConfig } from '../types/gemini';

export interface WashProgram {
  name: string;
  displayName: string;
  description: string;
  config: WashConfig;
}

// Predefined wash programs for cotton fabrics
export const COTTON_PROGRAMS: Record<string, WashProgram> = {
  'standard': {
    name: 'standard',
    displayName: 'Standard Cotton',
    description: 'Everyday cotton clothing',
    config: {
      program: 'standard',
      temperature: 40,
      spinSpeed: 800,
      duration: 120,
      waterLevel: 'medium',
      extraRinse: false,
      preWash: false,
      clothing_type: 'cotton',
      temperature_setting: '40°C',
      cycle: 'normal',
      extra_rinse: false,
      pre_soak: false
    }
  },
  'delicate': {
    name: 'delicate',
    displayName: 'Delicate Cotton',
    description: 'Delicate cotton, silk or wool items',
    config: {
      program: 'delicate',
      temperature: 30,
      spinSpeed: 600,
      duration: 90,
      waterLevel: 'low',
      extraRinse: true,
      preWash: false,
      clothing_type: 'cotton_delicate',
      temperature_setting: '30°C',
      cycle: 'gentle',
      extra_rinse: true,
      pre_soak: false
    }
  },
  'white': {
    name: 'white',
    displayName: 'White Cotton',
    description: 'White cotton items that can handle hot water',
    config: {
      program: 'white',
      temperature: 60,
      spinSpeed: 1200,
      duration: 150,
      waterLevel: 'high',
      extraRinse: false,
      preWash: false,
      clothing_type: 'cotton_white',
      temperature_setting: '60°C',
      cycle: 'normal',
      extra_rinse: false,
      pre_soak: false
    }
  },
  'color': {
    name: 'color',
    displayName: 'Color Cotton',
    description: 'Colored cotton items to prevent bleeding',
    config: {
      program: 'color',
      temperature: 40,
      spinSpeed: 800,
      duration: 120,
      waterLevel: 'medium',
      extraRinse: false,
      preWash: false,
      clothing_type: 'cotton_color',
      temperature_setting: '40°C',
      cycle: 'normal',
      extra_rinse: false,
      pre_soak: false
    }
  },
  'sport': {
    name: 'sport',
    displayName: 'Sport Cotton',
    description: 'Active wear cotton clothing',
    config: {
      program: 'sport',
      temperature: 40,
      spinSpeed: 1200,
      duration: 90,
      waterLevel: 'medium',
      extraRinse: true,
      preWash: false,
      clothing_type: 'cotton_sport',
      temperature_setting: '40°C',
      cycle: 'intensive',
      extra_rinse: true,
      pre_soak: false
    }
  }
};

// Predefined wash programs for nylon fabrics
export const NYLON_PROGRAMS: Record<string, WashProgram> = {
  'standard': {
    name: 'standard',
    displayName: 'Standard Nylon',
    description: 'Everyday nylon clothing and items',
    config: {
      program: 'standard',
      temperature: 30,
      spinSpeed: 600,
      duration: 60,
      waterLevel: 'low',
      extraRinse: false,
      preWash: false,
      clothing_type: 'nylon',
      temperature_setting: '30°C',
      cycle: 'gentle',
      extra_rinse: false,
      pre_soak: false
    }
  },
  'delicate': {
    name: 'delicate',
    displayName: 'Delicate Nylon',
    description: 'Fine nylon fabrics, hosiery, lingerie',
    config: {
      program: 'delicate',
      temperature: 30,
      spinSpeed: 400,
      duration: 45,
      waterLevel: 'low',
      extraRinse: true,
      preWash: false,
      clothing_type: 'nylon_delicate',
      temperature_setting: '30°C',
      cycle: 'extra_gentle',
      extra_rinse: true,
      pre_soak: false
    }
  },
  'sport': {
    name: 'sport',
    displayName: 'Sport Nylon',
    description: 'Active wear nylon, swimwear, athletic gear',
    config: {
      program: 'sport',
      temperature: 30,
      spinSpeed: 800,
      duration: 50,
      waterLevel: 'medium',
      extraRinse: true,
      preWash: false,
      clothing_type: 'nylon_sport',
      temperature_setting: '30°C',
      cycle: 'normal',
      extra_rinse: true,
      pre_soak: false
    }
  },
  'waterproof': {
    name: 'waterproof',
    displayName: 'Waterproof Nylon',
    description: 'Water-resistant nylon jackets, outdoor gear',
    config: {
      program: 'waterproof',
      temperature: 30,
      spinSpeed: 400,
      duration: 40,
      waterLevel: 'low',
      extraRinse: false,
      preWash: false,
      clothing_type: 'nylon_waterproof',
      temperature_setting: '30°C',
      cycle: 'hand_wash',
      extra_rinse: false,
      pre_soak: false
    }
  }
};

/**
 * Analyzes QR code text and returns appropriate wash recommendation
 */
export function analyzeQRTextForWashing(qrText: string): WashProgram | null {
  const text = qrText.toLowerCase();

  // Check for cotton
  if (text.includes('cotton')) {
    // Check for specific cotton types
    if (text.includes('delicate') || text.includes('silk') || text.includes('wool')) {
      return COTTON_PROGRAMS.delicate;
    }

    if (text.includes('white') || text.includes('bleach')) {
      return COTTON_PROGRAMS.white;
    }

    if (text.includes('color') || text.includes('dark')) {
      return COTTON_PROGRAMS.color;
    }

    if (text.includes('sport') || text.includes('active')) {
      return COTTON_PROGRAMS.sport;
    }

    // Default to standard cotton
    return COTTON_PROGRAMS.standard;
  }

  // Check for nylon
  if (text.includes('nylon')) {
    // Check for specific nylon types
    if (text.includes('delicate') || text.includes('lingerie') || text.includes('hosiery')) {
      return NYLON_PROGRAMS.delicate;
    }

    if (text.includes('sport') || text.includes('swim') || text.includes('athletic')) {
      return NYLON_PROGRAMS.sport;
    }

    if (text.includes('waterproof') || text.includes('outdoor') || text.includes('jacket')) {
      return NYLON_PROGRAMS.waterproof;
    }

    // Default to standard nylon
    return NYLON_PROGRAMS.standard;
  }

  return null;
}

/**
 * Creates a human-readable wash recommendation string
 */
export function createWashRecommendation(qrText: string): string {
  const program = analyzeQRTextForWashing(qrText);

  if (!program) {
    return 'Standard Program - 30°C, normal cycle';
  }

  return `${program.displayName} Program - ${program.config.temperature_setting}, ${program.config.cycle} cycle${program.config.spinSpeed ? `, ${program.config.spinSpeed} RPM` : ''}`;
}

/**
 * Modular wash starter function
 */
export interface WashStarterCallbacks {
  onStartWash: (config: WashConfig) => void;
  onError?: (error: string) => void;
}

export function startWashFromQR(qrText: string, callbacks: WashStarterCallbacks): boolean {
  const program = analyzeQRTextForWashing(qrText);

  if (!program) {
    callbacks.onError?.('No cotton-specific program found in QR code');
    return false;
  }

  console.log(`🧺 Starting wash from QR: ${program.displayName}`);
  console.log('📋 Configuration:', program.config);

  try {
    callbacks.onStartWash(program.config);
    return true;
  } catch (error) {
    callbacks.onError?.(`Failed to start wash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Get all available cotton programs
 */
export function getCottonPrograms(): WashProgram[] {
  return Object.values(COTTON_PROGRAMS);
}

/**
 * Get a specific cotton program by name
 */
export function getCottonProgram(name: string): WashProgram | null {
  return COTTON_PROGRAMS[name] || null;
}
#!/usr/bin/env bun

import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GeminiConnectionManager } from './src/services/geminiConnectionManager';
import { ConnectionCallbacks } from './src/types/voice';

const MP3_PATH = './test-record.mp3';
const OUTPUT_WAV = 'test_live_response.wav';

function loadApiKey(): string {
  if (process.env.VITE_GEMINI_API_KEY) {
    return process.env.VITE_GEMINI_API_KEY;
  }

  if (existsSync('.env')) {
    const lines = readFileSync('.env', 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key === 'VITE_GEMINI_API_KEY') {
        const value = rest.join('=').trim();
        process.env.VITE_GEMINI_API_KEY = value;
        return value;
      }
    }
  }

  throw new Error('VITE_GEMINI_API_KEY not found in environment or .env file.');
}

function base64ToPCM(base64Audio: string): Int16Array {
  const buffer = Buffer.from(base64Audio, 'base64');
  return new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Int16Array.BYTES_PER_ELEMENT);
}

function createWavFile(pcmData: Int16Array, sampleRate: number = 24000): Buffer {
  const numberOfChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numberOfChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * 2;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numberOfChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < pcmData.length; i++) {
    buffer.writeInt16LE(pcmData[i], offset);
    offset += 2;
  }
  return buffer;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function convertMp3ToPCM(): Buffer {
  if (!existsSync(MP3_PATH)) {
    throw new Error(`Missing ${MP3_PATH}. Please add your voice sample first.`);
  }

  const tempRaw = join(tmpdir(), `gemini-audio-${Date.now()}.raw`);
  const ffmpegResult = spawnSync('ffmpeg', [
    '-y',
    '-i',
    MP3_PATH,
    '-ac',
    '1',
    '-ar',
    '16000',
    '-f',
    's16le',
    tempRaw
  ], { stdio: 'inherit' });

  if (ffmpegResult.status !== 0) {
    throw new Error('Failed to convert MP3 to PCM. Ensure ffmpeg is installed and accessible.');
  }

  const pcmBuffer = readFileSync(tempRaw);
  unlinkSync(tempRaw);
  return pcmBuffer;
}

async function streamPCMThroughManager(manager: GeminiConnectionManager, pcmBuffer: Buffer) {
  const chunkSize = 4096;
  for (let offset = 0; offset < pcmBuffer.length; offset += chunkSize) {
    const chunk = pcmBuffer.slice(offset, offset + chunkSize);
    manager.sendAudio(Buffer.from(chunk).toString('base64'));
    await sleep(10);
  }
  manager.sendAudioStreamEnd();
}

async function runIntegrationTest() {
  const apiKey = loadApiKey();
  const pcmBuffer = convertMp3ToPCM();

  const audioChunks: string[] = [];
  let turnCompleteResolver: (() => void) | null = null;
  let turnCompleteTimeout: NodeJS.Timeout | null = null;
  const turnCompletePromise = new Promise<void>((resolve) => {
    turnCompleteResolver = () => {
      if (turnCompleteTimeout) {
        clearTimeout(turnCompleteTimeout);
        turnCompleteTimeout = null;
      }
      resolve();
    };

    turnCompleteTimeout = setTimeout(() => {
      console.log('⏱️ Timeout waiting for turn completion, finalizing with collected audio.');
      resolve();
    }, 15000);
  });

  let manager: GeminiConnectionManager;

  const connectionCallbacks: ConnectionCallbacks = {
    onReady: () => {},
    onError: (error) => {
      console.error('❌ Connection error:', error);
      process.exit(1);
    },
    onMessage: (message) => {
      if (message.text) {
        console.log(`🤖 ${message.text}`);
      }
    },
    onTranscription: (text) => {
      console.log(`🗣️ Transcript: ${text}`);
    },
    onToolCall: async (toolCalls: any[]) => {
      console.log('🛠️ Tool calls received:', toolCalls);
      const toolManager = manager.getToolManager();
      if (toolManager) {
        const responses = await toolManager.executeToolCalls(toolCalls);
        manager.sendToolResponse(responses);
      }
    },
    onAudioChunk: (audioData, _isFirst) => {
      audioChunks.push(audioData);
    },
    onTurnComplete: () => {
      console.log('🔄 Turn complete detected');
      turnCompleteResolver?.();
    }
  };

  const readyPromise = new Promise<void>((resolve) => {
    connectionCallbacks.onReady = () => {
      console.log('✅ Gemini connection ready');
      resolve();
    };
  });

  const dummyStatus = {
    overallHealth: 98,
    isActive: false,
    currentCycle: 0,
    totalCyclesScheduled: 0,
    timeRemaining: '0m',
    parts: []
  };

  manager = new GeminiConnectionManager(connectionCallbacks);

  const connected = await manager.connect(
    apiKey,
    dummyStatus,
    () => console.log('🧺 start_wash invoked'),
    reason => console.log('🧺 stop_wash invoked', reason),
    () => {}
  );

  if (!connected) {
    throw new Error('Failed to connect to Gemini Live API.');
  }

  await readyPromise;

  await streamPCMThroughManager(manager, pcmBuffer);
  await turnCompletePromise;
  manager.disconnect();

  if (audioChunks.length === 0) {
    console.log('⚠️ No audio response received.');
    return;
  }

  let totalSamples = 0;
  const segments: Int16Array[] = [];

  for (const chunk of audioChunks) {
    const pcm = base64ToPCM(chunk);
    segments.push(pcm);
    totalSamples += pcm.length;
  }

  const combined = new Int16Array(totalSamples);
  let offset = 0;
  for (const segment of segments) {
    combined.set(segment, offset);
    offset += segment.length;
  }

  const wavBuffer = createWavFile(combined, 24000);
  writeFileSync(OUTPUT_WAV, wavBuffer);
  console.log(`✅ Saved AI response to ${OUTPUT_WAV} (${(totalSamples / 24000).toFixed(2)}s)`);
}

runIntegrationTest().catch(error => {
  console.error('❌ Test run failed:', error);
  process.exit(1);
});

#!/usr/bin/env bun

import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUTPUT_WAV = 'test_direct_response.wav';
const MODEL_ID = 'gemini-2.5-flash-native-audio-preview-09-2025';
const VOICE_NAME = 'Kore';

function loadApiKey(): string {
  if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
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

function extractAudioChunks(message: LiveServerMessage): string[] {
  const chunks: string[] = [];
  const serverContent = (message as any).serverContent || (message as any).server_content;
  const parts = serverContent?.modelTurn?.parts || serverContent?.model_turn?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      const inlineData = part.inlineData || part.inline_data;
      if (
        inlineData?.data &&
        typeof inlineData.data === 'string' &&
        inlineData.mimeType?.includes('audio/pcm')
      ) {
        chunks.push(inlineData.data);
      }
    }
  }
  return chunks;
}

async function waitForTurnComplete(queue: LiveServerMessage[]): Promise<{chunks: string[], transcript?: string}> {
  const collectedChunks: string[] = [];
  let transcript: string | undefined;

  let done = false;
  while (!done) {
    while (queue.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const message = queue.shift()!;
    const serverContent = (message as any).serverContent || (message as any).server_content;

    if (serverContent?.modelTurn || serverContent?.model_turn) {
      collectedChunks.push(...extractAudioChunks(message));
    }

    const outputTranscription = serverContent?.outputTranscription?.text
      || serverContent?.output_transcription?.text;
    if (outputTranscription) {
      transcript = outputTranscription;
    }

    if (serverContent?.turnComplete || serverContent?.turn_complete) {
      done = true;
    }
  }

  return { chunks: collectedChunks, transcript };
}

async function main() {
  const apiKey = loadApiKey();

  const ai = new GoogleGenAI({ apiKey });
  const responseQueue: LiveServerMessage[] = [];

  const session = await ai.live.connect({
    model: MODEL_ID,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: VOICE_NAME }
        }
      },
      outputAudioTranscription: {},
      realtimeInputConfig: {
        automaticActivityDetection: {}
      }
    },
    callbacks: {
      onopen: () => console.log('🔌 Live session opened'),
      onmessage: (message: LiveServerMessage) => responseQueue.push(message),
      onerror: (error: ErrorEvent) => console.error('❌ Live session error:', error.message),
      onclose: (event: CloseEvent) => console.log(`🔒 Live session closed: ${event.reason || event.code}`)
    }
  });

  console.log('📤 Sending poem request text to Gemini...');
  await session.sendClientContent({
    turns: [{
      role: 'user',
      parts: [{
        text: 'Please recite an inspiring poem about reliable washing machines that save energy. Speak clearly for audio testing.'
      }]
    }],
    turnComplete: true
  });

  const { chunks, transcript } = await waitForTurnComplete(responseQueue);

  session.close();

  if (chunks.length === 0) {
    console.log('⚠️ No audio response received.');
    return;
  }

  let totalSamples = 0;
  const segments: Int16Array[] = [];
  for (const chunk of chunks) {
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
  if (transcript) {
    console.log(`📝 Transcript: ${transcript}`);
  }
}

main().catch(error => {
  console.error('❌ Direct test failed:', error);
  process.exit(1);
});

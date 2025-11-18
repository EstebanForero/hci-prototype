#!/usr/bin/env bun

import WebSocket from 'ws';
import { writeFileSync } from 'fs';

const API_KEY = process.env.VITE_GEMINI_API_KEY || (() => {
  const fs = require('fs');
  if (fs.existsSync('.env')) {
    const lines = fs.readFileSync('.env', 'utf8').split(/\r?\n/);
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
})();

const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;
const OUTPUT_WAV = 'test_ws_response.wav';

function base64ToPCM(base64Audio: string): Int16Array {
  const binaryString = Buffer.from(base64Audio, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
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

function extractAudioFromMessage(message: any): string[] {
  const chunks: string[] = [];
  const parts = message?.server_content?.model_turn?.parts || [];
  for (const part of parts) {
    const inlineData = part.inline_data;
    if (inlineData?.data && typeof inlineData.data === 'string' && inlineData.mime_type?.includes('audio/pcm')) {
      chunks.push(inlineData.data);
    }
  }
  return chunks;
}

async function runWebSocketPoemTest() {
  console.log('🚀 Starting manual WebSocket Live test');

  return new Promise<void>((resolve) => {
    const ws = new WebSocket(WS_URL);
    const audioChunks: string[] = [];
    let setupSent = false;

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      const setupMessage = {
        setup: {
          model: 'models/gemini-2.5-flash-native-audio-preview-09-2025',
          generation_config: {
            response_modalities: ['AUDIO'],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: { voice_name: 'Kore' }
              }
            }
          },
          system_instruction: {
            parts: [{
              text: 'You are a friendly assistant. Speak clearly for audio testing.'
            }]
          }
        }
      };
      ws.send(JSON.stringify(setupMessage));
      setupSent = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.setup_complete && setupSent) {
          console.log('📤 Sending poem text request...');
          ws.send(JSON.stringify({
            realtime_input: {
              text: 'Please recite a short poem about reliable washing machines that save water and energy.'
            }
          }));
          return;
        }

        if (message.error) {
          console.error('❌ Error from Gemini:', message.error);
          return;
        }

        const chunks = extractAudioFromMessage(message);
        if (chunks.length > 0) {
          audioChunks.push(...chunks);
          console.log(`🎧 Received ${chunks.length} chunk(s) (total ${audioChunks.length})`);
        }

        if (message.server_content?.turn_complete) {
          console.log('🔄 Turn complete - finishing');
          ws.close();
        }
      } catch (err) {
        console.error('❌ Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      console.log('🔒 WebSocket closed');
      if (audioChunks.length === 0) {
        console.log('⚠️ No audio chunks received.');
        return resolve();
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
      console.log(`✅ Saved WebSocket response to ${OUTPUT_WAV} (${(totalSamples / 24000).toFixed(2)}s)`);
      resolve();
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      resolve();
    });
  });
}

runWebSocketPoemTest().catch(error => {
  console.error('❌ test-ws failed:', error);
  process.exit(1);
});

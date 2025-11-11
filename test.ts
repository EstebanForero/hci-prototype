#!/usr/bin/env bun

import WebSocket from 'ws';
import { writeFileSync } from 'fs';

// Configuration
const API_KEY = process.env.VITE_GEMINI_API_KEY || 'AIzaSyCT2H5X4m0za4vRWW2PnVUyrXVzJP_RN-0';
const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

// Convert base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Create WAV file from PCM data
function createWavFile(pcmData: Int16Array, sampleRate: number = 24000): Buffer {
    const numberOfChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numberOfChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length * 2;
    const fileSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(fileSize, 4);
    buffer.write('WAVE', 8);

    // fmt chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // chunk size
    buffer.writeUInt16LE(1, 20); // audio format (PCM)
    buffer.writeUInt16LE(numberOfChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < pcmData.length; i++) {
        buffer.writeInt16LE(pcmData[i], offset);
        offset += 2;
    }

    return buffer;
}

// Main test function
async function testGeminiLiveAudio() {
    console.log('🚀 Starting Gemini Live Audio Test - Memory Buffer Version');

    return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        let audioDataReceived = false;
        let testComplete = false;
        let audioChunkCount = 0;
        let allAudioChunks: string[] = []; // Store all chunks in memory

        // Timeout after 60 seconds
        const timeout = setTimeout(() => {
            if (!testComplete && audioDataReceived) {
                console.log('⏰ Test timeout - processing all collected chunks');
                processAllChunks();
            } else {
                console.log('⏰ Test timeout - no audio received');
                ws.close();
                resolve();
            }
        }, 60000);

        // Function to process all collected chunks at once
        const processAllChunks = () => {
            console.log(`🎵 Processing all ${allAudioChunks.length} collected audio chunks...`);

            if (allAudioChunks.length === 0) {
                console.log('❌ No audio chunks to process');
                ws.close();
                resolve();
                return;
            }

            // Combine all chunks into one complete audio buffer
            let totalSamples = 0;
            const allPcmData: Int16Array[] = [];

            // Convert each chunk to PCM and store
            for (let i = 0; i < allAudioChunks.length; i++) {
                const chunk = allAudioChunks[i];
                const binaryString = atob(chunk);
                const bytes = new Uint8Array(binaryString.length);

                for (let j = 0; j < binaryString.length; j++) {
                    bytes[j] = binaryString.charCodeAt(j);
                }

                const pcmData = new Int16Array(bytes.buffer.slice(0, bytes.length));
                allPcmData.push(pcmData);
                totalSamples += pcmData.length;

                console.log(`🎵 Chunk ${i + 1}: ${pcmData.length} samples, total so far: ${totalSamples}`);
            }

            // Combine all PCM data into one buffer
            const combinedPcmData = new Int16Array(totalSamples);
            let offset = 0;
            for (const pcmData of allPcmData) {
                combinedPcmData.set(pcmData, offset);
                offset += pcmData.length;
            }

            // Create one complete WAV file
            const wavBuffer = createWavFile(combinedPcmData, 24000);
            writeFileSync('test_complete_response.wav', wavBuffer);

            console.log(`✅ Complete! Saved ${totalSamples} samples as test_complete_response.wav`);
            console.log(`🎵 Duration: ${(totalSamples / 24000).toFixed(2)} seconds`);
            console.log(`🎵 Total chunks: ${allAudioChunks.length}`);

            testComplete = true;
            clearTimeout(timeout);
            ws.close();
            resolve();
        };

        ws.on('open', () => {
            console.log('✅ WebSocket connected');

            // Send setup message
            const setupMessage = {
                setup: {
                    model: "models/gemini-2.5-flash-native-audio-preview-09-2025",
                    generation_config: {
                        response_modalities: ["AUDIO"],
                        speech_config: {
                            voice_config: {
                                prebuilt_voice_config: {
                                    voice_name: "Kore"
                                }
                            }
                        }
                    },
                    system_instruction: {
                        parts: [{
                            text: "Please respond with clear, articulate speech. When I ask you to recite something, speak at a moderate pace with good pronunciation and proper pauses. Focus on voice clarity and audio quality."
                        }]
                    }
                }
            };

            console.log('📤 Sending setup message...');
            ws.send(JSON.stringify(setupMessage));

            // Send a text message to trigger longer audio response
            setTimeout(() => {
                const textMessage = {
                    realtime_input: {
                        text: "Please recite the poem 'The Road Not Taken' by Robert Frost. I want to test audio quality over a longer duration. Please speak clearly at a moderate pace with proper pauses between stanzas. This will help me detect any audio degradation over time."
                    }
                };
                console.log('📤 Sending text message requesting poem...');
                ws.send(JSON.stringify(textMessage));
            }, 2000);
        });

        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('📨 Received message type:', Object.keys(message));

                // Handle setup complete
                if (message.setup_complete) {
                    console.log('✅ Setup complete');
                    return;
                }

                // Handle errors
                if (message.error) {
                    console.error('❌ Error:', message.error);
                    return;
                }

                // Handle turn complete - process all collected chunks
                if (message.server_content?.turn_complete) {
                    console.log('🔄 Turn complete detected - processing all collected chunks');
                    testComplete = true;
                    clearTimeout(timeout);
                    processAllChunks();
                    return;
                }

                // Look for audio content more comprehensively
                const extractAudioFromMessage = (msg: any): string[] => {
                    const foundAudio: string[] = [];

                    // Helper function to search recursively for audio data
                    const searchRecursively = (obj: any, path: string = '') => {
                        if (obj === null || obj === undefined) return;

                        // Check for common audio data fields
                        const audioFields = ['data', 'audio_data', 'audio', 'inline_data', 'inlineData'];
                        for (const field of audioFields) {
                            if (obj[field] && typeof obj[field] === 'string' && obj[field].length > 100) {
                                foundAudio.push(obj[field]);
                                console.log(`🎵 Found audio at ${path}.${field}: ${obj[field].length} chars`);
                            }
                        }

                        // Recursively search objects and arrays
                        if (typeof obj === 'object' && !Array.isArray(obj)) {
                            for (const key in obj) {
                                if (obj.hasOwnProperty(key)) {
                                    searchRecursively(obj[key], path ? `${path}.${key}` : key);
                                }
                            }
                        } else if (Array.isArray(obj)) {
                            for (let i = 0; i < obj.length; i++) {
                                searchRecursively(obj[i], `${path}[${i}]`);
                            }
                        }
                    };

                    searchRecursively(msg);
                    return foundAudio;
                };

                // Extract all audio chunks from this message
                const audioChunksInMessage = extractAudioFromMessage(message);

                // Store all found chunks
                for (const audioData of audioChunksInMessage) {
                    audioChunkCount++;
                    allAudioChunks.push(audioData);
                    audioDataReceived = true;
                    console.log(`🎵 Stored chunk #${audioChunkCount} (total: ${allAudioChunks.length} chunks)`);
                }

                // Also check the base64 pattern matching as fallback
                if (audioChunksInMessage.length === 0) {
                    const messageStr = JSON.stringify(message);
                    const base64Matches = messageStr.match(/[A-Za-z0-9+/]{40,}={0,2}/g);
                    if (base64Matches) {
                        console.log('🔍 Found potential base64 strings:', base64Matches.length);

                        // Store all base64 matches as audio chunks
                        for (let i = 0; i < base64Matches.length; i++) {
                            const match = base64Matches[i];
                            if (match.length > 100) { // Only store substantial chunks
                                audioChunkCount++;
                                allAudioChunks.push(match);
                                audioDataReceived = true;
                                console.log(`🎵 Stored base64 chunk #${audioChunkCount}: ${match.length} chars`);
                            }
                        }
                    }
                }

                // If no audio found, log message structure for debugging
                if (!audioDataReceived) {
                    console.log('🔍 No audio found in this message');
                    console.log('🔍 Message keys:', Object.keys(message));
                }
            } catch (error) {
                console.error('❌ Error processing message:', error);
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
            clearTimeout(timeout);
            reject(error);
        });

        ws.on('close', (code, reason) => {
            console.log('🔌 WebSocket closed:', code, reason.toString());
            clearTimeout(timeout);

            if (!testComplete) {
                console.log('⚠️ Test completed without finding audio');
                resolve();
            }
        });
    });
}

// Run the test
testGeminiLiveAudio()
    .then(() => {
        console.log('🏁 Test finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Test failed:', error);
        process.exit(1);
    });
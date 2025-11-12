/**
 * ChatMessages Component for Gemini Live
 * Displays conversation history and live transcripts
 */

import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { ChatMessage } from '../../types/gemini';

interface ChatMessagesProps {
  responses: ChatMessage[];
  transcript: string;
  isSDKReady: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  className?: string;
}

export default function ChatMessages({
  responses,
  transcript,
  isSDKReady,
  messagesEndRef,
  className = ''
}: ChatMessagesProps) {
  return (
    <div className={`h-64 overflow-y-auto p-4 space-y-3 ${className}`}>
      {responses.length === 0 ? (
        <div className="text-center py-8">
          <Bot className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">
            Click the mic button to start talking
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Ask me about system health, start wash cycles, or component status
          </p>
          {isSDKReady && (
            <p className="text-green-400 text-xs mt-2">
              ✅ Gemini Live API connected
            </p>
          )}
        </div>
      ) : (
        responses.map((response, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${response.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-3 rounded-xl ${
              response.type === 'user'
                ? 'bg-blue-500/20 border border-blue-500/30 text-blue-100'
                : 'bg-gray-800/50 border border-gray-700/30 text-gray-100'
            }`}>
              <p className="text-sm">{response.text}</p>
              <p className="text-xs opacity-60 mt-1">
                {response.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </motion.div>
        ))
      )}

      {/* Live transcript */}
      {transcript && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="max-w-[80%] p-3 rounded-xl bg-gray-800/30 border border-gray-700/20 text-gray-300">
            <p className="text-sm italic">{transcript}</p>
          </div>
        </motion.div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
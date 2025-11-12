/**
 * Custom hook for managing Gemini Live state
 */

import { useState, useCallback } from 'react';
import { GeminiLiveState, ChatMessage } from '../types/gemini';

export function useGeminiLiveState() {
  const [state, setState] = useState<GeminiLiveState>({
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    isSDKReady: false,
    transcript: '',
    responses: [],
    volume: 0.8,
    isSettingsOpen: false,
    wakeWordEnabled: true,
    autoStartEnabled: false,
    error: null,
    textInput: '',
    useTextInput: false,
    audioLevel: 0,
    isAudioTesting: false,
    testResults: [],
    debugLogsEnabled: false
  });

  const updateState = useCallback((updates: Partial<GeminiLiveState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setListening = useCallback((isListening: boolean) => {
    updateState({ isListening });
  }, [updateState]);

  const setSpeaking = useCallback((isSpeaking: boolean) => {
    updateState({ isSpeaking });
  }, [updateState]);

  const setProcessing = useCallback((isProcessing: boolean) => {
    updateState({ isProcessing });
  }, [updateState]);

  const setSDKReady = useCallback((isSDKReady: boolean) => {
    updateState({ isSDKReady });
  }, [updateState]);

  const setTranscript = useCallback((transcript: string) => {
    updateState({ transcript });
  }, [updateState]);

  const addResponse = useCallback((message: string, type: 'user' | 'assistant') => {
    const newResponse: ChatMessage = {
      text: message,
      timestamp: new Date(),
      type
    };
    setState(prev => ({
      ...prev,
      responses: [...prev.responses, newResponse]
    }));
  }, []);

  const clearResponses = useCallback(() => {
    setState(prev => ({ ...prev, responses: [] }));
  }, []);

  const clearTranscript = useCallback(() => {
    updateState({ transcript: '' });
  }, [updateState]);

  const setVolume = useCallback((volume: number) => {
    updateState({ volume });
  }, [updateState]);

  const setSettingsOpen = useCallback((isSettingsOpen: boolean) => {
    updateState({ isSettingsOpen });
  }, [updateState]);

  const setWakeWordEnabled = useCallback((wakeWordEnabled: boolean) => {
    updateState({ wakeWordEnabled });
  }, [updateState]);

  const setAutoStartEnabled = useCallback((autoStartEnabled: boolean) => {
    updateState({ autoStartEnabled });
  }, [updateState]);

  const setError = useCallback((error: string | null) => {
    updateState({ error });
  }, [updateState]);

  const setTextInput = useCallback((textInput: string) => {
    updateState({ textInput });
  }, [updateState]);

  const setUseTextInput = useCallback((useTextInput: boolean) => {
    updateState({ useTextInput });
  }, [updateState]);

  const setAudioLevel = useCallback((audioLevel: number) => {
    updateState({ audioLevel });
  }, [updateState]);

  const setAudioTesting = useCallback((isAudioTesting: boolean) => {
    updateState({ isAudioTesting });
  }, [updateState]);

  const addTestResult = useCallback((result: string) => {
    setState(prev => ({
      ...prev,
      testResults: [...prev.testResults, result]
    }));
  }, []);

  const clearTestResults = useCallback(() => {
    setState(prev => ({ ...prev, testResults: [] }));
  }, []);

  const setDebugLogsEnabled = useCallback((debugLogsEnabled: boolean) => {
    updateState({ debugLogsEnabled });
  }, [updateState]);

  const resetState = useCallback(() => {
    setState({
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      isSDKReady: false,
      transcript: '',
      responses: [],
      volume: 0.8,
      isSettingsOpen: false,
      wakeWordEnabled: true,
      autoStartEnabled: false,
      error: null,
      textInput: '',
      useTextInput: false,
      audioLevel: 0,
      isAudioTesting: false,
      testResults: [],
      debugLogsEnabled: false
    });
  }, []);

  return {
    state,
    updateState,
    setListening,
    setSpeaking,
    setProcessing,
    setSDKReady,
    setTranscript,
    addResponse,
    clearResponses,
    clearTranscript,
    setVolume,
    setSettingsOpen,
    setWakeWordEnabled,
    setAutoStartEnabled,
    setError,
    setTextInput,
    setUseTextInput,
    setAudioLevel,
    setAudioTesting,
    addTestResult,
    clearTestResults,
    setDebugLogsEnabled,
    resetState
  };
}
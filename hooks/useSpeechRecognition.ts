import { useState, useEffect, useRef, useCallback } from 'react';

// Fix: Add TypeScript definitions for the Web Speech API.
// These types are not part of the standard TypeScript DOM library.
// By declaring them, we can use the SpeechRecognition API without TypeScript errors.
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: any; // Using 'any' for simplicity as it's not used in this hook
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

// Polyfill for browsers that only support webkitSpeechRecognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const useSpeechRecognition = () => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (!SpeechRecognition) {
      console.error('Speech Recognition API is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setText(finalTranscript + interimTranscript);
    };
    
    // Let the API's own events drive the `isListening` state for reliability.
    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error);
        // onend will be called automatically after an error.
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort(); // Use abort to prevent onresult from firing during cleanup.
    };
  }, []);

  const startListening = useCallback((lang: string = 'vi-VN') => {
    // Check component state to prevent multiple clicks from trying to start recognition multiple times.
    // The actual state change to `true` will be handled by the `onstart` event handler.
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.lang = lang;
      setText('');
      try {
        recognitionRef.current.start();
      } catch(e) {
        console.error("Error starting recognition:", e);
        // If start() throws, onstart/onend won't fire, so state remains correct.
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    // Check component state to prevent trying to stop something that is not running.
    // The actual state change to `false` will be handled by the `onend` event handler.
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return {
    text,
    isListening,
    startListening,
    stopListening,
    hasRecognitionSupport: !!SpeechRecognition,
    setText, // Allow parent to clear text
  };
};
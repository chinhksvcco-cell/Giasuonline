
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Message } from '../types';
import { Sender } from '../types';
import TutorAvatar from './TutorAvatar';
import UserAvatar from './UserAvatar';
import { GoogleGenAI, Session, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData } from '../utils/audioUtils';

declare global {
  interface Window {
    marked: {
      parse: (markdown: string) => string;
    };
    MathJax?: {
      typesetPromise: (elements?: (HTMLElement | Document)[]) => Promise<void>;
    };
  }
}

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY! });

/**
 * Converts LaTeX-like math expressions into a simplified, plain-text format.
 * This function follows a set of rules to make formulas more readable,
 * as if they were written by hand.
 * @param text The input string containing math expressions.
 * @returns A simplified string.
 */
const simplifyMathExpressions = (text: string): string => {
  if (!text) return '';

  let simplified = text;

  const wrapIfNeeded = (str: string) => (str.length > 1 && /[\s+\-*/^]/.test(str)) ? `(${str})` : str;
  const wrapRootContent = (str: string) => str.length > 1 ? `(${str})` : str;

  // Rule 7: Matrices (most complex, do first to avoid inner replacements)
  // \begin{bmatrix} a & b \\ c & d \end{bmatrix} → [ [a, b]; [c, d] ]
  simplified = simplified.replace(/\\begin{bmatrix}([\s\S]*?)\\end{bmatrix}/g, (_, content) => {
    const rows = content.trim().split(/\\\\|\\cr/).map(row => row.trim());
    const matrix = rows.map(row => row.split('&').map(cell => cell.trim()));
    const formattedMatrix = matrix.map(row => `[${row.join(', ')}]`).join('; ');
    return `[ ${formattedMatrix} ]`;
  });

  // Rule 4: Roots (before fractions)
  // \sqrt[n]{a} → √[n](a)
  simplified = simplified.replace(/\\sqrt\[([^\]]+)\]{([^}]+)}/g, (_, root, content) => {
      return `√[${root}](${content})`;
  });
  // \sqrt{x} → √x or √(x+1)
  simplified = simplified.replace(/\\sqrt{([^}]+)}/g, (_, content) => {
      return `√${wrapRootContent(content.trim())}`;
  });

  // Rule 2: Exponents (before fractions)
  // x^{2} → x^2 and a^{m+n} → a^(m+n)
  simplified = simplified.replace(/\^{([^}]+)}/g, (_, exponent) => {
      const exp = exponent.trim();
      return exp.length > 1 && !/^\w+$/.test(exp) ? `^(${exp})` : `^${exp}`;
  });
  
  // Rule 3: Fractions
  // \frac{a}{b} → a/b and \frac{x+1}{y-2} → (x+1)/(y-2)
  simplified = simplified.replace(/\\frac{([^}]+)}{([^}]+)}/g, (_, numerator, denominator) => {
      const num = wrapIfNeeded(numerator.trim());
      const den = wrapIfNeeded(denominator.trim());
      return `${num}/${den}`;
  });
  
  // Rule 6: Summations and Products
  // \sum_{i=1}^{n} i → Σ(i=1→n) i
  simplified = simplified.replace(/\\sum_{([^}]+)}^{([^}]+)}/g, (_, lower, upper) => `Σ(${lower.trim()}→${upper.trim()})`);
  // \prod_{k=1}^{n} k → Π(k=1→n) k
  simplified = simplified.replace(/\\prod_{([^}]+)}^{([^}]+)}/g, (_, lower, upper) => `Π(${lower.trim()}→${upper.trim()})`);

  // Rule 5: Integrals
  // \int f(x) dx → ∫ f(x) dx
  simplified = simplified.replace(/\\int/g, '∫');

  // General cleanup (Rule 1 and others)
  // \text{...}, \{, \}, etc.
  simplified = simplified.replace(/\\text{([^}]+)}/g, '$1');
  simplified = simplified.replace(/\\{|\\}|{|}/g, '');
  // LaTeX spacing commands
  simplified = simplified.replace(/\\,|\\;|\\!|\\quad|\\qquad/g, ' ');
  simplified = simplified.replace(/\\ /g, ' ');
  // Remove backslash from named commands like \alpha -> alpha
  simplified = simplified.replace(/\\([a-zA-Z]+)/g, '$1');
  // Remove any remaining stray backslashes
  simplified = simplified.replace(/\\/g, '');

  // Final formatting
  return simplified.replace(/\s+/g, ' ').trim();
};


const SpeakerIcon: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    {isPlaying ? 
        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9 9 0 0119 10a9 9 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7 7 0 0017 10a7 7 0 00-2.343-5.657 1 1 0 010-1.414zm-2.828 2.828a1 1 0 011.414 0A5 5 0 0115 10a5 5 0 01-1.757 3.536 1 1 0 11-1.414-1.414A3 3 0 0013 10a3 3 0 00-.757-2.121 1 1 0 010-1.414z" clipRule="evenodd" />
        :
        <path d="M5.586 3.586a1 1 0 011.414 0l4.293 4.293a1 1 0 010 1.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.172 10 5.586 7.414a1 1 0 010-1.414zM11 5a1 1 0 011-1h1a1 1 0 011 1v10a1 1 0 01-1 1h-1a1 1 0 01-1-1V5z" transform="translate(1,0)"/>
    }
    </svg>
);

const SpinnerIcon: React.FC = () => (
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const FileIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
);

interface ChatMessageProps {
  message: Message;
  subject: string;
  onSuggestionClick: (suggestionText: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, subject, onSuggestionClick }) => {
  const isAI = message.sender === Sender.AI;
  
  const [ttsState, setTtsState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const sessionRef = useRef<Session | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageRef.current && window.MathJax) {
      if (message.text && message.text.includes('$')) {
        window.MathJax.typesetPromise([messageRef.current]).catch((err) =>
          console.error('MathJax typesetting failed:', err)
        );
      }
    }
  }, [message.text]);

  const cleanupTts = useCallback(() => {
    sessionRef.current?.close();
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();
    sessionRef.current = null;
    nextStartTimeRef.current = 0;
    setTtsState('idle');
  }, []);

  useEffect(() => {
    return () => {
      cleanupTts();
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, [cleanupTts]);


  const handleTextToSpeech = async () => {
    if (ttsState !== 'idle') {
      cleanupTts();
      return;
    }

    setTtsState('loading');
    
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    await audioContextRef.current.resume();
    const audioContext = audioContextRef.current;

    const textForSpeech = simplifyMathExpressions(message.text);

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          sessionPromise.then(session => session.sendRealtimeInput({ text: textForSpeech }));
        },
        onmessage: async (msg: LiveServerMessage) => {
          const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioData) {
            // Fix(stale-closure): Use functional update to avoid stale state in closure. This comparison was causing a TS error.
            setTtsState(current => current === 'loading' ? 'playing' : current);

            const audioBuffer = await decodeAudioData(decode(audioData), audioContext, 24000, 1);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            source.onended = () => {
              sourcesRef.current.delete(source);
              if (sourcesRef.current.size === 0 && sessionRef.current === null) {
                setTtsState('idle');
              }
            };
            
            const currentTime = audioContext.currentTime;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
          }
          if (msg.serverContent?.turnComplete) {
            sessionPromise.then(session => session.close());
            sessionRef.current = null;
          }
        },
        onclose: () => {
           sessionRef.current = null;
           if (sourcesRef.current.size === 0) {
              setTtsState('idle');
           }
        },
        onerror: (e) => {
          console.error('TTS Error', e);
          cleanupTts();
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: `You are a text-to-speech service. Your task is to read the text provided by the user aloud. Use a clear, natural, and friendly female teacher's voice appropriate for tutoring students in Vietnam. Do not add any extra words, conversation, or introductory phrases. Only speak the text provided.`,
      }
    });
    sessionPromise.then(session => sessionRef.current = session).catch(e => {
        console.error("Failed to establish TTS session:", e);
        cleanupTts();
    });
  };

  const renderedHtml = (() => {
    const textToRender = message.text || '';
    if (!textToRender && !message.file && !message.imageIsLoading) return { __html: '' };

    // Use marked for both AI and user messages to support markdown.
    // MathJax will process the raw LaTeX within the output.
    if (typeof window.marked !== 'undefined') {
        return { __html: window.marked.parse(textToRender) };
    }

    // Fallback if marked is not available.
    // This won't render Markdown but will prevent XSS. MathJax won't run here.
    const escapedText = textToRender.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    return { __html: `<p class="whitespace-pre-wrap">${escapedText}</p>` };
  })();

  const hasContent = message.text || message.file || message.imageIsLoading;

  return (
    <div ref={messageRef} className={`flex flex-col ${isAI ? 'items-start animate-slide-in-left' : 'items-end animate-slide-in-right'}`}>
        <div className={`flex items-end gap-3 w-full ${isAI ? 'justify-start' : 'justify-end'}`}>
            {isAI && (
                <div className="flex-shrink-0 self-start">
                <TutorAvatar />
                </div>
            )}
            {hasContent && (
                 <div
                    className={`group relative max-w-xl lg:max-w-2xl px-4 py-3 rounded-2xl shadow-sm ${
                    isAI
                        ? 'bg-tutor-secondary text-gray-800 rounded-bl-none'
                        : 'bg-user-secondary text-gray-800 rounded-br-none'
                    }`}
                >
                    {message.imageIsLoading && (
                        <div className="mb-2 p-4 bg-white/50 rounded-lg flex items-center justify-center gap-3">
                            <div className="w-6 h-6 border-2 border-tutor-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm text-gray-600 font-medium">Cô đang vẽ hình minh họa...</p>
                        </div>
                    )}
                    
                    {message.file && (
                        <div className="mb-2">
                            {isAI ? (
                                message.file.mimeType.startsWith('image/') && <img src={message.file.data} alt="Hình minh họa" className="w-full max-h-96 rounded-lg object-contain bg-gray-200" />
                            ) : (
                                <div className="p-2 bg-white/50 border border-gray-300/50 rounded-lg flex items-center gap-2">
                                    {message.file.mimeType.startsWith('image/') ? (
                                        <img src={message.file.data} alt={message.file.name} className="w-20 h-20 rounded-md object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-user-primary/20 rounded-lg">
                                            <FileIcon className="w-8 h-8 text-user-primary" />
                                        </div>
                                    )}
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-medium text-gray-800 truncate">{message.file.name}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {message.text && <div className="markdown-content" dangerouslySetInnerHTML={renderedHtml} />}

                    {isAI && message.text && (
                    <button
                        onClick={handleTextToSpeech}
                        className="absolute -bottom-3 -right-3 bg-white p-1.5 rounded-full text-tutor-primary hover:bg-tutor-secondary shadow-md transition opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50 btn-press"
                        aria-label="Đọc văn bản"
                    >
                        {ttsState === 'loading' && <SpinnerIcon />}
                        {ttsState !== 'loading' && <SpeakerIcon isPlaying={ttsState === 'playing'} />}
                    </button>
                    )}
                </div>
            )}
            {!isAI && (
                <div className="flex-shrink-0 self-start">
                    <UserAvatar />
                </div>
            )}
        </div>
        
        {isAI && message.suggestions && message.suggestions.length > 0 && (
            <div className="pl-12 mt-2 flex flex-wrap items-start justify-start gap-2 animate-fade-in-suggestions">
                {message.suggestions.map((suggestion, index) => (
                    <button
                        key={index}
                        onClick={() => onSuggestionClick(suggestion)}
                        className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium hover:bg-purple-200 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 btn-press"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>
        )}
        <style>{`
            .mjx-chtml {
                font-size: 1.1em !important;
            }
            @keyframes fade-in-suggestions {
                from { opacity: 0; transform: translateY(5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-suggestions {
                animation: fade-in-suggestions 0.4s ease-out forwards;
            }
            /* Custom styles for markdown content for a professional look */
            .markdown-content > *:first-child {
                margin-top: 0;
            }
            .markdown-content > *:last-child {
                margin-bottom: 0;
            }
            .markdown-content p {
                margin-bottom: 0.75rem; /* 12px */
                line-height: 1.6;
            }
            .markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4 {
                font-weight: 700;
                color: #6d28d9; /* Corresponds to tutor-primary */
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
                line-height: 1.3;
            }
            .markdown-content h2 {
                font-size: 1.25rem; /* 20px */
                padding-bottom: 0.3rem;
                border-bottom: 1px solid #e5e7eb; /* gray-200 */
            }
            .markdown-content h3 {
                font-size: 1.125rem; /* 18px */
            }
            .markdown-content h4 {
                font-size: 1rem; /* 16px */
                color: #581C87; /* Darker purple */
            }
            .markdown-content ul, .markdown-content ol {
                list-style-position: outside;
                padding-left: 1.5rem;
                margin-bottom: 1rem;
            }
            .markdown-content ul { list-style-type: disc; }
            .markdown-content ol { list-style-type: decimal; }
            .markdown-content li {
                margin-bottom: 0.5rem;
                padding-left: 0.25rem;
            }
            .markdown-content li::marker {
                color: #a78bfa;
            }
            .markdown-content strong, .markdown-content b { 
                font-weight: 600;
                color: #581C87;
            }
            .markdown-content blockquote {
                border-left: 4px solid #a78bfa;
                padding: 0.75rem 1rem;
                margin: 1rem 0;
                color: #4b5563;
                background-color: #f5f3ff; /* Lighter tutor-secondary */
            }
            .markdown-content blockquote p {
                margin-bottom: 0;
            }
            .markdown-content code {
                background-color: #ede9fe; /* Even lighter purple */
                color: #581C87;
                padding: 0.125rem 0.375rem;
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.9em;
            }
            .markdown-content pre {
                background-color: #f5f3ff;
                padding: 1rem;
                border-radius: 8px;
                margin: 1rem 0;
                overflow-x: auto;
                border: 1px solid #ddd6fe;
            }
            .markdown-content pre code {
                background-color: transparent;
                padding: 0;
                border: none;
            }
            .markdown-content hr {
                border-top: 1px solid #e5e7eb;
                margin: 1.5rem 0;
            }
            .markdown-content table {
                width: 100%;
                border-collapse: collapse;
                margin: 1rem 0;
            }
            .markdown-content th, .markdown-content td {
                border: 1px solid #d1d5db;
                padding: 0.5rem 0.75rem;
                text-align: left;
            }
            .markdown-content th {
                background-color: #f5f3ff;
                font-weight: 600;
            }
        `}</style>
    </div>
  );
};

export default ChatMessage;

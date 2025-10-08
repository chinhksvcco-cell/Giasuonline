import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Session, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { getLiveSystemInstruction } from '../constants';
import Header from '../components/Header';
import TutorAvatar from '../components/TutorAvatar';
import UserAvatar from '../components/UserAvatar';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

interface LiveAudioScreenProps {
  grade: string;
  subject: string;
  onBack: () => void;
}

interface Transcript {
    id: number;
    speaker: 'user' | 'ai';
    text: string;
}

const LiveAudioScreen: React.FC<LiveAudioScreenProps> = ({ grade, subject, onBack }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Nhấn nút đỏ để bắt đầu nói');
  const [error, setError] = useState('');
  
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const sessionPromiseRef = useRef<Promise<Session> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const stopRecording = useCallback((isCleaningUp = false) => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
     if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close()).catch(console.error);
        sessionPromiseRef.current = null;
    }

    if (!isCleaningUp) {
      setIsRecording(false);
      setStatus('Đã dừng. Nhấn nút đỏ để nói lại.');
    }
  }, []);

  const cleanup = useCallback(() => {
    stopRecording(true); 
    
    inputAudioContextRef.current?.close().catch(console.error);
    outputAudioContextRef.current?.close().catch(console.error);
    
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
  }, [stopRecording]);

  const handleGoBack = () => {
    cleanup();
    onBack();
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startSession = useCallback(() => {
    if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const outputAudioContext = outputAudioContextRef.current;
    
    const speechLanguage = subject === 'Tiếng Anh' ? 'en-US' : 'vi-VN';

    sessionPromiseRef.current = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          setStatus('Kết nối thành công. Bắt đầu nói...');
        },
        onmessage: async (message: LiveServerMessage) => {
          // 1. Handle Audio Output
          const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
          if (base64EncodedAudioString) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.addEventListener('ended', () => sourcesRef.current.delete(source));
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
          }

          // 2. Handle Real-time Transcription
          const hasInput = !!message.serverContent?.inputTranscription;
          const hasOutput = !!message.serverContent?.outputTranscription;

          if (hasInput || hasOutput) {
            setTranscripts(prev => {
                const newTranscripts = [...prev];
                let lastTranscript = newTranscripts.length > 0 ? newTranscripts[newTranscripts.length - 1] : null;

                if (hasInput) {
                    const text = message.serverContent!.inputTranscription!.text;
                    currentInputRef.current += text;
                    if (lastTranscript && lastTranscript.speaker === 'user') {
                        lastTranscript.text = currentInputRef.current;
                    } else {
                        const newEntry = { id: Date.now() + Math.random(), speaker: 'user' as const, text: currentInputRef.current };
                        newTranscripts.push(newEntry);
                        lastTranscript = newEntry; // Update lastTranscript for the next check within this same call
                    }
                }

                if (hasOutput) {
                    const text = message.serverContent!.outputTranscription!.text;
                    currentOutputRef.current += text;
                    if (lastTranscript && lastTranscript.speaker === 'ai') {
                        lastTranscript.text = currentOutputRef.current;
                    } else {
                        const newEntry = { id: Date.now() + Math.random(), speaker: 'ai' as const, text: currentOutputRef.current };
                        newTranscripts.push(newEntry);
                    }
                }
                
                return newTranscripts;
            });
          }

          // 3. Handle Turn Completion
          if (message.serverContent?.turnComplete) {
              currentInputRef.current = '';
              currentOutputRef.current = '';
          }

          // 4. Handle Interruption
          if (message.serverContent?.interrupted) {
            sourcesRef.current.forEach(source => source.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }
        },
        onerror: (e: ErrorEvent) => {
          setError(`Đã xảy ra lỗi: ${e.message || 'Không thể kết nối'}`);
          setStatus('Lỗi kết nối. Vui lòng thử lại.');
          stopRecording();
        },
        onclose: (e: CloseEvent) => {
          setStatus('Kết nối đã đóng. Nhấn nút đỏ để bắt đầu lại.');
          if (isRecording) {
            stopRecording();
          }
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: { languageCodes: [speechLanguage] },
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: getLiveSystemInstruction(grade, subject),
      },
    });
    
    sessionPromiseRef.current.catch(e => {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        setError(`Lỗi khởi tạo: ${errorMessage}`);
        setStatus('Không thể bắt đầu phiên luyện nói.');
        setIsRecording(false);
    });
  }, [grade, subject, stopRecording, isRecording]);

  const startRecording = useCallback(async () => {
    setError('');
    setStatus('Đang yêu cầu quyền truy cập micro...');
    setTranscripts([]);
    setIsRecording(true);

    try {
      if (!inputAudioContextRef.current || inputAudioContextRef.current.state === 'closed') {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      const inputAudioContext = inputAudioContextRef.current;
      await inputAudioContext.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      startSession(); 

      mediaStreamSourceRef.current = inputAudioContext.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
            }).catch(() => {
                // Session promise might reject if connection fails.
                // Error is handled in the session's onerror callback.
            });
        }
      };
      
      mediaStreamSourceRef.current.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContext.destination);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Lỗi micro: ${errorMessage}`);
      setStatus('Không thể truy cập micro.');
      setIsRecording(false);
    }
  }, [startSession]);

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex flex-col h-screen font-sans bg-gray-100 text-gray-800">
      <Header grade={grade} subject={subject} onBack={handleGoBack} />
      <main className="flex-1 flex flex-col items-center justify-between p-4 text-center">
        <div className="w-full max-w-2xl flex-1 mb-6 bg-white rounded-lg shadow-inner p-4 overflow-y-auto flex flex-col">
            <div className="space-y-4 flex-1">
                {transcripts.map(t => (
                    <div key={t.id} className={`flex items-start gap-2.5 ${t.speaker === 'user' ? 'justify-end animate-slide-in-right' : 'justify-start animate-slide-in-left'}`}>
                        {t.speaker === 'ai' && <div className="flex-shrink-0"><TutorAvatar size="sm" /></div>}
                        <div className={`max-w-md text-left px-3 py-2 rounded-lg ${t.speaker === 'user' ? 'bg-user-secondary' : 'bg-tutor-secondary'}`}>
                            {t.text}
                        </div>
                        {t.speaker === 'user' && <div className="flex-shrink-0"><UserAvatar size="sm" /></div>}
                    </div>
                ))}
                {!isRecording && transcripts.length > 0 && <div className="text-center text-gray-400 text-sm p-2">Phiên đã kết thúc.</div>}
                <div ref={transcriptEndRef} />
            </div>
            {transcripts.length === 0 && <p className="text-gray-400 text-center m-auto">Lịch sử trò chuyện sẽ xuất hiện ở đây</p>}
        </div>
        <div className="mb-4 min-h-[28px]">
            <p className={`text-lg ${error ? 'text-red-500' : 'text-gray-500'}`}>{error || status}</p>
        </div>
        <div className="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center">
            <div className={`absolute inset-0 bg-tutor-primary rounded-full transition-transform duration-500 ${isRecording ? 'scale-100 animate-pulse' : 'scale-90'}`}></div>
            <div className={`absolute inset-2 bg-gray-50 rounded-full`}></div>
            <button
                onClick={handleToggleRecording}
                className="relative z-10 w-32 h-32 md:w-40 md:h-40 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transform transition focus:outline-none focus:ring-4 focus:ring-red-300 btn-press"
                aria-label={isRecording ? 'Dừng nói' : 'Bắt đầu nói'}
            >
                {isRecording ? (
                     <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 5a1 1 0 011-1h8a1 1 0 011 1v10a1 1 0 01-1 1H6a1 1 0 01-1-1V5z" clipRule="evenodd" />
                     </svg>
                ) : (
                    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"></path>
                    </svg>
                )}
            </button>
        </div>
      </main>
    </div>
  );
};

export default LiveAudioScreen;
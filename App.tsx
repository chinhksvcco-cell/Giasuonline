
import React, { useState, useEffect, useRef } from 'react';
import type { Message, ChatSession, LessonSummary, LearningProgress, FileAttachment } from './types';
import { Sender } from './types';
import { getTutorResponse, summarizeChatSession, generateIllustration } from './services/geminiService';
import Header from './components/Header';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import LoadingIndicator from './components/LoadingIndicator';
import SelectionScreen from './screens/SelectionScreen';
import LiveAudioScreen from './screens/LiveAudioScreen';
import HistoryScreen from './screens/HistoryScreen';
import QuizScreen from './screens/QuizScreen';

const App: React.FC = () => {
  const [view, setView] = useState<'selection' | 'chat' | 'live' | 'history' | 'quiz'>('selection');
  const [grade, setGrade] =useState('');
  const [subject, setSubject] = useState('');
  const [isViewingHistory, setIsViewingHistory] = useState<boolean>(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [resumedHistory, setResumedHistory] = useState<Message[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [learningProgress, setLearningProgress] = useState<string>('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const LEARNING_PROGRESS_KEY = 'ai_tutor_learning_progress';
  const CHAT_HISTORY_KEY = 'ai_tutor_chat_history';
  const RESUMABLE_SESSIONS_KEY = 'ai_tutor_resumable_sessions';

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    
    const handleAppInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Effect to save the current chat session automatically whenever messages change
  useEffect(() => {
    if (view === 'chat' && !isViewingHistory && grade && subject && messages.length > 0) {
      const subjectKey = `${grade}_${subject}`.replace(/\s+/g, '_').toLowerCase();
      
      const resumableSessionsJSON = localStorage.getItem(RESUMABLE_SESSIONS_KEY);
      const allResumableSessions = resumableSessionsJSON ? JSON.parse(resumableSessionsJSON) : {};
      
      const sessionMessages = resumedHistory ? [...resumedHistory, ...messages] : messages;
      allResumableSessions[subjectKey] = { grade, subject, messages: sessionMessages };
      
      localStorage.setItem(RESUMABLE_SESSIONS_KEY, JSON.stringify(allResumableSessions));
    }
  }, [messages, resumedHistory, view, grade, subject, isViewingHistory]);

  const startNewSession = async (selectedGrade: string, selectedSubject: string, progressString: string) => {
    setResumedHistory(null);
    setMessages([]);
    setIsLoading(true);
    try {
        const initialPrompt = "Bắt đầu buổi học hôm nay.";
        const initialMessage: Message = { sender: Sender.User, text: initialPrompt };
        const aiResponse = await getTutorResponse(
            [initialMessage],
            selectedGrade,
            selectedSubject,
            progressString
        );
        setMessages([{
            sender: Sender.AI,
            text: aiResponse.text,
            suggestions: aiResponse.suggestions
        }]);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Rất tiếc, đã có lỗi khi bắt đầu buổi học. (${errorMessage})`);
        setMessages([{
            sender: Sender.AI,
            text: `Chào em! Hôm nay chúng ta lại gặp nhau rồi. Em đã sẵn sàng cho buổi học môn ${selectedSubject} của ${grade} chưa nào?`,
        }]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleStart = async (mode: 'chat' | 'live' | 'quiz', selectedGrade: string, selectedSubject: string) => {
    setGrade(selectedGrade);
    setSubject(selectedSubject);
    setIsViewingHistory(false);

    if (mode === 'chat') {
        const subjectKey = `${selectedGrade}_${selectedSubject}`.replace(/\s+/g, '_').toLowerCase();
        const resumableSessionsJSON = localStorage.getItem(RESUMABLE_SESSIONS_KEY);
        const allResumableSessions = resumableSessionsJSON ? JSON.parse(resumableSessionsJSON) : {};
        const resumableSession = allResumableSessions[subjectKey];

        const progressJSON = localStorage.getItem(LEARNING_PROGRESS_KEY);
        const allProgress: LearningProgress = progressJSON ? JSON.parse(progressJSON) : {};
        const subjectProgress = allProgress[subjectKey] || [];
        const progressString = subjectProgress.map(s => s.topic).join('; ');
        setLearningProgress(progressString);

        setView('chat');
        setIsLoading(true);
        try {
            if (resumableSession && resumableSession.messages && resumableSession.messages.length > 1) {
                const aiResponse = await getTutorResponse(
                    resumableSession.messages,
                    selectedGrade,
                    selectedSubject,
                    progressString,
                    true // isResuming flag
                );
                setResumedHistory(resumableSession.messages);
                setMessages([{
                    sender: Sender.AI,
                    text: aiResponse.text,
                    suggestions: aiResponse.suggestions
                }]);
            } else {
                await startNewSession(selectedGrade, selectedSubject, progressString);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Rất tiếc, đã có lỗi khi bắt đầu buổi học. (${errorMessage})`);
            setMessages([{
                sender: Sender.AI,
                text: `Chào em! Hôm nay chúng ta lại gặp nhau rồi. Em đã sẵn sàng cho buổi học môn ${selectedSubject} của ${grade} chưa nào?`,
            }]);
        } finally {
            setIsLoading(false);
        }
    } else {
      setView(mode);
    }
  };


  const handleGoBack = async () => {
    if (view === 'chat' && !isViewingHistory && messages.some(m => m.sender === Sender.User)) {
        const subjectKey = `${grade}_${subject}`.replace(/\s+/g, '_').toLowerCase();
        const fullMessageHistory = resumedHistory ? [...resumedHistory, ...messages] : messages;

        // Ensure the session is meaningful before saving.
        if (fullMessageHistory.filter(m => m.sender === Sender.User).length >= 2) {
            // 1. Summarize the lesson for the progress tracker.
            const summaryText = await summarizeChatSession(fullMessageHistory, grade, subject);
            if (summaryText) {
                const newSummary: LessonSummary = {
                    topic: summaryText,
                    timestamp: new Date().toISOString(),
                };
                const progressJSON = localStorage.getItem(LEARNING_PROGRESS_KEY);
                const allProgress: LearningProgress = progressJSON ? JSON.parse(progressJSON) : {};
                const subjectProgress = allProgress[subjectKey] || [];
                const updatedProgress = [newSummary, ...subjectProgress].slice(0, 5);
                allProgress[subjectKey] = updatedProgress;
                localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(allProgress));
            }

            // 2. Archive the full chat session to permanent history.
            const sessionToArchive: ChatSession = {
                id: Date.now(),
                grade,
                subject,
                messages: fullMessageHistory,
                timestamp: new Date().toISOString(),
            };
            const historyJSON = localStorage.getItem(CHAT_HISTORY_KEY);
            const history: ChatSession[] = historyJSON ? JSON.parse(historyJSON) : [];
            history.unshift(sessionToArchive);
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
            
            // 3. Clear the resumable session for this subject as it's now archived.
            const resumableSessionsJSON = localStorage.getItem(RESUMABLE_SESSIONS_KEY);
            const allResumableSessions = resumableSessionsJSON ? JSON.parse(resumableSessionsJSON) : {};
            delete allResumableSessions[subjectKey];
            localStorage.setItem(RESUMABLE_SESSIONS_KEY, JSON.stringify(allResumableSessions));
        }
    }
    
    // Reset state and go back to selection screen
    setView('selection');
    setMessages([]);
    setGrade('');
    setSubject('');
    setError(null);
    setLearningProgress('');
    setIsViewingHistory(false);
    setResumedHistory(null);
  };
  
  const handleViewHistoryChat = (session: ChatSession) => {
    setGrade(session.grade);
    setSubject(session.subject);
    setMessages(session.messages);
    setIsViewingHistory(true);
    setView('chat');
  };


  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (
    inputText: string,
    file?: FileAttachment,
  ) => {
    if ((!inputText.trim() && !file) || !grade || !subject) return;

    const userMessage: Message = {
      sender: Sender.User,
      text: inputText,
      file: file,
    };
    
    setMessages((prevMessages) => {
        const latestMessages = prevMessages.map((msg, index) => {
            if (index === prevMessages.length - 1 && msg.sender === Sender.AI) {
                const { suggestions, ...rest } = msg;
                return rest;
            }
            return msg;
        });
        return [...latestMessages, userMessage];
    });

    setIsLoading(true);
    setError(null);

    const currentHistory = [...messages, userMessage];
    const historyForAI = resumedHistory ? [...resumedHistory, ...currentHistory] : currentHistory;

    const aiResponse = await getTutorResponse(
        historyForAI,
        grade,
        subject,
        learningProgress
    );

    // Handle user wanting to start a new lesson
    const magicNewLessonString = "Được thôi, chúng ta hãy bắt đầu một bài học mới nhé!";
    if (resumedHistory && aiResponse.text.includes(magicNewLessonString)) {
        // 1. Archive the old session
        const sessionToArchive: ChatSession = {
            id: Date.now(),
            grade,
            subject,
            messages: resumedHistory,
            timestamp: new Date().toISOString(),
        };
        const historyJSON = localStorage.getItem(CHAT_HISTORY_KEY);
        const history: ChatSession[] = historyJSON ? JSON.parse(historyJSON) : [];
        history.unshift(sessionToArchive);
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
        
        // 2. Clear the resumable session for this subject
        const subjectKey = `${grade}_${subject}`.replace(/\s+/g, '_').toLowerCase();
        const resumableSessionsJSON = localStorage.getItem(RESUMABLE_SESSIONS_KEY);
        const allResumableSessions = resumableSessionsJSON ? JSON.parse(resumableSessionsJSON) : {};
        delete allResumableSessions[subjectKey];
        localStorage.setItem(RESUMABLE_SESSIONS_KEY, JSON.stringify(allResumableSessions));

        // 3. Start a fresh session
        await startNewSession(grade, subject, learningProgress);
        return;
    }
    
    setIsLoading(false);

    const messageId = Date.now();
    const aiMessage: Message = { 
        id: messageId,
        sender: Sender.AI, 
        text: aiResponse.text, 
        suggestions: aiResponse.suggestions,
        imageIsLoading: !!aiResponse.imagePrompt,
    };

    setMessages((prev) => {
        const base = resumedHistory ? [...resumedHistory, ...prev] : prev;
        return [...base, aiMessage];
    });
    
    if (resumedHistory) {
        setResumedHistory(null);
    }

    if (aiResponse.imagePrompt) {
        generateIllustration(aiResponse.imagePrompt)
            .then(imageData => {
                const imageFile: FileAttachment = {
                    name: 'illustration.png',
                    mimeType: 'image/png',
                    data: imageData,
                };
                setMessages(prev => prev.map(msg => 
                    msg.id === messageId 
                    ? { ...msg, file: imageFile, imageIsLoading: false } 
                    : msg
                ));
            })
            .catch(err => {
                console.error("Image generation failed:", err);
                setMessages(prev => prev.map(msg =>
                    msg.id === messageId 
                    ? { ...msg, imageIsLoading: false, text: `${msg.text}\n\n_(Rất tiếc, cô không tạo được hình minh họa cho em lúc này.)_` } 
                    : msg
                ));
            });
    }
  };
  
  const handleSuggestionClick = (suggestionText: string) => {
    handleSendMessage(suggestionText);
  };

  if (view === 'selection') {
    return <SelectionScreen onStart={handleStart} onShowHistory={() => setView('history')} installPrompt={installPrompt} />;
  }

  if (view === 'history') {
    return <HistoryScreen onViewChat={handleViewHistoryChat} onBack={() => setView('selection')} />;
  }
  
  if (view === 'live') {
    return <LiveAudioScreen grade={grade} subject={subject} onBack={handleGoBack} />;
  }

  if (view === 'quiz') {
    return <QuizScreen grade={grade} subject={subject} onBack={handleGoBack} />;
  }

  return (
    <>
      <div className="flex flex-col h-screen font-sans bg-gray-100">
        <Header grade={grade} subject={subject} onBack={handleGoBack} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((msg, index) => (
            <ChatMessage 
                key={msg.id || index} 
                message={msg} 
                subject={subject} 
                onSuggestionClick={handleSuggestionClick}
            />
          ))}
          {isLoading && messages.length === 0 && ( // Only show full-screen loader on initial load
            <div className="flex justify-center items-center h-full">
              <LoadingIndicator />
            </div>
          )}
          {isLoading && messages.length > 0 && ( // Show inline loader for subsequent messages
            <div className="flex justify-start items-center">
              <LoadingIndicator />
            </div>
          )}
          {error && (
            <div className="flex justify-center">
              <p className="text-red-500 bg-red-100 p-3 rounded-lg">{error}</p>
            </div>
          )}
          <div ref={chatEndRef} />
        </main>
        <footer className="bg-white border-t border-gray-200 p-4 sticky bottom-0">
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} subject={subject}/>
        </footer>
      </div>
    </>
  );
};

export default App;

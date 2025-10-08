import React, { useState, useRef, useEffect } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import type { FileAttachment } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import CameraModal from './CameraModal';


const MicrophoneIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const SendIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);

const FileIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
);


const CameraIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 6a2 2 0 012-2h1.172a2 2 0 011.414.586l.828.828A2 2 0 008.828 6H12a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        <path d="M15 8a1 1 0 01-1-1V5h-2a1 1 0 010-2h2V2a1 1 0 012 0v1h2a1 1 0 110 2h-2v2a1 1 0 01-1 1z" />
    </svg>
);

interface ChatInputProps {
  onSendMessage: (text: string, file?: FileAttachment) => void;
  isLoading: boolean;
  subject: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, subject }) => {
  const [text, setText] = useState('');
  const [attachedFile, setAttachedFile] = useState<FileAttachment | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const speechLanguage = subject === 'Tiếng Anh' ? 'en-US' : 'vi-VN';
  const {
    text: speechText,
    isListening,
    startListening,
    stopListening,
    hasRecognitionSupport,
    setText: setSpeechText,
  } = useSpeechRecognition();

  useEffect(() => {
    setText(speechText);
  }, [speechText]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [text, attachedFile]);
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Limit file size to ~10MB for performance
      if (file.size > 10 * 1024 * 1024) {
        alert("Kích thước file quá lớn. Vui lòng chọn file dưới 10MB.");
        return;
      }
      const base64Data = await fileToBase64(file);
      setAttachedFile({
        name: file.name,
        mimeType: file.type,
        data: base64Data,
      });
    }
    // Reset file input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCapture = (fileData: FileAttachment) => {
    setAttachedFile(fileData);
    setIsCameraOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((text.trim() || attachedFile) && !isLoading) {
      onSendMessage(text, attachedFile ?? undefined);
      setText('');
      setAttachedFile(null);
      if (isListening) stopListening();
      setSpeechText('');
    }
  };
  
  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(speechLanguage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      {isCameraOpen && <CameraModal onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />}
      <div className="max-w-4xl mx-auto">
        {attachedFile && (
            <div className="mb-2 p-2 bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-2 overflow-hidden">
                    {attachedFile.mimeType.startsWith('image/') ? (
                        <img src={attachedFile.data} alt="Preview" className="w-10 h-10 rounded object-cover" />
                    ) : (
                        <div className="w-10 h-10 flex items-center justify-center bg-tutor-secondary rounded">
                            <FileIcon className="w-6 h-6 text-tutor-primary" />
                        </div>
                    )}
                    <span className="text-sm text-gray-700 truncate">{attachedFile.name}</span>
                </div>
                <button onClick={() => setAttachedFile(null)} className="p-1 rounded-full hover:bg-gray-200 text-gray-500 btn-press">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end space-x-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.ppt,.pptx" className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-2 text-gray-500 rounded-full hover:bg-gray-200 transition-colors btn-press" aria-label="Đính kèm file">
                <FileIcon className="w-6 h-6" />
            </button>
            <button type="button" onClick={() => setIsCameraOpen(true)} disabled={isLoading} className="p-2 text-gray-500 rounded-full hover:bg-gray-200 transition-colors btn-press" aria-label="Chụp ảnh">
                <CameraIcon className="w-6 h-6" />
            </button>
            <div className="flex-1 relative">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? 'Cô đang nghe...' : 'Em muốn hỏi cô bài gì...'}
                    rows={1}
                    className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tutor-primary focus:outline-none resize-none transition-shadow duration-200 disabled:bg-gray-100"
                    disabled={isLoading}
                    style={{ maxHeight: '150px' }}
                />
                {hasRecognitionSupport && (
                    <button type="button" onClick={handleMicClick} disabled={isLoading} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors btn-press ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:bg-gray-200'}`} aria-label="Nói">
                        <MicrophoneIcon />
                    </button>
                )}
            </div>
            <button type="submit" disabled={isLoading || (!text.trim() && !attachedFile)} className="bg-tutor-primary text-white p-3 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tutor-primary disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors duration-200 btn-press" aria-label="Gửi">
                <SendIcon />
            </button>
        </form>
         <style>{`
            @keyframes fade-in {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in {
                animation: fade-in 0.3s ease-out forwards;
            }
        `}</style>
      </div>
    </>
  );
};

export default ChatInput;
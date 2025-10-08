
import React, { useState, useEffect } from 'react';
import type { ChatSession } from '../types';
import { Sender } from '../types';

interface HistoryScreenProps {
  onViewChat: (session: ChatSession) => void;
  onBack: () => void;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ onViewChat, onBack }) => {
  const [history, setHistory] = useState<ChatSession[]>([]);

  useEffect(() => {
    const storedHistory = localStorage.getItem('ai_tutor_chat_history');
    if (storedHistory) {
      setHistory(JSON.parse(storedHistory));
    }
  }, []);
  
  const truncateText = (text: string, maxLength: number = 80): string => {
    if (!text || text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <header className="bg-white shadow-md p-3 sticky top-0 z-10 flex items-center justify-between">
         <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 transition btn-press" aria-label="Quay lại">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        <h1 className="text-xl font-bold text-gray-800">Lịch sử trò chuyện</h1>
        <div className="w-10"></div> {/* Spacer */}
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {history.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Không có lịch sử</h3>
            <p className="mt-1 text-sm text-gray-500">Các cuộc trò chuyện của em sẽ được lưu tại đây.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {history.map((session) => {
                const conversationSnippet = session.messages.slice(-3); // Get last 3 messages
                return (
                  <li key={session.id}>
                    <button
                      onClick={() => onViewChat(session)}
                      className="w-full text-left bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-tutor-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-tutor-primary hover:-translate-y-1 btn-press"
                    >
                      <div className="font-semibold text-tutor-primary">{session.subject} - {session.grade}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {new Date(session.timestamp).toLocaleString('vi-VN', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                      <div className="text-sm text-gray-700 mt-2 pt-2 border-t border-gray-100 space-y-1">
                        {conversationSnippet.length > 0 ? (
                          conversationSnippet.map((msg, index) => (
                            <p key={index}>
                              <span className={`font-medium ${msg.sender === Sender.User ? 'text-user-primary' : 'text-tutor-primary'}`}>
                                {msg.sender === Sender.User ? 'Em' : 'Cô'}:
                              </span>
                              <span className="text-gray-600 ml-1">{truncateText(msg.text) || '[Hình ảnh]'}</span>
                            </p>
                          ))
                        ) : (
                          <p className="italic text-gray-400">Không có nội dung trò chuyện.</p>
                        )}
                      </div>
                    </button>
                  </li>
                );
            })}
          </ul>
        )}
      </main>
    </div>
  );
};

export default HistoryScreen;
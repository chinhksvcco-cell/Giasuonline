
import React, { useState, useEffect } from 'react';
import SettingsModal from '../components/SettingsModal';
import TutorAvatar from '../components/TutorAvatar';
import type { LessonSummary } from '../types';

interface SelectionScreenProps {
  onStart: (mode: 'chat' | 'live' | 'quiz', grade: string, subject:string) => void;
  onShowHistory: () => void;
  installPrompt: any;
}

const GRADES = Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`);
const SUBJECTS = ['Toán học', 'Ngữ văn', 'Tiếng Anh', 'Vật lí', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lí', 'Xã hội'];
const TUTOR_NAME_KEY = 'ai_tutor_name';
const LEARNING_PROGRESS_KEY = 'ai_tutor_learning_progress';


const InstallIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

const SettingsIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
    </svg>
);


const SelectionScreen: React.FC<SelectionScreenProps> = ({ onStart, onShowHistory, installPrompt }) => {
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tutorName, setTutorName] = useState('Gia sư AI');
  const [progress, setProgress] = useState<LessonSummary[]>([]);

  const canStart = grade && subject;
  
  const handleInstallClick = async () => {
    if (!installPrompt) {
      return;
    }
    installPrompt.prompt();
    // The 'appinstalled' event will clear the prompt in App.tsx
  };

  useEffect(() => {
    if (grade && subject) {
      const subjectKey = `${grade}_${subject}`.replace(/\s+/g, '_').toLowerCase();
      const progressJSON = localStorage.getItem(LEARNING_PROGRESS_KEY);
      if (progressJSON) {
        const allProgress = JSON.parse(progressJSON);
        setProgress(allProgress[subjectKey] || []);
      } else {
        setProgress([]);
      }
    } else {
        setProgress([]); // Reset if grade/subject is cleared
    }
  }, [grade, subject]);

  const updateName = () => {
    const storedName = localStorage.getItem(TUTOR_NAME_KEY) || 'Gia sư AI';
    setTutorName(storedName);
  };

  useEffect(() => {
    updateName();
    window.addEventListener('settingsChanged', updateName);
    return () => {
        window.removeEventListener('settingsChanged', updateName);
    };
  }, []);

  return (
    <>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-sans">

        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6 text-center animate-fade-in">
            <div className="flex justify-center">
                <TutorAvatar size="lg" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">{tutorName}</h1>
            <p className="text-gray-500">Chào em, em hãy chọn lớp và môn học để bắt đầu nhé!</p>
            
            <div className="space-y-4">
                <div>
                    <label htmlFor="grade-select" className="sr-only">Chọn Lớp</label>
                    <select
                    id="grade-select"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tutor-primary focus:outline-none bg-gray-50 transition"
                    >
                    <option value="" disabled>-- Chọn Lớp --</option>
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="subject-select" className="sr-only">Chọn Môn học</label>
                    <select
                    id="subject-select"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tutor-primary focus:outline-none bg-gray-50 transition"
                    >
                    <option value="" disabled>-- Chọn Môn học --</option>
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {grade && subject && subject !== 'Xã hội' && (
                <div className="text-left p-4 bg-purple-50 rounded-lg border border-purple-200 animate-fade-in space-y-2">
                    {progress.length > 0 ? (
                        <>
                            <h3 className="font-semibold text-tutor-primary text-sm">Các chủ đề đã học gần đây:</h3>
                            <ul className="space-y-1.5 pl-1">
                                {progress.map((item, index) => (
                                    <li key={index} className="flex items-start text-sm text-gray-700">
                                        <svg className="w-4 h-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span>{item.topic}</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <div className="flex items-center text-sm text-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-tutor-primary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.042 1.95l-2.122 1.159a1 1 0 00-.578 1.68l7 12a1 1 0 001.68-.578l1.159-2.122a1 1 0 011.95.042l1.093 2.668a1 1 0 001.84 0l3-7a1 1 0 00-.788-1.218l-5.998-1.551a1 1 0 00-1.218.788l-1.55 5.998a1 1 0 00.788 1.218l.55.142a1 1 0 001.218-.788l1.093-4.258a1 1 0 00-.97-1.243l-4.258 1.093a1 1 0 00-.788 1.218l.142.55a1 1 0 001.218.788l2.668 1.093z" />
                            </svg>
                            <span>Sẵn sàng khám phá chủ đề đầu tiên cho môn học này!</span>
                        </div>
                    )}
                </div>
            )}


            <div className="flex flex-col space-y-3 pt-2">
                <button
                    onClick={() => canStart && onStart('chat', grade, subject)}
                    disabled={!canStart}
                    className="w-full bg-tutor-primary text-white p-3 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tutor-primary disabled:bg-purple-300 disabled:cursor-not-allowed transition-all duration-200 btn-press"
                >
                    Vào phòng học
                </button>
                <button
                    onClick={() => canStart && onStart('live', grade, subject)}
                    disabled={!canStart}
                    className="w-full bg-blue-500 text-white p-3 rounded-lg font-semibold hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all duration-200 btn-press"
                >
                    Luyện nói
                </button>
                <button
                    onClick={() => canStart && onStart('quiz', grade, subject)}
                    disabled={!canStart}
                    className="w-full bg-green-500 text-white p-3 rounded-lg font-semibold hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed transition-all duration-200 btn-press"
                >
                    Kiểm tra kiến thức
                </button>
            </div>
            <div className="pt-4 border-t border-gray-200 space-y-3">
                {installPrompt && (
                    <button
                        onClick={handleInstallClick}
                        className="w-full bg-indigo-500 text-white p-3 rounded-lg font-semibold hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 flex items-center justify-center btn-press"
                        aria-label="Cài đặt ứng dụng"
                    >
                        <InstallIcon />
                        Cài đặt ứng dụng
                    </button>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onShowHistory}
                        className="w-full text-gray-600 p-3 rounded-lg font-semibold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-200 btn-press"
                    >
                        Xem lịch sử
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-full text-gray-600 p-3 rounded-lg font-semibold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-200 flex items-center justify-center btn-press"
                    >
                        <SettingsIcon />
                        Cài đặt
                    </button>
                </div>
            </div>
        </div>
        <style>{`
            @keyframes fade-in {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in {
                animation: fade-in 0.5s ease-out forwards;
            }
        `}</style>
        </div>
    </>
  );
};

export default SelectionScreen;

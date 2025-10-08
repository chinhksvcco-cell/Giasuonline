
import React, { useState, useMemo, useRef } from 'react';
import type { QuizQuestion, FileAttachment } from '../types';
import { getQuizQuestions, getWrittenAnswerFeedback } from '../services/geminiService';
import Header from '../components/Header';
import CameraModal from '../components/CameraModal';
import TutorAvatar from '../components/TutorAvatar';
import { fileToBase64 } from '../utils/fileUtils';

const Spinner: React.FC = () => (
  <div className="flex justify-center items-center p-8">
    <div className="w-16 h-16 border-4 border-tutor-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const SpinnerIcon: React.FC<{className?: string}> = ({className}) => (
    <svg className={`animate-spin h-5 w-5 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


const CheckIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

const XIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
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


interface QuizScreenProps {
  grade: string;
  subject: string;
  onBack: () => void;
}

const QuizScreen: React.FC<QuizScreenProps> = ({ grade, subject, onBack }) => {
  const [topic, setTopic] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadedFile, setUploadedFile] = useState<FileAttachment | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isQuizFinished = hasStarted && currentQuestionIndex >= questions.length;
  
  const correctAnswers = useMemo(() => {
    return questions.map((q) => {
      const normalize = (text: string) => text.replace(/^[A-Z]\.\s*/i, '').trim();
      
      return q.options.find((opt, optIndex) => {
        const modelAnswer = q.correctAnswer.trim();
        const optionText = opt.trim();
        const optionLetter = String.fromCharCode(65 + optIndex);
        
        const normalizedModelAnswer = normalize(modelAnswer);
        const normalizedOptionText = normalize(optionText);

        return normalizedModelAnswer.toLowerCase() === normalizedOptionText.toLowerCase() ||
               modelAnswer.replace(/\./g, '').toUpperCase() === optionLetter;
      }) || null;
    });
  }, [questions]);

  const currentQuestion = !isQuizFinished && questions.length > 0 ? questions[currentQuestionIndex] : null;
  const correctOptionText = currentQuestion ? correctAnswers[currentQuestionIndex] : null;

  const fetchQuestions = async () => {
    if (!topic.trim()) {
        setError('Em vui lòng nhập chủ đề muốn kiểm tra nhé.');
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedQuestions = await getQuizQuestions(grade, subject, topic);
      if (fetchedQuestions.length === 0) {
        setError('Cô không thể tạo được câu hỏi cho chủ đề này. Em thử một chủ đề khác nhé.');
        setQuestions([]);
      } else {
        setQuestions(fetchedQuestions);
        setUserAnswers(new Array(fetchedQuestions.length).fill(null));
        setHasStarted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã có lỗi không xác định xảy ra.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("Kích thước file quá lớn. Vui lòng chọn file dưới 10MB.");
        return;
      }
      const base64Data = await fileToBase64(file);
      setUploadedFile({
        name: file.name,
        mimeType: file.type,
        data: base64Data,
      });
      setFeedback(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCapture = (fileData: FileAttachment) => {
    setUploadedFile(fileData);
    setIsCameraOpen(false);
    setFeedback(null);
  };

  const handleGetFeedback = async () => {
    if (!uploadedFile || !currentQuestion) return;

    setIsAnalyzing(true);
    setFeedback(null);
    setError(null);
    try {
        const aiFeedback = await getWrittenAnswerFeedback(uploadedFile, currentQuestion);
        setFeedback(aiFeedback);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
        setFeedback(`Rất tiếc, cô không thể nhận xét bài làm lúc này. (${message})`);
    } finally {
        setIsAnalyzing(false);
    }
  };


  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer) return; // Prevent changing answer

    const correct = answer === correctOptionText;
    
    setSelectedAnswer(answer);
    setIsCorrect(correct);
    if (correct) {
      setScore(prev => prev + 1);
    }
    setUserAnswers(prev => {
        const newAnswers = [...prev];
        newAnswers[currentQuestionIndex] = answer;
        return newAnswers;
    });
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setCurrentQuestionIndex(prev => prev + 1);
    setUploadedFile(null);
    setFeedback(null);
    setIsAnalyzing(false);
    setError(null);
  };

  const handleRestart = () => {
    setTopic('');
    setHasStarted(false);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setScore(0);
    setUserAnswers([]);
    setError(null);
    setUploadedFile(null);
    setFeedback(null);
    setIsAnalyzing(false);
  };
  
  const getButtonClass = (option: string) => {
    if (selectedAnswer) {
      if (option === correctOptionText) {
        return 'bg-green-200 border-green-500 text-green-800 ring-2 ring-green-500'; // Correct answer
      }
      if (option === selectedAnswer && option !== correctOptionText) {
        return 'bg-red-200 border-red-500 text-red-800'; // Incorrectly selected
      }
       return 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'; // Not selected, after an answer was given
    }
    return 'bg-white border-gray-300 hover:bg-purple-50 hover:border-tutor-primary'; // Default
  };

  if (!hasStarted) {
     return (
        <div className="flex flex-col h-screen font-sans bg-gray-100">
            <Header grade={grade} subject={subject} onBack={onBack} />
            <main className="flex-1 flex items-center justify-center p-4">
                 <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6 text-center">
                    <h2 className="text-2xl font-bold text-gray-800">Kiểm tra kiến thức</h2>
                    <p className="text-gray-500">Em muốn cô kiểm tra về chủ đề gì trong môn {subject}?</p>
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Ví dụ: Chương 1 Đạo hàm, Thơ Tố Hữu,..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tutor-primary focus:outline-none"
                        disabled={isLoading}
                    />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button
                        onClick={fetchQuestions}
                        disabled={isLoading || !topic.trim()}
                        className="w-full bg-tutor-primary text-white p-3 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tutor-primary disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors btn-press"
                    >
                        {isLoading ? 'Đang soạn đề...' : 'Bắt đầu'}
                    </button>
                 </div>
            </main>
        </div>
     );
  }

  return (
    <>
      {isCameraOpen && <CameraModal onClose={() => setIsCameraOpen(false)} onCapture={handleCapture} />}
      <div className="flex flex-col h-screen font-sans bg-gray-100">
        <Header grade={grade} subject={subject} onBack={onBack} />
        <main className="flex-1 flex items-center justify-center p-4">
          {isLoading && <Spinner />}
          {error && !isLoading && (
              <div className="w-full max-w-xl text-center bg-white p-8 rounded-lg shadow-lg">
                  <h2 className="text-xl font-bold text-red-600">Ôi, có lỗi rồi!</h2>
                  <p className="text-gray-600 mt-2">{error}</p>
                  <button onClick={handleRestart} className="mt-6 bg-tutor-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 btn-press btn-transition">Thử lại</button>
              </div>
          )}
          {!isLoading && questions.length > 0 && (
            <div className="w-full max-w-xl">
              {isQuizFinished ? (
                <div className="bg-white p-8 rounded-lg shadow-lg text-center">
                  <h2 className="text-2xl font-bold text-gray-800">Hoàn thành!</h2>
                  <p className="text-lg text-gray-600 mt-4">Điểm của em là:</p>
                  <p className="text-5xl font-bold text-tutor-primary my-4">{score} / {questions.length}</p>
                  
                  <div className="mt-6 text-left max-h-80 overflow-y-auto pr-2 space-y-4">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Xem lại bài làm</h3>
                      {questions.map((q, index) => {
                          const userAnswer = userAnswers[index];
                          const correctOpt = correctAnswers[index];
                          const isUserCorrect = userAnswer === correctOpt;
                          
                          return (
                              <div key={index} className={`p-3 border-l-4 rounded-r-lg ${isUserCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                                  <p className="font-semibold text-gray-800">{index + 1}. {q.question}</p>
                                  <p className="mt-2 text-sm text-gray-700">
                                      <strong>Em chọn:</strong> {userAnswer || 'Không trả lời'}
                                  </p>
                                  {!isUserCorrect && (
                                      <p className="mt-1 text-sm text-gray-700">
                                          <strong>Đáp án đúng:</strong> {correctOpt || 'Không xác định'}
                                      </p>
                                  )}
                              </div>
                          )
                      })}
                  </div>

                  <div className="flex justify-center space-x-4 mt-8">
                      <button onClick={handleRestart} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 btn-press btn-transition">Làm lại chủ đề khác</button>
                      <button onClick={onBack} className="bg-tutor-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 btn-press btn-transition">Quay về</button>
                  </div>
                </div>
              ) : currentQuestion && (
                <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm font-semibold text-tutor-primary">Câu {currentQuestionIndex + 1}/{questions.length}</p>
                    <p className="text-sm font-semibold text-gray-600">Điểm: {score}</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                      <div className="bg-tutor-primary h-2 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`, transition: 'width 0.5s ease-in-out' }}></div>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-800 mb-6">{currentQuestion.question}</h3>
                  
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleAnswerSelect(option)}
                        disabled={!!selectedAnswer}
                        className={`w-full text-left p-3 border rounded-lg transition-all duration-200 flex items-center btn-press ${getButtonClass(option)}`}
                      >
                        <span className="font-bold mr-3">{String.fromCharCode(65 + index)}.</span>
                        <span>{option}</span>
                      </button>
                    ))}
                  </div>

                  {selectedAnswer && (
                    <div className={`mt-6 p-4 rounded-lg animate-fade-in ${isCorrect ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'}`}>
                      <div className="flex items-center">
                          {isCorrect ? <CheckIcon/> : <XIcon/>}
                          <h4 className="font-bold">{isCorrect ? 'Chính xác!' : 'Chưa đúng rồi!'}</h4>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">{currentQuestion.explanation}</p>
                      { !correctOptionText && <p className="text-xs text-red-500 mt-2">Lỗi: Cô không xác định được đáp án đúng từ dữ liệu câu hỏi. </p>}
                      
                      {/* --- NEW SECTION FOR WRITTEN FEEDBACK --- */}
                      <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-300">
                          <h4 className="font-bold text-gray-800">Kiểm tra bài làm viết tay</h4>
                          <p className="text-sm text-gray-600 mt-1">Nếu em đã giải bài này ra giấy, hãy tải file lên để cô xem và nhận xét nhé!</p>
                          
                          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,.pdf" className="hidden" />

                          {uploadedFile ? (
                              <div className="mt-3 p-2 bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between animate-fade-in">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                      {uploadedFile.mimeType.startsWith('image/') ? (
                                          <img src={uploadedFile.data} alt="Preview" className="w-10 h-10 rounded object-cover" />
                                      ) : (
                                          <div className="w-10 h-10 flex items-center justify-center bg-tutor-secondary rounded">
                                              <FileIcon className="w-6 h-6 text-tutor-primary" />
                                          </div>
                                      )}
                                      <span className="text-sm text-gray-700 truncate">{uploadedFile.name}</span>
                                  </div>
                                  <button onClick={() => setUploadedFile(null)} className="p-1 rounded-full hover:bg-gray-200 text-gray-500 btn-press">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                  </button>
                              </div>
                          ) : (
                              <div className="mt-3 grid grid-cols-2 gap-3">
                                  <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center p-2 border-2 border-dashed rounded-lg text-gray-500 hover:bg-gray-100 hover:border-gray-400 transition btn-press">
                                      <FileIcon className="w-5 h-5 mr-2" /> Tải file lên
                                  </button>
                                  <button onClick={() => setIsCameraOpen(true)} className="w-full flex items-center justify-center p-2 border-2 border-dashed rounded-lg text-gray-500 hover:bg-gray-100 hover:border-gray-400 transition btn-press">
                                      <CameraIcon className="w-5 h-5 mr-2" /> Chụp ảnh
                                  </button>
                              </div>
                          )}
                          
                          {uploadedFile && (
                              <button
                                  onClick={handleGetFeedback}
                                  disabled={isAnalyzing}
                                  className="w-full mt-3 bg-blue-500 text-white p-2 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-blue-300 btn-press btn-transition flex items-center justify-center"
                              >
                                  {isAnalyzing && <SpinnerIcon className="mr-2" />}
                                  {isAnalyzing ? 'Cô đang xem bài...' : 'Nhận xét từ cô'}
                              </button>
                          )}
                          
                          {feedback && !isAnalyzing && (
                              <div className="mt-4 flex items-start gap-3 animate-fade-in">
                                  <div className="flex-shrink-0 pt-1"> <TutorAvatar size="sm" /> </div>
                                  <div className="p-3 bg-tutor-secondary rounded-lg rounded-bl-none text-gray-800 text-sm whitespace-pre-wrap">
                                      {feedback}
                                  </div>
                              </div>
                          )}
                      </div>

                      <button onClick={handleNextQuestion} className="w-full mt-4 bg-tutor-primary text-white p-2 rounded-lg font-semibold hover:bg-purple-700 btn-press btn-transition">
                        {currentQuestionIndex === questions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
        <style>{`
          @keyframes fade-in {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        `}</style>
      </div>
    </>
  );
};

export default QuizScreen;

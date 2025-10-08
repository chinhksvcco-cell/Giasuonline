import React, { useState, useEffect } from 'react';

interface HeaderProps {
  grade: string;
  subject: string;
  onBack: () => void;
}

const TUTOR_NAME_KEY = 'ai_tutor_name';

const Header: React.FC<HeaderProps> = ({ grade, subject, onBack }) => {
  const [tutorName, setTutorName] = useState('Cô giáo AI');

  const updateName = () => {
    const storedName = localStorage.getItem(TUTOR_NAME_KEY) || 'Cô giáo AI';
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
    <header className="bg-white shadow-md p-3 sticky top-0 z-10 flex items-center justify-between">
      <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 transition btn-press" aria-label="Quay lại">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="text-center">
        <h1 className="text-xl font-bold text-tutor-primary">{subject} - {grade}</h1>
        <p className="text-xs text-gray-500">{tutorName}</p>
      </div>
      <div className="w-10"></div> {/* Spacer to balance the back button */}
    </header>
  );
};

export default Header;
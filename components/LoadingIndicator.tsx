
import React from 'react';
import TutorAvatar from './TutorAvatar';

const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex items-center space-x-3">
      <TutorAvatar />
      <div className="bg-tutor-secondary p-3 rounded-2xl rounded-bl-none">
        <div className="flex items-center space-x-1">
          <span className="h-2 w-2 bg-tutor-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="h-2 w-2 bg-tutor-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="h-2 w-2 bg-tutor-primary rounded-full animate-bounce"></span>
        </div>
      </div>
    </div>
  );
};

export default LoadingIndicator;

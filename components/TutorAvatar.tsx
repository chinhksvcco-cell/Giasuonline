import React, { useState, useEffect } from 'react';

const AVATAR_STORAGE_KEY = 'ai_tutor_avatar';

interface SvgIconProps {
    className?: string;
}

const DefaultAvatar: React.FC<SvgIconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.042 1.95l-2.122 1.159a1 1 0 00-.578 1.68l7 12a1 1 0 001.68-.578l1.159-2.122a1 1 0 011.95.042l1.093 2.668a1 1 0 001.84 0l3-7a1 1 0 00-.788-1.218l-5.998-1.551a1 1 0 00-1.218.788l-1.55 5.998a1 1 0 00.788 1.218l.55.142a1 1 0 001.218-.788l1.093-4.258a1 1 0 00-.97-1.243l-4.258 1.093a1 1 0 00-.788 1.218l.142.55a1 1 0 001.218.788l2.668 1.093z" />
    </svg>
);

const AvatarOption1: React.FC<SvgIconProps> = ({ className }) => ( // Woman with glasses
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
    </svg>
);

const AvatarOption2: React.FC<SvgIconProps> = ({ className }) => ( // Abstract book/owl
     <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 16c1.255 0 2.443-.29 3.5-.804V4.804zM14.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 0014.5 16c1.255 0 2.443-.29 3.5-.804v-10A7.968 7.968 0 0014.5 4z" />
    </svg>
);

interface TutorAvatarProps {
    size?: 'sm' | 'md' | 'lg';
}

const TutorAvatar: React.FC<TutorAvatarProps> = ({ size = 'md' }) => {
    const [avatar, setAvatar] = useState<string | null>(() => localStorage.getItem(AVATAR_STORAGE_KEY));

    const updateAvatar = () => {
        const storedAvatar = localStorage.getItem(AVATAR_STORAGE_KEY);
        setAvatar(storedAvatar);
    };
    
    useEffect(() => {
        window.addEventListener('settingsChanged', updateAvatar);
        
        return () => {
            window.removeEventListener('settingsChanged', updateAvatar);
        };
    }, []);

    const sizeClasses = size === 'lg' ? 'w-16 h-16' : size === 'sm' ? 'w-6 h-6' : 'w-10 h-10';
    const iconSizeClasses = size === 'lg' ? 'w-8 h-8' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';

    const renderAvatar = () => {
        if (avatar && avatar.startsWith('data:image')) {
            return <img src={avatar} alt="Tutor Avatar" className="w-full h-full object-cover" />;
        }
        switch (avatar) {
            case 'avatar-1':
                return <AvatarOption1 className={iconSizeClasses} />;
            case 'avatar-2':
                return <AvatarOption2 className={iconSizeClasses} />;
            case 'default':
            default:
                return <DefaultAvatar className={iconSizeClasses} />;
        }
    };
    
  return (
    <div className={`${sizeClasses} rounded-full bg-tutor-primary flex items-center justify-center text-white font-bold text-xl shadow-lg overflow-hidden`}>
      {renderAvatar()}
    </div>
  );
};

export default TutorAvatar;
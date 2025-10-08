import React, { useState, useEffect } from 'react';

const AVATAR_STORAGE_KEY = 'user_avatar';

interface SvgIconProps {
    className?: string;
}

const DefaultUserAvatar: React.FC<SvgIconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
);

interface UserAvatarProps {
    size?: 'sm' | 'md';
}

const UserAvatar: React.FC<UserAvatarProps> = ({ size = 'md' }) => {
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

    const sizeClasses = size === 'sm' ? 'w-6 h-6' : 'w-10 h-10';
    const iconSizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';

    const renderAvatar = () => {
        if (avatar) {
            return <img src={avatar} alt="User Avatar" className="w-full h-full object-cover" />;
        }
        return <DefaultUserAvatar className={iconSizeClasses} />;
    };
    
  return (
    <div className={`${sizeClasses} rounded-full bg-user-primary flex items-center justify-center text-white font-bold text-xl shadow-sm overflow-hidden`}>
      {renderAvatar()}
    </div>
  );
};

export default UserAvatar;

import React, { useState, useEffect, useRef } from 'react';
import { generateAvatarImage } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';

const TUTOR_AVATAR_KEY = 'ai_tutor_avatar';
const USER_AVATAR_KEY = 'user_avatar';
const TUTOR_NAME_KEY = 'ai_tutor_name';

const DefaultAvatar: React.FC = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.042 1.95l-2.122 1.159a1 1 0 00-.578 1.68l7 12a1 1 0 001.68-.578l1.159-2.122a1 1 0 011.95.042l1.093 2.668a1 1 0 001.84 0l3-7a1 1 0 00-.788-1.218l-5.998-1.551a1 1 0 00-1.218.788l-1.55 5.998a1 1 0 00.788 1.218l.55.142a1 1 0 001.218-.788l1.093-4.258a1 1 0 00-.97-1.243l-4.258 1.093a1 1 0 00-.788 1.218l.142.55a1 1 0 001.218.788l2.668 1.093z" />
    </svg>
);

const AvatarOption1: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
    </svg>
);

const AvatarOption2: React.FC = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 16c1.255 0 2.443-.29 3.5-.804V4.804zM14.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 0014.5 16c1.255 0 2.443-.29 3.5-.804v-10A7.968 7.968 0 0014.5 4z" />
    </svg>
);

const UploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.414l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L13 9.414V13H5.5z" />
        <path d="M9 13h2v5H9v-5z" />
    </svg>
);


const PRESET_AVATARS = [
    { id: 'default', component: <DefaultAvatar /> },
    { id: 'avatar-1', component: <AvatarOption1 /> },
    { id: 'avatar-2', component: <AvatarOption2 /> },
];

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [tutorName, setTutorName] = useState('Hồng Vân');
    const [selectedTutorAvatar, setSelectedTutorAvatar] = useState<string>('default');
    const [tutorPrompt, setTutorPrompt] = useState<string>('');
    const [customTutorAvatar, setCustomTutorAvatar] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    
    const tutorFileInputRef = useRef<HTMLInputElement>(null);
    const userFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            const currentName = localStorage.getItem(TUTOR_NAME_KEY) || 'Hồng Vân';
            setTutorName(currentName);

            const currentTutor = localStorage.getItem(TUTOR_AVATAR_KEY) || 'default';
            setSelectedTutorAvatar(currentTutor);
            if (currentTutor.startsWith('data:image')) {
                setCustomTutorAvatar(currentTutor);
            } else {
                setCustomTutorAvatar(null);
            }

            const currentUser = localStorage.getItem(USER_AVATAR_KEY);
            setUserAvatar(currentUser);
        }
    }, [isOpen]);

    const handleGenerate = async () => {
        if (!tutorPrompt.trim()) {
            setError('Vui lòng nhập mô tả cho avatar.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const imageB64 = await generateAvatarImage(tutorPrompt);
            setCustomTutorAvatar(imageB64);
            setSelectedTutorAvatar(imageB64);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleTutorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await fileToBase64(file);
            setCustomTutorAvatar(base64);
            setSelectedTutorAvatar(base64);
        }
    };
    
    const handleUserUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await fileToBase64(file);
            setUserAvatar(base64);
        }
    };


    const handleSave = () => {
        localStorage.setItem(TUTOR_NAME_KEY, tutorName.trim() || 'Cô giáo AI');
        localStorage.setItem(TUTOR_AVATAR_KEY, selectedTutorAvatar);
        if (userAvatar) {
            localStorage.setItem(USER_AVATAR_KEY, userAvatar);
        } else {
            localStorage.removeItem(USER_AVATAR_KEY);
        }
        window.dispatchEvent(new CustomEvent('settingsChanged'));
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">Cài đặt</h2>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Tutor Section */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-700">Thông tin Cô giáo</h3>
                         <div className="space-y-2">
                            <label htmlFor="tutor-name-input" className="font-medium text-sm text-gray-600">Tên của Cô</label>
                            <input
                                id="tutor-name-input"
                                type="text"
                                value={tutorName}
                                onChange={(e) => setTutorName(e.target.value)}
                                placeholder="Ví dụ: Hồng Vân"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tutor-primary focus:outline-none"
                            />
                        </div>
                        
                        <div className="space-y-2">
                             <label className="font-medium text-sm text-gray-600">Avatar của Cô</label>
                            <div className="flex items-center justify-around gap-4 pt-1">
                                {PRESET_AVATARS.map(({ id, component }) => (
                                    <button
                                        key={id}
                                        onClick={() => setSelectedTutorAvatar(id)}
                                        className={`w-16 h-16 rounded-full flex items-center justify-center transition bg-tutor-secondary text-tutor-primary btn-press ${selectedTutorAvatar === id ? 'ring-4 ring-tutor-primary ring-offset-2' : 'hover:bg-purple-200'}`}
                                    >
                                        {component}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="text-center text-gray-500 text-sm">hoặc tùy chỉnh</div>

                        <input type="file" ref={tutorFileInputRef} onChange={handleTutorUpload} accept="image/*" className="hidden" />
                        <button onClick={() => tutorFileInputRef.current?.click()} className="w-full flex items-center justify-center p-2 border-2 border-dashed rounded-lg text-gray-500 hover:bg-gray-100 hover:border-gray-400 transition btn-press">
                           <UploadIcon /> Tải ảnh lên
                        </button>
                        
                        <div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={tutorPrompt}
                                    onChange={(e) => setTutorPrompt(e.target.value)}
                                    placeholder="VD: cô giáo tóc ngắn, đeo kính"
                                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tutor-primary focus:outline-none"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={handleGenerate}
                                    disabled={isLoading}
                                    className="bg-tutor-primary text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-purple-300 btn-press btn-transition"
                                >
                                    {isLoading ? 'Đang vẽ...' : 'Tạo'}
                                </button>
                            </div>
                            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                        </div>

                        {(isLoading || customTutorAvatar) && (
                             <div className="mt-4 flex flex-col items-center justify-center h-24">
                                <p className="text-sm font-medium text-gray-600 mb-2">Avatar tùy chỉnh</p>
                                {isLoading ? (
                                    <div className="w-10 h-10 border-4 border-tutor-primary border-t-transparent rounded-full animate-spin"></div>
                                ) : customTutorAvatar ? (
                                    <button onClick={() => setSelectedTutorAvatar(customTutorAvatar)} className={`w-20 h-20 rounded-full overflow-hidden btn-press btn-transition ${selectedTutorAvatar === customTutorAvatar ? 'ring-4 ring-tutor-primary ring-offset-2' : ''}`}>
                                        <img src={customTutorAvatar} alt="Generated Avatar" className="w-full h-full object-cover" />
                                    </button>
                                ) : null}
                            </div>
                        )}
                    </div>

                    {/* User Avatar Section */}
                    <div className="border-t pt-6 space-y-4">
                        <h3 className="font-semibold text-gray-700">Thông tin của Em</h3>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-full bg-user-secondary flex items-center justify-center overflow-hidden">
                                {userAvatar ? (
                                    <img src={userAvatar} alt="User Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-user-primary" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div className="flex-1">
                                <input type="file" ref={userFileInputRef} onChange={handleUserUpload} accept="image/*" className="hidden" />
                                <button onClick={() => userFileInputRef.current?.click()} className="w-full mb-2 flex items-center justify-center p-2 border-2 border-dashed rounded-lg text-gray-500 hover:bg-gray-100 hover:border-gray-400 transition btn-press">
                                    <UploadIcon /> Tải ảnh của em
                                </button>
                                {userAvatar && (
                                     <button onClick={() => setUserAvatar(null)} className="w-full text-sm text-red-500 hover:underline btn-press">
                                        Xóa avatar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 flex justify-end space-x-3 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 btn-press btn-transition">
                        Hủy
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 bg-tutor-primary text-white rounded-md hover:bg-purple-700 btn-press btn-transition">
                        Lưu thay đổi
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default SettingsModal;
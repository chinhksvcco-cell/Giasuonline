import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CameraModalProps {
  onClose: () => void;
  onCapture: (fileData: { name: string; mimeType: string; data: string }) => void;
}

const CameraModal: React.FC<CameraModalProps> = ({ onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập trong trình duyệt của bạn.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setError(null);
    startCamera();
  };

  const handleUsePhoto = async () => {
    if (capturedImage) {
        onCapture({
            name: `capture-${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
            data: capturedImage
        });
        onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 text-white rounded-lg shadow-xl w-full max-w-lg animate-fade-in relative" onClick={(e) => e.stopPropagation()}>
        <canvas ref={canvasRef} className="hidden" />
        {error ? (
          <div className="p-8 text-center">
            <h3 className="text-xl font-bold text-red-500">Lỗi Camera</h3>
            <p className="mt-2">{error}</p>
            <button onClick={onClose} className="mt-6 bg-tutor-primary px-4 py-2 rounded-lg font-semibold btn-press btn-transition">Đóng</button>
          </div>
        ) : (
          <>
            <div className="relative aspect-video bg-black flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-contain ${capturedImage ? 'hidden' : 'block'}`}></video>
                {capturedImage && (
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
                )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 flex justify-center items-center space-x-4">
              {!capturedImage ? (
                <>
                    <button onClick={onClose} className="bg-gray-700 p-3 rounded-full hover:bg-gray-600 transition btn-press" aria-label="Đóng">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <button onClick={handleCapture} className="w-20 h-20 rounded-full border-4 border-white bg-white/30 hover:bg-white/50 transition btn-press" aria-label="Chụp ảnh"></button>
                    <div className="w-9 h-9"></div> {/* Spacer */}
                </>
              ) : (
                <>
                    <button onClick={handleRetake} className="bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition btn-press">Chụp lại</button>
                    <button onClick={handleUsePhoto} className="bg-tutor-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition btn-press">Dùng ảnh này</button>
                </>
              )}
            </div>
          </>
        )}
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

export default CameraModal;
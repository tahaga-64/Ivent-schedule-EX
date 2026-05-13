import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, RotateCcw, Check, Loader2 } from 'lucide-react';
import { usePhotos } from '../../hooks/usePhotos';

interface MobilePhotoCaptureProps {
  eventId: string;
  onPhotoUploaded?: () => void;
  onClose?: () => void;
  className?: string;
}

export default function MobilePhotoCapture({ 
  eventId, 
  onPhotoUploaded, 
  onClose, 
  className = '' 
}: MobilePhotoCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [caption, setCaption] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { uploading, uploadPhoto } = usePhotos();

  // Initialize camera
  const initializeCamera = useCallback(async () => {
    try {
      setError(null);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      
      setIsInitialized(true);
    } catch (err) {
      setError('カメラにアクセスできません。許可設定を確認してください。');
      console.error('Camera error:', err);
    }
  }, [facingMode, stream]);

  // Cleanup camera stream
  const cleanupCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Initialize camera on mount
  useEffect(() => {
    if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
      initializeCamera();
    } else {
      setError('このデバイスではカメラ機能がサポートされていません。');
    }

    return () => {
      cleanupCamera();
    };
  }, []);

  // Re-initialize when facing mode changes
  useEffect(() => {
    if (isInitialized) {
      initializeCamera();
    }
  }, [facingMode]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d')!;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/webp', 0.8);
    setCapturedImage(imageData);
  }, []);

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setCaption('');
  }, []);

  const handleUpload = useCallback(async () => {
    if (!capturedImage) return;

    try {
      // Convert dataURL to File
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], `photo_${Date.now()}.webp`, { type: 'image/webp' });

      await uploadPhoto(eventId, file, caption);
      
      setCapturedImage(null);
      setCaption('');
      onPhotoUploaded?.();
    } catch (error) {
      // Error is handled by the hook
    }
  }, [capturedImage, caption, eventId, uploadPhoto, onPhotoUploaded]);

  const handleClose = useCallback(() => {
    cleanupCamera();
    onClose?.();
  }, [cleanupCamera, onClose]);

  if (error) {
    return (
      <div className={`p-6 text-center ${className}`}>
        <div className="space-y-4">
          <Camera size={48} className="mx-auto text-red-400" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              カメラエラー
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
          {onClose && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
            >
              閉じる
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-black ${className}`}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4">
        <div className="flex items-center justify-between text-white">
          <h3 className="text-lg font-semibold">写真撮影</h3>
          {onClose && (
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Camera View or Captured Image */}
      <div className="relative aspect-[4/3] bg-gray-900 overflow-hidden">
        <AnimatePresence mode="wait">
          {capturedImage ? (
            <motion.img
              key="captured"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          ) : (
            <motion.video
              key="camera"
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: isInitialized ? 1 : 0.5 }}
            />
          )}
        </AnimatePresence>

        {/* Loading indicator */}
        {!isInitialized && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-4">
        {capturedImage ? (
          <>
            {/* Caption Input */}
            <input
              type="text"
              placeholder="写真の説明を入力（任意）"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={uploading}
            />
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={retakePhoto}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                <RotateCcw size={18} />
                撮り直し
              </button>
              
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium transition-colors"
              >
                {uploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    アップロード中...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    保存
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-4">
            {/* Camera Toggle */}
            <button
              onClick={toggleCamera}
              disabled={!isInitialized}
              className="p-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-500 text-white rounded-full transition-colors"
            >
              <RotateCcw size={20} />
            </button>
            
            {/* Capture Button */}
            <button
              onClick={capturePhoto}
              disabled={!isInitialized}
              className="p-4 bg-white hover:bg-gray-100 disabled:bg-gray-300 text-gray-900 rounded-full shadow-lg transition-colors"
            >
              <Camera size={24} />
            </button>
            
            <div className="w-12" /> {/* Spacer for symmetry */}
          </div>
        )}
      </div>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
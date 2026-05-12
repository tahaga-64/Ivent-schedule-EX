import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Camera, X, Image, Loader2 } from 'lucide-react';
import { usePhotos } from '../../hooks/usePhotos';

interface PhotoUploadProps {
  eventId: string;
  onPhotoUploaded?: () => void;
  className?: string;
}

export default function PhotoUpload({ eventId, onPhotoUploaded, className = '' }: PhotoUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const { uploading, uploadPhoto, error, clearError } = usePhotos();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileSelected(imageFile);
    }
  }, []);

  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowCaption(true);
    clearError();
  }, [clearError]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }, [handleFileSelected]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    try {
      await uploadPhoto(eventId, selectedFile, caption);
      
      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption('');
      setShowCaption(false);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      
      onPhotoUploaded?.();
    } catch (error) {
      // Error is handled by the hook
    }
  }, [selectedFile, caption, eventId, uploadPhoto, onPhotoUploaded]);

  const handleCancel = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    setShowCaption(false);
    clearError();
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, [previewUrl, clearError]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Preview */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative"
          >
            <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-48 object-cover"
              />
              <button
                onClick={handleCancel}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Caption Input */}
      <AnimatePresence>
        {showCaption && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <input
              type="text"
              placeholder="写真の説明を入力（任意）"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={uploading}
            />
            
            <div className="flex gap-2">
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium transition-colors"
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    アップロード中...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    アップロード
                  </>
                )}
              </button>
              
              <button
                onClick={handleCancel}
                disabled={uploading}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
              >
                キャンセル
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Area */}
      {!showCaption && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
          }`}
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              <Image size={48} className="text-gray-400 dark:text-gray-500" />
            </div>
            
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                写真をアップロード
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ドラッグ&ドロップまたはボタンをクリック
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                <Upload size={16} />
                ファイル選択
              </button>
              
              {/* Mobile Camera Button */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="sm:hidden inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <Camera size={16} />
                カメラ
              </button>
            </div>
            
            <p className="text-xs text-gray-400 dark:text-gray-500">
              JPG, PNG, WebP (最大10MB)
            </p>
          </div>
          
          {/* Hidden File Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
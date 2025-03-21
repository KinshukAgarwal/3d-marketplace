'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UploadCloud } from "lucide-react";
import { UploadProgress } from "../scan/upload-progress";
import { supabase } from '@/lib/supabase';

interface VideoUploaderProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
}

const SUPPORTED_FORMATS = ['.mp4', '.mov', '.avi'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function VideoUploader({ onFileSelect, isUploading, uploadProgress }: VideoUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        variant: "destructive",
      });
      return false;
    }

    // Check file format
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_FORMATS.includes(fileExtension)) {
      toast({
        title: "Unsupported format",
        description: `Supported formats: ${SUPPORTED_FORMATS.join(', ')}`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      console.log('File selected:', file.name, 'Size:', file.size);
      onFileSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
      console.log('File dropped:', file.name, 'Size:', file.size);
      onFileSelect(file);
    }
  }, [onFileSelect, toast]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-10 text-center ${
        isDragging ? 'border-primary bg-primary/10' : 'border-gray-300'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="flex flex-col items-center justify-center space-y-4">
        <UploadCloud className="h-12 w-12 text-gray-400" />
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Upload a video</h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop a video file, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Supported formats: {SUPPORTED_FORMATS.join(', ')} (Max {MAX_FILE_SIZE / (1024 * 1024)}MB)
          </p>
        </div>
        <div>
          <input
            type="file"
            id="video-upload"
            className="hidden"
            accept={SUPPORTED_FORMATS.join(',')}
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById('video-upload')?.click()}
            disabled={isUploading}
          >
            Select Video
          </Button>
        </div>
      </div>
    </div>
  );
}

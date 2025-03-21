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

export default function VideoUploader({ 
  onFileSelect, 
  isUploading, 
  uploadProgress 
}: VideoUploaderProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <label 
        className="w-full h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer relative overflow-hidden group"
      >
        <div className="absolute inset-0 border-2 border-transparent rounded-lg transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)]"></div>
        <div className="flex flex-col items-center justify-center pt-5 pb-6 z-10">
          <UploadCloud className="w-12 h-12 mb-3 text-muted-foreground" />
          <p className="mb-2 text-sm text-muted-foreground">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">
            MP4, MOV, or AVI (max. 100MB)
          </p>
        </div>
        <input 
          id="dropzone-file" 
          type="file" 
          className="hidden" 
          accept="video/mp4,video/quicktime,video/x-msvideo" 
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </label>
      <UploadProgress progress={uploadProgress} isUploading={isUploading} />
    </div>
  );
}

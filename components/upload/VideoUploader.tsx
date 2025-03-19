'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface VideoUploaderProps {
  isUploading: boolean;
  uploadProgress: number;
  onFileSelect?: (file: File) => void;
}

const SUPPORTED_FORMATS = ['.mp4', '.mov', '.avi'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function VideoUploader({ isUploading, uploadProgress, onFileSelect }: VideoUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [internalIsUploading, setInternalIsUploading] = useState(isUploading);
  const [internalUploadProgress, setInternalUploadProgress] = useState(uploadProgress);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (onFileSelect) {
      onFileSelect(file);
    }

    // Validate file
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!SUPPORTED_FORMATS.includes(extension)) {
      toast({
        title: 'Invalid File',
        description: `Please use: ${SUPPORTED_FORMATS.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File Too Large',
        description: 'File must be less than 100MB',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Sign in Required',
        description: 'Please sign in to upload videos',
        variant: 'destructive',
      });
      router.push('/auth');
      return;
    }

    try {
      setInternalIsUploading(true);

      // 1. Create processing job
      const { data: job, error: jobError } = await supabase
        .from('video_processing_jobs')
        .insert({
          user_id: user.id,
          status: 'uploading',
          filename: file.name,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // 2. Upload video
      const filePath = `${user.id}/${job.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          onUploadProgress: (progress) => {
            setInternalUploadProgress((progress.loaded / progress.total) * 100);
          },
        });

      if (uploadError) throw uploadError;

      // 3. Get video URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      // 4. Start processing
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          videoUrl: publicUrl,
          userId: user.id,
        }),
      });

      if (!response.ok) throw new Error('Processing failed');

      toast({
        title: 'Upload Successful',
        description: 'Video processing started',
      });

      router.push(`/dashboard/processing/${job.id}`);

    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setInternalIsUploading(false);
      setInternalUploadProgress(0);
    }
  };

  return (
    <div className="w-full">
      <div className="border-2 border-dashed rounded-lg p-8 text-center relative overflow-hidden group hover:border-primary/50 transition-colors">
        {/* Glow effect element */}
        <div className="absolute inset-0 w-full h-full bg-[linear-gradient(to_right,transparent_0%,rgba(var(--primary)/.1)_30%,rgba(var(--primary)/.1)_70%,transparent_100%)] -translate-x-full group-hover:translate-x-[100%] transition-transform duration-[10000ms] ease-in-out" />
        
        <input
          type="file"
          id="video-upload"
          className="hidden"
          accept={SUPPORTED_FORMATS.join(',')}
          onChange={handleFileSelect}
          disabled={internalIsUploading}
        />

        <div className="flex flex-col items-center gap-4 relative">
          <Upload className="w-12 h-12 text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="font-semibold">Upload your video</h3>
            <p className="text-sm text-muted-foreground">
              Click to select a video file
            </p>
            <p className="text-xs text-muted-foreground">
              Supported: {SUPPORTED_FORMATS.join(', ')} (Max 100MB)
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => document.getElementById('video-upload')?.click()}
            disabled={internalIsUploading}
          >
            Select Video
          </Button>
        </div>
      </div>

      {internalIsUploading && (
        <div className="mt-4 space-y-2">
          <Progress value={internalUploadProgress} />
          <p className="text-sm text-center text-muted-foreground">
            Uploading... {Math.round(internalUploadProgress)}%
          </p>
        </div>
      )}
    </div>
  );
}

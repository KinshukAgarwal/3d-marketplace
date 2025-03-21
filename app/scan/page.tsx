"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import VideoUploader from "@/components/upload/VideoUploader";
import { RecordingGuidelines } from "@/components/scan/recording-guidelines";
import { VideoPreview } from "@/components/scan/video-preview";
import { ProcessingStatus } from "@/components/scan/processing-status";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { ensureDatabaseSetup } from '@/lib/supabase';
import { supabase } from "@/lib/supabase";
import { TaskList } from "@/components/scan/task-list";

interface Job {
  id: string;
  status: string;
  filename: string;
  progress: number;
  modelUrl: string | null;
  error: string | null;
}

export default function ScanPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dbSetupAttempted, setDbSetupAttempted] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  useEffect(() => {
    // Verify database setup on component mount
    const setupDb = async () => {
      try {
        const isValid = await ensureDatabaseSetup();
        setDbSetupAttempted(true);
        
        if (!isValid) {
          toast({
            title: "Database Setup Required",
            description: "The database tables need to be set up. Please contact an administrator.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Database setup error:", error);
        setDbSetupAttempted(true);
        toast({
          title: "Database Error",
          description: "There was an issue connecting to the database. Please try again later.",
          variant: "destructive",
        });
      }
    };
    
    setupDb();
  }, [toast]);

  useEffect(() => {
    // Fetch user's jobs
    const fetchJobs = async () => {
      if (!user) return;
      
      setIsLoadingJobs(true);
      
      try {
        const { data, error } = await supabase
          .from('video_processing_jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const formattedJobs = data.map(job => ({
          id: job.id,
          status: job.status,
          filename: job.filename || 'Unnamed scan',
          progress: job.metadata?.progress || 0,
          modelUrl: job.model_url,
          error: job.error
        }));
        
        setJobs(formattedJobs);
      } catch (error) {
        console.error('Error fetching jobs:', error);
        toast({
          title: "Error",
          description: "Failed to load your previous scans",
          variant: "destructive",
        });
      } finally {
        setIsLoadingJobs(false);
      }
    };
    
    fetchJobs();
  }, [user, toast]);

  const handleVideoUpload = async (file: File) => {
    setSelectedFile(file);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || !user) return;
    
    try {
      setIsUploading(true);
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('userId', user.id);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + 5;
          if (newProgress >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return newProgress;
        });
      }, 200);
      
      // Send to our API endpoint
      const response = await fetch('/api/process-scan', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      
      const responseData = await response.json();
      
      if (!response.ok) {
        // Check for specific database errors
        if (responseData.error && responseData.error.includes('does not exist')) {
          throw new Error('Database setup required. Please contact an administrator.');
        }
        throw new Error(responseData.error || 'Failed to upload video');
      }
      
      setUploadProgress(100);
      const { jobId } = responseData;
      setJobId(jobId);
      
      // Switch to processing state
      setIsUploading(false);
      setIsProcessing(true);
      
      toast({
        title: "Upload Successful",
        description: "Video processing has begun",
      });
      
      // Redirect to processing page after a short delay
      setTimeout(() => {
        router.push(`/dashboard/processing/${jobId}`);
      }, 2000);
      
    } catch (error: any) {
      setIsUploading(false);
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload video",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('video_processing_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', user?.id);
      
      if (error) throw error;
      
      // Update local state
      setJobs(jobs.filter(job => job.id !== jobId));
      
      toast({
        title: "Scan Deleted",
        description: "The scan has been removed successfully",
      });
    } catch (error) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: "Failed to delete the scan",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto mt-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">3D Scan</h1>
        <p className="text-muted-foreground">
          Upload a video to create a 3D model of your object
        </p>
      </div>
      <RecordingGuidelines />
      <div className="p-6">
        {!selectedFile ? (
          <VideoUploader
            onFileSelect={handleVideoUpload}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
          />
        ) : isUploading ? (
          <ProcessingStatus 
            status="uploading" 
            progress={uploadProgress} 
          />
        ) : isProcessing ? (
          <ProcessingStatus 
            status="processing" 
            progress={0} 
          />
        ) : (
          <VideoPreview 
            file={selectedFile} 
            onCancel={handleCancel} 
            onConfirm={handleConfirmUpload} 
          />
        )}
      </div>
      
      {/* Previous Scans Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Your Previous Scans</h2>
        {isLoadingJobs ? (
          <div className="text-center py-4">Loading your scans...</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            You haven't created any 3D scans yet
          </div>
        ) : (
          <TaskList 
            tasks={jobs.map(job => ({
              ...job,
              status: (["uploading", "processing", "completed", "failed"].includes(job.status) 
                ? job.status 
                : "processing") as "uploading" | "processing" | "completed" | "failed"
            }))} 
            onDelete={handleDeleteJob} 
          />
        )}
      </div>
    </div>
  );
}


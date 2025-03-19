"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import VideoUploader from "@/components/upload/VideoUploader";
import { RecordingGuidelines } from "@/components/scan/recording-guidelines";

export default function ScanPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleVideoUpload = async (file: File) => {
    setSelectedFile(file);
    // Simulate upload progress for UI demo purposes
    setIsUploading(true);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsUploading(false);
        // Show placeholder message
        alert("Backend processing removed. This is just the frontend UI.");
      }
    }, 200);
    
    // Clean up
    return () => clearInterval(interval);
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
        <VideoUploader
          onFileSelect={handleVideoUpload}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />
        
        {selectedFile && (
          <div className="mt-4 flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => setSelectedFile(null)}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}



















































































import { Progress } from "@/components/ui/progress";

interface UploadProgressProps {
  progress: number;
  isUploading: boolean;
}

export function UploadProgress({ progress, isUploading }: UploadProgressProps) {
  if (!isUploading) return null;

  return (
    <div className="w-full mt-4">
      <Progress value={progress} className="w-full" />
      <p className="text-sm text-muted-foreground mt-2">
        Uploading... {progress}%
      </p>
    </div>
  );
}
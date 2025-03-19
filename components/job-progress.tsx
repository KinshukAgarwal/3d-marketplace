import { JobState } from '@/hooks/use-job-status';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface JobProgressProps {
  jobState: JobState;
}

export function JobProgress({ jobState }: JobProgressProps) {
  if (!jobState) return null;

  const { status, progress, currentStage, modelUrl, error } = jobState;

  // Progress stages aligned with pipeline/main.py
  const stages = [
    { name: "Checking video quality", progress: 5 },
    { name: "Processing video frames", progress: 10 },
    { name: "Generating initial mesh", progress: 30 },
    { name: "Optimizing mesh", progress: 60 },
    { name: "Checking mesh quality", progress: 80 },
    { name: "Converting to final format", progress: 90 },
    { name: "Complete", progress: 100 }
  ];

  const getCurrentStage = () => {
    if (status === 'completed') return "Complete";
    if (status === 'failed') return "Failed";
    return currentStage || stages.find(stage => progress <= stage.progress)?.name || "Processing...";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === 'processing' && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500" />}
          <span className="font-medium">{getCurrentStage()}</span>
        </div>
        <span className="text-sm text-muted-foreground">{progress}%</span>
      </div>

      <Progress value={progress} className="h-2" />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Processing Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {status === 'completed' && modelUrl && (
        <div className="flex justify-end">
          <Link href={modelUrl} target="_blank">
            <Button size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download Model
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

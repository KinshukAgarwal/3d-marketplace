import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProcessingStatusProps {
  status: 'uploading' | 'processing';
  progress: number;
  error?: string;
}

export function ProcessingStatus({ status, progress, error }: ProcessingStatusProps) {
  return (
    <div className="mt-4">
      <Progress value={progress} className="h-2" />
      <p className="text-sm text-muted-foreground mt-2">
        {status === 'uploading' ? 'Uploading video...' : 'Processing video...'}
        {' '}({Math.round(progress)}%)
      </p>
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

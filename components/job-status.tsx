import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface JobStatus {
  status: string;
  progress: number;
  current_stage: string;
  error?: string;
}

interface JobStatusProps {
  jobId: string;
  onComplete?: (modelUrl: string) => void;
}

export function JobStatus({ jobId, onComplete }: JobStatusProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize WebSocket connection
    const websocket = new WebSocket(`ws://localhost:8000/ws/jobs/${jobId}`);

    websocket.onopen = () => {
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStatus(data);

      // Handle job completion
      if (data.status === 'completed' && onComplete) {
        onComplete(data.model_url);
      }

      // Handle job failure
      if (data.status === 'failed') {
        toast({
          title: 'Processing Failed',
          description: data.error || 'An error occurred during processing',
          variant: 'destructive',
        });
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to status updates',
        variant: 'destructive',
      });
    };

    setWs(websocket);

    // Cleanup on unmount
    return () => {
      websocket.close();
    };
  }, [jobId, onComplete, toast]);

  if (!status) {
    return <div>Connecting...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Processing Status</h4>
          <p className="text-sm text-muted-foreground">
            {status.current_stage}
          </p>
        </div>
        <span className="text-sm font-medium">
          {Math.round(status.progress)}%
        </span>
      </div>
      <Progress value={status.progress} />
      
      {status.error && (
        <p className="text-sm text-destructive">
          Error: {status.error}
        </p>
      )}
    </div>
  );
}
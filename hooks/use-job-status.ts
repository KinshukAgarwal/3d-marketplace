import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobState {
  id: string;
  status: JobStatus;
  progress: number;
  currentStage: string;
  modelUrl?: string;
  error?: string;
}

export function useJobStatus(jobId: string) {
  const [jobState, setJobState] = useState<JobState | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const previousStatusRef = useRef<JobStatus | null>(null);

  useEffect(() => {
    let subscription: any;

    async function setupSubscription() {
      try {
        // Get initial job state
        const { data: job, error } = await supabase
          .from('video_processing_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (error) throw error;

        setJobState({
          id: job.id,
          status: job.status,
          progress: job.metadata?.progress || 0,
          currentStage: job.metadata?.current_stage || '',
          modelUrl: job.model_url,
          error: job.error
        });

        // Subscribe to changes
        subscription = supabase
          .channel(`job-${jobId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'video_processing_jobs',
              filter: `id=eq.${jobId}`
            },
            (payload) => {
              const job = payload.new;
              setJobState({
                id: job.id,
                status: job.status,
                progress: job.metadata?.progress || 0,
                currentStage: job.metadata?.current_stage || '',
                modelUrl: job.model_url,
                error: job.error
              });

              // Show toast notifications for important status changes
              if (job.status === 'completed' && previousStatusRef.current !== 'completed') {
                previousStatusRef.current = 'completed';
                toast({
                  title: "Processing Complete",
                  description: "Your 3D model is ready!",
                });
              } else if (job.status === 'failed' && previousStatusRef.current !== 'failed') {
                previousStatusRef.current = 'failed';
                toast({
                  title: "Processing Failed",
                  description: job.error || "An error occurred during processing",
                  variant: "destructive",
                });
              }
            }
          )
          .subscribe();

      } catch (error) {
        console.error('Error setting up job subscription:', error);
        toast({
          title: "Error",
          description: "Failed to load job status",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    setupSubscription();

    return () => {
      subscription?.unsubscribe();
    };
  }, [jobId, toast]);

  return { jobState, loading };
}

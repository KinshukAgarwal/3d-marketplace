"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

interface JobStatus {
  id: string;
  status: string;
  progress: number;
  currentStage: string;
  modelUrl: string | null;
  error: string | null;
}

export default function ProcessingPage() {
  const { jobId } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    // Fetch initial job status
    const fetchJobStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('video_processing_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (error) throw error;

        setJobStatus({
          id: data.id,
          status: data.status,
          progress: data.metadata?.progress || 0,
          currentStage: data.metadata?.current_stage || '',
          modelUrl: data.model_url,
          error: data.error
        });
      } catch (error) {
        console.error('Error fetching job:', error);
        toast({
          title: "Error",
          description: "Failed to load processing status",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchJobStatus();

    // Subscribe to real-time updates
    const subscription = supabase
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
          setJobStatus({
            id: job.id,
            status: job.status,
            progress: job.metadata?.progress || 0,
            currentStage: job.metadata?.current_stage || '',
            modelUrl: job.model_url,
            error: job.error
          });
        }
      )
      .subscribe();

    // For demo purposes, simulate processing progress
    let progress = 0;
    const interval = setInterval(async () => {
      progress += 5;
      if (progress <= 100) {
        try {
          // Update the job in Supabase to trigger the subscription
          const { error } = await supabase
            .from('video_processing_jobs')
            .update({ 
              metadata: { 
                progress, 
                current_stage: progress < 30 ? 'analyzing video' : 
                              progress < 60 ? 'generating point cloud' : 
                              progress < 90 ? 'creating mesh' : 'finalizing model' 
              }
            })
            .eq('id', jobId)
            .eq('user_id', user.id); // Add this line to match RLS policy
          
          if (error) console.error('Update error:', error);
        } catch (err) {
          console.error('Simulation update error:', err);
        }
      } else {
        clearInterval(interval);
        // Mark as complete
        try {
          const { error } = await supabase
            .from('video_processing_jobs')
            .update({ 
              status: 'completed',
              model_url: 'https://example.com/sample-model.glb', // Placeholder URL
              metadata: { progress: 100, current_stage: 'completed' }
            })
            .eq('id', jobId)
            .eq('user_id', user.id); // Add this line to match RLS policy
          
          if (error) console.error('Completion update error:', error);
        } catch (err) {
          console.error('Completion update error:', err);
        }
      }
    }, 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [jobId, router, toast, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p>Loading...</p>
      </div>
    );
  }

  if (!jobStatus) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p>Processing job not found</p>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Processing Your 3D Model</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Status: {jobStatus.status}</span>
              <span>{Math.round(jobStatus.progress)}%</span>
            </div>
            <Progress value={jobStatus.progress} className="h-2" />
          </div>
          
          <p className="text-sm text-muted-foreground">
            Current stage: {jobStatus.currentStage}
          </p>
          
          {jobStatus.error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md">
              Error: {jobStatus.error}
            </div>
          )}
          
          {jobStatus.status === 'completed' && (
            <div className="bg-green-100 dark:bg-green-900/20 p-4 rounded-md">
              Your 3D model is ready! You can now view or download it.
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
          
          {jobStatus.status === 'completed' && jobStatus.modelUrl && (
            <Button onClick={() => jobStatus.modelUrl && window.open(jobStatus.modelUrl, '_blank')}>
              View Model
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}


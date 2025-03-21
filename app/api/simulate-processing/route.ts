import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Processing stages with timing and descriptions
const processingStages = [
  { stage: 'analyzing_video', progress: 10, duration: 5000 },
  { stage: 'extracting_frames', progress: 20, duration: 5000 },
  { stage: 'detecting_features', progress: 30, duration: 5000 },
  { stage: 'generating_point_cloud', progress: 50, duration: 8000 },
  { stage: 'creating_mesh', progress: 70, duration: 8000 },
  { stage: 'texturing', progress: 85, duration: 5000 },
  { stage: 'finalizing', progress: 95, duration: 4000 },
  { stage: 'completed', progress: 100, duration: 0 }
];

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing job ID' },
        { status: 400 }
      );
    }
    
    // Start the background processing simulation
    simulateProcessing(jobId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Processing simulation started' 
    });
  } catch (error: any) {
    console.error('Error starting simulation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start processing simulation' },
      { status: 500 }
    );
  }
}

async function simulateProcessing(jobId: string) {
  try {
    // Update job status to processing
    await supabaseAdmin
      .from('video_processing_jobs')
      .update({ 
        status: 'processing',
        metadata: { progress: 0, current_stage: 'starting' }
      })
      .eq('id', jobId);
    
    // Process each stage sequentially
    for (const stage of processingStages) {
      // Update the current stage and progress
      await supabaseAdmin
        .from('video_processing_jobs')
        .update({ 
          metadata: { 
            progress: stage.progress, 
            current_stage: stage.stage 
          }
        })
        .eq('id', jobId);
      
      // If this is the final stage, mark as completed
      if (stage.stage === 'completed') {
        await supabaseAdmin
          .from('video_processing_jobs')
          .update({ 
            status: 'completed',
            model_url: 'https://example.com/sample-model.glb', // Placeholder URL
            metadata: { progress: 100, current_stage: 'completed' }
          })
          .eq('id', jobId);
        break;
      }
      
      // Wait for the specified duration before moving to the next stage
      await new Promise(resolve => setTimeout(resolve, stage.duration));
    }
  } catch (error) {
    console.error('Error in processing simulation:', error);
    
    // Update job status to failed
    await supabaseAdmin
      .from('video_processing_jobs')
      .update({ 
        status: 'failed',
        error: 'Simulation error occurred'
      })
      .eq('id', jobId);
  }
}
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { exec } from 'child_process';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import fs from 'fs';

// Create admin client for database operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    console.log('Received scan request');
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const userId = formData.get('userId') as string;
    
    console.log('Video file received:', videoFile?.name, 'Size:', videoFile?.size);
    console.log('User ID:', userId);
    
    if (!videoFile || !userId) {
      return NextResponse.json(
        { error: 'Missing video file or user ID' },
        { status: 400 }
      );
    }

    // Create a unique job ID
    const jobId = uuidv4();
    
    // Create a temporary directory for processing
    const tempDir = path.join(os.tmpdir(), jobId);
    const videoPath = path.join(tempDir, videoFile.name);
    
    try {
      // Create job record in database
      const { data: job, error: jobError } = await supabaseAdmin
        .from('video_processing_jobs')
        .insert({
          id: jobId,
          user_id: userId,
          status: 'pending',
          filename: videoFile.name,
          metadata: { progress: 0, current_stage: 'uploading' }
        })
        .select()
        .single();
      
      if (jobError) {
        console.error('Database error creating job:', jobError);
        throw jobError;
      }
      
      // Create directory if it doesn't exist
      await fs.promises.mkdir(tempDir, { recursive: true });
      
      // Convert File to Buffer correctly
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      await fs.promises.writeFile(videoPath, buffer, 'binary');
      
      // Update job status to processing
      await supabaseAdmin
        .from('video_processing_jobs')
        .update({ 
          status: 'processing',
          metadata: { progress: 0, current_stage: 'starting' }
        })
        .eq('id', jobId);
      
      // Start the pipeline processing in the background
      startPipelineProcessing(jobId, videoPath, userId);
      
      // Return job ID for client to track progress
      return NextResponse.json({ 
        success: true, 
        jobId: jobId 
      });
    } catch (error: any) {
      console.error('Error setting up processing:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to start processing' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

async function startPipelineProcessing(jobId: string, videoPath: string, userId: string) {
  const baseDir = path.join(os.tmpdir(), jobId);
  
  // Check if the pipeline module exists before executing
  try {
    // For development/testing, you might want to simulate the pipeline instead
    // of actually running it if the module doesn't exist
    const isPipelineAvailable = await fs.promises.access(
      path.join(process.cwd(), 'pipeline', 'main.py')
    ).then(() => true).catch(() => false);
    
    if (!isPipelineAvailable) {
      console.log('Pipeline module not found, simulating processing instead');
      simulateProcessing(jobId, userId);
      return;
    }
    
    // Execute the pipeline as a child process
    const pythonProcess = exec(
      `python -m pipeline.main --video="${videoPath}" --output="${baseDir}" --job_id="${jobId}"`,
      { maxBuffer: 1024 * 1024 * 500 } // 500MB buffer for output
    );
    
    // Log stdout and stderr for debugging
    if (pythonProcess.stdout) {
      pythonProcess.stdout.on('data', (data) => {
        console.log(`Pipeline stdout: ${data}`);
        
        // Check for progress updates
        const progressMatch = data.toString().match(/Progress: (\d+)%/);
        const stageMatch = data.toString().match(/Stage: (.+)/);
        
        if (progressMatch && stageMatch) {
          const progress = parseInt(progressMatch[1]);
          const stage = stageMatch[1];
          
          // Update job progress in database
          supabaseAdmin
            .from('video_processing_jobs')
            .update({ 
              metadata: { progress, current_stage: stage }
            })
            .eq('id', jobId)
            .then(() => {})
            .catch((err: any) => console.error('Failed to update job progress:', err));
        }
      });
    }
    
    if (pythonProcess.stderr) {
      pythonProcess.stderr.on('data', (data) => {
        console.error(`Pipeline stderr: ${data}`);
      });
    }
    
    // Handle process completion
    pythonProcess.on('close', async (code) => {
      console.log(`Pipeline process exited with code ${code}`);
      
      if (code === 0) {
        // Upload the model to storage
        try {
          const modelUrl = await uploadModelToStorage(baseDir, userId, jobId);
          
          // Update job as completed with model URL
          await supabaseAdmin
            .from('video_processing_jobs')
            .update({ 
              status: 'completed',
              model_url: modelUrl,
              metadata: { progress: 100, current_stage: 'completed' }
            })
            .eq('id', jobId);
        } catch (uploadError) {
          console.error('Failed to upload model:', uploadError);
          markJobAsFailed(jobId, 'Failed to upload final model');
        }
      } else {
        markJobAsFailed(jobId, `Pipeline failed with exit code ${code}`);
      }
    });
  } catch (error) {
    console.error('Error executing pipeline:', error);
    markJobAsFailed(jobId, `Failed to execute pipeline: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function updateJobProgress(jobId: string, progress?: number, stage?: string) {
  const metadata: any = {};
  
  if (progress !== undefined) {
    metadata.progress = progress;
  }
  
  if (stage !== undefined) {
    metadata.current_stage = stage;
  }
  
  if (Object.keys(metadata).length > 0) {
    await supabaseAdmin
      .from('video_processing_jobs')
      .update({ metadata })
      .eq('id', jobId);
  }
}

async function markJobAsFailed(jobId: string, errorMessage: string) {
  await supabaseAdmin
    .from('video_processing_jobs')
    .update({ 
      status: 'failed',
      metadata: { 
        error: errorMessage,
        current_stage: 'failed'
      }
    })
    .eq('id', jobId);
}

async function uploadModelToStorage(modelPath: string, userId: string, jobId: string) {
  // Find the model file (looking for .ply files)
  const fs = require('fs');
  const path = require('path');
  
  // Look for the final mesh in the point_clouds directory
  const pointCloudsDir = path.join(modelPath, 'point_clouds');
  const modelFilePath = path.join(pointCloudsDir, 'final_mesh.ply');
  
  console.log(`Checking for model file at: ${modelFilePath}`);
  
  // Check if the file exists, otherwise try simplified_mesh.ply
  let actualModelPath = modelFilePath;
  if (!fs.existsSync(actualModelPath)) {
    console.log(`final_mesh.ply not found, trying simplified_mesh.ply`);
    actualModelPath = path.join(pointCloudsDir, 'simplified_mesh.ply');
    if (!fs.existsSync(actualModelPath)) {
      console.log(`No model file found in directory: ${pointCloudsDir}`);
      // List files in directory for debugging
      if (fs.existsSync(pointCloudsDir)) {
        const files = fs.readdirSync(pointCloudsDir);
        console.log(`Files in directory: ${files.join(', ')}`);
      } else {
        console.log(`Directory does not exist: ${pointCloudsDir}`);
      }
      throw new Error('No model file found');
    }
  }
  
  console.log(`Found model file at: ${actualModelPath}`);
  
  // Read the model file
  const modelBuffer = fs.readFileSync(actualModelPath);
  console.log(`Read model file, size: ${modelBuffer.length} bytes`);
  
  // Upload to Supabase storage
  const fileName = `${userId}/${jobId}/model.ply`;
  console.log(`Uploading to storage: ${fileName}`);
  
  const { data, error } = await supabaseAdmin
    .storage
    .from('models')
    .upload(fileName, modelBuffer, {
      contentType: 'application/octet-stream',
      cacheControl: '3600'
    });
  
  if (error) {
    console.error('Storage upload error:', error);
    throw error;
  }
  
  console.log('Upload successful, getting public URL');
  
  // Get the public URL
  const { data: urlData } = supabaseAdmin
    .storage
    .from('models')
    .getPublicUrl(fileName);
  
  console.log(`Model public URL: ${urlData.publicUrl}`);
  
  return urlData.publicUrl;
}

// Add a simulation function for development/testing
async function simulateProcessing(jobId: string, userId: string) {
  console.log(`Simulating processing for job ${jobId}`);
  
  // Update job to processing
  await updateJobProgress(jobId, 0, 'starting');
  
  // Create a mock model URL for testing
  const mockModelUrl = 'https://example.com/sample-model.glb';
  
  // Update job as completed with mock model URL
  await supabaseAdmin
    .from('video_processing_jobs')
    .update({ 
      status: 'completed',
      model_url: mockModelUrl,
      metadata: { progress: 100, current_stage: 'completed' }
    })
    .eq('id', jobId);
}






















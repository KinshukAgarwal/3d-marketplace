import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const userId = formData.get('userId') as string;
    
    if (!videoFile || !userId) {
      return NextResponse.json(
        { error: 'Missing video file or user ID' },
        { status: 400 }
      );
    }

    console.log('Processing request for user:', userId, 'with file:', videoFile.name);

    // 1. Create processing job with more detailed error handling
    try {
      // First, check if we can connect to the database
      const { data: testData, error: testError } = await supabase
        .from('video_processing_jobs')
        .select('id')
        .limit(1);
      
      if (testError) {
        console.error('Database connection test failed:', testError);
        return NextResponse.json(
          { error: `Database connection error: ${testError.message}` },
          { status: 500 }
        );
      }
      
      // For server-side operations, we need to use service role to bypass RLS
      // Or modify the RLS policy to allow the service role to insert on behalf of users
      
      // Option 1: Use service role if available
      let supabaseAdmin = supabase;
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data } = await supabase.auth.setSession({
          access_token: process.env.SUPABASE_SERVICE_ROLE_KEY,
          refresh_token: ''
        });
        supabaseAdmin = supabase;
      }
      
      // Now try to insert the job
      const { data: job, error: jobError } = await supabaseAdmin
        .from('video_processing_jobs')
        .insert({
          user_id: userId,
          status: 'uploading',
          filename: videoFile.name,
          metadata: { progress: 0 }
        })
        .select()
        .single();

      if (jobError) {
        console.error('Job creation error details:', jobError);
        
        // Check if it's a permissions issue
        if (jobError.message.includes('permission') || jobError.code === '42501' || 
            jobError.message.includes('violates row-level security')) {
          return NextResponse.json(
            { error: `Permission denied: ${jobError.message}` },
            { status: 403 }
          );
        }
        
        // Check if it's a schema issue
        if (jobError.message.includes('column') || jobError.code === '42703') {
          return NextResponse.json(
            { error: `Schema error: ${jobError.message}` },
            { status: 500 }
          );
        }
        
        return NextResponse.json(
          { error: `Failed to create processing job: ${jobError.message}` },
          { status: 500 }
        );
      }

      if (!job) {
        console.error('Job creation failed: No job data returned');
        return NextResponse.json(
          { error: 'Failed to create processing job: No job data returned' },
          { status: 500 }
        );
      }
      
      console.log('Job created successfully:', job.id);
      
      // Create a supabase admin client with service role key
      // Use the existing supabaseAdmin variable
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          }
        );
      }

      // Check if bucket exists and create if needed
      try {
        // Check if bucket exists
        const { data: buckets, error: bucketsError } = await supabase
          .storage
          .listBuckets();
        
        const bucketExists = buckets?.some(bucket => bucket.name === 'scan_videos');
        
        if (!bucketExists) {
          // Try to create the bucket using admin privileges
          const { data: newBucket, error: createError } = await supabaseAdmin
            .storage
            .createBucket('scan_videos', {
              public: false, // Set to true if you want files to be publicly accessible
            });
            
          if (createError) {
            // If the error is just that the bucket already exists, we can ignore it
            if (createError.message.includes('already exists')) {
              console.log('Bucket already exists, continuing with upload');
            } else {
              console.error('Bucket creation error:', createError);
              return NextResponse.json(
                { error: `Failed to create storage bucket: ${createError.message}` },
                { status: 500 }
              );
            }
          } else {
            console.log('Created new bucket:', newBucket);
          }
        }
        
        // Now upload the file using the admin client
        const fileName = `${userId}/${Date.now()}-${videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('scan_videos')
          .upload(fileName, videoFile);
          
        if (uploadError) {
          console.error('Video upload error:', uploadError);
          
          // Update job status to failed
          await supabaseAdmin
            .from('video_processing_jobs')
            .update({ 
              status: 'failed',
              error: `Failed to upload video: ${uploadError.message}`
            })
            .eq('id', job.id);
            
          return NextResponse.json(
            { error: `Failed to upload video: ${uploadError.message}` },
            { status: 500 }
          );
        }
        
        // Update job status to processing using admin client
        await supabaseAdmin
          .from('video_processing_jobs')
          .update({ 
            status: 'processing',
            metadata: { progress: 0, current_stage: 'starting' }
          })
          .eq('id', job.id);

        // Trigger the background processing simulation
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/simulate-processing`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobId: job.id }),
          });
        } catch (error) {
          console.error('Failed to start background processing:', error);
          // Continue anyway, as this is just a simulation
        }

        // Return job ID for client to track progress
        return NextResponse.json({ 
          success: true, 
          jobId: job.id 
        });
      } catch (error: any) {
        console.error('Storage operation error:', error);
        return NextResponse.json(
          { error: `Storage operation failed: ${error.message}` },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error('Job creation error:', error);
      return NextResponse.json(
        { error: `Failed to create processing job: ${error.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Processing error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process video' },
      { status: 500 }
    );
  }
}

















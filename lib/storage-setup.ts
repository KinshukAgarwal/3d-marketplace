import { supabase } from './supabase';

export const verifyStorageSetup = async () => {
  try {
    // Check previews bucket
    const { data: previewsBucket, error: previewsError } = await supabase
      .storage
      .getBucket('previews');

    if (previewsError) {
      console.log('Previews bucket access error:', previewsError.message);
    }

    // Check models bucket
    const { data: modelsBucket, error: modelsError } = await supabase
      .storage
      .getBucket('models');

    if (modelsError) {
      console.log('Models bucket access error:', modelsError.message);
    }
    
    // Check videos bucket
    const { data: videosBucket, error: videosError } = await supabase
      .storage
      .getBucket('videos');

    if (videosError) {
      console.log('Videos bucket access error:', videosError.message);
    }
    
    // Check scan_videos bucket
    const { data: scanVideosBucket, error: scanVideosError } = await supabase
      .storage
      .getBucket('scan_videos');

    if (scanVideosError) {
      console.log('Scan videos bucket access error:', scanVideosError.message);
      
      // Try to create the bucket if it doesn't exist
      if (scanVideosError.message.includes('not found')) {
        const { data: newBucket, error: createError } = await supabase
          .storage
          .createBucket('scan_videos', {
            public: false,
          });
          
        if (createError) {
          // Ignore "already exists" errors
          if (createError.message.includes('already exists')) {
            console.log('Scan videos bucket already exists');
          } else {
            console.log('Failed to create scan_videos bucket:', createError.message);
          }
        } else {
          console.log('Created scan_videos bucket successfully');
        }
      }
    }

  } catch (error) {
    console.error('Storage setup error:', error);
  }
};

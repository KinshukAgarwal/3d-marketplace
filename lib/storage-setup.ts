import { supabase } from './supabase';

export const verifyStorageSetup = async () => {
  try {
    // Check previews bucket
    const { data: previewsBucket, error: previewsError } = await supabase
      .storage
      .getBucket('previews');

    // If there's an error or the bucket doesn't exist, we'll skip creation
    // as the bucket should be created by an admin
    if (previewsError) {
      console.log('Previews bucket access error:', previewsError.message);
    }

    // Check models bucket
    const { data: modelsBucket, error: modelsError } = await supabase
      .storage
      .getBucket('models');

    // If there's an error or the bucket doesn't exist, we'll skip creation
    // as the bucket should be created by an admin
    if (modelsError) {
      console.log('Models bucket access error:', modelsError.message);
    }

  } catch (error) {
    console.error('Storage setup error:', error);
  }
};

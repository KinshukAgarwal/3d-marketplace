import { supabase } from '../supabase';

// Export the function
export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '/placeholder-image.svg';
  
  // If it's already a full URL, return it
  if (path.startsWith('http')) {
    return path;
  }
  
  // Construct the full URL
  return `https://vturbhfjbelphikvumtd.supabase.co/storage/v1/object/public/previews/${path}`;
};

export const verifyImageUrl = async (path: string): Promise<string> => {
  if (!path) return '/placeholder-image.svg';

  // For debugging
  console.log('Verifying image URL:', path);

  if (path.startsWith('http')) {
    if (path.includes('supabase')) {
      try {
        // Extract bucket and path
        const url = new URL(path);
        const pathParts = url.pathname.split('/storage/v1/object/public/');
        if (pathParts.length > 1) {
          const [bucket, ...rest] = pathParts[1].split('/');
          const filePath = rest.join('/');
          
          // Decode the path properly
          const decodedPath = decodeURIComponent(filePath);
          
          // Check if file exists
          const { data: existsData, error: existsError } = await supabase
            .storage
            .from(bucket)
            .list(decodedPath.split('/').slice(0, -1).join('/'));

          console.log('Storage check:', { exists: existsData, error: existsError });

          if (existsError || !existsData?.length) {
            console.log('File not found in storage:', decodedPath);
            return '/placeholder-image.svg';
          }

          // Get fresh URL
          const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(decodedPath);

          return data?.publicUrl || '/placeholder-image.svg';
        }
      } catch (error) {
        console.error('Error processing Supabase URL:', error);
        return '/placeholder-image.svg';
      }
    }
    return path;
  }

  // Handle direct storage paths
  try {
    const { data } = supabase.storage
      .from('previews')
      .getPublicUrl(decodeURIComponent(path));
    
    return data?.publicUrl || '/placeholder-image.svg';
  } catch (error) {
    console.error('Error getting storage URL:', error);
    return '/placeholder-image.svg';
  }
};

export const debugImageUrl = (url: string | null | undefined) => {
  if (!url) return { isValid: false, reason: 'URL is null or undefined' };
  
  try {
    const urlObj = new URL(url);
    const isValidStructure = urlObj.hostname === 'vturbhfjbelphikvumtd.supabase.co' &&
      urlObj.pathname.startsWith('/storage/v1/object/public/previews/');
    
    return {
      isValid: isValidStructure,
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      fullUrl: url
    };
  } catch (e) {
    return { isValid: false, reason: 'Invalid URL format', error: e };
  }
};

export const isValidImageUrl = (url: string | null | undefined): boolean => {
  const debug = debugImageUrl(url);
  return debug.isValid;
};

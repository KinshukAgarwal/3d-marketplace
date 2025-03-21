import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    },
  }
);

// Debug helper function
export const checkAuthState = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Auth state check error:', error);
      return null;
    }
    
    if (session) {
      console.log('Valid session found:', {
        userId: session.user.id,
        expiresAt: new Date(session.expires_at! * 1000).toISOString()
      });
    } else {
      console.log('No active session found');
    }
    
    return session;
  } catch (error) {
    console.error('Error checking auth state:', error);
    return null;
  }
};

// Enhance the ensureDatabaseSetup function
export const ensureDatabaseSetup = async () => {
  try {
    // Check if video_processing_jobs table exists
    const { count, error: countError } = await supabase
      .from('video_processing_jobs')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Table check error:', countError);
      
      // If table doesn't exist, create it
      if (countError.message.includes('does not exist')) {
        const { error: createError } = await supabase.rpc('create_video_processing_jobs_table', {});
        
        if (createError) {
          console.error('Table creation error:', createError);
          
          // If RPC fails, try direct SQL (requires admin privileges)
          const { error: sqlError } = await supabase.auth.getUser();
          if (!sqlError) {
            const { error: createTableError } = await supabase.rpc('run', {
              query: `
                CREATE TABLE IF NOT EXISTS public.video_processing_jobs (
                  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                  user_id UUID NOT NULL REFERENCES auth.users(id),
                  status TEXT NOT NULL,
                  filename TEXT,
                  model_url TEXT,
                  error TEXT,
                  metadata JSONB,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
              `
            });
            
            if (createTableError) {
              console.error('Manual SQL table creation error:', createTableError);
              return false;
            }
          } else {
            return false;
          }
        }
      } else {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Database setup error:', error);
    return false;
  }
};

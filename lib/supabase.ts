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

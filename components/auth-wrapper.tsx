'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthWrapper({
  children
}: {
  children: React.ReactNode
}) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Optional: Clear any client-side state here
      }
    })
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return <div>Loading...</div>
  }

  return <>{children}</>
}
'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LikeButtonProps {
  modelId: number;
  initialLikeCount: number;
  initialIsLiked: boolean;
  userId: string | null;
  onLikeChange?: (newIsLiked: boolean, newLikeCount: number) => void;
}

export function LikeButton({ 
  modelId, 
  initialLikeCount, 
  initialIsLiked, 
  userId,
  onLikeChange 
}: LikeButtonProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isLoading, setIsLoading] = useState(false);

  // Update state when props change
  useEffect(() => {
    setLikeCount(initialLikeCount);
    setIsLiked(initialIsLiked);
  }, [initialLikeCount, initialIsLiked]);

  const handleClick = async () => {
    if (!userId) {
      toast.error('Please sign in to like models');
      return;
    }

    if (isLoading) return;

    setIsLoading(true);

    try {
      // Optimistically update UI
      const optimisticIsLiked = !isLiked;
      const optimisticLikeCount = optimisticIsLiked ? likeCount + 1 : likeCount - 1;
      
      setIsLiked(optimisticIsLiked);
      setLikeCount(optimisticLikeCount);

      const { data, error } = await supabase.rpc('toggle_like', {
        p_model_id: modelId,
        p_user_id: userId
      });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('No response from server');
      }

      // Update UI with server response
      setIsLiked(data[0].new_like_status);
      setLikeCount(data[0].new_like_count);
      
      // Notify parent component of the change
      onLikeChange?.(data[0].new_like_status, data[0].new_like_count);
      
      toast.success(data[0].new_like_status ? 'Added to favorites' : 'Removed from favorites');

    } catch (error: any) {
      // Revert optimistic update on error
      setIsLiked(!isLiked);
      setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
      
      toast.error('Failed to update like status');
      console.error('Error toggling like:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || !userId}
      className={`flex items-center gap-1 transition-colors ${
        isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
      }`}
    >
      <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
      <span>{likeCount}</span>
    </button>
  );
}

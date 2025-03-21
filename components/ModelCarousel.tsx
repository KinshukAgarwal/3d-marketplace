'use client';

import { useState, useEffect } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { supabase } from '@/lib/supabase';

interface ModelCarouselProps {
  modelId: number;
  primaryImageUrl: string;
}

export function ModelCarousel({ modelId, primaryImageUrl }: ModelCarouselProps) {
  const [images, setImages] = useState<string[]>([primaryImageUrl]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchModelImages() {
      try {
        const { data, error } = await supabase
          .from('model_images')
          .select('image_url')
          .eq('model_id', modelId)
          .order('is_primary', { ascending: false });

        if (error) throw error;
        
        if (data && data.length > 0) {
          setImages(data.map(img => img.image_url));
        }
      } catch (error) {
        console.error('Error fetching model images:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchModelImages();
  }, [modelId, primaryImageUrl]);

  if (loading) {
    return (
      <div className="aspect-square bg-muted animate-pulse"></div>
    );
  }

  return (
    <Carousel className="w-full">
      <CarouselContent>
        {images.map((imageUrl, index) => (
          <CarouselItem key={index}>
            <div className="aspect-square relative overflow-hidden">
              <img
                src={imageUrl}
                alt={`Model preview ${index + 1}`}
                className="object-cover w-full h-full"
              />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      {images.length > 1 && (
        <>
          <CarouselPrevious className="left-2" />
          <CarouselNext className="right-2" />
        </>
      )}
    </Carousel>
  );
}
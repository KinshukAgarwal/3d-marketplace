'use client';

import { SetStateAction, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LikeButton } from '@/components/LikeButton';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Eye, Search, SlidersHorizontal, User } from "lucide-react";
import { ProductModal } from "@/components/ProductModal";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { toast } from 'sonner';
import { Model } from "@/types/database";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface ModelWithCreator extends Model {
  creator_name?: string;
}

export default function MarketplacePage() {
  const [models, setModels] = useState<ModelWithCreator[]>([]);
  const [filteredModels, setFilteredModels] = useState<ModelWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelWithCreator | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [sortBy, setSortBy] = useState('newest');

  const categories = [
    "All Categories",
    "Furniture",
    "Architecture",
    "Characters",
    "Vehicles",
    "Nature",
    "Other"  // Added Other category
  ];

  // Update the sortBy options
  const sortOptions = [
    { value: "popularity", label: "Most Popular" },
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "price-low", label: "Price: Low to High" },
    { value: "price-high", label: "Price: High to Low" },
  ];

  // Update filtered models whenever filters change
  useEffect(() => {
    if (!models.length) return;

    let filtered = [...models];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(model => 
        model.title.toLowerCase().includes(query) ||
        model.description.toLowerCase().includes(query) ||
        model.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(model => 
        model.category === selectedCategory
      );
    }

    // Apply price filter
    filtered = filtered.filter(model => 
      model.price >= priceRange[0] && model.price <= priceRange[1]
    );

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'popularity':
          return (b.likes || 0) - (a.likes || 0);
        default:
          return 0;
      }
    });

    setFilteredModels(filtered);
  }, [models, searchQuery, selectedCategory, priceRange, sortBy]);

  const handleLikeChange = (modelId: number, newIsLiked: boolean, newLikeCount: number) => {
    setModels(prevModels => 
      prevModels.map(model => 
        model.id === modelId 
          ? { ...model, isLiked: newIsLiked, likes: newLikeCount }
          : model
      )
    );
    
    setFilteredModels(prevModels => 
      prevModels.map(model => 
        model.id === modelId 
          ? { ...model, isLiked: newIsLiked, likes: newLikeCount }
          : model
      )
    );
    
    // Also update the selected model if it's open in the modal
    setSelectedModel(prevModel => 
      prevModel?.id === modelId 
        ? { ...prevModel, isLiked: newIsLiked, likes: newLikeCount }
        : prevModel
    );
  };

  useEffect(() => {
    fetchModels();
  }, [user]); // Add user as a dependency

  useEffect(() => {
    const modelId = searchParams.get('model');
    if (modelId) {
      const model = models.find(m => m.id === parseInt(modelId));
      if (model) {
        setSelectedModel(model);
      }
    }
  }, [searchParams, models]);

  const fetchModels = async () => {
    try {
      setLoading(true);
      setError(null);
      let userLikes = new Set<number>();

      // First fetch user's likes if logged in
      if (user) {
        const { data: likesData, error: likesError } = await supabase
          .from('likes')
          .select('model_id')
          .eq('user_id', user.id);

        if (likesError) {
          console.error('Error fetching likes:', likesError.message);
          throw new Error(`Failed to fetch likes: ${likesError.message}`);
        }
        
        userLikes = new Set(likesData?.map(like => like.model_id) || []);
      }

      // Fetch models with a separate count of likes
      const { data: modelsData, error: modelsError } = await supabase
        .from('models')
        .select(`
          *,
          users (full_name),
          likes:likes(count)
        `);

      if (modelsError) {
        console.error('Error fetching models:', modelsError.message);
        throw new Error(`Failed to fetch models: ${modelsError.message}`);
      }

      if (!modelsData) {
        throw new Error('No models data received');
      }

      // Get accurate like counts for each model
      const likesCountPromises = modelsData.map(model =>
        supabase
          .from('likes')
          .select('id', { count: 'exact' })
          .eq('model_id', model.id)
      );

      const likeCounts = await Promise.all(likesCountPromises);

      const modelsWithLikes = modelsData.map((model, index) => ({
        ...model,
        creator_name: model.users?.full_name || 'Anonymous User',
        likes: likeCounts[index].count || 0,
        downloads: model.downloads || 0,
        isLiked: userLikes.has(model.id)
      }));

      setModels(modelsWithLikes);
      setFilteredModels(modelsWithLikes);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Detailed error:', error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (model: Model) => {
    if (!user) {
      toast.error('Please sign in to download models');
      return;
    }

    try {
      // First increment the download count in the database
      const { error: incrementError } = await supabase.rpc('increment_downloads', {
        p_model_id: model.id
      });

      if (incrementError) {
        throw new Error(`Failed to update download count: ${incrementError.message}`);
      }

      // Download the file
      const response = await fetch(model.model_url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${model.title}.glb`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Update the local state to reflect the new download count
      setModels(prevModels => 
        prevModels.map(m => 
          m.id === model.id 
            ? { ...m, downloads: (m.downloads || 0) + 1 }
            : m
        )
      );

      setFilteredModels(prevModels => 
        prevModels.map(m => 
          m.id === model.id 
            ? { ...m, downloads: (m.downloads || 0) + 1 }
            : m
        )
      );

      // Update selected model if it's open in modal
      setSelectedModel(prevModel => 
        prevModel?.id === model.id 
          ? { ...prevModel, downloads: (prevModel.downloads || 0) + 1 }
          : prevModel
      );

      toast.success('Download started successfully');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download model');
    }
  };

  const handleOpenModal = (model: Model) => {
    router.push(`/marketplace?model=${model.id}`, { scroll: false });
    setSelectedModel(model);
  };

  const handleCloseModal = () => {
    router.back();
    setSelectedModel(null);
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="text-center text-red-500">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search models..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent title={''}>
                <SheetHeader>
                  <SheetTitle>Filter Models</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price Range</label>
                    <div className="pt-2">
                      <Slider
                        min={0}
                        max={1000}
                        step={1}
                        value={priceRange}
                        onValueChange={setPriceRange}
                      />
                      <div className="flex justify-between mt-2">
                        <span className="text-sm text-muted-foreground">
                          ${priceRange[0]}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ${priceRange[1]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModels.map((model) => (
            <Card key={model.id} className="overflow-hidden max-w-sm flex flex-col h-full">
              <div 
                className="aspect-square relative overflow-hidden cursor-pointer"
                onClick={() => handleOpenModal(model)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleOpenModal(model);
                  }
                }}
              >
                {model.preview_image_url && (
                  <img
                    src={model.preview_image_url}
                    alt={model.title}
                    className="object-cover w-full h-full hover:scale-105 transition-transform duration-200"
                  />
                )}
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="text-lg font-bold px-3 py-1.5 bg-background/90 backdrop-blur-sm">
                    ${model.price}
                  </Badge>
                </div>
              </div>
              
              <div className="flex flex-col flex-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">
                      <span className="truncate">{model.title}</span>
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <LikeButton
                        modelId={model.id}
                        initialLikeCount={model.likes || 0}
                        initialIsLiked={model.isLiked ?? false}
                        userId={user?.id || null}
                        onLikeChange={(newIsLiked, newLikeCount) => 
                          handleLikeChange(model.id, newIsLiked, newLikeCount)
                        }
                      />
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Download className="h-4 w-4" />
                        <span>{model.downloads || 0}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-muted-foreground mt-2 line-clamp-2">
                    {model.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mt-3">
                    {model.tags?.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>

                <div className="mt-auto p-6 pt-0">
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="default" 
                      size="lg" 
                      onClick={() => handleDownload(model)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleOpenModal(model)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <ProductModal
        model={selectedModel}
        isOpen={!!selectedModel}
        onClose={handleCloseModal}
        onDownload={handleDownload}
        onLikeChange={handleLikeChange}
      />
    </div>
  );
}
function setFilteredModels(modelsWithCreator: any[]) {
  throw new Error('Function not implemented.');
}


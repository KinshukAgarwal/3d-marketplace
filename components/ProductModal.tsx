import { Model } from "@/types/database";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Heart, User, Eye3d } from "lucide-react";
import { LikeButton } from "@/components/LikeButton";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ModelCarousel } from "@/components/ModelCarousel";
import { ModelViewer } from "@/components/ModelViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProductModalProps {
  model: Model | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (model: Model) => void;
  onLikeChange: (modelId: number, newIsLiked: boolean, newLikeCount: number) => void;
}

export function ProductModal({ model, isOpen, onClose, onDownload, onLikeChange }: ProductModalProps) {
  const { user } = useAuth();
  const [currentModel, setCurrentModel] = useState(model);
  const [viewMode, setViewMode] = useState<"images" | "3d">("images");

  // Update currentModel when model prop changes
  useEffect(() => {
    setCurrentModel(model);
  }, [model]);

  if (!currentModel) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full p-0">
        <div className="h-full overflow-y-auto">
          {/* Header with back button */}
          <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-center">
            <Button variant="ghost" size="icon" onClick={onClose} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold">{currentModel.title}</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 p-6">
            {/* Left column - Image/3D viewer and details */}
            <div className="space-y-6">
              <Tabs defaultValue="images" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="images" className="flex-1">Images</TabsTrigger>
                  <TabsTrigger value="3d" className="flex-1">3D View</TabsTrigger>
                </TabsList>
                <TabsContent value="images" className="mt-2">
                  <div className="aspect-square w-full">
                    <ModelCarousel 
                      modelId={currentModel.id} 
                      primaryImageUrl={currentModel.preview_image_url || '/placeholder-image.svg'} 
                    />
                  </div>
                </TabsContent>
                <TabsContent value="3d" className="mt-2">
                  {currentModel.model_url ? (
                    <ModelViewer modelUrl={currentModel.model_url} />
                  ) : (
                    <div className="flex items-center justify-center aspect-square w-full bg-muted rounded-lg">
                      <p className="text-muted-foreground">3D preview not available</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Description</h3>
                <p className="text-muted-foreground">{currentModel.description}</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {currentModel.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column - Info and actions */}
            <div className="space-y-6">
              <div className="bg-muted p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-bold">${currentModel.price}</span>
                  <LikeButton
                    modelId={currentModel.id}
                    initialLikeCount={currentModel.likes || 0}
                    initialIsLiked={currentModel.isLiked || false}
                    userId={user?.id || null}
                    onLikeChange={(newIsLiked, newLikeCount) => {
                      onLikeChange(currentModel.id, newIsLiked, newLikeCount);
                      setCurrentModel(prev => prev ? {
                        ...prev,
                        isLiked: newIsLiked,
                        likes: newLikeCount
                      } : null);
                    }}
                  />
                </div>

                <Button 
                  className="w-full mb-3" 
                  size="lg"
                  onClick={() => onDownload(currentModel)}
                >
                  <Download className="mr-2 h-4 w-4" /> Download Now
                </Button>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Downloads</span>
                    <span className="font-medium">{currentModel.downloads || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{currentModel.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-medium">GLB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

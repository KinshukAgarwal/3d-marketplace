"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { CharacterCounter } from "@/components/ui/character-counter";

interface UploadResponse {
  path: string;
  url: string;
}

const modelSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(50, "Title cannot exceed 50 characters"),
  description: z.string()
    .min(1, "Description is required")
    .max(500, "Description cannot exceed 500 characters"),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number()
    .min(0, "Price must be positive")
    .nonnegative("Price cannot be negative"),
  tags: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof modelSchema>;

// Enhanced upload helper function
const uploadFileToStorage = async (
  file: File,
  userId: string,
  bucket: 'models' | 'previews'
): Promise<UploadResponse> => {
  const fileName = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return {
    path: fileName,
    url: urlData.publicUrl
  };
};

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(modelSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      price: 0,
      tags: [], // Changed to empty array
    },
  });

  useEffect(() => {
    if (!loading && !user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload models",
        variant: "destructive",
      });
      router.replace('/auth?redirect=/upload');
    }
  }, [user, loading, router, toast]);

  const onSubmit = async (values: FormValues) => {
    try {
      // Verify authentication first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast({
          title: "Authentication Error",
          description: "Please sign in again to continue",
          variant: "destructive",
        });
        router.push('/auth?redirect=/upload');
        return;
      }

      if (!modelFile || !previewImage) {
        toast({
          title: "Missing Files",
          description: "Please provide both a model file and preview image",
          variant: "destructive",
        });
        return;
      }

      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      if (modelFile.size > MAX_FILE_SIZE || previewImage.size > MAX_FILE_SIZE) {
        toast({
          title: "File Too Large",
          description: "Files must be less than 100MB",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      let uploadedFiles: { model?: UploadResponse; preview?: UploadResponse } = {};

      try {
        // Upload preview image first
        if (!user) throw new Error("User not authenticated");
        uploadedFiles.preview = await uploadFileToStorage(previewImage, user.id, 'previews');
        
        // Upload model file
        uploadedFiles.model = await uploadFileToStorage(modelFile, user.id, 'models');

        // Insert into database
        const { error: insertError } = await supabase
          .from('models')
          .insert([{
            title: values.title,
            description: values.description,
            category: values.category,
            price: values.price,
            tags: values.tags,
            user_id: user.id,
            model_url: uploadedFiles.model.url,
            preview_image_url: uploadedFiles.preview.url
          }]);

        if (insertError) throw insertError;

        toast({
          title: "Success",
          description: "Model uploaded successfully",
        });

        router.push("/dashboard");
      } catch (error) {
        // Cleanup on failure
        if (uploadedFiles.model?.path) {
          await supabase.storage.from('models').remove([uploadedFiles.model.path]);
        }
        if (uploadedFiles.preview?.path) {
          await supabase.storage.from('previews').remove([uploadedFiles.preview.path]);
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to upload model',
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-screen">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const categories = [
    "Furniture",
    "Architecture",
    "Characters",
    "Vehicles",
    "Nature",
    "Other"  // Added Other category
  ];

  return (
    <div className="container py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Upload 3D Model</h1>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Title</FormLabel>
                    <CharacterCounter 
                      current={field.value.length} 
                      max={50} 
                    />
                  </div>
                  <FormControl>
                    <Input 
                      placeholder="Enter model title" 
                      {...field} 
                      onChange={(e) => {
                        if (e.target.value.length <= 50) {
                          field.onChange(e);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Description</FormLabel>
                    <CharacterCounter 
                      current={field.value.length} 
                      max={500} 
                    />
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your 3D model"
                      className="resize-none"
                      {...field}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) {
                          field.onChange(e);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price ($)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0"
                      step="0.01"
                      onKeyDown={(e) => {
                        if (e.key === '-' || e.key === 'e') {
                          e.preventDefault();
                        }
                      }}
                      {...field}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (value < 0) {
                          e.target.value = '0';
                          field.onChange(0);
                        } else {
                          field.onChange(e);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (comma-separated)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      value={field.value.join(', ')}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value.split(',').map(tag => tag.trim()).filter(Boolean));
                      }}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground mt-1">
                    e.g., modern, furniture, chair
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>3D Model File</FormLabel>
              <Input
                type="file"
                accept=".glb,.gltf,.fbx,.obj"
                onChange={(e) => setModelFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-2">
              <FormLabel>Preview Image</FormLabel>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setPreviewImage(e.target.files?.[0] || null)}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isUploading}
            >
              {isUploading ? "Uploading..." : "Upload Model"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}














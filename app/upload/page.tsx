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
import { X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

type UploadResponse = {
  path: string;
  url: string;
};

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

// Add this function to handle .blend file uploads
const handleBlendFileUpload = async (file: File, userId: string): Promise<UploadResponse> => {
  // Create a FormData object
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
  
  // Send the file to our conversion endpoint
  const response = await fetch('/api/convert-blend', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to convert Blender file');
  }
  
  // Get the converted file URL
  const data = await response.json();
  return {
    path: `converted/${data.path}`,
    url: data.url
  };
};

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [previewImages, setPreviewImages] = useState<File[]>([]);

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
    if (!modelFile) {
      toast({
        title: "Error",
        description: "Please select a model file to upload",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      const userId = user?.id || 'anonymous';
      let modelData: UploadResponse;
      
      // Check if it's a .blend file
      if (modelFile.name.toLowerCase().endsWith('.blend')) {
        toast({
          title: "Converting Blender File",
          description: "Please wait while we convert your Blender file...",
        });
        
        modelData = await handleBlendFileUpload(modelFile, userId);
      } else {
        // Handle regular file uploads as before
        modelData = await uploadFileToStorage(modelFile, userId, 'models');
      }
      
      // Upload preview images
      const previewUrls = await Promise.all(
        previewImages.map(async (file) => {
          const data = await uploadFileToStorage(file, userId, 'previews');
          return data.url;
        })
      );
      
      // Create the model record in the database
      const { error: insertError } = await supabase
        .from('models')
        .insert({
          title: values.title,
          description: values.description,
          category: values.category,
          price: parseFloat(values.price.toString()),
          tags: values.tags,
          model_url: modelData.url,
          preview_urls: previewUrls,
          user_id: userId,
          file_format: modelFile.name.toLowerCase().endsWith('.blend') ? 'glb' : modelFile.name.split('.').pop()?.toLowerCase(),
          original_filename: modelFile.name
        });
      
      if (insertError) throw insertError;
      
      toast({
        title: "Success",
        description: "Your model has been uploaded successfully!",
      });
      
      // Reset form
      form.reset();
      setModelFile(null);
      setPreviewImages([]);
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload model",
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
                      value={Array.isArray(field.value) ? field.value.join(', ') : field.value}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        
                        // Store the raw input string with commas
                        // We'll only convert to array on blur or when form is submitted
                        field.onChange(inputValue);
                      }}
                      onBlur={(e) => {
                        const inputValue = e.target.value;
                        
                        // When field loses focus, convert comma-separated string to array
                        if (typeof inputValue === 'string') {
                          const tags = inputValue
                            .split(',')
                            .map(tag => tag.trim())
                            .filter(Boolean);
                          
                          field.onChange(tags);
                        }
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
                accept=".glb,.gltf,.fbx,.obj,.blend,.stl,.ply"
                onChange={(e) => setModelFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-2">
              <FormLabel>Preview Images</FormLabel>
              <div className="grid grid-cols-2 gap-4 mb-2">
                {previewImages.map((img, index) => (
                  <div key={index} className="relative">
                    <img 
                      src={URL.createObjectURL(img)} 
                      alt={`Preview ${index}`} 
                      className="h-24 w-24 object-cover rounded-md"
                    />
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      type="button" // Add this to prevent form submission
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={(e) => {
                        e.preventDefault(); // Prevent any default behavior
                        e.stopPropagation(); // Stop event propagation
                        setPreviewImages(prev => prev.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setPreviewImages(prev => [...prev, ...Array.from(e.target.files || [])]);
                  }
                }}
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









'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Eye, X } from "lucide-react";

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

// Enhanced upload helper function with better error handling
const uploadFileToStorage = async (
  file: File,
  userId: string,
  bucket: 'models' | 'previews'
): Promise<UploadResponse> => {
  try {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);
    
    if (fileSizeMB > 100) {
      throw new Error(`File size (${fileSizeMB.toFixed(2)} MB) exceeds the 100 MB limit`);
    }
    
    const fileName = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    console.log(`Uploading file to ${bucket}: ${fileName}, size: ${file.size} bytes`);
    
    // Try with chunked upload for large files
    if (fileSizeMB > 5) {
      console.log('Using chunked upload for large file');
      
      // Read the file as ArrayBuffer
      const fileBuffer = await file.arrayBuffer();
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, new Uint8Array(fileBuffer), {
          contentType: file.type || 'application/octet-stream'
        });

      if (uploadError) {
        console.error(`Upload error for ${fileName}:`, uploadError);
        throw uploadError;
      }
    } else {
      // Standard upload for smaller files
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) {
        console.error(`Upload error for ${fileName}:`, uploadError);
        throw uploadError;
      }
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    console.log(`Successfully uploaded to ${bucket}: ${fileName}`);
    
    return {
      path: fileName,
      url: urlData.publicUrl
    };
  } catch (error) {
    console.error('File upload error:', error);
    
    // Provide more specific error messages based on the error
    if (error instanceof Error) {
      if (error.message.includes('storage/object_too_large')) {
        throw new Error('File is too large. Maximum file size is 100 MB.');
      } else if (error.message.includes('JWT')) {
        throw new Error('Authentication error. Please try logging out and back in.');
      } else if (error.message.includes('network')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      throw new Error(`Upload failed: ${error.message}`);
    }
    
    throw new Error('Failed to upload file. Please try again or use a different file.');
  }
};

async function handleModelFileUpload(file: File, userId: string): Promise<UploadResponse> {
  // Check if the file format is supported
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const supportedFormats = ['glb', 'gltf', 'obj', 'stl', 'ply', 'fbx'];
  
  console.log(`Processing model file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
  
  if (fileExtension === 'blend') {
    throw new Error('Blender (.blend) files are not supported. Please export to GLB, OBJ, or another supported format.');
  }
  
  if (!fileExtension || !supportedFormats.includes(fileExtension)) {
    throw new Error(`Unsupported file format: .${fileExtension}. Supported formats: ${supportedFormats.join(', ')}`);
  }
  
  // For all supported file types, use the standard upload
  return uploadFileToStorage(file, userId, 'models');
}

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [previewImages, setPreviewImages] = useState<File[]>([]);
  const searchParams = useSearchParams();
  const [preloadedModelUrl, setPreloadedModelUrl] = useState<string | null>(null);

  useEffect(() => {
    const modelUrl = searchParams.get('modelUrl');
    if (modelUrl) {
      setPreloadedModelUrl(modelUrl);
      
      // Extract filename from URL to set as default title
      try {
        const urlObj = new URL(modelUrl);
        const pathParts = urlObj.pathname.split('/');
        const fileNameWithExt = pathParts[pathParts.length - 1];
        const baseName = fileNameWithExt.split('.')[0];
        
        if (baseName) {
          form.setValue('title', baseName.replace(/-|_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
        }
      } catch (e) {
        console.error('Error parsing URL:', e);
      }
    }
  }, [searchParams]);

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
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload models",
        variant: "destructive"
      });
      return;
    }

    if (!modelFile && !preloadedModelUrl) {
      toast({
        title: "Model Required",
        description: "Please upload a 3D model file",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const userId = user.id;
      
      // Verify user session is valid
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('Your session has expired. Please sign in again.');
      }
      
      // Handle model upload or use preloaded URL
      let modelData;
      if (preloadedModelUrl) {
        // Use the preloaded model URL directly
        console.log('Using preloaded model URL:', preloadedModelUrl);
        modelData = { url: preloadedModelUrl };
      } else {
        // Upload the model file
        console.log('Uploading model file:', modelFile?.name);
        try {
          modelData = await handleModelFileUpload(modelFile!, userId);
        } catch (uploadError) {
          console.error('Model upload error:', uploadError);
          throw uploadError;
        }
      }
      
      // Upload preview images
      let previewUrls: string | any[] = [];
      try {
        previewUrls = await Promise.all(
          previewImages.map(async (file) => {
            console.log('Uploading preview image:', file.name);
            const data = await uploadFileToStorage(file, userId, 'previews');
            return data.url;
          })
        );
      } catch (previewError) {
        console.error('Preview upload error:', previewError);
        // Continue with model upload even if preview fails
      }
      
      console.log('Creating database record for model');
      
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
          preview_image_url: previewUrls.length > 0 ? previewUrls[0] : null, // Use the first preview image as the main preview
          user_id: userId
        });
      
      if (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error(`Database error: ${insertError.message}`);
      }
      
      toast({
        title: "Success",
        description: "Your model has been uploaded successfully!",
      });
      
      // Reset form
      form.reset();
      setModelFile(null);
      setPreviewImages([]);
      
      // Redirect to the dashboard instead of dashboard/models
      router.push('/dashboard');
      
    } catch (error) {
      console.error('Upload submission error:', error);
      toast({
        title: "Upload Failed",
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
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col space-y-2 mb-6">
          <h1 className="text-3xl font-bold">Upload 3D Model</h1>
          <p className="text-muted-foreground">
            {preloadedModelUrl 
              ? "Complete the details to add your scanned model to the marketplace" 
              : "Share your 3D models with the community"}
          </p>
        </div>

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

            {!preloadedModelUrl && (
              <div className="space-y-2">
                <FormLabel>3D Model File</FormLabel>
                <Input
                  type="file"
                  accept=".glb,.gltf,.fbx,.obj,.stl,.ply"
                  onChange={(e) => setModelFile(e.target.files?.[0] || null)}
                />
                <p className="text-sm text-muted-foreground">
                  Supported formats: GLB, GLTF, FBX, OBJ, STL, PLY
                </p>
              </div>
            )}

            {preloadedModelUrl && (
              <div className="bg-muted p-4 rounded-md mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Scanned Model</h3>
                    <p className="text-sm text-muted-foreground">Your 3D scan is ready to be published</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(preloadedModelUrl, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
              </div>
            )}

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

// The function implementation is already defined earlier in the file
// This duplicate function implementation has been removed

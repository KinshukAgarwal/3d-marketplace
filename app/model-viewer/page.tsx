'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ModelViewer } from '@/components/ModelViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Upload, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';

export default function ModelViewerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('model');

  useEffect(() => {
    const url = searchParams.get('url');
    if (url) {
      setModelUrl(url);
      
      // Extract filename from URL
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const fileNameWithExt = pathParts[pathParts.length - 1];
        const baseName = fileNameWithExt.split('.')[0];
        if (baseName) setFileName(baseName);
      } catch (e) {
        console.error('Error parsing URL:', e);
      }
    }
  }, [searchParams]);

  const handleDownload = () => {
    if (!modelUrl) return;
    
    const a = document.createElement('a');
    a.href = modelUrl;
    a.download = `${fileName}.${modelUrl.split('.').pop()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleUploadToMarketplace = () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload models to the marketplace",
        variant: "destructive"
      });
      return;
    }
    
    if (!modelUrl) return;
    
    // Redirect to upload page with the model URL as a parameter
    router.push(`/upload?modelUrl=${encodeURIComponent(modelUrl)}`);
  };

  if (!modelUrl) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Model Viewer</CardTitle>
            <CardDescription>No model URL provided</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>3D Model Viewer</CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          <CardDescription>
            View your 3D model and upload it to the marketplace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-square w-full bg-muted/20 rounded-md overflow-hidden">
            <ModelViewer modelUrl={modelUrl} />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download Model
          </Button>
          <Button onClick={handleUploadToMarketplace}>
            <Upload className="h-4 w-4 mr-2" />
            Upload to Marketplace
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


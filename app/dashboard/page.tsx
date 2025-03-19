"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Model } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, Heart, DollarSign, Users, ShoppingCart, Edit, Trash2, Upload, Eye, Box } from "lucide-react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

interface Stats {
  totalDownloads: number;
  totalLikes: number;
  totalEarnings: number;
}

interface ChartData {
  month: string;
  earnings: number;
}

interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface ModelData {
  id: number;
  title: string;
  description?: string;
  price: number;
  model_url: string;
  preview_image_url: string;
  created_at: string;
  downloads: { count: number } | null;
  likes: { count: number } | null;
}

const generateMonthlyEarningsData = (models: Model[]): ChartData[] => {
  const monthlyEarnings = new Map<string, number>();
  
  // Get the last 6 months
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
    monthlyEarnings.set(monthKey, 0);
  }

  // Calculate earnings for each model's downloads
  models.forEach(model => {
    const date = new Date(model.created_at);
    const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
    
    if (monthlyEarnings.has(monthKey)) {
      const earnings = (model.downloads || 0) * (model.price || 0);
      monthlyEarnings.set(
        monthKey,
        (monthlyEarnings.get(monthKey) || 0) + earnings
      );
    }
  });

  // Convert to array and ensure chronological order
  return Array.from(monthlyEarnings.entries())
    .map(([month, earnings]) => ({
      month,
      earnings: Number(earnings.toFixed(2))
    }));
};

const generateDownloadsData = (models: Model[]) => {
  const monthlyDownloads = new Map<string, number>();
  const now = new Date();
  
  // Initialize last 6 months with 0
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
    monthlyDownloads.set(monthKey, 0);
  }

  // Calculate downloads for each model
  models.forEach(model => {
    const modelDate = new Date(model.created_at);
    const monthKey = modelDate.toLocaleString('default', { month: 'short', year: '2-digit' });
    
    if (monthlyDownloads.has(monthKey)) {
      monthlyDownloads.set(
        monthKey, 
        (monthlyDownloads.get(monthKey) || 0) + (model.downloads || 0)
      );
    }
  });

  // Convert to array format for the chart
  return Array.from(monthlyDownloads.entries())
    .map(([month, downloads]) => ({
      month,
      downloads: Number(downloads)
    }));
};

const fetchUserModelsWithRetry = async (userId: string, retryCount = 3): Promise<Model[]> => {
  for (let i = 0; i < retryCount; i++) {
    try {
      // Session check
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', {
          code: sessionError.status || 'unknown',
          message: sessionError.message,
          details: sessionError
        });
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!sessionData.session) {
        throw new Error('No active session found');
      }

      // First, fetch the basic model data
      const { data: modelsData, error: modelsError } = await supabase
        .from('models')
        .select(`
          id,
          title,
          description,
          price,
          model_url,
          preview_image_url,
          created_at,
          category,
          downloads,
          likes (count)
        `)
        .eq('user_id', userId);

      if (modelsError) {
        console.error('Supabase query error:', {
          code: modelsError.code,
          message: modelsError.message,
          details: modelsError.details,
          hint: modelsError.hint
        });
        throw new Error(`Database error: ${modelsError.message}`);
      }

      // Combine all data
      return modelsData.map(model => ({
        ...model,
        downloads: model.downloads || 0,
        likes: Array.isArray(model.likes) ? model.likes.length : 0,
        price: model.price || 0,
        category: model.category || '',
        user_id: userId
      })) as Model[];  // Explicitly cast to Model[]

    } catch (error) {
      const attemptLog = {
        attempt: i + 1,
        totalAttempts: retryCount,
        errorType: error instanceof Error ? 'Error' : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };

      console.error('Fetch attempt failed:', attemptLog);

      if (i === retryCount - 1) {
        const finalError = new Error(
          `Failed after ${retryCount} attempts: ${attemptLog.errorMessage}`
        );
        throw finalError;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Failed to fetch models after exhausting all retry attempts');
};

const deleteModelFiles = async (
  modelUrl: string | null,
  previewUrl: string | null,
  userId: string
): Promise<void> => {
  const getPathFromUrl = (url: string) => {
    const segments = url.split('/');
    return `${userId}/${segments[segments.length - 1]}`;
  };

  if (modelUrl) {
    const modelPath = getPathFromUrl(modelUrl);
    const { error: modelError } = await supabase.storage
      .from('models')
      .remove([modelPath]);
    
    if (modelError) {
      console.error('Model file deletion error:', modelError);
      throw modelError;
    }
  }

  if (previewUrl) {
    const previewPath = getPathFromUrl(previewUrl);
    const { error: previewError } = await supabase.storage
      .from('previews')
      .remove([previewPath]);
    
    if (previewError) {
      console.error('Preview file deletion error:', previewError);
      throw previewError;
    }
  }
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [userModels, setUserModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [modelToDelete, setModelToDelete] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalDownloads: 0,
    totalLikes: 0,
    totalEarnings: 0
  });
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!loading && !user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to view your dashboard",
        variant: "destructive",
      });
      router.replace('/auth?redirect=/dashboard');
    }
  }, [user, loading, router, toast]);

  useEffect(() => {
    async function fetchUserModels() {
      if (!user?.id) {
        console.warn('No user ID available for fetching models');
        return;
      }

      setIsLoadingModels(true);

      try {
        const models = await fetchUserModelsWithRetry(user.id);
        
        const stats = models.reduce((acc, model) => ({
          totalDownloads: acc.totalDownloads + (Number(model.downloads) || 0),
          totalLikes: acc.totalLikes + (Number(model.likes) || 0),
          totalEarnings: acc.totalEarnings + ((Number(model.downloads) || 0) * (Number(model.price) || 0))
        }), {
          totalDownloads: 0,
          totalLikes: 0,
          totalEarnings: 0
        });

        setUserModels(models);
        setStats(stats);

      } catch (error) {
        const errorLog = {
          type: error instanceof Error ? 'Error' : typeof error,
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        };

        console.error('Error in fetchUserModels:', errorLog);

        if (errorLog.message.includes('No active session') || 
            errorLog.message.includes('Session error')) {
          toast({
            title: "Session Expired",
            description: "Please sign in again to continue",
            variant: "destructive",
          });
          router.push('/auth?redirect=/dashboard');
          return;
        }

        toast({
          title: "Error",
          description: errorLog.message,
          variant: "destructive",
        });
      } finally {
        setIsLoadingModels(false);
      }
    }

    if (user) {
      fetchUserModels();
    }
  }, [user, toast, router]);

  if (loading || isLoadingModels) {
    return (
      <div className="container flex items-center justify-center min-h-screen">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleDeleteModel = async (modelId: number) => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to delete models",
        variant: "destructive",
      });
      router.push('/auth?redirect=/dashboard');
      return;
    }

    try {
      // Verify session first
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication session expired');
      }

      // Fetch the model with a single query
      const { data: model, error: fetchError } = await supabase
        .from('models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (fetchError) throw fetchError;
      if (!model) throw new Error('Model not found');
      if (model.user_id !== user.id) throw new Error('Unauthorized access');

      // Delete associated records in a transaction
      const { error: deleteError } = await supabase
        .from('models')
        .delete()
        .eq('id', modelId);

      if (deleteError) throw deleteError;

      // Delete storage files
      await deleteModelFiles(model.model_url, model.preview_image_url, user.id);

      // Update local state
      setUserModels(prevModels => prevModels.filter(m => m.id !== modelId));
      
      // Update stats
      const deletedDownloads = model.downloads || 0;
      const deletedLikes = model.likes || 0;
      const deletedEarnings = deletedDownloads * (model.price || 0);
      
      setStats(prev => ({
        totalDownloads: prev.totalDownloads - deletedDownloads,
        totalLikes: prev.totalLikes - deletedLikes,
        totalEarnings: prev.totalEarnings - deletedEarnings
      }));

      toast({
        title: "Success",
        description: "Model deleted successfully"
      });
    } catch (error: any) {
      console.error('Delete operation failed:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete model",
        variant: "destructive"
      });
    } finally {
      setModelToDelete(null);
    }
  };

  const totalEarnings = userModels.reduce((sum, model) => sum + (model.price * (model.downloads || 0)), 0);

  return (
    <div className="container py-8">
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold">Creator Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your 3D models and track your performance
          </p>
        </div>

        <Tabs defaultValue="overview" onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex bg-background border rounded-lg p-1">
            <TabsTrigger 
              value="overview"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm border-muted"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="models"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm border-muted"
            >
              My Models
            </TabsTrigger>
            <TabsTrigger 
              value="earnings"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm border-muted"
            >
              Earnings
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview">
            {userModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <Box className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No Models Found</h3>
                <p className="text-muted-foreground mt-2">
                  You haven't uploaded any 3D models yet.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Your First Model
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground">
                        +20.1% from last month
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Downloads</CardTitle>
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {userModels.reduce((sum, model) => sum + (model.downloads || 0), 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        +12.5% from last month
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Likes</CardTitle>
                      <Heart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {userModels.reduce((sum, model) => sum + (model.likes || 0), 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        +18.2% from last month
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Models</CardTitle>
                      <Box className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{userModels.length}</div>
                      <p className="text-xs text-muted-foreground">
                        +3 new this month
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 mt-6 md:grid-cols-2">
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Recent Downloads</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer 
                        config={{
                          downloads: {
                            theme: {
                              light: "hsl(215, 70%, 50%)",
                              dark: "hsl(215, 70%, 60%)"
                            }
                          }
                        }}
                      >
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={generateDownloadsData(userModels)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip 
                              content={({ active, payload, label }) => (
                                <ChartTooltipContent 
                                  active={active} 
                                  payload={payload} 
                                  label={label}
                                  labelFormatter={(value) => `${value}`}
                                  formatter={(value) => (
                                    <span className="font-mono font-medium">
                                      {Number(value).toLocaleString()} downloads
                                    </span>
                                  )}
                                />
                              )}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="downloads" 
                              stroke="var(--color-downloads)"
                              fill="var(--color-downloads)"
                              fillOpacity={0.2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                  
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Monthly Earnings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer 
                        config={{
                          earnings: {
                            theme: {
                              light: "hsl(143, 70%, 50%)",
                              dark: "hsl(143, 70%, 60%)"
                            }
                          }
                        }}
                      >
                        <ResponsiveContainer width="100%" height={150}>
                          <AreaChart data={generateMonthlyEarningsData(userModels)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip 
                              content={({ active, payload, label }) => (
                                <ChartTooltipContent 
                                  active={active} 
                                  payload={payload} 
                                  label={label}
                                  labelFormatter={(value) => `${value}`}
                                  formatter={(value) => (
                                    <span className="font-mono font-medium">
                                      ${Number(value).toLocaleString()}
                                    </span>
                                  )}
                                />
                              )}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="earnings" 
                              stroke="var(--color-earnings)"
                              fill="var(--color-earnings)"
                              fillOpacity={0.2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Performing Models</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {userModels
                          .sort((a, b) => (b.downloads || 0) - (a.downloads || 0)) // Sort by downloads in descending order
                          .slice(0, 5) // Take only top 5
                          .map((model) => (
                            <div key={model.id} className="flex items-center justify-between">
                              <div className="flex items-center flex-1 min-w-0">
                                <div className="w-12 h-12 rounded overflow-hidden mr-4">
                                  <img 
                                    src={model.preview_image_url} 
                                    alt={model.title} 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{model.title}</p>
                                  <div className="flex items-center text-sm text-muted-foreground">
                                    <Download className="h-4 w-4 mr-1" />
                                    {model.downloads || 0} downloads
                                  </div>
                                </div>
                              </div>
                              <div className="text-right font-medium">
                                ${((model.price || 0) * (model.downloads || 0)).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        {userModels.length === 0 && (
                          <div className="text-center text-muted-foreground py-6">
                            No models uploaded yet
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
          
          {/* My Models Tab */}
          <TabsContent value="models">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Your 3D Models</h2>
              <Button asChild>
                <Link href="/upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Model
                </Link>
              </Button>
            </div>
            
            {userModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <Box className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No Models Found</h3>
                <p className="text-muted-foreground mt-2">
                  Get started by uploading your first 3D model.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Your First Model
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {userModels.map((model) => (
                  <Card key={model.id} className="overflow-hidden">
                    <div className="aspect-video relative overflow-hidden bg-muted">
                      <img
                        src={model.preview_image_url}
                        alt={model.title}
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary">{model.category}</Badge>
                      </div>
                    </div>
                    <CardHeader className="p-4">
                      <CardTitle className="text-xl">{model.title}</CardTitle>
                      <div className="flex items-center text-sm text-muted-foreground">
                        Uploaded on {new Date(model.created_at).toLocaleDateString()}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Download className="h-4 w-4 mr-1" />
                            {model.downloads || 0}
                          </div>
                          <div className="flex items-center">
                            <Heart className="h-4 w-4 mr-1" />
                            {model.likes || 0}
                          </div>
                        </div>
                        <div className="text-lg font-bold">${model.price}</div>
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/edit/${model.id}`}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/models/${model.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Link>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive"
                        onClick={() => setModelToDelete(model.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
            
            {/* Add the Alert Dialog */}
            <AlertDialog open={modelToDelete !== null} onOpenChange={() => setModelToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your model
                    and remove all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => modelToDelete && handleDeleteModel(modelToDelete)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>
          
          {/* Earnings Tab */}
          <TabsContent value="earnings">
            {/* Calculate real earnings data */}
            {(() => {
              const now = new Date();
              const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              
              // Calculate this month's earnings
              const thisMonthEarnings = userModels.reduce((sum, model) => {
                const modelDate = new Date(model.created_at);
                if (modelDate >= firstDayOfMonth) {
                  return sum + (model.price * (model.downloads || 0));
                }
                return sum;
              }, 0);

              // Calculate pending payout (earnings from the last 30 days)
              const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
              const pendingPayout = userModels.reduce((sum, model) => {
                const modelDate = new Date(model.created_at);
                if (modelDate >= thirtyDaysAgo) {
                  return sum + (model.price * (model.downloads || 0));
                }
                return sum;
              }, 0);

              return (
                <div className="grid gap-6 md:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">This Month</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${thisMonthEarnings.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground">
                        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pending Payout</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${pendingPayout.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground">Last 30 days</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
            
            <Card className="mt-6">
              <CardHeader>  
                <CardTitle>Earnings History</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] overflow-hidden"> {/* Added overflow-hidden */}
                <div className="w-full h-full flex items-center justify-center"> {/* Added centering container */}
                  <ChartContainer 
                    config={{
                      earnings: {
                        theme: {
                          light: "hsl(143, 70%, 50%)",
                          dark: "hsl(143, 70%, 60%)"
                        }
                      }
                    }}
                    className="w-full h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart 
                        data={generateMonthlyEarningsData(userModels)}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip 
                          content={({ active, payload, label }) => (
                            <ChartTooltipContent 
                              active={active} 
                              payload={payload} 
                              label={label}
                              labelFormatter={(value) => `${value}`}
                              formatter={(value) => (
                                <span className="font-mono font-medium">
                                  ${Number(value).toLocaleString()}
                                </span>
                              )}
                            />
                          )}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="earnings" 
                          stroke="var(--color-earnings)"
                          fill="var(--color-earnings)"
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Payout - December 2023</p>
                      <p className="text-sm text-muted-foreground">Dec 31, 2023</p>
                    </div>
                    <div className="font-medium text-green-600 dark:text-green-400">+$490.00</div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Payout - November 2023</p>
                      <p className="text-sm text-muted-foreground">Nov 30, 2023</p>
                    </div>
                    <div className="font-medium text-green-600 dark:text-green-400">+$380.00</div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Payout - October 2023</p>
                      <p className="text-sm text-muted-foreground">Oct 31, 2023</p>
                    </div>
                    <div className="font-medium text-green-600 dark:text-green-400">+$420.00</div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Payout - September 2023</p>
                      <p className="text-sm text-muted-foreground">Sep 30, 2023</p>
                    </div>
                    <div className="font-medium text-green-600 dark:text-green-400">+$350.00</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

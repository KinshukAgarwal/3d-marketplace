"use client";

import { useEffect, useState } from "react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Cuboid as Cube3d } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

export default function AuthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const defaultTab = searchParams.get("tab") || "login";

  // Add state variables
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectPath);
    }
  }, [user, loading, router, redirectPath]);

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-screen">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        toast({
          title: "Success",
          description: "Logged in successfully",
        });
        
        router.push(redirectPath);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Failed to login',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: `${window.location.origin}/auth?redirect=/dashboard`,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Please check your email to confirm your account",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Failed to sign up',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container relative flex items-center justify-center min-h-screen py-12" data-page="auth">
      {/* Theme Toggle Button - Positioned in top-right corner */}
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Cube3d className="h-8 w-8 transition-transform hover:rotate-12" />
            <CardTitle className="text-2xl font-bold">Overflow 3D</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className={cn(
              "grid w-full grid-cols-2",
              "bg-gray-100 dark:bg-gray-800", // Grey background
              "rounded-lg p-1"
            )}>
              <TabsTrigger 
                value="login"
                className={cn(
                  "rounded-md transition-all",
                  "text-gray-600 dark:text-gray-400",
                  "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-950",
                  "data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-50",
                  "data-[state=active]:shadow-sm",
                  "data-[state=active]:font-medium"
                )}
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="signup"
                className={cn(
                  "rounded-md transition-all",
                  "text-gray-600 dark:text-gray-400",
                  "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-950",
                  "data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-50",
                  "data-[state=active]:shadow-sm",
                  "data-[state=active]:font-medium"
                )}
              >
                Sign Up
              </TabsTrigger>
            </TabsList>
            <div>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Loading..." : "Login"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm Password</label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Loading..." : "Sign Up"}
                  </Button>
                </form>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}






























































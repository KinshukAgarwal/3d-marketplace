"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cuboid as Cube3d, Search, Upload, User } from "lucide-react";
import Spline from '@splinetool/react-spline';
// import Spline from '@splinetool/react-spline/next';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";

const softwareList = [
  {
    name: "Blender",
    icon: "/icons/blender.png",
    url: "https://www.blender.org",
    className: ""
  },
  {
    name: "Maya",
    icon: "/icons/maya.png",
    url: "https://www.autodesk.com/products/maya/overview",
    className: ""
  },
  {
    name: "3ds Max",
    icon: "/icons/3ds.png",
    url: "https://www.autodesk.com/products/3ds-max/overview",
    className: ""
  },
  {
    name: "Cinema 4D",
    icon: "/icons/cinema4d.png",
    url: "https://www.maxon.net/cinema-4d",
    className: ""
  },
  {
    name: "ZBrush",
    icon: "/icons/zbrush.png",
    url: "https://pixologic.com/",
    className: "zbrush-logo"
  }
];



export default function Home() {
  const router = useRouter();

  // Enable view transitions
  useEffect(() => {
    document.documentElement.style.setProperty("view-transition-name", "home-page");
  }, []);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="container px-4 md:px-6 relative z-10">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-5xl font-bold tracking-tighter max-sm:text-5xl max-md:text-5xl xl:text-6xl/none">
                  Scan, Discover, Download, and Share 3D Models
                </h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl">
                  Overflow 3D is the premier marketplace for high-quality 3D models. Find the perfect assets for your next project or share your creations with the world.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Button className="h-12" size="lg" onClick={() => router.push("/marketplace")}>
                  Browse Marketplace
                </Button>
                <Button className="h-12" size="lg" variant="outline" onClick={() => router.push("/auth")}>
                  Get Started
                </Button>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[500px] aspect-square rounded-lg overflow-hidden shadow-xl flex justify-center items-center">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm flex justify-center items-center">
                  {/* <Spline scene="https://prod.spline.design/7WaQT0WlKSaNPFnv/scene.splinecode" /> */}
                  <Cube3d className="scale-[3]"></Cube3d>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-24 bg-muted/50 dark:bg-background features-section">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                Everything You Need
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl">
                Our platform provides all the tools you need to discover, share, and manage 3D models
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-3 lg:gap-10 mt-12">
            <div className="feature-card flex flex-col items-center space-y-4 border border-border rounded-xl p-8 bg-card/80 backdrop-blur-sm relative overflow-hidden transition-all duration-300 hover:border-primary/60 group shadow-sm hover:shadow-md w-full min-h-[320px]">
              <div className="glow-effect absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"></div>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                <Search className="h-8 w-8 text-primary relative z-10 transition-transform duration-300 group-hover:-rotate-12 group-hover:-translate-x-1" />
              </div>
              <h3 className="text-xl font-bold relative z-10">Discover Models</h3>
              <p className="text-muted-foreground text-center relative z-10 group-hover:text-foreground/90">
                Browse thousands of high-quality 3D models for games, AR/VR, animation, and more.
              </p>
            </div>
            <div className="feature-card flex flex-col items-center space-y-4 border border-border rounded-xl p-8 bg-card/80 backdrop-blur-sm relative overflow-hidden transition-all duration-300 hover:border-primary/60 group shadow-sm hover:shadow-md w-full min-h-[320px] perspective">
              <div className="glow-effect absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"></div>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                <Upload className="h-8 w-8 text-primary relative z-10 transition-transform duration-300 group-hover:-translate-y-1" />
              </div>
              <h3 className="text-xl font-bold relative z-10 transition-transform duration-300 group-hover:transform group-hover:translate-z-5">Share Your Work</h3>
              <p className="text-muted-foreground text-center relative z-10 group-hover:text-foreground/90 transition-all duration-300 group-hover:transform group-hover:translate-z-5">
                Upload your 3D creations and share them with a community of creators and developers.
              </p>
            </div>
            <div className="feature-card flex flex-col items-center space-y-4 border border-border rounded-xl p-8 bg-card/80 backdrop-blur-sm relative overflow-hidden transition-all duration-300 hover:border-primary/60 group shadow-sm hover:shadow-md w-full min-h-[320px]">
              <div className="glow-effect absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"></div>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                <User className="h-8 w-8 text-primary relative z-10 transition-transform duration-300 group-hover:rotate-12 group-hover:translate-x-1" />
              </div>
              <h3 className="text-xl font-bold relative z-10">Manage Your Portfolio</h3>
              <p className="text-muted-foreground text-center relative z-10 group-hover:text-foreground/90">
                Track downloads, manage your models, and build your reputation in the 3D community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Software Section */}
      <section className="py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                Compatible with Your Favorite Tools
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl">
                Our marketplace supports models from all major 3D creation software
              </p>
            </div>
          </div>

          <div className="mt-12">
            <InfiniteMovingCards 
              items={softwareList}
              speed="slow"
              direction="left"
            />

            <div className="mt-12 text-center">
              <p className="text-muted-foreground">
                Support for all major file formats including .fbx, .obj, .gltf, .blend, .max, .c4d, and more
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                Ready to Get Started?
              </h2>
              <p className="max-w-[600px] text-muted-foreground md:text-xl">
                Join thousands of creators and developers on ModelHub today.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button size="lg" onClick={() => router.push("/auth")}>
                Sign Up Now
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push("/marketplace")}>
                Explore Models
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-24 bg-muted/50 dark:bg-background">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                FAQ's
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl">
                Everything you need to know about Overflow 3D marketplace
              </p>
            </div>
          </div>
          
          <div className="mx-auto max-w-[800px] mt-12">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>What file formats are supported?</AccordionTrigger>
                <AccordionContent>
                  We support all major 3D file formats including .fbx, .obj, .gltf, .glb, .stl, and .ply. 
                  All models are verified for quality and compatibility before being listed.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>How do I sell my 3D models?</AccordionTrigger>
                <AccordionContent>
                  Simply create an account, verify your email, and click the Upload button to start selling. 
                  You can set your own prices and earn up to 80% commission on each sale.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger>What are the licensing terms?</AccordionTrigger>
                <AccordionContent>
                  Each model comes with a standard license for personal and commercial use. 
                  Extended licenses are available for large-scale commercial projects.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger>How does the 3D scanning feature work?</AccordionTrigger>
                <AccordionContent>
                  Our advanced 3D scanning technology allows you to create 3D models from real objects 
                  using just your smartphone camera. Visit the Scan page to learn more.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger>Is there a free trial available?</AccordionTrigger>
                <AccordionContent>
                  Yes! New users can download up to 3 free models per month. 
                  You can also preview all models in 3D before purchasing.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>
    </div>
  );
}


"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { Cuboid as Cube3d, Home, ShoppingCart, Upload, User, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  if (pathname === "/auth") {
    return null;
  }

  const routes = [
    {
      href: "/",
      label: "Home",
      icon: Home,
      active: pathname === "/",
    },
    {
      href: "/marketplace",
      label: "Marketplace",
      icon: ShoppingCart,
      active: pathname === "/marketplace",
    },
    {
      href: "/scan",
      label: "3D Scan",
      icon: Cube3d,
      active: pathname === "/scan",
    },
    {
      href: "/upload",
      label: "Upload",
      icon: Upload,
      active: pathname === "/upload",
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: User,
      active: pathname === "/dashboard",
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link 
          href="/" 
          className="flex items-center space-x-2 nav-logo relative overflow-hidden group rounded-lg px-3 py-1 transition-all hover:scale-105"
        >
          <Cube3d className="h-6 w-6 transition-transform group-hover:rotate-12" />
          <span className="font-bold">
            Overflow 3D
          </span>
        </Link>
        
        {/* Desktop Navigation */}
        <NavigationMenu className="ml-6 hidden lg:flex">
          <NavigationMenuList className="gap-2">
            {routes.map((route) => (
              <NavigationMenuItem key={route.href}>
                <Link href={route.href} legacyBehavior passHref>
                  <NavigationMenuLink
                    className={cn(
                      "flex items-center gap-2 relative overflow-hidden group transition-all duration-300 ease-out hover:scale-105 bg-transparent",
                      "px-4 py-2 ml-1 rounded-md",
                      route.active ? "text-primary before:absolute before:inset-0 before:bg-primary/10" : "text-muted-foreground",
                      "before:absolute before:inset-0 before:w-full before:h-full before:bg-gradient-to-r before:from-transparent before:via-primary/10 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-500 before:ease-out"
                    )}
                  >
                    <route.icon className="h-4 w-4 transition-transform group-hover:scale-110 group-hover:rotate-3" />
                    <span className="relative z-10">
                      {route.label}
                    </span>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="ml-auto flex items-center space-x-4">
          <ModeToggle />
          
          {/* Desktop User Menu */}
          {user ? (
            <div className="hidden lg:flex">
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-8 w-8 rounded-full hover:scale-105 transition-transform"
                      onClick={(e) => {
                        // Prevent default behavior
                        e.preventDefault();
                        // Find the trigger and click it programmatically
                        const trigger = e.currentTarget.closest('li')?.querySelector('[data-state]');
                        if (trigger instanceof HTMLElement) {
                          trigger.click();
                        }
                      }}
                    >
                      <Avatar className="h-8 w-8 border-2 border-border hover:border-primary transition-colors">
                        <AvatarFallback>
                          {user.user_metadata.full_name?.[0] || user.email?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                    <NavigationMenuTrigger className="hidden">
                      {/* Empty trigger that will be clicked programmatically */}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-48 p-2">
                        <Link
                          href="/dashboard"
                          className="block px-2 py-1.5 text-sm hover:bg-accent rounded-md relative group overflow-hidden"
                        >
                          <span className="relative z-10">Dashboard</span>
                          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
                        </Link>
                        <Link
                          href="/upload"
                          className="block px-2 py-1.5 text-sm hover:bg-accent rounded-md relative group overflow-hidden"
                        >
                          <span className="relative z-10">Upload Model</span>
                          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
                        </Link>
                        <div className="h-px my-1 bg-border" />
                        <button
                          onClick={async () => await signOut()}
                          className="w-full flex items-center px-2 py-1.5 text-sm hover:bg-accent rounded-md text-left relative group overflow-hidden"
                        >
                          <LogOut className="mr-2 h-4 w-4 transition-transform group-hover:rotate-12" />
                          <span className="relative z-10">Log out</span>
                          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-destructive/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
                        </button>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          ) : (
            <Button 
              asChild 
              variant="outline" 
              size="sm"
              className="relative overflow-hidden group hover:scale-105 transition-all duration-300 hidden lg:flex"
            >
              <Link href="/auth">
                <span className="relative z-10">Sign In</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
              </Link>
            </Button>
          )}

          {/* Mobile Menu Button */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80" title={""}>
              <nav className="flex flex-col h-full pt-6">
                <div className="flex-1">
                  {routes.map((route) => (
                    <Link
                      key={route.href}
                      href={route.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors mb-1",
                        route.active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-accent"
                      )}
                    >
                      <route.icon className="h-4 w-4" />
                      {route.label}
                    </Link>
                  ))}
                </div>

                {/* Mobile User Profile */}
                {user ? (
                  <div className="mt-auto border-t pt-4">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                      <Avatar className="h-10 w-10 border-2 border-border">
                        <AvatarFallback>
                          {user.user_metadata.full_name?.[0] || user.email?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {user.user_metadata.full_name || 'User'}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await signOut();
                        setIsOpen(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:text-destructive hover:bg-destructive/10 w-full text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                ) : (
                  <div className="mt-auto border-t pt-4 px-4">
                    <Button 
                      asChild 
                      className="w-full"
                      onClick={() => setIsOpen(false)}
                    >
                      <Link href="/auth">Sign In</Link>
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}








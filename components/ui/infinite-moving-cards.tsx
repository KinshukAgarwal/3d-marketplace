"use client";

import React, { useEffect, useState, useRef } from "react";

export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "normal",
}: {
  items: {
    icon: string;
    name: string;
    url: string;
    className?: string;
  }[];
  direction?: "left" | "right";
  speed?: "slow" | "normal" | "fast";
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [duplicatedItems, setDuplicatedItems] = useState<typeof items>([]);

  useEffect(() => {
    // Duplicate items multiple times to ensure seamless looping
    setDuplicatedItems([...items, ...items, ...items, ...items]);
  }, [items]);

  // Map speed to actual CSS animation duration
  const speedMap = {
    slow: "40s",
    normal: "25s",
    fast: "15s",
  };

  return (
    <div className="relative w-full overflow-hidden">
      {/* Left fade effect */}
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
      
      <div
        ref={containerRef}
        className="flex gap-12 py-8"
        style={{
          animationDuration: speedMap[speed],
          animationName: "scroll",
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationDirection: direction === "right" ? "reverse" : "normal",
        }}
      >
        {duplicatedItems.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center gap-2 cursor-pointer"
            onClick={() => window.open(item.url, '_blank')}
          >
            <div className="h-20 flex items-center justify-center">
              <img
                src={item.icon.startsWith("http") || item.icon.startsWith("/") ? item.icon : `/icons/${item.icon}`}
                alt={item.name}
                className={`h-auto max-h-20 w-auto ${
                  item.name === "ZBrush" || item.name === "Blender" 
                    ? "max-w-[200px]" 
                    : "max-w-[160px]"
                } object-contain ${item.className || ''}`}
                onError={(e) => {
                  e.currentTarget.src = "/placeholder-image.svg";
                }}
              />
            </div>
            <span className="text-sm mt-2">{item.name}</span>
          </div>
        ))}
      </div>
      
      {/* Right fade effect */}
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />
    </div>
  );
};

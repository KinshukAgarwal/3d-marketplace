import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  max: number;
}

export function CharacterCounter({ current, max }: CharacterCounterProps) {
  const isNearLimit = current >= max * 0.9;
  const isAtLimit = current >= max;

  return (
    <div
      className={cn(
        "text-xs transition-colors",
        isAtLimit ? "text-destructive font-medium" : "text-muted-foreground",
        isNearLimit && !isAtLimit && "text-orange-500"
      )}
    >
      {current}/{max}
    </div>
  );
}

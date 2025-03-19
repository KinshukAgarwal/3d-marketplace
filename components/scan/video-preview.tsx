import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Check } from "lucide-react";

interface VideoPreviewProps {
  file: File;
  onCancel: () => void;
  onConfirm: () => void;
}

export function VideoPreview({ file, onCancel, onConfirm }: VideoPreviewProps) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <video
          className="w-full max-w-md mx-auto rounded-lg" // Added max-width and centered
          src={URL.createObjectURL(file)}
          controls
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={onCancel}
            type="button"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            type="button"
          >
            <Check className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
      </Card>
    </div>
  );
}

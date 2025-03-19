import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export function RecordingGuidelines() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Recording Guidelines</AlertTitle>
      <AlertDescription>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Record a complete 360° view of the object</li>
          <li>Ensure good lighting conditions</li>
          <li>Keep the object centered in frame</li>
          <li>Avoid fast movements</li>
          <li>Maximum file size: 100MB</li>
          <li>Supported formats: MP4, MOV, AVI</li>
        </ul>
      </AlertDescription>
    </Alert>
  );
}
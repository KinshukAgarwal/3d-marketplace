import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Download } from "lucide-react";
import { ProcessingStatus } from "./processing-status";

interface Task {
  id: string;
  filename: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  modelUrl?: string;
}

interface TaskListProps {
  tasks: Task[];
  onDelete: (taskId: string) => void;
}

export function TaskList({ tasks, onDelete }: TaskListProps) {
  const handleDownload = (task: Task) => {
    // Create a simple test GLB file (just a small blob)
    const testData = new Blob(['Test 3D model data'], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(testData);
    
    // Create a download link and trigger it
    const a = document.createElement('a');
    a.href = url;
    a.download = `${task.filename.replace(/\s+/g, '_')}.glb`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 100);
  };

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card key={task.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium">{task.filename}</h3>
              <p className="text-sm text-muted-foreground">
                Status: {task.status}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {task.status === 'completed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(task)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(task.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {(task.status === 'uploading' || task.status === 'processing') && (
            <ProcessingStatus
              status={task.status}
              progress={task.progress}
            />
          )}

          {task.status === 'failed' && task.error && (
            <div className="mt-2 text-sm text-destructive">
              Error: {task.error}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

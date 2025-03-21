import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Trash2, Eye, Upload } from "lucide-react";
import { ProcessingStatus } from "./processing-status";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Task {
  id: string;
  status: string;
  filename: string;
  progress: number;
  modelUrl: string | null;
  error: string | null;
}

interface TaskListProps {
  tasks: Task[];
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, onDelete }: TaskListProps) {
  const router = useRouter();
  
  const handleViewProcessing = (jobId: string) => {
    router.push(`/dashboard/processing/${jobId}`);
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
              {task.status === 'completed' && task.modelUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => task.modelUrl && router.push(`/model-viewer?url=${encodeURIComponent(task.modelUrl)}`)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href={task.modelUrl} download>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </a>
                  </Button>
                </>
              )}
              {(task.status === 'processing' || task.status === 'uploading') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewProcessing(task.id)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View Progress
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
            <div className="mt-2">
              <ProcessingStatus
                status={task.status}
                progress={task.progress}
              />
            </div>
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

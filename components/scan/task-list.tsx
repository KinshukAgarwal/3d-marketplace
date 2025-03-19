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

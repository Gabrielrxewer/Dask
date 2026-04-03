import { Button } from "@/shared/ui";

interface CreateTaskButtonProps {
  onCreate: () => void;
}

export function CreateTaskButton({ onCreate }: CreateTaskButtonProps) {
  return (
    <Button variant="primary" onClick={onCreate}>
      + Nova tarefa
    </Button>
  );
}

import { useCallback } from "react";

import { toast } from "sonner";

import { IkEntity } from "../../../types";
import { Entity } from "../entities/Entity";

import { ErrorCardShell } from "./ErrorCardShell";

interface DependencyErrorProps {
  id: string | number;
  title: string;
  metadata?: Record<string, any>;
}

export const DependencyError = ({
  id,
  title,
  metadata,
}: DependencyErrorProps) => {
  const handleDismiss = useCallback(() => {
    toast.dismiss(id);
  }, [id]);

  return (
    <ErrorCardShell title={title} onDismiss={handleDismiss}>
      <div className="flex flex-col items-start gap-1.5 pl-8">
        {metadata?.map((r: IkEntity) => (
          <Entity key={r.id} entity={r} />
        ))}
      </div>
    </ErrorCardShell>
  );
};

DependencyError.displayName = "DependencyError";

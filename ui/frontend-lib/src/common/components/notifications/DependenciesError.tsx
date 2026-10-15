import { useCallback } from "react";

import { toast } from "sonner";

import { IkEntity } from "../../../types";
import { Entity } from "../entities/Entity";

import { ErrorCardShell } from "./ErrorCardShell";

interface DependencyErrorProps {
  id: string | number;
  message: string;
  metadata?: Record<string, any>;
}

export const DependencyError = ({
  id,
  message,
  metadata,
}: DependencyErrorProps) => {
  const handleDismiss = useCallback(() => {
    toast.dismiss(id);
  }, [id]);

  return (
    <ErrorCardShell title={message} onDismiss={handleDismiss}>
      {metadata?.map((r: IkEntity) => (
        <div
          className="mb-2 rounded-surface border border-divider p-3"
          key={r.id}
        >
          <p className="m-0 text-body2 font-semibold">
            <Entity entity={r} />
          </p>
        </div>
      ))}
    </ErrorCardShell>
  );
};

DependencyError.displayName = "DependencyError";

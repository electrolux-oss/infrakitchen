import { useCallback } from "react";

import { Box, Typography } from "@mui/material";
import { toast } from "sonner";

import { IkEntity } from "../../../types";
import { Entity } from "../entities/Entity";
import { ErrorCardShell } from "./ErrorCardShell";

interface DependencyErrorProps {
  id: string | number;
  message: string;
  metadata?: Record<string, any>;
}

export const DependencyError = ({ id, message, metadata }: DependencyErrorProps) => {
  const handleDismiss = useCallback(() => {
    toast.dismiss(id);
  }, [id]);

  return (
    <ErrorCardShell title={message} onDismiss={handleDismiss}>
      {metadata?.map((r: IkEntity) => (
        <Box
          key={r.id}
          sx={{
            border: 1,
            borderColor: "divider",
            p: 1.5,
            mb: 1,
            borderRadius: "var(--template-surface-radius)",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            <Entity entity={r} />
          </Typography>
        </Box>
      ))}
    </ErrorCardShell>
  );
};

DependencyError.displayName = "DependencyError";

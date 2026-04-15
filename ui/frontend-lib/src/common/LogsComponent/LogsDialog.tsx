import { ReactNode, useCallback, useState } from "react";

import { CommonDialog } from "../components/CommonDialog";

import { getDialogTitle } from "./LogActionButtons";
import { Logs } from "./Logs";

export interface LogsDialogProps {
  entityId: string;
  action?: string;
  view: "summary" | "logs";
  auditLogId?: string;
  traceId?: string;
  executionStart?: number;
  onClose: () => void;
  onViewChange?: (view: "summary" | "logs") => void;
}

export const LogsDialog = ({
  entityId,
  action,
  view,
  auditLogId,
  traceId,
  executionStart,
  onClose,
  onViewChange,
}: LogsDialogProps) => {
  const [headerAction, setHeaderAction] = useState<ReactNode>(undefined);

  const handleOpenLogs = useCallback(() => {
    onViewChange?.("logs");
  }, [onViewChange]);

  return (
    <CommonDialog
      title={getDialogTitle(view, action)}
      maxWidth="md"
      hasFooterActions={false}
      open
      onClose={onClose}
      headerAction={headerAction}
      content={
        <Logs
          entityId={entityId}
          auditLogId={auditLogId}
          traceId={traceId}
          executionStart={executionStart}
          eventAction={action}
          view={view}
          onHeaderActionReady={setHeaderAction}
          onOpenLogs={handleOpenLogs}
        />
      }
    />
  );
};

import { Icon } from "@iconify/react";
import ixLogData from "@iconify-icons/ix/log";

import { AuditExecutionResult } from "../../../audit_logs/components/AuditExecutionResult";
import { AutoAwesomeIcon } from "../../../icons/material";
import { AuditLogEntity } from "../../../types";
import { IconButton, Tooltip } from "../../../ui";
import { RelativeTime } from "../fields/RelativeTime";
import { RevisionChip } from "../labels/RevisionChip";

import { HorizontalTimeline } from "./HorizontalTimeline";

interface RevisionTimelineProps {
  revision: string;
  logs: AuditLogEntity[];
  actionsWithLogs: string[];
  onRevisionClick?: (revisionNumber: number) => void;
  onOpenDialog: (rowId: string, view: "summary" | "logs") => void;
}

export const RevisionTimeline = ({
  revision,
  logs,
  actionsWithLogs,
  onRevisionClick,
  onOpenDialog,
}: RevisionTimelineProps) => {
  return (
    <div className="mb-6">
      <div className="flex flex-row items-center gap-2">
        <RevisionChip
          revision={revision}
          variant="outlined"
          onClick={
            logs[0].revisionNumber && onRevisionClick
              ? () => onRevisionClick(logs[0].revisionNumber as number)
              : undefined
          }
        />
        <RelativeTime className="text-[0.75rem]" date={logs[0].createdAt} />
      </div>
      <div className="mt-6">
        <HorizontalTimeline
          items={[...logs].reverse()}
          renderItem={(log) => (
            <>
              <p className="m-0 mt-1 text-body2 font-medium">{log.action}</p>
              <RelativeTime className="text-[0.7rem]" date={log.createdAt} />
              <div className="mt-1">
                <AuditExecutionResult log={log} hideSummary />
              </div>
              {actionsWithLogs.includes(log.action) && (
                <div className="mt-0.5 flex flex-row gap-0.5 [&_.d-btn]:border-0">
                  {log.action !== "sync" && (
                    <Tooltip title="Summary">
                      <IconButton
                        size="small"
                        onClick={() => onOpenDialog(log.id, "summary")}
                      >
                        <AutoAwesomeIcon className="text-[1rem]" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Logs">
                    <IconButton
                      size="small"
                      onClick={() => onOpenDialog(log.id, "logs")}
                    >
                      <Icon icon={ixLogData} ssr width={16} />
                    </IconButton>
                  </Tooltip>
                </div>
              )}
            </>
          )}
        />
      </div>
    </div>
  );
};

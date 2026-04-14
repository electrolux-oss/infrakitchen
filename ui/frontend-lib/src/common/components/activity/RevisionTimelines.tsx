import { useMemo, useState } from "react";

import { Box, Button } from "@mui/material";

import { AuditLogEntity } from "../../../types";

import { RevisionTimeline } from "./RevisionTimeline";

interface RevisionTimelinesProps {
  logs: AuditLogEntity[];
  actionsWithLogs: string[];
  onRevisionClick?: (revisionNumber: number) => void;
  onOpenDialog: (rowId: string, view: "summary" | "logs") => void;
}

export const RevisionTimelines = ({
  logs,
  actionsWithLogs,
  onRevisionClick,
  onOpenDialog,
}: RevisionTimelinesProps) => {
  const [limit, setLimit] = useState(3);

  // Groups logs by revision, preserving insertion order
  const groups = useMemo(() => {
    const result: [string, AuditLogEntity[]][] = [];
    const map = new Map<string, AuditLogEntity[]>();
    for (const log of logs) {
      // Falls back to "v1" when revision_number is not available
      const revision = `v${log.revision_number ?? 1}`;
      if (!map.has(revision)) {
        const arr: AuditLogEntity[] = [];
        map.set(revision, arr);
        result.push([revision, arr]);
      }
      map.get(revision)!.push(log);
    }
    return result;
  }, [logs]);

  return (
    <>
      {groups.slice(0, limit).map(([revision, logs]) => (
        <RevisionTimeline
          key={revision}
          revision={revision}
          logs={logs}
          actionsWithLogs={actionsWithLogs}
          onRevisionClick={onRevisionClick}
          onOpenDialog={onOpenDialog}
        />
      ))}
      {groups.length > 0 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Button
            variant="text"
            disabled={groups.length <= limit}
            onClick={() => setLimit((prev) => prev + 3)}
          >
            Show more
          </Button>
        </Box>
      )}
    </>
  );
};

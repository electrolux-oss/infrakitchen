import { useMemo, useState } from "react";

import { Box, Button } from "@mui/material";

import { AuditLogEntity } from "../../../types";

import { RevisionTimeline } from "./RevisionTimeline";

interface RevisionTimelinesProps {
  logs: AuditLogEntity[];
  search: string;
  actionsWithLogs: string[];
  onRevisionClick?: (revisionNumber: number) => void;
  onOpenDialog: (rowId: string, view: "summary" | "logs") => void;
}

export const RevisionTimelines = ({
  logs,
  search,
  actionsWithLogs,
  onRevisionClick,
  onOpenDialog,
}: RevisionTimelinesProps) => {
  const [limit, setLimit] = useState(3);

  // Search filtering for timeline view
  const filteredLogs = useMemo(() => {
    const tokens = search.toLowerCase().split(" ").filter(Boolean);
    if (tokens.length === 0) return logs;
    return logs.filter((log) =>
      tokens.every(
        (token) =>
          log.action.toLowerCase().includes(token) ||
          (log.creator?.identifier ?? "system").toLowerCase().includes(token),
      ),
    );
  }, [logs, search]);

  // Groups logs by revision, preserving insertion order
  const groups = useMemo(() => {
    const result: [string, AuditLogEntity[]][] = [];
    const map = new Map<string, AuditLogEntity[]>();
    for (const log of filteredLogs) {
      // Falls back to "v1" when revision_number is not available
      const revision = log.revision_number
        ? `v${log.revision_number}`
        : "uncategorized";
      if (!map.has(revision)) {
        const arr: AuditLogEntity[] = [];
        map.set(revision, arr);
        result.push([revision, arr]);
      }
      map.get(revision)!.push(log);
    }
    return result;
  }, [filteredLogs]);

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

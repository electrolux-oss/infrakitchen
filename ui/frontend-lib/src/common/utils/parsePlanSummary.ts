import { LogEntity } from "../../types";

export interface ChangeSummary {
  id: string;
  action: "CREATE" | "DESTROY" | "REPLACE" | "UPDATE";
  resourceType: string;
  resourceName: string;
  rawLines: string[];
}

export type ExecutionStatus = "DONE" | "ERROR" | "IN_PROGRESS";

export const getExecutionStatus = (
  logs: LogEntity[],
  eventAction?: string,
): ExecutionStatus => {
  if (logs.length === 0) return "IN_PROGRESS";

  if (logs.some((log) => String(log.level ?? "").toLowerCase() === "error")) {
    return "ERROR";
  }

  const logText = logs.map((log) => String(log.data ?? "")).join("\n");

  if (/error:|failed\b|exception\b|traceback\b/i.test(logText)) {
    return "ERROR";
  }
  if (
    (eventAction === "dryrun" || eventAction === "dryrun_with_temp_state") &&
    /plan:/i.test(logText)
  ) {
    return "DONE";
  }
  if (
    /apply complete!?|apply successful|create task is done|update task is done|destroy task is done|sync task is done|no changes detected/i.test(
      logText,
    )
  ) {
    return "DONE";
  }

  return "IN_PROGRESS";
};

export const parsePlanSummary = (logs: LogEntity[]): ChangeSummary[] => {
  const changes: Map<string, ChangeSummary> = new Map();
  const resourcePattern =
    /# (.+?) (?:(?:will be (created|destroyed|updated|replaced))|(?:must be (replaced)))/;
  const ansiEscape = String.fromCharCode(27);
  const ansiPattern = new RegExp(`${ansiEscape}\\[[0-9;]*m`, "g");

  // Find index of every resource header line
  const headerIndices: number[] = [];
  logs.forEach((log, i) => {
    const clean = String(log.data ?? "").replace(ansiPattern, "");
    if (resourcePattern.test(clean)) headerIndices.push(i);
  });

  headerIndices.forEach((startIdx, groupIdx) => {
    const endIdx = headerIndices[groupIdx + 1] ?? logs.length;
    const headerClean = String(logs[startIdx].data ?? "").replace(
      ansiPattern,
      "",
    );
    const match = headerClean.match(resourcePattern);
    if (!match) return;

    const fullResourceName = match[1];
    const actionRaw = match[2] ?? match[3];

    const resourceMatch = fullResourceName.match(/^(\w+)\.(.+)$/);
    if (!resourceMatch) return;

    const [, resourceType, resourceNameWithIndex] = resourceMatch;

    let action: ChangeSummary["action"] = "UPDATE";

    if (actionRaw === "created") action = "CREATE";
    else if (actionRaw === "destroyed") action = "DESTROY";
    else if (actionRaw === "replaced") action = "REPLACE";
    else if (actionRaw === "updated") action = "UPDATE";

    const id = `${action}-${fullResourceName}`;

    // Keep only the resource diff block (from `~|+|-|-/+|+/- resource ... {` to matching `}`).
    const blockStartPattern =
      /^\s*(?:\d{2}:\d{2}:\d{2}\.\s*)?(?:~|[+-](?:\/[+-])?)\s+resource\b/;
    const rawLines: string[] = [];
    let blockStarted = false;
    let braceBalance = 0;

    for (let i = startIdx + 1; i < endIdx; i++) {
      const line = String(logs[i].data ?? "");
      const cleanLine = line.replace(ansiPattern, "");

      if (!blockStarted) {
        if (!blockStartPattern.test(cleanLine)) {
          continue;
        }
        blockStarted = true;
      }

      rawLines.push(line);

      for (const ch of cleanLine) {
        if (ch === "{") braceBalance += 1;
        if (ch === "}") braceBalance -= 1;
      }

      if (blockStarted && braceBalance <= 0) {
        break;
      }
    }

    if (!changes.has(id)) {
      changes.set(id, {
        id,
        action,
        resourceType,
        resourceName: resourceNameWithIndex,
        rawLines,
      });
    }
  });

  const actionOrder: Record<ChangeSummary["action"], number> = {
    REPLACE: 0,
    DESTROY: 1,
    UPDATE: 2,
    CREATE: 3,
  };

  const result = Array.from(changes.values()).sort(
    (a, b) => (actionOrder[a.action] ?? 999) - (actionOrder[b.action] ?? 999),
  );

  return result;
};

export const getActionColor = (
  action: ChangeSummary["action"],
): "error" | "warning" | "info" | "success" => {
  switch (action) {
    case "UPDATE":
      return "warning";
    case "DESTROY":
    case "REPLACE":
      return "error";
    case "CREATE":
      return "success";
    default:
      return "info";
  }
};

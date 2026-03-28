import { LogEntity } from "../../types";

export interface ChangeSummary {
  id: string;
  action: "CREATE" | "DESTROY" | "REPLACE" | "UPDATE";
  resourceType: string;
  resourceName: string;
  rawLines: string[];
  executionStatus?: "IN_PROGRESS" | "COMPLETE" | "ERROR";
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

export const parsePlanSummary = (
  logs: LogEntity[],
  trackExecution = false,
): ChangeSummary[] => {
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

  if (trackExecution) {
    const resourceExecutionPattern =
      /^(?:\d{2}:\d{2}:\d{2}\.\s*)?([A-Za-z0-9_][^:\s]*):\s+(.+)$/;
    const inProgressPattern =
      /\b(?:Destroying|Creating|Modifying|Still\s+destroying|Still\s+creating|Still\s+modifying)\.\.\./i;
    const completePattern =
      /\b(?:Modifications complete after|Creation complete after|Destruction complete after)\b/i;
    const withPattern = /\bwith\s+([A-Za-z0-9_][^,\s]*),/i;
    const errorPattern = /\berror:/i;

    const byResource = new Map<string, ChangeSummary>();
    changes.forEach((change) => {
      byResource.set(`${change.resourceType}.${change.resourceName}`, change);
    });

    const markResourceError = (resourceAddress?: string) => {
      if (!resourceAddress) return;
      const target = byResource.get(resourceAddress.trim());
      if (target) {
        target.executionStatus = "ERROR";
      }
    };

    let inErrorBlock = false;
    let errorBlockLines: string[] = [];
    let errorBlockResources = new Set<string>();

    logs.forEach((log) => {
      const rawLine = String(log.data ?? "");
      const line = rawLine.replace(ansiPattern, "");

      if (/^\s*(?:│\s*)?Error:/i.test(line)) {
        inErrorBlock = true;
        errorBlockLines = [rawLine];
        errorBlockResources = new Set<string>();
      }

      if (inErrorBlock) {
        if (errorBlockLines.length === 0) {
          errorBlockLines.push(rawLine);
        } else if (errorBlockLines[errorBlockLines.length - 1] !== rawLine) {
          errorBlockLines.push(rawLine);
        }

        const withMatch = line.match(withPattern);
        if (withMatch) {
          errorBlockResources.add(withMatch[1].trim());
          markResourceError(withMatch[1]);
        }

        if (line.includes("╵")) {
          errorBlockResources.forEach((resourceAddress) => {
            const target = byResource.get(resourceAddress);
            if (!target) return;

            if (target.rawLines.length > 0) {
              target.rawLines.push("");
            }
            target.rawLines.push(...errorBlockLines);
          });

          inErrorBlock = false;
          errorBlockLines = [];
          errorBlockResources = new Set<string>();
        }
      }

      const m = line.match(resourceExecutionPattern);
      if (!m) return;

      const resourceName = m[1];
      const message = m[2];
      const change = byResource.get(resourceName);
      if (!change) return;

      if (errorPattern.test(message) || /\bfailed\b/i.test(message)) {
        change.executionStatus = "ERROR";
        return;
      }

      if (inProgressPattern.test(message)) {
        if (change.executionStatus !== "ERROR") {
          change.executionStatus = "IN_PROGRESS";
        }
        return;
      }

      if (completePattern.test(message)) {
        if (change.executionStatus !== "ERROR") {
          change.executionStatus = "COMPLETE";
        }
      }
    });
  }

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

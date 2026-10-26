import { useCallback, useRef, useState } from "react";

import InfiniteScroll from "react-infinite-scroll-component";

import { GqlLog, LOG_DETAIL_FIELDS } from "../../logs/graphql";
import { getTimeOnlyValue } from "../components/fields/CommonField";
import { useConfig } from "../context";
import GradientCircularProgress from "../GradientCircularProgress";
import { useEffectOnce } from "../hooks/useEffectOnce";

import { LogLine } from "./LogLine";

const LOGS_PAGE_SIZE = 600;

const LOGS_VIEW_QUERY = `
  query Logs($filter: JSON, $sort: [String!], $range: [Int!]) {
    logs(filter: $filter, sort: $sort, range: $range) {
      ${LOG_DETAIL_FIELDS}
    }
  }
`;

function createLog(log: GqlLog[]) {
  const result: { id: string; data: string }[] = [];
  if (!log || log.length === 0) return result;

  for (let i = 0; i < log.length; i++) {
    const l = log[i];
    const createdAtStr = getTimeOnlyValue(l.createdAt.toString());
    let logMessage = l.data;
    if (l.level === "warn") {
      logMessage = `\u001b[1m\u001b[36m${logMessage}\u001b[22m\u001b[30m`;
    } else if (l.level === "error") {
      logMessage = `\u001b[1m\u001b[31m${logMessage}\u001b[22m\u001b[30m`;
    } else if (l.level === "footer") {
      logMessage = `\u001b[1m\u001b[32m${logMessage}\u001b[22m\u001b[30m`;
    }
    const s = `${createdAtStr}. ${logMessage}`;
    result.push({ id: l.id, data: s });
  }
  return result;
}

export const LogsView = (props: {
  entityId: string;
  auditLogId?: string;
  traceId?: string;
  executionTime?: number;
  scrollContainerId: string;
}) => {
  const { entityId, auditLogId, traceId, scrollContainerId, executionTime } =
    props;
  const { ikApi } = useConfig();

  const [logs, setLogs] = useState<GqlLog[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const isFetching = useRef(false);
  const indexRef = useRef(1);

  const fetchMoreData = useCallback(() => {
    if (isFetching.current) return; // prevent concurrent fetches
    isFetching.current = true;

    const filter: Record<string, string | number> = { entity_id: entityId };
    if (auditLogId) {
      filter.audit_log_id = auditLogId;
    }
    if (executionTime) {
      filter.execution_start = executionTime;
    }
    if (traceId) {
      filter.trace_id = traceId;
    }

    ikApi
      .graphqlRequest<{ logs: GqlLog[] }>(LOGS_VIEW_QUERY, {
        filter,
        sort: ["created_at", "DESC"],
        range: [
          (indexRef.current - 1) * LOGS_PAGE_SIZE,
          indexRef.current * LOGS_PAGE_SIZE,
        ],
      })
      .then((response) => {
        if (response.logs.length > 0) {
          setLogs((prevItems) => [...response.logs.reverse(), ...prevItems]);
          indexRef.current += 1;
        } else {
          setHasMore(false);
        }
      })
      .catch(() => setHasMore(false))
      .finally(() => {
        isFetching.current = false;
      });
  }, [ikApi, entityId, auditLogId, traceId, executionTime]);

  useEffectOnce(() => {
    fetchMoreData();
  });

  return (
    <div
      className="flex h-[calc(100vh_-_300px)] max-h-[80vh] min-h-100 flex-col-reverse overflow-y-auto p-2"
      id={scrollContainerId}
    >
      {logs.length > 0 ? (
        <InfiniteScroll
          dataLength={logs.length}
          next={fetchMoreData}
          hasMore={hasMore}
          inverse={true}
          loader={<GradientCircularProgress />}
          scrollableTarget={scrollContainerId}
        >
          {createLog(logs).map((log) => (
            <LogLine key={log.id} line={log.data} />
          ))}
        </InfiniteScroll>
      ) : (
        <p className="m-0 text-body2 text-fg-muted">No logs available.</p>
      )}
    </div>
  );
};

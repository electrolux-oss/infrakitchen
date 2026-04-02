import { useState, useCallback, useRef } from "react";

import InfiniteScroll from "react-infinite-scroll-component";
import { useEffectOnce } from "react-use";

import { Box, List, ListItem, ListItemText, Typography } from "@mui/material";
import Ansi from "ansi-to-react";

import { LogEntity } from "../../../types";
import { useConfig } from "../../context";
import GradientCircularProgress from "../../GradientCircularProgress";
import { getTimeOnlyValue } from "../CommonField";

function createLog(log: LogEntity[]) {
  const result: { id: string; data: string }[] = [];
  if (!log || log.length === 0) return result;

  for (let i = 0; i < log.length; i++) {
    const l = log[i];
    const createdAtStr = getTimeOnlyValue(l.created_at.toString());
    let logMessage = l.data;
    if (l.level === "warn") {
      logMessage = `\u001b[1m\u001b[36m${logMessage}\u001b[22m\u001b[30m`;
    } else if (l.level === "error") {
      logMessage = `\u001b[1m\u001b[31m${logMessage}\u001b[22m\u001b[30m`;
    }
    const s = `${createdAtStr}. ${logMessage}`;
    result.push({ id: l.id, data: s });
  }
  return result;
}

export const LogsView = (props: {
  entityId: string;
  executionTime: number;
  scrollContainerId: string;
}) => {
  const { entityId, executionTime, scrollContainerId } = props;
  const { ikApi } = useConfig();

  const [logs, setLogs] = useState<LogEntity[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const isFetching = useRef(false);
  const indexRef = useRef(1);

  const fetchMoreData = useCallback(() => {
    if (isFetching.current) return; // prevent concurrent fetches
    isFetching.current = true;

    ikApi
      .getList("logs", {
        filter: { entity_id: entityId, execution_start: executionTime },
        pagination: { page: indexRef.current, perPage: 600 },
        sort: { field: "created_at", order: "DESC" },
      })
      .then((response) => {
        setLogs((prevItems) => [...response.data.reverse(), ...prevItems]);

        if (response.data.length > 0) {
          indexRef.current += 1;
        } else {
          setHasMore(false);
        }
      })
      .catch(() => setHasMore(false))
      .finally(() => {
        isFetching.current = false;
      });
  }, [ikApi, entityId, executionTime]);

  useEffectOnce(() => {
    fetchMoreData();
  });

  return (
    <Box
      id={scrollContainerId}
      sx={{
        height: "calc(100vh - 300px)",
        minHeight: 400,
        maxHeight: "80vh",
        overflowY: "auto",
        padding: 1,
        display: "flex",
        flexDirection: "column-reverse",
      }}
    >
      {logs.length > 0 ? (
        <List dense>
          <InfiniteScroll
            dataLength={logs.length}
            next={fetchMoreData}
            hasMore={hasMore}
            inverse={true}
            loader={<GradientCircularProgress />}
            scrollableTarget={scrollContainerId}
          >
            {createLog(logs).map((log) => (
              <ListItem disablePadding key={log.id}>
                <ListItemText sx={{ margin: 0 }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    <Ansi>{log.data}</Ansi>
                  </pre>
                </ListItemText>
              </ListItem>
            ))}
          </InfiniteScroll>
        </List>
      ) : (
        <Typography color="text.secondary">No logs available.</Typography>
      )}
    </Box>
  );
};

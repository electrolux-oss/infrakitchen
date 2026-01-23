import { useState, useCallback } from "react";

import InfiniteScroll from "react-infinite-scroll-component";
import { useEffectOnce } from "react-use";

import { Box, List, ListItem, ListItemText, Typography } from "@mui/material";
import Ansi from "ansi-to-react";

import { LogEntity } from "../../types";
import { getTimeOnlyValue } from "../components/CommonField";
import { useConfig } from "../context/ConfigContext";
import GradientCircularProgress from "../GradientCircularProgress";

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

export const LogView = (props: {
  entity_id: string;
  execution_time: number;
}) => {
  const { entity_id, execution_time } = props;
  const { ikApi } = useConfig();

  const [logs, setLogs] = useState<LogEntity[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [index, setIndex] = useState(1);

  const fetchMoreData = useCallback(() => {
    ikApi
      .getList("logs", {
        filter: {
          entity_id: entity_id,
          execution_start: execution_time,
        },
        pagination: { page: index, perPage: 600 },
        sort: { field: "created_at", order: "ASC" },
      })
      .then((response) => {
        setLogs((prevItems) => [...prevItems, ...response.data]);

        if (response.data.length > 0) {
          setIndex((prevIndex) => prevIndex + 1);
        } else {
          setHasMore(false);
        }
      })
      .catch((_) => {
        setHasMore(false);
      });
  }, [ikApi, entity_id, setLogs, setHasMore, setIndex, execution_time, index]);

  useEffectOnce(() => {
    fetchMoreData();
  });

  return (
    <Box
      id="logScrollContainer"
      sx={{
        maxHeight: 800,
        overflowY: "auto",
        padding: 1,
      }}
    >
      {logs.length > 0 ? (
        <List dense>
          <InfiniteScroll
            dataLength={logs.length}
            next={fetchMoreData}
            hasMore={hasMore}
            loader={<GradientCircularProgress />}
            scrollableTarget="logScrollContainer"
          >
            {createLog(logs).map((log) => (
              <ListItem disablePadding key={log.id}>
                <ListItemText sx={{ margin: 0 }}>
                  <pre style={{ margin: 0 }}>
                    <Ansi>{log.data}</Ansi>
                  </pre>
                </ListItemText>
              </ListItem>
            ))}
          </InfiniteScroll>
        </List>
      ) : (
        <Typography>No logs found</Typography>
      )}
    </Box>
  );
};

import { useEffect, useRef, useState } from "react";

import CloseIcon from "@mui/icons-material/Close";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import Ansi from "ansi-to-react";

import { useConfig } from "../context/ConfigContext";
import { useEntityProvider } from "../context/EntityContext";
import WebSocketManager from "../WebSocketManager";

export const LogLiveTail = () => {
  const { ikApi } = useConfig();
  const { entity } = useEntityProvider();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const socketManagerRef = useRef<WebSocketManager | null>(null);

  useEffect(() => {
    if (socketManagerRef.current === null) {
      socketManagerRef.current = new WebSocketManager(
        ikApi,
        `/api/ws/logs/${entity._entity_name}/${entity.id}`,
      );
    }
  }, [ikApi, entity]);

  useEffect(() => {
    if (socketManagerRef.current) {
      socketManagerRef.current.setEventHandler((messageEvent) => {
        const data = JSON.parse(messageEvent.data);
        setSnackbarOpen(true);
        setLogMessages((prev) => [...prev, data.data]);
      });
      socketManagerRef.current.startVisibilityTracking();
      socketManagerRef.current.connect();
    }
    return () => {
      if (socketManagerRef.current) {
        socketManagerRef.current.stopVisibilityTracking();
        socketManagerRef.current.disconnect();
      }
    };
  }, [setLogMessages, setSnackbarOpen]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [logMessages]);

  return (
    <Snackbar
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      open={snackbarOpen}
      onClose={() => setSnackbarOpen(false)}
    >
      <Alert severity="info" sx={{ p: 0, minWidth: 400 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            Live Log Tail
          </Typography>
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={() => setSnackbarOpen(false)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box
          ref={scrollContainerRef}
          sx={{ maxHeight: 300, overflow: "auto", whiteSpace: "pre-line" }}
        >
          <pre
            style={{
              margin: 0,
              maxWidth: 700,
              overflowY: "hidden",
              padding: 16,
            }}
          >
            <Ansi>{logMessages.join("\n")}</Ansi>
          </pre>
        </Box>
      </Alert>
    </Snackbar>
  );
};

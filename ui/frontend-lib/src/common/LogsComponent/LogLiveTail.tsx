import React, { useEffect, useRef, useState, useCallback } from "react";

import CloseIcon from "@mui/icons-material/Close";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Ansi from "ansi-to-react";

import { useConfig } from "../context/ConfigContext";
import { useEntityProvider } from "../context/EntityContext";
import WebSocketManager from "../WebSocketManager";

const MAX_LOG_MESSAGES = 1000;
const BATCH_INTERVAL = 100; // milliseconds

export const LogLiveTail = () => {
  const { ikApi } = useConfig();
  const { entity } = useEntityProvider();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  // Resizing State
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 });
  const isResizing = useRef(false);

  const socketManagerRef = useRef<WebSocketManager | null>(null);
  const pendingMessagesRef = useRef<string[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingMessages = useCallback(() => {
    if (pendingMessagesRef.current.length > 0) {
      const newMessages = pendingMessagesRef.current;
      pendingMessagesRef.current = [];

      setLogMessages((prev) => {
        const combined = [...prev, ...newMessages];
        return combined.length > MAX_LOG_MESSAGES
          ? combined.slice(combined.length - MAX_LOG_MESSAGES)
          : combined;
      });

      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop =
            scrollContainerRef.current.scrollHeight;
        }
      });
    }
    batchTimerRef.current = null;
  }, []);

  // Resize Logic
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX - 20;
    const newHeight = window.innerHeight - e.clientY - 20;

    setDimensions({
      width: Math.max(300, newWidth),
      height: Math.max(200, newHeight),
    });
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
  }, [handleMouseMove]);

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", stopResizing);
    },
    [handleMouseMove, stopResizing],
  );

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
        setIsVisible(true);
        pendingMessagesRef.current.push(data.data);
        if (batchTimerRef.current === null) {
          batchTimerRef.current = setTimeout(
            flushPendingMessages,
            BATCH_INTERVAL,
          );
        }
      });
      socketManagerRef.current.startVisibilityTracking();
      socketManagerRef.current.connect();
    }
    return () => {
      if (socketManagerRef.current) {
        socketManagerRef.current.stopVisibilityTracking();
        socketManagerRef.current.disconnect();
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        flushPendingMessages();
      }
    };
  }, [flushPendingMessages]);

  if (!isVisible) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: dimensions.width,
        height: dimensions.height,
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        boxShadow: 6,
        borderRadius: 1,
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      <Box
        onMouseDown={startResizing}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 15,
          height: 15,
          cursor: "nwse-resize",
          zIndex: 10,
          "&:hover": { bgcolor: "action.hover" },
        }}
      />

      <Alert
        severity="info"
        icon={false}
        sx={{
          p: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          "& .MuiAlert-message": {
            p: 0,
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            width: "100%",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: "divider",
            cursor: "default",
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            Live Log Tail
          </Typography>
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={() => setIsVisible(false)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box
          ref={scrollContainerRef}
          sx={{
            flexGrow: 1,
            overflow: "auto",
            bgcolor: "#1e1e1e",
            color: "#fff",
          }}
        >
          <pre style={{ margin: 0, padding: 16, fontSize: "0.8rem" }}>
            <Ansi>{logMessages.join("\n")}</Ansi>
          </pre>
        </Box>
      </Alert>
    </Box>
  );
};

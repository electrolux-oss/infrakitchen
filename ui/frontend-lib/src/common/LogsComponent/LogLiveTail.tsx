import React, { useEffect, useRef, useState, useCallback } from "react";

import MinimizeIcon from "@mui/icons-material/Minimize";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Ansi from "ansi-to-react";

import { useLocalStorage } from "../context";
import { useConfig } from "../context/ConfigContext";
import { useEntityProvider } from "../context/EntityContext";
import WebSocketManager from "../WebSocketManager";

const MAX_LOG_MESSAGES = 1000;
const BATCH_INTERVAL = 100; // milliseconds

export const LogLiveTail = () => {
  const { ikApi } = useConfig();
  const { entity } = useEntityProvider();
  const { get, setKey } = useLocalStorage<Record<string, unknown>>();
  const isMinimizedSaved = get("log_live_tail_minimized") as
    | { isMinimized: boolean }
    | undefined;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(
    isMinimizedSaved?.isMinimized ?? false,
  );
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [isReceivingLogs, setIsReceivingLogs] = useState<boolean>(false);

  // Resizing State
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 });
  const isResizing = useRef(false);

  const socketManagerRef = useRef<WebSocketManager | null>(null);
  const pendingMessagesRef = useRef<string[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logActivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    setKey("log_live_tail_minimized", { isMinimized });
  }, [setKey, isMinimized]);

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
        pendingMessagesRef.current.push(data.data);

        // Show spinner when logs are coming
        setIsReceivingLogs(true);
        if (logActivityTimerRef.current) {
          clearTimeout(logActivityTimerRef.current);
        }
        logActivityTimerRef.current = setTimeout(() => {
          setIsReceivingLogs(false);
        }, 10000);

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
      if (logActivityTimerRef.current) {
        clearTimeout(logActivityTimerRef.current);
      }
    };
  }, [flushPendingMessages]);

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: isMinimized ? "auto" : dimensions.width,
        height: isMinimized ? "auto" : dimensions.height,
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        boxShadow: 6,
        borderRadius: 1,
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      {!isMinimized && (
        <Box
          onMouseDown={startResizing}
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 20,
            height: 20,
            cursor: "nwse-resize",
            zIndex: 10,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            "&:hover": { bgcolor: "action.hover" },
            "&::before": {
              content: '""',
              position: "absolute",
              top: 2,
              left: 2,
              width: 0,
              height: 0,
              borderLeft: "8px solid",
              borderBottom: "8px solid",
              borderColor: "text.secondary",
              opacity: 0.3,
            },
          }}
        />
      )}

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
            borderBottom: isMinimized ? 0 : 1,
            borderColor: "divider",
            cursor: "default",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              paddingRight: 1,
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              Live Log Tail
            </Typography>
            {isReceivingLogs && <CircularProgress size={14} thickness={5} />}
          </Box>
          <Box>
            <IconButton
              size="small"
              aria-label={isMinimized ? "maximize" : "minimize"}
              color="inherit"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? (
                <OpenInFullIcon fontSize="small" />
              ) : (
                <MinimizeIcon fontSize="small" />
              )}
            </IconButton>
          </Box>
        </Box>

        {!isMinimized && (
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
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "1em",
                  backgroundColor: "#fff",
                  marginLeft: "2px",
                  animation: "blink 1s step-end infinite",
                  verticalAlign: "text-bottom",
                }}
              />
            </pre>
            <style>
              {`
                @keyframes blink {
                  0%, 50% { opacity: 1; }
                  51%, 100% { opacity: 0; }
                }
              `}
            </style>
          </Box>
        )}
      </Alert>
    </Box>
  );
};

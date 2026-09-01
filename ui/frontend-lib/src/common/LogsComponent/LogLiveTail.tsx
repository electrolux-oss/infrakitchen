import React, { useEffect, useRef, useState, useCallback } from "react";

import {
  CloseFullscreen,
  FitScreen,
  Fullscreen,
  OpenInFull,
  Terminal,
} from "@mui/icons-material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Ansi from "ansi-to-react";

import { useLocalStorage } from "../context";
import { useConfig } from "../context/ConfigContext";
import { useEntityProvider } from "../context/EntityContext";
import { useLogStreamSubscription } from "../hooks/useLogStreamSubscription";
import { CODE_FONT_FAMILY } from "../theme";

const MAX_LOG_MESSAGES = 1000;
const BATCH_INTERVAL = 100; // milliseconds

export const LogLiveTail = () => {
  const { ikApi, webSocketEnabled, globalConfig } = useConfig();
  const { entity } = useEntityProvider();
  const { get, setKey } = useLocalStorage<Record<string, unknown>>();
  const isMinimizedSaved = get("log_live_tail_minimized") as
    { isMinimized: boolean } | undefined;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(
    isMinimizedSaved?.isMinimized ?? false,
  );
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [isReceivingLogs, setIsReceivingLogs] = useState<boolean>(false);

  // Resizing State
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 });
  const isResizing = useRef(false);

  const pendingMessagesRef = useRef<string[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logActivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    setKey("log_live_tail_minimized", { isMinimized });
  }, [setKey, isMinimized]);

  useEffect(() => {
    if (isMinimized) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsMinimized(true);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMinimized]);

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

  const applyPresetSize = useCallback((scale: number) => {
    setDimensions({
      width: Math.max(300, window.innerWidth * scale),
      height: Math.max(200, window.innerHeight * scale),
    });
  }, []);

  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        flushPendingMessages();
      }
      if (logActivityTimerRef.current) {
        clearTimeout(logActivityTimerRef.current);
      }
    };
  }, [flushPendingMessages]);

  const subscriptionEnabled = !!webSocketEnabled && !!globalConfig?.websocket;

  const handleLogMessage = useCallback(
    (data: string) => {
      pendingMessagesRef.current.push(data);

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
    },
    [flushPendingMessages],
  );

  useLogStreamSubscription({
    ikApi,
    entityName: entity.entityName,
    entityId: entity.id,
    enabled: subscriptionEnabled,
    onMessage: handleLogMessage,
  });

  if (webSocketEnabled === false || !globalConfig?.websocket) {
    return null;
  }

  return (
    <Box
      ref={containerRef}
      onClick={isMinimized ? () => setIsMinimized(false) : undefined}
      sx={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: isMinimized ? "auto" : dimensions.width,
        height: isMinimized ? "auto" : dimensions.height,
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.18)",
        borderRadius: isMinimized ? "999px" : "var(--template-surface-radius)",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        overflow: "hidden",
        cursor: isMinimized ? "pointer" : "default",
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
              borderColor: "transparent",
              opacity: 0.3,
            },
          }}
        />
      )}
      {isMinimized ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1.25,
          }}
        >
          <Terminal fontSize="small" sx={{ color: "text.secondary" }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Log Stream
          </Typography>
          <OpenInFull fontSize="small" sx={{ color: "text.secondary" }} />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 1.5,
              py: 0.75,
              borderBottom: 1,
              borderColor: "divider",
              cursor: "default",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                minWidth: 0,
              }}
            >
              <Terminal fontSize="small" sx={{ color: "text.secondary" }} />
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Log Stream
              </Typography>
              {isReceivingLogs && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: "success.main",
                    animation: "log-tail-pulse 1.2s ease-in-out infinite",
                    flexShrink: 0,
                  }}
                />
              )}
            </Box>{" "}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                borderLeft: "1px solid",
                borderColor: "divider",
                pl: 1,
              }}
            >
              <Tooltip title="Medium size">
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => applyPresetSize(0.6)}
                  sx={{ color: "text.secondary" }}
                >
                  <FitScreen fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Large size">
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => applyPresetSize(0.85)}
                  sx={{ color: "text.secondary" }}
                >
                  <Fullscreen fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Minimize">
                <IconButton
                  size="small"
                  aria-label="Minimize"
                  color="inherit"
                  onClick={() => setIsMinimized(true)}
                  sx={{ color: "text.secondary" }}
                >
                  <CloseFullscreen fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
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
            <pre
              style={{
                margin: 0,
                padding: 16,
                fontSize: "0.8rem",
                lineHeight: 1.5,
                fontFamily: CODE_FONT_FAMILY,
              }}
            >
              <Ansi>{logMessages.join("\n")}</Ansi>
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "1em",
                  backgroundColor: "#fff",
                  marginLeft: "2px",
                  animation: "log-tail-blink 1s step-end infinite",
                  verticalAlign: "text-bottom",
                }}
              />
            </pre>
            <style>
              {`
                      @keyframes log-tail-blink {
                        0%, 50% { opacity: 1; }
                        51%, 100% { opacity: 0; }
                      }
                      @keyframes log-tail-pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.3; }
                      }
                    `}
            </style>
          </Box>
        </>
      )}
    </Box>
  );
};

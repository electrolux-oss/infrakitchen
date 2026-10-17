import React, { useEffect, useRef, useState, useCallback } from "react";

import Ansi from "ansi-to-react";

import {
  CloseFullscreenIcon,
  FitScreenIcon,
  FullscreenIcon,
  TerminalIcon,
} from "../../icons/material";
import { IconButton, Tooltip } from "../../ui";
import { cn } from "../../utils/cn";
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
  // Set by the footer row, which the server writes last when a task is done
  const [isFinished, setIsFinished] = useState<boolean>(false);

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

  // Expanding ring around the minimized icon while logs are arriving.
  const showActivity = isMinimized && isReceivingLogs;

  const subscriptionEnabled = !!webSocketEnabled && !!globalConfig?.websocket;

  const handleLogMessage = useCallback(
    (data: string, level?: string) => {
      const isFooter = level === "footer";
      pendingMessagesRef.current.push(
        isFooter ? `\u001b[1m\u001b[32m${data}\u001b[0m` : data,
      );

      if (logActivityTimerRef.current) {
        clearTimeout(logActivityTimerRef.current);
        logActivityTimerRef.current = null;
      }
      setIsFinished(isFooter);
      setIsReceivingLogs(!isFooter);
      if (!isFooter) {
        logActivityTimerRef.current = setTimeout(() => {
          setIsReceivingLogs(false);
        }, 10000);
      }

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
    <div
      className={cn(
        "shadow-[0_12px_40px_rgba(0,0,0,0.18)] motion-reduce:[animation:none]",
        showActivity && "animate-[log-tail-ripple_1.6s_ease-out_infinite]",
        cn(
          isMinimized ? "rounded-full" : "rounded-surface",
          "border",
          showActivity ? "border-success" : "border-divider",
          isMinimized ? "cursor-pointer" : "cursor-default",
          "fixed right-5 bottom-5 z-1300 flex flex-col overflow-hidden bg-paper",
        ),
      )}
      ref={containerRef}
      onClick={isMinimized ? () => setIsMinimized(false) : undefined}
      // Minimized collapses to a compact icon-only FAB so it barely covers
      // page content; expanded uses the user-resizable dimensions.
      style={{
        width: isMinimized ? 44 : dimensions.width,
        height: isMinimized ? 44 : dimensions.height,
      }}
    >
      {!isMinimized && (
        <div
          className="absolute top-0 left-0 z-10 flex h-5 w-5 cursor-nwse-resize items-start justify-start before:absolute before:top-0.5 before:left-0.5 before:h-0 before:w-0 before:border-b-8 before:border-l-8 before:border-transparent before:opacity-30 before:content-[''] hover:bg-hover"
          onMouseDown={startResizing}
        />
      )}
      {isMinimized ? (
        <div
          className="relative flex h-full w-full items-center justify-center"
          role="button"
          aria-label="Open log stream"
        >
          {showActivity && (
            <div
              className="absolute inset-0.5 animate-spin rounded-full border-2 border-transparent border-t-success border-r-success motion-reduce:[animation:none]"
              aria-hidden
            />
          )}
          <Tooltip
            title={
              isReceivingLogs ? "Log Stream — receiving logs" : "Log Stream"
            }
          >
            <TerminalIcon
              fontSize="small"
              className={cn(
                "[transition:color_0.3s]",
                showActivity ? "text-success" : "text-fg-muted",
              )}
            />
          </Tooltip>
        </div>
      ) : (
        <>
          <div className="flex cursor-default items-center justify-between border-b border-divider px-3 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <TerminalIcon className="text-fg-muted" fontSize="small" />
              <p className="m-0 overflow-hidden text-body2 font-semibold text-ellipsis whitespace-nowrap">
                Log Stream
              </p>
              {isReceivingLogs && (
                <div className="h-2 w-2 shrink-0 [animation:log-tail-pulse_1.2s_ease-in-out_infinite] rounded-full bg-success" />
              )}
            </div>{" "}
            <div className="flex items-center gap-0.5 border-l border-divider pl-2">
              <Tooltip title="Medium size">
                <IconButton
                  className="text-fg-muted"
                  size="small"
                  onClick={() => applyPresetSize(0.6)}
                >
                  <FitScreenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Large size">
                <IconButton
                  className="text-fg-muted"
                  size="small"
                  onClick={() => applyPresetSize(0.85)}
                >
                  <FullscreenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Minimize">
                <IconButton
                  className="text-fg-muted"
                  size="small"
                  aria-label="Minimize"
                  onClick={() => setIsMinimized(true)}
                >
                  <CloseFullscreenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
          </div>
          <div
            className="grow overflow-auto bg-[#1e1e1e] text-[#fff]"
            ref={scrollContainerRef}
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
              {!isFinished && (
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
              )}
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
          </div>
        </>
      )}
    </div>
  );
};

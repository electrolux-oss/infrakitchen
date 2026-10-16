import { Fragment, useMemo, useState } from "react";

import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { Box, ButtonBase, IconButton, Tooltip } from "@mui/material";
import Ansi from "ansi-to-react";

import { CODE_FONT_FAMILY } from "../theme";

const ESC = String.fromCharCode(27);

export const ANSI_ESCAPE_RE = new RegExp(ESC + "\\[[0-9;]*m", "g");

type DiffMarker = "+" | "-" | "~" | "-/+" | "+/-";

type DiffLine = {
  text: string;
  marker: DiffMarker | null;
  markerCol: number;
  // Column where the content starts once the diff marker is removed; null for blank lines.
  indent: number | null;
};

type Segment =
  | { kind: "lines"; start: number; end: number }
  | { kind: "fold"; start: number; end: number };

const CONTEXT_LINES = 2;
const MIN_FOLD_SIZE = 4;

const MARKER_RE = /^(\s*)(-\/\+|\+\/-|[+~-])(?=\s|$)/;
const HEREDOC_OPEN_RE = /<<-?([A-Za-z_][A-Za-z0-9_]*)\s*$/;

const leadingSpaces = (s: string): number => s.length - s.trimStart().length;

const markerColor: Record<DiffMarker, "success" | "error" | "warning"> = {
  "+": "success",
  "-": "error",
  "~": "warning",
  "-/+": "warning",
  "+/-": "warning",
};

const classifyLines = (lines: string[]): DiffLine[] => {
  const result: DiffLine[] = [];
  let heredoc: { tag: string; markerCol: number } | null = null;

  for (const text of lines) {
    const clean = text.replace(ANSI_ESCAPE_RE, "").trimEnd();
    if (clean.trim() === "") {
      result.push({ text, marker: null, markerCol: 0, indent: null });
      continue;
    }

    if (heredoc) {
      if (clean.trim() === heredoc.tag) {
        heredoc = null;
        result.push({
          text,
          marker: null,
          markerCol: 0,
          indent: leadingSpaces(clean),
        });
        continue;
      }
      // Heredoc bodies keep their own indentation, so only a marker at the fixed marker column is a diff marker.
      const col = heredoc.markerCol;
      const ch = clean[col];
      const isMarker =
        (ch === "+" || ch === "-" || ch === "~") &&
        clean.slice(0, col).trim() === "" &&
        (clean[col + 1] ?? " ") === " ";
      const indent = isMarker
        ? col + 1 + leadingSpaces(clean.slice(col + 1))
        : leadingSpaces(clean);
      result.push({
        text,
        marker: isMarker ? (ch as DiffMarker) : null,
        markerCol: col,
        indent,
      });
      continue;
    }

    const match = clean.match(MARKER_RE);
    const marker = match ? (match[2] as DiffMarker) : null;
    const indent = match
      ? match[1].length +
        match[2].length +
        leadingSpaces(clean.slice(match[0].length))
      : leadingSpaces(clean);

    const open = clean.match(HEREDOC_OPEN_RE);
    if (open) {
      heredoc = { tag: open[1], markerCol: indent + 2 };
    }

    result.push({
      text,
      marker,
      markerCol: match ? match[1].length : 0,
      indent,
    });
  }

  return result;
};

const computeSegments = (lines: DiffLine[]): Segment[] => {
  const visible = new Array<boolean>(lines.length).fill(false);
  const ancestors: number[] = [];

  lines.forEach((line, index) => {
    if (line.indent === null) return;
    while (
      ancestors.length > 0 &&
      (lines[ancestors[ancestors.length - 1]].indent ?? 0) >= line.indent
    ) {
      ancestors.pop();
    }
    if (line.marker) {
      for (const ancestor of ancestors) visible[ancestor] = true;
      const from = Math.max(0, index - CONTEXT_LINES);
      const to = Math.min(lines.length - 1, index + CONTEXT_LINES);
      for (let i = from; i <= to; i++) visible[i] = true;
    }
    ancestors.push(index);
  });

  if (lines.length > 0) {
    visible[0] = true;
    visible[lines.length - 1] = true;
  }

  const segments: Segment[] = [];
  let index = 0;
  while (index < lines.length) {
    const isVisible = visible[index];
    let end = index;
    while (end + 1 < lines.length && visible[end + 1] === isVisible) end++;

    const kind =
      !isVisible && end - index + 1 >= MIN_FOLD_SIZE ? "fold" : "lines";
    const last = segments[segments.length - 1];
    if (kind === "lines" && last?.kind === "lines") {
      last.end = end;
    } else {
      segments.push({ kind, start: index, end });
    }
    index = end + 1;
  }

  return segments;
};

const DiffRow = ({ line }: { line: DiffLine }) => {
  const { text, marker, markerCol } = line;
  // Lines carrying ANSI codes already color their own markers.
  const colorMarker = marker && !text.includes(ESC);

  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        px: 0.5,
        fontFamily: "inherit",
        fontSize: "0.8rem",
        whiteSpace: "pre",
      }}
    >
      {colorMarker ? (
        <>
          {text.slice(0, markerCol)}
          <Box component="span" sx={{ color: `${markerColor[marker]}.main` }}>
            {marker}
          </Box>
          {text.slice(markerCol + marker.length)}
        </>
      ) : (
        <Ansi>{text || " "}</Ansi>
      )}
    </Box>
  );
};

export const PlanDiff = ({ lines }: { lines: string[] }) => {
  const parsed = useMemo(() => classifyLines(lines), [lines]);
  const segments = useMemo(() => computeSegments(parsed), [parsed]);
  const [expandedFolds, setExpandedFolds] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const hasFolds = segments.some((segment) => segment.kind === "fold");

  const renderRange = (start: number, end: number) =>
    parsed
      .slice(start, end + 1)
      .map((line, offset) => <DiffRow key={start + offset} line={line} />);

  return (
    <Box sx={{ fontFamily: CODE_FONT_FAMILY }}>
      {hasFolds && (
        // Zero-height sticky bar so the toggle floats over the diff without taking a row.
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            height: 0,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Tooltip
            title={showAll ? "Collapse unchanged lines" : "Expand all lines"}
          >
            <IconButton
              size="small"
              aria-label={
                showAll ? "Collapse unchanged lines" : "Expand all lines"
              }
              onClick={() => {
                setShowAll((prev) => !prev);
                setExpandedFolds(new Set());
              }}
              sx={{
                mt: 0.5,
                mr: 0.5,
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                boxShadow: 1,
                "&:hover": { bgcolor: "background.paper" },
              }}
            >
              {showAll ? (
                <UnfoldLessIcon fontSize="small" />
              ) : (
                <UnfoldMoreIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      )}
      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ width: "max-content", minWidth: "100%" }}>
          {showAll
            ? renderRange(0, parsed.length - 1)
            : segments.map((segment) => {
                if (
                  segment.kind === "lines" ||
                  expandedFolds.has(segment.start)
                ) {
                  return (
                    <Fragment key={segment.start}>
                      {renderRange(segment.start, segment.end)}
                    </Fragment>
                  );
                }
                const count = segment.end - segment.start + 1;
                return (
                  <ButtonBase
                    key={segment.start}
                    onClick={() =>
                      setExpandedFolds((prev) =>
                        new Set(prev).add(segment.start),
                      )
                    }
                    sx={{
                      display: "flex",
                      justifyContent: "flex-start",
                      gap: 0.5,
                      width: "100%",
                      my: 0.25,
                      px: 0.5,
                      py: 0.25,
                      borderRadius: 0.5,
                      fontFamily: "inherit",
                      fontSize: "0.75rem",
                      color: "text.secondary",
                      bgcolor: "action.selected",
                      "&:hover": { bgcolor: "action.focus" },
                    }}
                  >
                    <UnfoldMoreIcon sx={{ fontSize: "1rem" }} />
                    {count} unchanged lines
                  </ButtonBase>
                );
              })}
        </Box>
      </Box>
    </Box>
  );
};

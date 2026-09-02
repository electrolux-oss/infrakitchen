import {
  ReactNode,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useNavigate } from "react-router";

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Chip,
  Divider,
  CardActions,
  Button,
  Tooltip,
  Typography,
} from "@mui/material";

import { PermissionWrapper } from "../wrappers";
import { solidChipColorSx, softChipColorSx } from "../utils/softChip";

import { PlaceholderDescription } from "./PlaceholderDescription";

export interface EntityCardProps {
  name: string;
  entity_name: string;
  description: string;
  detailsUrl: string;
  createUrl?: string;
  onCreateClick?: () => void;
  labels: string[];
  createButtonName?: string | undefined;
  entityFields: ReactNode;
  status?: string;
  icon?: ReactNode;
  chip?: string;
  chipColor?:
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "warning"
    | "info"
    | "success";
  lastUpdated?: string | Date;
  headerAction?: ReactNode;
  secondaryAction?: ReactNode;
}

export const EntityCard = ({
  name,
  description,
  detailsUrl,
  createUrl,
  onCreateClick,
  labels,
  createButtonName,
  entityFields,
  entity_name,
  icon,
  chip,
  chipColor = "info",
  lastUpdated,
  headerAction,
  secondaryAction,
}: EntityCardProps) => {
  const navigate = useNavigate();
  const handleCreateClick = () => {
    if (onCreateClick) {
      onCreateClick();
    } else if (createUrl) {
      navigate(createUrl);
    }
  };

  const cardRef = useRef<HTMLDivElement>(null);

  const handleCardClick = () => {
    // Don't navigate when the user is selecting/copying text on the card.
    const selection = window.getSelection();
    if (
      selection &&
      selection.anchorNode &&
      cardRef.current?.contains(selection.anchorNode) &&
      selection.toString().trim().length > 0
    ) {
      return;
    }
    navigate(detailsUrl);
  };

  const handleCardKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(detailsUrl);
    }
  }; // Show "Updated" chip if lastUpdated is within the last 7 days
  const daysSinceUpdate = lastUpdated
    ? Math.floor(
        (new Date().getTime() - new Date(lastUpdated).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : Infinity;
  const isRecentlyUpdated = daysSinceUpdate <= 7;

  // Detect when the description is clamped to two lines so a tooltip with the
  // full text can be shown only when something is actually hidden.
  const descriptionRef = useRef<HTMLElement | null>(null);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);

  // Same deal for the title: a tooltip with the full name is shown only when
  // the single-line no-wrap clamp actually truncates it.
  const titleRef = useRef<HTMLElement | null>(null);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    const check = () => {
      setIsDescriptionTruncated(el.scrollHeight > el.clientHeight + 1);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    document.fonts?.ready.then(check);
    return () => observer.disconnect();
  }, [description]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => {
      setIsTitleTruncated(el.scrollWidth > el.clientWidth + 1);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    document.fonts?.ready.then(check);
    return () => observer.disconnect();
  }, [name]);
  return (
    <Card
      ref={cardRef}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: "100%",
        transition:
          "transform 150ms ease-in-out, box-shadow 150ms ease-in-out, border-color 150ms ease-in-out",
        position: "relative",
        overflow: "visible",
        // The card is a CSS grid item; without this, the grid applies a
        // content-based automatic minimum and a long title can inflate the
        // whole row's track width instead of shrinking to it.
        minWidth: 0,
        cursor: "pointer",
        outline: "none",
        "&:focus-visible": {
          boxShadow: "0 0 0 2px",
        },
        "&:hover": {
          borderColor: "text.disabled",
          boxShadow: "0 6px 16px rgba(0, 0, 0, 0.08)",
          transform: "translateY(-2px)",
        },
      }}
    >
      {" "}
      {isRecentlyUpdated && (
        <Chip
          label="Updated"
          variant="filled"
          sx={(theme) => ({
            ...solidChipColorSx("success")(theme),
            position: "absolute",
            top: -10,
            left: 16,
            zIndex: 1,
          })}
        />
      )}
      <CardHeader
        title={
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", minWidth: 0 }}>
            {icon}
            <Tooltip title={isTitleTruncated ? name : ""} arrow>
              <Typography
                component="span"
                ref={titleRef}
                variant="inherit"
                noWrap
                sx={{ flex: 1, minWidth: 0 }}
              >
                {name}
              </Typography>
            </Tooltip>
          </Box>
        }
        subheader={
          <Tooltip
            title={isDescriptionTruncated ? description || "" : ""}
            arrow
          >
            <Typography
              component="span"
              ref={descriptionRef}
              sx={(theme) => ({
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                // Reserve two description lines so every card header (and the
                // divider below it) has the same height regardless of how many
                // lines the description actually renders.
                minHeight: `${Number(theme.typography.body2.lineHeight ?? 1.43) * 2}em`,
              })}
            >
              {description ? description : <PlaceholderDescription />}
            </Typography>
          </Tooltip>
        }
        action={
          <Box
            onClick={(e: ReactMouseEvent) => e.stopPropagation()}
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            {" "}
            {chip && (
              <Chip
                label={chip.toUpperCase()}
                variant="filled"
                sx={(theme) => ({
                  ...solidChipColorSx(chipColor)(theme),
                  height: 18,
                  fontSize: "0.625rem",
                })}
              />
            )}
            {headerAction}
          </Box>
        }
        sx={{
          mb: 0,
          // MUI's header content slot is `flex: 1 1 auto` with no min-width,
          // so a long nowrap title would keep the whole row from shrinking and
          // overflow the card edge instead of ellipsizing. Let it shrink.
          "& .MuiCardHeader-content": { minWidth: 0 },
        }}
      />
      <CardContent sx={{ flexGrow: 1, pb: 1.5 }}>
        <Divider sx={{ mb: 1.5 }} />
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
          }}
        >
          {entityFields}
        </Box>
        <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
          {labels.map((label) => (
            <Chip
              key={label}
              label={label}
              sx={softChipColorSx("default")}
            />
          ))}
        </Box>
      </CardContent>
      <CardActions sx={{ pt: 0, px: 1, flexDirection: "column", gap: 1.5 }}>
        <Box
          sx={{
            display: "flex",
            gap: 1,
            width: "100%",
            justifyContent: "center",
          }}
        >
          {createButtonName && (
            <PermissionWrapper
              requiredPermission={`api:${entity_name}`}
              permissionAction="write"
            >
              <Button
                variant="contained"
                onClick={handleCreateClick}
                sx={{ flex: 1 }}
              >
                {createButtonName}
              </Button>
            </PermissionWrapper>
          )}
        </Box>{" "}
        {secondaryAction ? (
          <Box sx={{ width: "100%" }}>{secondaryAction}</Box>
        ) : null}
      </CardActions>
    </Card>
  );
};

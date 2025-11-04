import { ReactNode, useMemo } from "react";

import { ExpandMore } from "@mui/icons-material";
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Collapse,
  Grid,
  Chip,
} from "@mui/material";

import { useLocalStorage } from "../context/UIStateContext";

type MetadataItem = {
  label: string;
  value: string | ReactNode;
};

interface ExpandableCardProps {
  icon: ReactNode;
  title: string | ReactNode;
  subtitleLines?: (string | ReactNode)[];
  labels?: string[];
  description?: string;
  metadata?: MetadataItem[];
  onClick?: () => void;
  actions?: ReactNode;
  id?: string;
}

const ExpandableCard = ({
  icon,
  title,
  subtitleLines = [],
  labels = [],
  description,
  metadata = [],
  onClick,
  actions,
  id,
}: ExpandableCardProps) => {
  const { value, set } = useLocalStorage<{
    expanded?: Record<string, boolean>;
  }>();
  const expandedMap = value.expanded ?? {};
  const cardId = useMemo(() => id || String(title), [id, title]);
  const isExpanded = id ? expandedMap[cardId] === true : false;

  const toggleExpanded = (key: string) => {
    set((prev) => ({
      ...prev,
      expanded: { ...prev.expanded, [key]: !prev.expanded?.[key] },
    }));
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2.5, border: "1px solid", borderColor: "divider" }}>
      <Box
        onClick={handleCardClick}
        sx={{
          cursor: onClick ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: (t) =>
            t.transitions.create(["background-color"], {
              duration: t.transitions.duration.shortest,
            }),
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {icon}
          <Box>
            <Box fontWeight="bold">{title}</Box>
            {subtitleLines.map((line, index) => (
              <Typography key={index} variant="body2" color="textSecondary">
                {line}
              </Typography>
            ))}
          </Box>
        </Box>

        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(cardId);
            }}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            size="small"
          >
            <ExpandMore
              sx={{
                transition: (t) =>
                  t.transitions.create("transform", {
                    duration: t.transitions.duration.shortest,
                  }),
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </IconButton>
        </Box>
      </Box>
      <Collapse
        in={isExpanded}
        timeout="auto"
        easing={{
          enter: "cubic-bezier(0.4, 0, 0.2, 1)",
          exit: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <Box
          pt={2}
          px={1}
          onClick={handleCardClick}
          sx={{
            cursor: onClick ? "pointer" : "default",
          }}
        >
          <Grid container spacing={2}>
            {metadata.map((item, index) => (
              <Grid
                key={index}
                size={{
                  xs: 12,
                  md: 6,
                }}
              >
                <Typography variant="body1" gutterBottom>
                  {item.label}
                </Typography>

                {typeof item.value === "string" ||
                typeof item.value === "number" ? (
                  <Typography variant="body2">{item.value}</Typography>
                ) : (
                  item.value
                )}
              </Grid>
            ))}

            {labels.length > 0 && (
              <Grid size={12}>
                <Typography variant="body1" gutterBottom>
                  Labels
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {labels.map((label) => (
                    <Chip
                      key={label}
                      label={label}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Grid>
            )}

            {description !== undefined && (
              <Grid size={12}>
                <Typography variant="body1" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body2">{description || "—"}</Typography>
              </Grid>
            )}
          </Grid>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ExpandableCard;

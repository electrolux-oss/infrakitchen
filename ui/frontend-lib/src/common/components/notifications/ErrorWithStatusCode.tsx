import { useState, forwardRef, useCallback } from "react";

import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Collapse, Paper } from "@mui/material";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import IconButton from "@mui/material/IconButton";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { useSnackbar, SnackbarContent } from "notistack";

interface ErrorWithCodeProps {
  id: string | number;
  message: string;
  metadata?: Record<string, any>;
}

const StyledCard = styled(Card)(({ theme }) => ({
  color: theme.palette.primary.dark,
  backgroundColor: theme.palette.background.paper,
  width: "100%",
}));

const StyledCardActions = styled(CardActions)({
  padding: "8px 8px 8px 16px",
  justifyContent: "space-between",
});

const ExpandIconButton = styled(IconButton)<{ expanded: boolean }>(
  ({ theme, expanded }) => ({
    padding: "8px 8px",
    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
    transition: theme.transitions.create("transform", {
      duration: theme.transitions.duration.shortest,
    }),
  }),
);

export const ErrorWithStatusCode = forwardRef<
  HTMLDivElement,
  ErrorWithCodeProps
>((props, ref) => {
  const { id, message, metadata } = props;
  const { closeSnackbar } = useSnackbar();
  const [expanded, setExpanded] = useState(true);

  const handleExpandClick = useCallback(() => {
    setExpanded((oldExpanded) => !oldExpanded);
  }, []);

  const handleDismiss = useCallback(() => {
    closeSnackbar(id);
  }, [id, closeSnackbar]);

  return (
    <SnackbarContent ref={ref} role="alert">
      <StyledCard
        sx={{
          border: `1px solid`,
          borderColor: "error.main",
          boxShadow: 3,
        }}
      >
        <StyledCardActions>
          <Typography variant="body1" sx={{ fontWeight: "bold" }} color="error">
            {message}
          </Typography>

          <ExpandIconButton
            aria-label="Show details"
            expanded={expanded}
            onClick={handleExpandClick}
          >
            <ExpandMoreIcon />
          </ExpandIconButton>

          <IconButton sx={{ padding: "8px 8px" }} onClick={handleDismiss}>
            <CloseIcon />
          </IconButton>
        </StyledCardActions>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Paper
            sx={{
              padding: 2,
              overflowY: "auto",
              overflowX: "auto",
              maxHeight: 400,
              maxWidth: 800,
            }}
          >
            <Typography gutterBottom>Error details</Typography>
            {metadata && (
              <Box
                component="pre"
                sx={{
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  backgroundColor: (theme) =>
                    theme.palette.mode === "light"
                      ? "rgba(0, 0, 0, 0.05)"
                      : "rgba(255, 255, 255, 0.05)",
                  padding: 1,
                  borderRadius: 1,
                }}
              >
                {JSON.stringify(metadata, null, 2)}
              </Box>
            )}
          </Paper>
        </Collapse>
      </StyledCard>
    </SnackbarContent>
  );
});

ErrorWithStatusCode.displayName = "ErrorWithStatusCode";

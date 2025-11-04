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

import { IkEntity } from "../../../types";
import { GetEntityLink } from "../CommonField";

interface DependencyErrorProps {
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

export const DependencyError = forwardRef<HTMLDivElement, DependencyErrorProps>(
  (props, ref) => {
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
            <Typography
              variant="body1"
              sx={{ fontWeight: "bold" }}
              color="error"
            >
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
            <Paper sx={{ padding: 2, overflowY: "auto", maxHeight: 400 }}>
              <Typography gutterBottom>Entity dependencies</Typography>
              {metadata?.map((r: IkEntity) => (
                <Box
                  key={r.id}
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    p: 2,
                    mb: 2,
                    borderRadius: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                    <GetEntityLink {...r} />
                  </Typography>
                </Box>
              ))}
            </Paper>
          </Collapse>
        </StyledCard>
      </SnackbarContent>
    );
  },
);

DependencyError.displayName = "DependencyError";

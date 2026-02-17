import { useNavigate } from "react-router";

import { Icon } from "@iconify/react";
import { Box, Button, Typography, Container, Paper } from "@mui/material";

import { useConfig } from "../common";
import { InfrakitchenLogo } from "../icons";

const NotFoundPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80vh",
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            display: { xs: "none", lg: "flex" },
            "& svg": { width: 140, height: 140 },
            flexShrink: 0,
            marginBottom: "24px",
          }}
        >
          <InfrakitchenLogo />
        </Box>
        <Typography
          variant="h2"
          component="h1"
          fontWeight="700"
          color="text.primary"
          gutterBottom
        >
          404
        </Typography>

        <Typography variant="h4" component="h2" gutterBottom>
          Lost in space?
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4, maxWidth: "500px" }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Don&apos;t worry, even the best explorers get lost sometimes.
        </Typography>

        <Paper
          variant="outlined"
          sx={{
            p: 3,
            width: "100%",
            maxWidth: 450,
            borderRadius: 2,
            bgcolor: "action.hover",
          }}
        >
          <Typography variant="subtitle1" fontWeight="600" mb={2}>
            Let&apos;s get you back on track:
          </Typography>

          <Button
            variant="contained"
            size="large"
            disableElevation
            startIcon={<Icon icon="solar:home-2-bold" />}
            onClick={() => navigate(`${linkPrefix}getting-started`)}
            sx={{ px: 4, borderRadius: 2 }}
          >
            Go to Getting Started
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

NotFoundPage.path = "/not-found";

export { NotFoundPage };

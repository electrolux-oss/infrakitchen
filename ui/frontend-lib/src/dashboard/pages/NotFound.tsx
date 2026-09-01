import { Box, Typography, Container } from "@mui/material";

import { InfrakitchenLogo } from "../../icons";

export const NotFoundPage = () => {
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
            // InfrakitchenLogo hardcodes mr: 2 + a white border in its own sx;
            // reset them here so the icon sits perfectly centered.
            "& svg": { width: 80, height: 80, mr: 0, border: "none" },
            flexShrink: 0,
            marginBottom: "24px",
          }}
        >
          <InfrakitchenLogo />
        </Box>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: "700",
            color: "text.primary",
          }}
        >
          404
        </Typography>

        <Typography
          sx={{
            color: "text.secondary",
            mb: 4,
            maxWidth: "500px",
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          <br />
          Don&apos;t worry, even the best explorers get lost sometimes.
        </Typography>

      </Box>
    </Container>
  );
};

NotFoundPage.path = "/not-found";

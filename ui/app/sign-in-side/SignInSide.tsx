import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Stack from "@mui/material/Stack";

import ThemeSwitcher from "../base/layout/ThemeSwitcher";
import AppTheme from "../theme/AppTheme";

import Content from "./components/Content";
import SignInCard from "./components/SignInCard";

export default function SignInSide(props: { disableCustomTheme?: boolean }) {
  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <Box
        sx={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: (theme) => theme.zIndex.appBar + 1,
        }}
      >
        <ThemeSwitcher />
      </Box>
      <Stack
        direction="column"
        component="main"
        sx={[
          {
            justifyContent: "center",
            // Use dynamic viewport height to avoid iOS Safari bars, but allow page to grow if content increases.
            minHeight: { xs: "100dvh", sm: "100vh" },
            position: "relative",
            pb: "env(safe-area-inset-bottom)",
          },
          (theme) => ({
            "&::before": {
              content: '""',
              display: "block",
              position: "absolute",
              zIndex: -1,
              inset: 0,
              // Fallback base color to avoid visible band beneath radial gradient.
              backgroundColor: "hsl(0, 0%, 100%)",
              backgroundImage:
                "radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))",
              backgroundRepeat: "no-repeat",
              backgroundSize: "140% 140%", // Oversize to ensure coverage at edges
              backgroundAttachment: "fixed",
              ...theme.applyStyles("dark", {
                backgroundColor: "hsl(220, 30%, 5%)",
                backgroundImage:
                  "radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.55), hsl(220, 30%, 5%))",
              }),
            },
          }),
        ]}
      >
        <Stack
          direction={{ xs: "column-reverse", lg: "row" }}
          sx={{
            justifyContent: "center",
            gap: { xs: 6, sm: 12 },
            p: 2,
            mx: "auto",
          }}
        >
          <Stack
            direction={{ xs: "column-reverse", lg: "row" }}
            sx={{
              justifyContent: "center",
              gap: { xs: 3, sm: 6 },
              p: { xs: 2, sm: 4 },
              m: "auto",
            }}
          >
            <Content />
            <SignInCard />
          </Stack>
        </Stack>
      </Stack>
    </AppTheme>
  );
}

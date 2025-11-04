import * as React from "react";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ThemeOptions } from "@mui/material/styles";

import { accessibilityCustomizations } from "./customizations/accessibility";
import { dataDisplayCustomizations } from "./customizations/dataDisplay";
import { feedbackCustomizations } from "./customizations/feedback";
import { formInputCustomizations } from "./customizations/formInput";
import { inputsCustomizations } from "./customizations/inputs";
import { sidebarCustomizations } from "./customizations/sidebar";
import { surfacesCustomizations } from "./customizations/surfaces";
import { colorSchemes, typography, shadows, shape } from "./themePrimitives";

interface AppThemeProps {
  children: React.ReactNode;
  disableCustomTheme?: boolean;
  themeComponents?: ThemeOptions["components"];
}

export default function AppTheme(props: AppThemeProps) {
  const { children, disableCustomTheme, themeComponents } = props;

  const theme = React.useMemo(() => {
    return disableCustomTheme
      ? {}
      : createTheme({
          cssVariables: {
            colorSchemeSelector: "data-mui-color-scheme",
            cssVarPrefix: "template",
          },
          colorSchemes,
          typography,
          shadows,
          shape,
          components: {
            ...accessibilityCustomizations,
            ...inputsCustomizations,
            ...dataDisplayCustomizations,
            ...feedbackCustomizations,
            ...surfacesCustomizations,
            ...sidebarCustomizations,
            ...formInputCustomizations,
            ...themeComponents,
          },
        });
  }, [disableCustomTheme, themeComponents]);
  if (disableCustomTheme) {
    return <React.Fragment>{children}</React.Fragment>;
  }
  return (
    <ThemeProvider theme={theme} disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}

"use client";
import * as React from "react";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import Container, { ContainerProps } from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

const PageContentHeader = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  gap: theme.spacing(2),
}));

const PageHeaderToolbar = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: theme.spacing(1),
  marginLeft: "auto",
}));

export interface PageContainerProps extends ContainerProps {
  children?: React.ReactNode;
  title?: string;
  /** Actions/buttons to render at the right side of the page header */
  actions?: React.ReactNode;
  /** Actions/buttons to render at the bottom of the page, centered */
  bottomActions?: React.ReactNode;
  onBack?: () => void;
  backIcon?: React.ReactNode;
  backAriaLabel?: string;
}

export default function PageContainer(props: PageContainerProps) {
  const {
    children,
    title,
    actions = null,
    bottomActions = null,
    onBack,
    backIcon,
    backAriaLabel = "Back",
  } = props;

  return (
    <Container
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack sx={{ flex: 1, my: 2, minHeight: 0 }} spacing={2}>
        <Stack>
          <PageContentHeader sx={{ mt: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
              {onBack ? (
                <Tooltip title={backAriaLabel} arrow disableInteractive>
                  <IconButton
                    aria-label={backAriaLabel}
                    onClick={onBack}
                    edge="start"
                  >
                    {backIcon || <ArrowBackIcon />}
                  </IconButton>
                </Tooltip>
              ) : null}
              {title ? <Typography variant="h1">{title}</Typography> : null}
            </Box>
            <PageHeaderToolbar>{actions}</PageHeaderToolbar>
          </PageContentHeader>
        </Stack>
        <Box
          sx={{
            overflowY: "auto",
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            flexDirection: "column",
          }}
        >
          {children}
        </Box>
        {bottomActions ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              gap: 2,
            }}
          >
            {bottomActions}
          </Box>
        ) : null}
      </Stack>
    </Container>
  );
}

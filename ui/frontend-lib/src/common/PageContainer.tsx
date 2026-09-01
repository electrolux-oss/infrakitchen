"use client";
import * as React from "react";

import Box from "@mui/material/Box";
import Container, { ContainerProps } from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
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

export interface PageContainerProps extends Omit<
  ContainerProps,
  "title" | "maxWidth"
> {
  children?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Actions/buttons to render at the right side of the page header */
  actions?: React.ReactNode;
  /** Actions/buttons to render at the bottom of the page, centered */
  bottomActions?: React.ReactNode;
}

export default function PageContainer(props: PageContainerProps) {
  const {
    children,
    title,
    description,
    actions = null,
    bottomActions = null,
  } = props;

  return (
    <Container
      maxWidth={false}
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack sx={{ flex: 1, my: 2, minHeight: 0 }} spacing={2}>
        <Stack>
          {" "}
          <PageContentHeader sx={{ mt: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              {title ? (
                <Typography
                  variant="h3"
                  component="h1"
                  sx={{ fontWeight: 600 }}
                >
                  {title}
                </Typography>
              ) : null}
              {description ? (
                <Box
                  sx={{
                    color: "text.secondary",
                    mt: 1,
                  }}
                >
                  {description}
                </Box>
              ) : null}
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

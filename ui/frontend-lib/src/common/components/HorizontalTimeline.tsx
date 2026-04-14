import { ReactNode } from "react";

import { Box, Stack } from "@mui/material";

export interface HorizontalTimelineItem {
  id: string;
}

export interface HorizontalTimelineProps<T extends HorizontalTimelineItem> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
}

export const HorizontalTimeline = <T extends HorizontalTimelineItem>({
  items,
  renderItem,
}: HorizontalTimelineProps<T>) => {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", ml: 2 }}>
      {items.map((item, index) => (
        <Stack key={item.id} alignItems="center" sx={{ minWidth: 160, pb: 1 }}>
          <Stack
            direction="row"
            alignItems="center"
            sx={{ width: "100%", height: 12 }}
          >
            <Box
              sx={{
                flex: 1,
                height: 2,
                bgcolor: index > 0 ? "text.disabled" : "transparent",
              }}
            />
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: "primary.main",
                flexShrink: 0,
              }}
            />
            <Box
              sx={{
                flex: 1,
                height: 2,
                bgcolor:
                  index < items.length - 1 ? "text.disabled" : "transparent",
              }}
            />
            {index < items.length - 1 && (
              <Box
                sx={{
                  width: 0,
                  height: 0,
                  borderTop: "5px solid transparent",
                  borderBottom: "5px solid transparent",
                  borderLeft: "6px solid",
                  borderLeftColor: "text.disabled",
                  flexShrink: 0,
                }}
              />
            )}
          </Stack>
          {renderItem(item, index)}
        </Stack>
      ))}
    </Box>
  );
};

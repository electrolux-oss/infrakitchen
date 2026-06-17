import { useMemo } from "react";

import HistoryIcon from "@mui/icons-material/History";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";

import { ActivityLogEntry } from "../types";

import { ActivityFeedItem } from "./ActivityFeedItem";

export interface RecentActivityWidgetProps {
  activities: ActivityLogEntry[];
  loading?: boolean;
  hasFavorites?: boolean;
}

export const RecentActivityWidget = ({
  activities,
  loading = false,
  hasFavorites = false,
}: RecentActivityWidgetProps) => {
  const theme = useTheme();

  const displayedActivities = useMemo(() => {
    return activities.slice(0, 10);
  }, [activities]);

  return (
    <Card sx={{ height: "100%" }}>
      <CardHeader
        avatar={<HistoryIcon sx={{ color: theme.palette.info.main }} />}
        title="Recent Activity"
        subheader={`Last ${displayedActivities.length} action${displayedActivities.length !== 1 ? "s" : ""} ${
          hasFavorites
            ? "on your favorites"
            : "across all resources and executors"
        }`}
      />
      <CardContent sx={{ maxHeight: 400, overflowY: "auto" }}>
        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight={250}
          >
            <CircularProgress />
          </Box>
        ) : displayedActivities.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            minHeight={250}
            color="text.secondary"
          >
            <HistoryIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2" textAlign="center">
              No recent activity on your favorites.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={0}>
            {displayedActivities.map((activity) => {
              return (
                <ActivityFeedItem
                  key={activity.id}
                  activity={activity}
                  entityName={activity.entityData?.name}
                  entityStatus={activity.entityData?.status}
                />
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

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

import { useEntityMetadataFromRows } from "../../common/hooks/useEntityMetadata";
import { IkEntity } from "../../types";
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

  const activityEntities: IkEntity[] = useMemo(() => {
    return displayedActivities.map(
      (activity) =>
        ({
          ...activity,
          _entity_name: "audit_log",
        }) as unknown as IkEntity,
    );
  }, [displayedActivities]);

  const { data: entityMeta } = useEntityMetadataFromRows(activityEntities);

  return (
    <Card sx={{ height: "100%" }}>
      <CardHeader
        avatar={<HistoryIcon sx={{ color: theme.palette.info.main }} />}
        title="Recent Activity"
        subheader={`Last ${displayedActivities.length} action${displayedActivities.length !== 1 ? "s" : ""} ${
          hasFavorites ? "on your favorites" : "across all resources"
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
              const meta = entityMeta.get(activity.entity_id);
              return (
                <ActivityFeedItem
                  key={activity.id}
                  activity={activity}
                  entityName={meta?.name}
                  entityStatus={meta?.status}
                />
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

import FavoriteIcon from "@mui/icons-material/Favorite";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import { FavoriteResource } from "../types";

import { FavoriteResourceItem } from "./FavoriteResourceItem";

export interface MyFavoritesWidgetProps {
  favorites: FavoriteResource[];
  loading?: boolean;
}

export const MyFavoritesWidget = ({
  favorites,
  loading = false,
}: MyFavoritesWidgetProps) => {
  return (
    <Card sx={{ width: "100%" }}>
      <CardHeader
        avatar={<FavoriteIcon sx={{ color: "error.main" }} />}
        title="My Favorites"
        subheader={`${favorites.length} favorite ${favorites.length !== 1 ? "entities" : "entity"}`}
      />
      <CardContent sx={{ maxHeight: 400, overflowY: "auto" }}>
        {loading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            py={2}
          >
            <CircularProgress size={24} />
          </Box>
        ) : favorites.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            py={3}
            color="text.secondary"
          >
            <FavoriteIcon
              sx={{ fontSize: 36, mb: 1, opacity: 0.5, color: "error.main" }}
            />
            <Typography variant="body2" textAlign="center">
              No favorites yet.
            </Typography>
            <Typography variant="caption" textAlign="center">
              Pin resources for quick access.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {favorites.map((favorite) => (
              <FavoriteResourceItem key={favorite.id} resource={favorite} />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

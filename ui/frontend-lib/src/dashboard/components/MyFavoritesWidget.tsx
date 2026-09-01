import FavoriteIcon from "@mui/icons-material/Favorite";
import { Box, CircularProgress, Divider, Typography } from "@mui/material";

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
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <FavoriteIcon sx={{ color: "primary.main", fontSize: 20 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          My Favorites
        </Typography>
        {!loading && (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", ml: "auto" }}
          >
            {favorites.length}{" "}
            {favorites.length !== 1 ? "favorites" : "favorite"}
          </Typography>
        )}
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "var(--template-surface-radius)",
          backgroundColor: "background.paper",
          overflow: "hidden",
          overflowY: "auto",
          maxHeight: 400,
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 4,
            }}
          >
            <CircularProgress size={24} />
          </Box>
        ) : favorites.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 4,
              color: "text.secondary",
            }}
          >
            <FavoriteIcon
              sx={{ fontSize: 32, mb: 1, opacity: 0.5, color: "primary.main" }}
            />
            <Typography variant="body2">No favorites yet.</Typography>
            <Typography variant="caption">
              Pin resources for quick access.
            </Typography>
          </Box>
        ) : (
          <Box>
            {favorites.map((favorite) => (
              <FavoriteResourceItem key={favorite.id} resource={favorite} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

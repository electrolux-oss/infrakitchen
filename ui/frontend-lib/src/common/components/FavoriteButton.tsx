import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { IconButton } from "@mui/material";

import {
  FavoriteComponentType,
  useFavorites,
} from "../context/FavoritesContext";
import { notifyError } from "../hooks/useNotification";

interface FavoriteButtonProps {
  componentId: string;
  componentType: FavoriteComponentType;
  ariaLabel: string;
  format?: "overview" | "table";
}

export const FavoriteButton = ({
  componentId,
  componentType,
  ariaLabel,
  format = "overview",
}: FavoriteButtonProps) => {
  const { isFavorite, toggleFavorite, isSubmitting } = useFavorites();

  const favoriteState = isFavorite(componentType, componentId);
  const submittingState = isSubmitting(componentType, componentId);

  const handleAddFavorite = async () => {
    try {
      await toggleFavorite(componentType, componentId);
    } catch (error: any) {
      notifyError(error);
    }
  };

  return (
    <IconButton
      aria-label={ariaLabel}
      onClick={handleAddFavorite}
      disabled={submittingState}
      disableRipple={format === "table"}
      sx={
        format === "table"
          ? {
              p: 0,
              minWidth: 0,
              width: 20,
              height: 20,
              border: "none",
              outline: "none",
              "&:hover": {
                backgroundColor: "transparent",
              },
            }
          : undefined
      }
    >
      {favoriteState ? (
        <FavoriteIcon
          color="error"
          fontSize={format === "table" ? "small" : "medium"}
        />
      ) : (
        <FavoriteBorderIcon
          fontSize={format === "table" ? "small" : "medium"}
        />
      )}
    </IconButton>
  );
};

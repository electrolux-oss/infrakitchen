import { useCallback, useEffect, useState } from "react";

import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { IconButton } from "@mui/material";

import { useConfig } from "../context/ConfigContext";
import { notifyError } from "../hooks/useNotification";

type FavoriteComponentType = "resource" | "executor";

interface FavoriteResponse {
  component_type: string;
  component_id: string;
}

interface FavoriteButtonProps {
  componentId: string;
  componentType: FavoriteComponentType;
  ariaLabel: string;
  successMessage: string;
}

export const FavoriteButton = ({
  componentId,
  componentType,
  ariaLabel,
}: FavoriteButtonProps) => {
  const { ikApi } = useConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const fetchFavoriteStatus = useCallback(async () => {
    try {
      const favorites = await ikApi.get("favorites");
      const hasFavorite = (favorites as FavoriteResponse[]).some(
        (favorite) =>
          favorite.component_type === componentType &&
          String(favorite.component_id) === String(componentId),
      );
      setIsFavorite(hasFavorite);
    } catch {
      setIsFavorite(false);
    }
  }, [componentId, componentType, ikApi]);

  useEffect(() => {
    fetchFavoriteStatus();
  }, [fetchFavoriteStatus]);

  const handleAddFavorite = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    if (isFavorite) {
      try {
        await ikApi.deleteRaw(`favorites/${componentType}/${componentId}`, {});
        setIsFavorite(false);
      } catch (error: any) {
        notifyError(error);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      await ikApi.postRaw("favorites", {
        component_type: componentType,
        component_id: componentId,
      });
      setIsFavorite(true);
    } catch (error: any) {
      notifyError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <IconButton
      aria-label={ariaLabel}
      onClick={handleAddFavorite}
      disabled={isSubmitting}
    >
      {isFavorite ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
    </IconButton>
  );
};

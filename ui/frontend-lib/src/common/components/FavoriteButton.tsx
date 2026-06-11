import { useEffect, useState } from "react";

import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { IconButton } from "@mui/material";

import {
  CREATE_FAVORITE_MUTATION,
  DELETE_FAVORITE_MUTATION,
} from "../../favorites/graphql";
import { useConfig } from "../context/ConfigContext";
import { notifyError } from "../hooks/useNotification";

export type FavoriteComponentType = "resource" | "executor";

interface FavoriteButtonProps {
  componentId: string;
  componentType: FavoriteComponentType;
  ariaLabel: string;
  format?: "overview" | "table";
  isFavorite?: boolean;
}

export const FavoriteButton = ({
  componentId,
  componentType,
  ariaLabel,
  format = "overview",
  isFavorite: isFavoriteProp,
}: FavoriteButtonProps) => {
  const { ikApi } = useConfig();
  const [favoriteState, setFavoriteState] = useState(Boolean(isFavoriteProp));
  const [submittingState, setSubmittingState] = useState(false);

  useEffect(() => {
    if (isFavoriteProp !== undefined) {
      setFavoriteState(isFavoriteProp);
    }
  }, [isFavoriteProp, componentId, componentType]);

  const handleAddFavorite = async () => {
    if (submittingState) {
      return;
    }

    setSubmittingState(true);
    try {
      if (favoriteState) {
        await ikApi.graphqlRequest(DELETE_FAVORITE_MUTATION, {
          input: {
            componentType: componentType,
            componentId: componentId,
          },
        });
        setFavoriteState(false);
      } else {
        await ikApi.graphqlRequest(CREATE_FAVORITE_MUTATION, {
          input: {
            componentType: componentType,
            componentId: componentId,
          },
        });
        setFavoriteState(true);
      }
    } catch (error: any) {
      notifyError(error);
    } finally {
      setSubmittingState(false);
    }
  };

  return (
    <IconButton
      aria-label={ariaLabel}
      onClick={handleAddFavorite}
      disabled={submittingState}
      disableRipple={format === "table"}
      sx={{
        border: "none",
        outline: "none",
        backgroundColor: "transparent",
        "&.MuiButtonBase-root": { backgroundColor: "transparent" },
        "&:hover": { backgroundColor: "transparent" },
        "&:hover.MuiButtonBase-root": { backgroundColor: "transparent" },
        ...(format === "table" && {
          p: 0,
          minWidth: 0,
          width: 20,
          height: 20,
        }),
      }}
    >
      {favoriteState ? (
        <FavoriteIcon
          sx={{ color: "#e91e63" }}
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

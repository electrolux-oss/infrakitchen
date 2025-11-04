import React from "react";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Typography, IconButton, TextField } from "@mui/material";

type Tag = { key: string; value: string };

interface AccountTagsInputProps {
  tags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
}

const AccountTagsInput = ({ tags, setTags }: AccountTagsInputProps) => {
  const handleTagChange = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    const updatedTags = [...tags];
    updatedTags[index][field] = value;
    setTags(updatedTags);
  };

  const handleAddTag = () => {
    setTags([...tags, { key: "", value: "" }]);
  };

  const handleRemoveTag = (index: number) => {
    setTags((prevTags) => prevTags.filter((_, i) => i !== index));
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="body2" sx={{ mb: 2 }}>
          Account Tags
        </Typography>
        <IconButton
          onClick={handleAddTag}
          sx={{ height: "40px" }}
          aria-label="Add"
        >
          <AddIcon />
        </IconButton>
      </Box>

      {tags.map((tag, index) => (
        <Box key={index} sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            label="Key"
            value={tag.key}
            onChange={(e) => handleTagChange(index, "key", e.target.value)}
            fullWidth
          />
          <Box
            sx={{ display: "flex", width: "100%", alignItems: "end", gap: 1 }}
          >
            <TextField
              label="Value"
              value={tag.value}
              onChange={(e) => handleTagChange(index, "value", e.target.value)}
              fullWidth
            />
            <IconButton
              onClick={() => handleRemoveTag(index)}
              aria-label="Remove Tag"
              disabled={index === 0}
              sx={{ height: "40px" }}
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>
      ))}
    </>
  );
};

export { AccountTagsInput };

import { Checkbox, FormControlLabel } from "../../ui";

import { IMAGE_PLATFORMS, sortPlatforms } from "./builds";

interface PlatformSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export const PlatformSelector = ({
  value,
  onChange,
  disabled,
}: PlatformSelectorProps) => (
  <div>
    <div className="flex flex-wrap gap-x-4">
      {IMAGE_PLATFORMS.map((platform) => (
        <FormControlLabel
          key={platform.id}
          disabled={disabled}
          control={
            <Checkbox
              checked={value.includes(platform.id)}
              onChange={(_event, checked) =>
                onChange(
                  sortPlatforms(
                    checked
                      ? [...value, platform.id]
                      : value.filter((id) => id !== platform.id),
                  ),
                )
              }
            />
          }
          label={platform.label}
        />
      ))}
    </div>
    {value.length === 0 && (
      <p className="m-0 text-caption text-fg-muted">
        Choose at least one platform
      </p>
    )}
  </div>
);

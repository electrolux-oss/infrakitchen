import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import type { ColumnVisibilityModel, DataTableColumn } from "./DataTable.types";
import { FormControlLabel } from "./FormControlLabel";
import { Popover, PopoverOrigin } from "./Popover";

export interface ColumnVisibilityMenuProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  columns: readonly DataTableColumn[];
  model: ColumnVisibilityModel;
  onChange: (model: ColumnVisibilityModel) => void;
}

const ANCHOR: PopoverOrigin = { vertical: "bottom", horizontal: "right" };
const TRANSFORM: PopoverOrigin = { vertical: "top", horizontal: "right" };

/**
 * Show/hide list for a DataTable's columns (DataGrid's columns panel).
 * Columns with `hideable: false` stay checked and locked.
 */
export function ColumnVisibilityMenu({
  open,
  anchorEl,
  onClose,
  columns,
  model,
  onChange,
}: ColumnVisibilityMenuProps) {
  const listed = columns.filter((column) => column.headerName);
  const setAll = (visible: boolean) =>
    onChange({
      ...model,
      ...Object.fromEntries(
        listed
          .filter((column) => column.hideable !== false)
          .map((column) => [column.field, visible]),
      ),
    });

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={ANCHOR}
      transformOrigin={TRANSFORM}
      className="min-w-56"
    >
      <div className="flex max-h-[min(60vh,420px)] flex-col overflow-y-auto py-1">
        {listed.map((column) => {
          const locked = column.hideable === false;
          return (
            <FormControlLabel
              key={column.field}
              className="mx-0 px-2"
              disabled={locked}
              label={column.headerName}
              control={
                <Checkbox
                  className="m-1.5"
                  checked={locked || model[column.field] !== false}
                  onChange={(_event, checked) =>
                    onChange({ ...model, [column.field]: checked })
                  }
                />
              }
            />
          );
        })}
      </div>
      <div className="flex justify-between gap-2 border-t border-divider px-2 py-1">
        <Button variant="text" size="small" onClick={() => setAll(false)}>
          Hide all
        </Button>
        <Button variant="text" size="small" onClick={() => setAll(true)}>
          Show all
        </Button>
      </div>
    </Popover>
  );
}

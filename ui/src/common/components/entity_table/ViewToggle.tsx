import { HeroSquares2X2Icon, HeroTableCellsIcon } from "../../../icons";
import { Tab, Tabs } from "../../../ui";

export type EntityListView = "grid" | "table";

interface ViewToggleProps {
  value: EntityListView;
  onChange: (view: EntityListView) => void;
  ariaLabel: string;
}

/** Segmented Grid/Table switch, floating so it stays visible while scrolling. */
export const ViewToggle = ({ value, onChange, ariaLabel }: ViewToggleProps) => (
  <div className="fixed bottom-6 z-30 self-center rounded-box border border-base-content/10 bg-base-100/25 shadow-lg backdrop-blur-md backdrop-saturate-150">
    <Tabs
      appearance="segmented"
      value={value}
      onChange={(_, v) => onChange(v as EntityListView)}
      aria-label={ariaLabel}
    >
      <Tab
        value="grid"
        label={
          <span className="flex items-center gap-1">
            <HeroSquares2X2Icon fontSize="small" />
            Grid
          </span>
        }
      />
      <Tab
        value="table"
        label={
          <span className="flex items-center gap-1">
            <HeroTableCellsIcon fontSize="small" />
            Table
          </span>
        }
      />
    </Tabs>
  </div>
);

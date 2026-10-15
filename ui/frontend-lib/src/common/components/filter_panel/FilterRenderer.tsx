import { AdvancedFilter } from "./AdvancedFilter";
import { FilterConfig, FilterState } from "./FilterConfig";

interface FilterRendererProps {
  config: FilterConfig;
  filterValues: FilterState;
  onChange: (filterId: string, value: any) => void;
}

export const FilterRenderer = ({
  config,
  filterValues,
  onChange,
}: FilterRendererProps) => {
  const value = filterValues[config.id];
  const handleChange = (newValue: any) => {
    onChange(config.id, newValue);
  };

  return (
    <div className="flex w-full items-start">
      <AdvancedFilter
        config={config}
        value={value || []}
        onChange={handleChange}
      />
    </div>
  );
};

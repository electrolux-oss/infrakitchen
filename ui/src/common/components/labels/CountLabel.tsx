import { Label } from "../../../ui/Label";

// Label with an info-tinted count pill, e.g. "Resources" [0].
export const CountLabel = ({
  label,
  count,
  size,
}: {
  label: string;
  count: number;
  size?: "small";
}) => (
  <div className="flex items-center gap-1.5">
    {label}
    <Label size={size} label={String(count)} />
  </div>
);

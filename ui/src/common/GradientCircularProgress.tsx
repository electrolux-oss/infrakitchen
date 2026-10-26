import { Spinner } from "../ui";

interface GradientCircularProgressProps {
  size?: number;
}

/**
 * Page-level loading indicator: the daisyUI spinner in a muted grey.
 */
export function GradientCircularProgress({
  size = 40,
}: GradientCircularProgressProps) {
  return <Spinner size={size} color="inherit" className="text-grey-500" />;
}

export default GradientCircularProgress;

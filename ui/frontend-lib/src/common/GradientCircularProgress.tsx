import { Spinner } from "../ui";

interface GradientCircularProgressProps {
  size?: number;
}

/**
 * Page-level loading indicator. Kept under its original name for library
 * consumers; it now renders the daisyUI spinner in a muted grey instead of
 * the gradient MUI CircularProgress.
 */
export function GradientCircularProgress({
  size = 40,
}: GradientCircularProgressProps) {
  return <Spinner size={size} color="inherit" className="text-grey-500" />;
}

export default GradientCircularProgress;

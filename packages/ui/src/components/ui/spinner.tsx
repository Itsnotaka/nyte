import { IconLoader } from "@central-icons-react/round-filled-radius-2-stroke-1.5";

import { cn } from "../../lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <IconLoader
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };

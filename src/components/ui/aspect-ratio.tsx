import * as React from "react";
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio";

import { cn } from "@/lib/utils";

/**
 * AspectRatio do EduFlow Academy
 * Use para manter a proporção de imagens, vídeos ou gráficos de BI.
 * Ex: <AspectRatio ratio={16 / 9}> ... </AspectRatio>
 */
const AspectRatio = React.forwardRef<
  React.ElementRef<typeof AspectRatioPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AspectRatioPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AspectRatioPrimitive.Root
    ref={ref}
    className={cn(
      "overflow-hidden rounded-[24px] bg-muted/20 shadow-inner", 
      className
    )}
    {...props}
  />
));

AspectRatio.displayName = "AspectRatio";

export { AspectRatio };

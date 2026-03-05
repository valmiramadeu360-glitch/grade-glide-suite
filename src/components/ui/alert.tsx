import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-[24px] border p-5 [&>svg~*]:pl-9 [&>svg+div]:translate-y-[-2px] [&>svg]:absolute [&>svg]:left-5 [&>svg]:top-5 [&>svg]:text-foreground transition-all duration-300 shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border/50",
        destructive: 
          "border-destructive/30 bg-destructive/5 text-destructive dark:border-destructive/20 [&>svg]:text-destructive",
        primary: 
          "border-primary/30 bg-primary/5 text-primary [&>svg]:text-primary", // Nova variante para avisos de estudo
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 
      ref={ref} 
      className={cn("mb-1 font-black uppercase tracking-widest text-xs leading-none", className)} 
      {...props} 
    />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn("text-sm font-medium opacity-90 [&_p]:leading-relaxed", className)} 
      {...props} 
    />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };

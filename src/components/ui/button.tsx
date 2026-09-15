import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold ring-offset-background transition-all duration-200 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#E84326] shadow-[0_4px_14px_rgba(255,84,54,0.25)] hover:shadow-[0_6px_20px_rgba(255,84,54,0.35)] hover:-translate-y-0.5 active:translate-y-0",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline: "border border-border/80 bg-card hover:bg-secondary hover:text-foreground text-foreground shadow-2xs hover:border-border",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium",
        ghost: "hover:bg-secondary hover:text-foreground font-medium",
        link: "text-primary underline-offset-4 hover:underline font-medium p-0 h-auto",
        warm: "bg-[#FFF0EB] text-primary hover:bg-[#FFE5DC] border border-[#FFD9CE] font-semibold",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

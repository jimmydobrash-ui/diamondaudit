import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    // touch-action pan-y + pinch-zoom (not the shadcn default `touch-none`): a
    // vertical scroll or a pinch that starts on the slider passes through to the
    // page instead of being captured as a horizontal value drag. On the evaluate
    // screen the sliders fill most of the viewport, so `touch-none` meant coaches
    // scrolling or zooming on a phone kept nudging scores by accident. Horizontal
    // drags still move the thumb.
    className={cn("relative flex w-full select-none items-center [touch-action:pan-y_pinch-zoom]", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-6 w-6 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

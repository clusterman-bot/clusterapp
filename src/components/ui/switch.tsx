import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const SwitchThumbContent = () => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [isChecked, setIsChecked] = React.useState(false);

  React.useEffect(() => {
    const thumb = ref.current?.parentElement;
    if (!thumb) return;

    const observer = new MutationObserver(() => {
      setIsChecked(thumb.getAttribute("data-state") === "checked");
    });
    setIsChecked(thumb.getAttribute("data-state") === "checked");
    observer.observe(thumb, { attributes: true, attributeFilter: ["data-state"] });
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={ref} className="text-[7px] font-bold uppercase leading-none text-foreground select-none">
      {isChecked ? "ON" : "OFF"}
    </span>
  );
};

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    >
      <SwitchThumbContent />
    </SwitchPrimitives.Thumb>
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };

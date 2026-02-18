import { useEffect, useRef, useState, useCallback } from 'react';
import { useTour, TOUR_STEPS } from '@/contexts/TourContext';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, ArrowLeft, ArrowRight } from 'lucide-react';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PADDING = 12;

function useTargetRect(targetId: string | undefined): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  const rafRef = useRef<number>();

  const update = useCallback(() => {
    if (!targetId) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${targetId}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ x: r.left, y: r.top, width: r.width, height: r.height });
  }, [targetId]);

  useEffect(() => {
    // Poll a few times after mount to wait for navigation/render
    let attempts = 0;
    const poll = () => {
      update();
      attempts++;
      if (attempts < 15) {
        rafRef.current = requestAnimationFrame(poll);
      }
    };
    rafRef.current = requestAnimationFrame(poll);

    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [update]);

  return rect;
}

function getTooltipStyle(
  rect: Rect | null,
  position: string,
  ww: number,
  wh: number
): React.CSSProperties {
  if (!rect || position === 'center') {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(360, ww - 32),
    };
  }

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const tooltipW = Math.min(320, ww - 32);

  if (position === 'bottom' || cy < wh / 2) {
    return {
      position: 'fixed',
      top: rect.y + rect.height + PADDING + 12,
      left: Math.max(16, Math.min(cx - tooltipW / 2, ww - tooltipW - 16)),
      width: tooltipW,
    };
  }
  if (position === 'top') {
    return {
      position: 'fixed',
      bottom: wh - rect.y + PADDING + 12,
      left: Math.max(16, Math.min(cx - tooltipW / 2, ww - tooltipW - 16)),
      width: tooltipW,
    };
  }
  // fallback center
  return {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: tooltipW,
  };
}

function ArrowIndicator({ rect, position }: { rect: Rect; position: string }) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const wh = window.innerHeight;

  const isBottom = position === 'bottom' || cy < wh / 2;

  if (isBottom) {
    return (
      <div
        className="fixed z-[10001] pointer-events-none"
        style={{ left: cx - 12, top: rect.y + rect.height + PADDING - 4 }}
      >
        <ArrowDown className="h-6 w-6 text-primary animate-bounce" />
      </div>
    );
  }
  return (
    <div
      className="fixed z-[10001] pointer-events-none"
      style={{ left: cx - 12, top: rect.y - PADDING - 28 }}
    >
      <ArrowUp className="h-6 w-6 text-primary animate-bounce" />
    </div>
  );
}

export function GuidedTour() {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTour } = useTour();
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  const [ww, setWw] = useState(window.innerWidth);
  const [wh, setWh] = useState(window.innerHeight);

  useEffect(() => {
    const handler = () => { setWw(window.innerWidth); setWh(window.innerHeight); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const rect = useTargetRect(isActive ? step?.target : undefined);
  const position = step?.position || 'bottom';
  const isCentered = position === 'center' || !step?.target || !rect;

  const tooltipStyle = getTooltipStyle(rect, position, ww, wh);

  if (!isActive) return null;

  const spotX = rect ? rect.x - PADDING : 0;
  const spotY = rect ? rect.y - PADDING : 0;
  const spotW = rect ? rect.width + PADDING * 2 : 0;
  const spotH = rect ? rect.height + PADDING * 2 : 0;
  const spotR = 10;

  return (
    <>
      {/* SVG Overlay — dim everything except spotlight */}
      <svg
        className="fixed inset-0 z-[9998] pointer-events-none transition-all duration-500"
        width={ww}
        height={wh}
        style={{ position: 'fixed', top: 0, left: 0 }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width={ww} height={wh} fill="white" />
            {!isCentered && rect && (
              <rect
                x={spotX}
                y={spotY}
                width={spotW}
                height={spotH}
                rx={spotR}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width={ww}
          height={wh}
          fill="rgba(0,0,0,0.72)"
          mask="url(#tour-spotlight-mask)"
          className="transition-all duration-500"
        />
      </svg>

      {/* Spotlight pulse ring */}
      {!isCentered && rect && (
        <div
          className="fixed z-[9999] pointer-events-none rounded-xl transition-all duration-500"
          style={{
            left: spotX,
            top: spotY,
            width: spotW,
            height: spotH,
            boxShadow: '0 0 0 3px hsl(var(--primary)), 0 0 0 6px hsl(var(--primary) / 0.3)',
            animation: 'tour-pulse 1.6s ease-in-out infinite',
          }}
        />
      )}

      {/* Arrow bounce indicator */}
      {!isCentered && rect && (
        <ArrowIndicator rect={rect} position={position} />
      )}

      {/* Tooltip card */}
      <div
        className="z-[10002] bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={{ ...tooltipStyle, position: 'fixed' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {/* Step dots */}
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? 'w-5 h-2 bg-primary'
                        : i < currentStep
                        ? 'w-2 h-2 bg-primary/50'
                        : 'w-2 h-2 bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                {currentStep + 1}/{steps.length}
              </span>
            </div>
            <h3 className="font-bold text-base leading-tight">{step.title}</h3>
          </div>
          <button
            onClick={skipTour}
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevStep}
            disabled={isFirst}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>

          <Button
            size="sm"
            onClick={nextStep}
            className="gap-1 text-xs h-8 px-4"
          >
            {step.actionLabel || (isLast ? 'Finish 🎉' : 'Next')}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Pulse keyframe injected inline */}
      <style>{`
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 3px hsl(var(--primary)), 0 0 0 6px hsl(var(--primary) / 0.3); }
          50% { box-shadow: 0 0 0 4px hsl(var(--primary)), 0 0 0 12px hsl(var(--primary) / 0.15); }
        }
      `}</style>
    </>
  );
}

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Check, Sparkles, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  isRefreshing: boolean;
  refreshSuccess?: boolean;
  children: React.ReactNode;
  className?: string;
  pullDownThreshold?: number;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  isRefreshing,
  refreshSuccess = false,
  children,
  className,
  pullDownThreshold = 68,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startYRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  const hasTriggeredHapticRef = useRef<boolean>(false);
  const isEligibleForPullRef = useRef<boolean>(false);

  // Check if user is currently at the top of scrollable context
  const isScrolledToTop = useCallback(() => {
    if (typeof window === "undefined") return true;

    // Check window / body / document scroll
    const winScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    if (winScroll > 4) return false;

    // Check parent scroll container if present (e.g. desktop sidebar main container)
    const mainEl = containerRef.current?.closest("main");
    if (mainEl && mainEl.scrollTop > 4) return false;

    return true;
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || isRefreshing) return;
    if (isScrolledToTop()) {
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isEligibleForPullRef.current = true;
      hasTriggeredHapticRef.current = false;
    } else {
      isEligibleForPullRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || isRefreshing || !isEligibleForPullRef.current) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = Math.abs(currentX - startXRef.current);

    // If swiping horizontally more than vertically, abort pull
    if (!isPulling && deltaX > Math.abs(deltaY)) {
      isEligibleForPullRef.current = false;
      return;
    }

    if (deltaY > 0 && isScrolledToTop()) {
      setIsPulling(true);
      // Logarithmic / power damping for elastic feel
      const dampedDistance = Math.min(96, Math.pow(deltaY, 0.8) * 1.5);
      setPullDistance(dampedDistance);

      // Trigger haptic feedback when crossing threshold
      if (dampedDistance >= pullDownThreshold && !hasTriggeredHapticRef.current) {
        hasTriggeredHapticRef.current = true;
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(12);
          } catch {
            // Ignore vibration error
          }
        }
      } else if (dampedDistance < pullDownThreshold) {
        hasTriggeredHapticRef.current = false;
      }
    } else if (deltaY <= 0 && isPulling) {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = () => {
    if (disabled || isRefreshing) return;
    if (isPulling) {
      if (pullDistance >= pullDownThreshold) {
        onRefresh();
      }
      setIsPulling(false);
      setPullDistance(0);
      hasTriggeredHapticRef.current = false;
      isEligibleForPullRef.current = false;
    }
  };

  const isPastThreshold = pullDistance >= pullDownThreshold;
  const showIndicator = isPulling || isRefreshing || refreshSuccess;
  const activeHeight = isRefreshing || refreshSuccess ? 56 : pullDistance;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={cn("relative transition-transform select-none sm:select-auto", className)}
      style={{
        overscrollBehaviorY: "contain",
      }}
    >
      {/* Pull-down banner indicator */}
      <AnimatePresence>
        {showIndicator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{
              opacity: 1,
              height: activeHeight,
            }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 32,
            }}
            className="flex items-center justify-center overflow-hidden pointer-events-none"
          >
            <div
              className={cn(
                "inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-semibold shadow-soft transition-all duration-200 border",
                refreshSuccess
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : isRefreshing
                  ? "bg-[#FFF0EB] border-[#FFD9CE] text-[#FF5436]"
                  : isPastThreshold
                  ? "bg-[#FF5436] text-white border-[#FF5436] scale-105 shadow-card"
                  : "bg-white/95 backdrop-blur-sm border-[#EFE8DD] text-muted-foreground"
              )}
            >
              {refreshSuccess ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
                  <span>Matches & alerts updated!</span>
                </>
              ) : isRefreshing ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin text-[#FF5436]" />
                  <span>Checking latest matches & chats…</span>
                </>
              ) : isPastThreshold ? (
                <>
                  <Sparkles className="h-4 w-4 fill-white text-white animate-pulse" />
                  <span>Release to refresh now</span>
                </>
              ) : (
                <>
                  <motion.div
                    style={{
                      transform: `rotate(${Math.min(180, (pullDistance / pullDownThreshold) * 180)}deg)`,
                    }}
                  >
                    <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </motion.div>
                  <span>Pull down to refresh</span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main dashboard content container with slight elastic offset when pulling */}
      <motion.div
        animate={{
          y: isPulling ? pullDistance * 0.35 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

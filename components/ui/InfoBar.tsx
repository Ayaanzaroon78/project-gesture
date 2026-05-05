"use client";

import { GESTURE_VISUALS } from "@/utils/colors";
import type { GestureType } from "@/utils/gestures";

interface InfoBarProps {
  gestures: GestureType[];
  fps: number;
  handCount: number;
}

function getFpsColor(fps: number): string {
  if (fps > 45) {
    return "text-emerald-300";
  }

  if (fps >= 30) {
    return "text-amber-300";
  }

  return "text-rose-300";
}

export default function InfoBar({ gestures, fps, handCount }: InfoBarProps) {
  const visibleGestures = gestures.length > 0 ? gestures : ["UNKNOWN" as const];

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex h-14 items-center justify-between border-t border-white/10 bg-black/60 px-4 text-xs text-slate-200 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {visibleGestures.map((gesture, index) => {
          const visual = GESTURE_VISUALS[gesture];
          return (
            <span
              key={`${gesture}-${index}`}
              className="inline-flex h-8 max-w-40 items-center gap-2 rounded-md border border-white/10 bg-white/[0.08] px-3 transition-opacity duration-200"
              style={{ color: visual.color }}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px]">{visual.icon}</span>
              <span className="truncate font-semibold">{visual.label}</span>
            </span>
          );
        })}
      </div>

      <div className="hidden flex-1 justify-center text-center text-[11px] font-bold uppercase tracking-[0.22em] text-white/60 sm:flex">
        HandScape
      </div>

      <div className="flex flex-1 items-center justify-end gap-4 whitespace-nowrap font-semibold">
        <span className={getFpsColor(fps)}>{fps} FPS</span>
        <span className="text-slate-300">hands detected: {handCount}</span>
      </div>
    </div>
  );
}

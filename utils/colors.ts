import type { GestureType } from "./gestures";

export type ColorTheme = "Neon" | "Fire" | "Nature" | "Mono";

export interface ThemePalette {
  name: ColorTheme;
  primary: string;
  secondary: string;
  accent: string;
  soft: string;
  hues: [number, number];
  monochrome: boolean;
}

export interface GestureVisual {
  label: string;
  icon: string;
  color: string;
  hue: number;
}

export const THEMES: Record<ColorTheme, ThemePalette> = {
  Neon: {
    name: "Neon",
    primary: "#06B6D4",
    secondary: "#7C3AED",
    accent: "#EC4899",
    soft: "rgba(6, 182, 212, 0.18)",
    hues: [188, 262],
    monochrome: false
  },
  Fire: {
    name: "Fire",
    primary: "#F97316",
    secondary: "#EF4444",
    accent: "#FCD34D",
    soft: "rgba(249, 115, 22, 0.18)",
    hues: [24, 0],
    monochrome: false
  },
  Nature: {
    name: "Nature",
    primary: "#14B8A6",
    secondary: "#22C55E",
    accent: "#A3E635",
    soft: "rgba(20, 184, 166, 0.18)",
    hues: [174, 142],
    monochrome: false
  },
  Mono: {
    name: "Mono",
    primary: "#FFFFFF",
    secondary: "#D4D4D8",
    accent: "#A1A1AA",
    soft: "rgba(255, 255, 255, 0.12)",
    hues: [0, 0],
    monochrome: true
  }
};

export const GESTURE_VISUALS: Record<GestureType, GestureVisual> = {
  OPEN: { label: "Open", icon: "✦", color: "#06B6D4", hue: 188 },
  FIST: { label: "Fist", icon: "●", color: "#F8FAFC", hue: 0 },
  POINT: { label: "Point", icon: "→", color: "#06B6D4", hue: 188 },
  PINCH: { label: "Pinch", icon: "◎", color: "#EC4899", hue: 330 },
  PEACE: { label: "Peace", icon: "Ⅱ", color: "#8B5CF6", hue: 258 },
  THUMBS_UP: { label: "Thumbs up", icon: "↑", color: "#22C55E", hue: 142 },
  ROCK: { label: "Rock", icon: "ϟ", color: "#FCD34D", hue: 45 },
  OK: { label: "OK", icon: "○", color: "#A3E635", hue: 74 },
  UNKNOWN: { label: "Searching", icon: "·", color: "#94A3B8", hue: 210 }
};

export function getGestureHue(gesture: GestureType, fallbackHue: number): number {
  return gesture === "UNKNOWN" ? fallbackHue : GESTURE_VISUALS[gesture].hue;
}

export function getDynamicHue(baseHue: number, theme: ColorTheme, handIndex: number): number {
  const palette = THEMES[theme];
  if (palette.monochrome) {
    return 0;
  }

  return (baseHue + (handIndex === 1 ? 180 : 0)) % 360;
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHandDetector, type CameraFacingMode } from "@/hooks/useHandDetector";
import { useParticles } from "@/hooks/useParticles";
import { THEMES, type ColorTheme } from "@/utils/colors";
import {
  createConfettiPool,
  createFluidMesh,
  drawGestureEffects,
  drawReactiveBackground,
  drawRipples,
  drawSkeleton,
  drawVideoLayer,
  fitCanvasToViewport,
  getCanvasContext,
  getPinchPoint,
  getThumbTip,
  getVideoFrame,
  getWrist,
  projectLandmarks,
  shouldSpawnConfetti,
  shouldSpawnRipple,
  shouldSpawnShockwave,
  spawnConfetti,
  updateConfetti,
  updateFluidMesh,
  drawFluidMesh,
  type ConfettiPiece,
  type FluidPoint,
  type Ripple,
  type Shockwave,
  type VisualHand
} from "@/utils/drawUtils";
import { classifyGesture, type GestureType } from "@/utils/gestures";
import InfoBar from "./ui/InfoBar";
import Overlay from "./ui/Overlay";

interface Settings {
  intensity: number;
  skeleton: boolean;
  fluidMesh: boolean;
  background: boolean;
  theme: ColorTheme;
}

const DEFAULT_SETTINGS: Settings = {
  intensity: 75,
  skeleton: true,
  fluidMesh: true,
  background: true,
  theme: "Neon"
};

const STORAGE_KEY = "handscape-settings";
const MESH_COLUMNS = 20;
const MESH_ROWS = 14;

function createRipplePool(): Ripple[] {
  return Array.from({ length: 8 }, () => ({
    active: false,
    x: 0,
    y: 0,
    startTime: 0
  }));
}

function createShockwavePool(): Shockwave[] {
  return Array.from({ length: 8 }, () => ({
    active: false,
    x: 0,
    y: 0,
    startTime: 0
  }));
}

function getNextInactive<T extends { active: boolean }>(pool: T[]): T {
  return pool.find((item) => !item.active) ?? pool[0];
}

function isValidTheme(value: string): value is ColorTheme {
  return value === "Neon" || value === "Fire" || value === "Nature" || value === "Mono";
}

function loadSettings(): Settings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored) as Partial<Settings>;
    return {
      intensity: typeof parsed.intensity === "number" ? Math.min(100, Math.max(0, parsed.intensity)) : DEFAULT_SETTINGS.intensity,
      skeleton: typeof parsed.skeleton === "boolean" ? parsed.skeleton : DEFAULT_SETTINGS.skeleton,
      fluidMesh: typeof parsed.fluidMesh === "boolean" ? parsed.fluidMesh : DEFAULT_SETTINGS.fluidMesh,
      background: typeof parsed.background === "boolean" ? parsed.background : DEFAULT_SETTINGS.background,
      theme: typeof parsed.theme === "string" && isValidTheme(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function HandScape() {
  const {
    hands,
    handsRef,
    isLoading,
    isActive,
    error,
    fps,
    facingMode,
    videoRef,
    canvasRef: videoCanvasRef,
    startCamera,
    setFacingMode
  } = useHandDetector();
  const particleEngine = useParticles();
  const effectsCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const meshRef = useRef<FluidPoint[]>([]);
  const ripplesRef = useRef<Ripple[]>(createRipplePool());
  const shockwavesRef = useRef<Shockwave[]>(createShockwavePool());
  const confettiRef = useRef<ConfettiPiece[]>(createConfettiPool());
  const previousGesturesRef = useRef<Array<GestureType | undefined>>([]);
  const latestGestureKeyRef = useRef("");
  const flashOpacityRef = useRef(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gestures, setGestures] = useState<GestureType[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const intensityScale = settings.intensity / 100;
  const palette = THEMES[settings.theme];

  useEffect(() => {
    setSettings(loadSettings());
    setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const resizeCanvases = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (videoCanvasRef.current) {
      fitCanvasToViewport(videoCanvasRef.current, width, height);
    }

    if (effectsCanvasRef.current) {
      fitCanvasToViewport(effectsCanvasRef.current, width, height);
    }

    meshRef.current = createFluidMesh(width, height, MESH_COLUMNS, MESH_ROWS);
  }, [videoCanvasRef]);

  useEffect(() => {
    resizeCanvases();
    window.addEventListener("resize", resizeCanvases);
    return () => window.removeEventListener("resize", resizeCanvases);
  }, [resizeCanvases]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const triggerFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void document.documentElement.requestFullscreen();
  }, []);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }, []);

  const renderScene = useCallback(
    (time: number) => {
      const video = videoRef.current;
      const videoCanvas = videoCanvasRef.current;
      const effectsCanvas = effectsCanvasRef.current;

      if (!video || !videoCanvas || !effectsCanvas) {
        animationFrameRef.current = requestAnimationFrame(renderScene);
        return;
      }

      const videoContext = getCanvasContext(videoCanvas);
      const effectsContext = getCanvasContext(effectsCanvas);
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (!videoContext || !effectsContext) {
        animationFrameRef.current = requestAnimationFrame(renderScene);
        return;
      }

      const frame = getVideoFrame(width, height, video.videoWidth, video.videoHeight);
      const visualHands: VisualHand[] = handsRef.current.map((hand) => {
        const projected = projectLandmarks(hand.keypoints, frame, width, true);
        return {
          landmarks: projected,
          gesture: classifyGesture(hand.keypoints),
          handedness: hand.handedness
        };
      });

      const gestureKey = visualHands.map((hand) => hand.gesture).join("|");
      if (gestureKey !== latestGestureKeyRef.current) {
        latestGestureKeyRef.current = gestureKey;
        setGestures(visualHands.map((hand) => hand.gesture));
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        drawVideoLayer(videoContext, video, width, height, 14);
      }

      drawReactiveBackground(effectsContext, visualHands, {
        width,
        height,
        time,
        theme: settings.theme,
        intensity: intensityScale,
        showSkeleton: settings.skeleton,
        showFluidMesh: settings.fluidMesh,
        showBackground: settings.background,
        flashOpacity: flashOpacityRef.current
      });

      visualHands.forEach((hand, index) => {
        const previous = previousGesturesRef.current[index];

        if (shouldSpawnRipple(previous, hand.gesture)) {
          const ripple = getNextInactive(ripplesRef.current);
          const pinchPoint = getPinchPoint(hand.landmarks);
          ripple.active = true;
          ripple.x = pinchPoint.x;
          ripple.y = pinchPoint.y;
          ripple.startTime = time;
        }

        if (shouldSpawnShockwave(previous, hand.gesture)) {
          const shockwave = getNextInactive(shockwavesRef.current);
          const wrist = getWrist(hand.landmarks);
          if (wrist) {
            shockwave.active = true;
            shockwave.x = wrist.x;
            shockwave.y = wrist.y;
            shockwave.startTime = time;
            flashOpacityRef.current = 0.3;
          }
        }

        if (shouldSpawnConfetti(previous, hand.gesture)) {
          const thumbTip = getThumbTip(hand.landmarks);
          if (thumbTip) {
            spawnConfetti(confettiRef.current, thumbTip.x, thumbTip.y);
          }
        }
      });

      previousGesturesRef.current = visualHands.map((hand) => hand.gesture);
      ripplesRef.current.forEach((ripple) => {
        if (ripple.active && time - ripple.startTime > 840) {
          ripple.active = false;
        }
      });
      shockwavesRef.current.forEach((shockwave) => {
        if (shockwave.active && time - shockwave.startTime > 700) {
          shockwave.active = false;
        }
      });

      const allLandmarks = visualHands.flatMap((hand) => hand.landmarks);
      if (settings.fluidMesh) {
        updateFluidMesh(meshRef.current, allLandmarks);
        drawFluidMesh(effectsContext, meshRef.current, MESH_COLUMNS);
      }

      particleEngine.emitFromHands(visualHands, intensityScale, settings.theme, time);
      particleEngine.updateParticles();
      particleEngine.drawParticles(effectsContext, width, height);

      drawRipples(effectsContext, ripplesRef.current, time, Math.max(0.25, intensityScale));
      updateConfetti(confettiRef.current);
      drawGestureEffects(
        effectsContext,
        visualHands,
        {
          width,
          height,
          time,
          theme: settings.theme,
          intensity: intensityScale,
          showSkeleton: settings.skeleton,
          showFluidMesh: settings.fluidMesh,
          showBackground: settings.background,
          flashOpacity: flashOpacityRef.current
        },
        shockwavesRef.current,
        confettiRef.current
      );

      if (settings.skeleton) {
        visualHands.forEach((hand) => drawSkeleton(effectsContext, hand.landmarks, time, palette));
      }

      flashOpacityRef.current = Math.max(0, flashOpacityRef.current - 0.025);
      animationFrameRef.current = requestAnimationFrame(renderScene);
    },
    [
      handsRef,
      intensityScale,
      palette,
      particleEngine,
      settings.background,
      settings.fluidMesh,
      settings.skeleton,
      settings.theme,
      videoCanvasRef,
      videoRef
    ]
  );

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(renderScene);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderScene]);

  const startExperience = useCallback(() => {
    void startCamera(facingMode);
  }, [facingMode, startCamera]);

  const toggleFacingMode = useCallback(() => {
    setFacingMode(facingMode === "user" ? "environment" : "user");
  }, [facingMode, setFacingMode]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <video ref={videoRef} className="pointer-events-none fixed inset-0 h-px w-px opacity-0" playsInline muted />
      <canvas ref={videoCanvasRef} className="fixed inset-0 h-full w-full opacity-70" aria-hidden="true" />
      <canvas ref={effectsCanvasRef} className="fixed inset-0 h-full w-full" aria-hidden="true" />

      <div className="fixed left-4 top-4 z-20 flex items-center gap-2">
        <button
          type="button"
          title="Open settings"
          aria-label="Open settings"
          onClick={() => setSettingsOpen((open) => !open)}
          className="grid h-10 w-10 place-items-center rounded-md border border-white/[0.12] bg-black/50 text-lg text-white backdrop-blur transition hover:bg-white/[0.12]"
        >
          ⚙
        </button>
      </div>

      <div className="fixed right-4 top-4 z-20 flex items-center gap-2">
        {isMobile ? (
          <button
            type="button"
            onClick={toggleFacingMode}
            className="h-10 rounded-md border border-white/[0.12] bg-black/50 px-3 text-xs font-bold text-white backdrop-blur transition hover:bg-white/[0.12]"
          >
            {facingMode === "user" ? "Use rear camera" : "Use front camera"}
          </button>
        ) : null}
        <button
          type="button"
          title="Toggle fullscreen"
          aria-label="Toggle fullscreen"
          onClick={triggerFullscreen}
          className="grid h-10 w-10 place-items-center rounded-md border border-white/[0.12] bg-black/50 text-sm font-black text-white backdrop-blur transition hover:bg-white/[0.12]"
        >
          {isFullscreen ? "□" : "⛶"}
        </button>
      </div>

      <aside
        className={`fixed left-0 top-0 z-[25] h-full w-80 max-w-[86vw] border-r border-white/10 bg-black/[0.76] px-5 pb-24 pt-20 backdrop-blur-xl transition-transform duration-300 ${
          settingsOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">Control</p>
          <h2 className="mt-2 text-2xl font-black text-white">Settings</h2>
        </div>

        <label className="block text-sm font-semibold text-slate-200">
          Effect intensity
          <span className="float-right text-cyan-200">{settings.intensity}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.intensity}
            onChange={(event) => updateSetting("intensity", Number(event.target.value))}
            className="slider-thumb mt-3 h-2 w-full appearance-none rounded-full bg-white/14 accent-cyan-300"
          />
        </label>

        <div className="mt-7 space-y-3">
          {[
            ["Skeleton", "skeleton"],
            ["Fluid mesh", "fluidMesh"],
            ["Background reaction", "background"]
          ].map(([label, key]) => (
            <label key={key} className="flex h-11 items-center justify-between rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-slate-200">
              {label}
              <input
                type="checkbox"
                checked={Boolean(settings[key as keyof Settings])}
                onChange={(event) => updateSetting(key as keyof Settings, event.target.checked as Settings[keyof Settings])}
                className="h-4 w-4 accent-cyan-300"
              />
            </label>
          ))}
        </div>

        <label className="mt-7 block text-sm font-semibold text-slate-200">
          Color theme
          <select
            value={settings.theme}
            onChange={(event) => updateSetting("theme", event.target.value as ColorTheme)}
            className="mt-3 h-11 w-full rounded-md border border-white/10 bg-zinc-950 px-3 text-white outline-none transition focus:border-cyan-300"
          >
            {Object.keys(THEMES).map((theme) => (
              <option key={theme} value={theme}>
                {theme}
              </option>
            ))}
          </select>
        </label>
      </aside>

      <InfoBar gestures={gestures.length > 0 ? gestures : hands.map(() => "UNKNOWN")} fps={fps} handCount={hands.length} />

      {!isActive || error ? <Overlay isLoading={isLoading} error={error} onStart={startExperience} /> : null}
    </main>
  );
}

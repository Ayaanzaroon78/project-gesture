"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import type { Hand, HandDetector, Keypoint } from "@tensorflow-models/hand-pose-detection";
import type { LandmarkLike } from "@/utils/gestures";

const DEV = process.env.NODE_ENV !== "production";
const SMOOTHING_ALPHA = 0.4;

export type CameraFacingMode = "user" | "environment";

export interface DetectedHand {
  keypoints: LandmarkLike[];
  handedness?: string;
  score?: number;
}

export interface HandDetectorState {
  hands: DetectedHand[];
  handsRef: MutableRefObject<DetectedHand[]>;
  isLoading: boolean;
  isActive: boolean;
  error: string | null;
  fps: number;
  facingMode: CameraFacingMode;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  startCamera: (nextFacingMode?: CameraFacingMode) => Promise<void>;
  stopCamera: () => void;
  setFacingMode: (nextFacingMode: CameraFacingMode) => void;
}

function normalizeKeypoints(keypoints: Keypoint[]): LandmarkLike[] {
  return keypoints.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z,
    name: point.name
  }));
}

function getScore(hand: Hand): number | undefined {
  const candidate = (hand as { score?: unknown }).score;
  return typeof candidate === "number" ? candidate : undefined;
}

function smoothKeypoints(previous: LandmarkLike[] | undefined, next: LandmarkLike[]): LandmarkLike[] {
  if (!previous || previous.length !== next.length) {
    return next;
  }

  return next.map((point, index) => {
    const previousPoint = previous[index];
    return {
      x: previousPoint.x * (1 - SMOOTHING_ALPHA) + point.x * SMOOTHING_ALPHA,
      y: previousPoint.y * (1 - SMOOTHING_ALPHA) + point.y * SMOOTHING_ALPHA,
      z:
        previousPoint.z !== undefined || point.z !== undefined
          ? (previousPoint.z ?? 0) * (1 - SMOOTHING_ALPHA) + (point.z ?? 0) * SMOOTHING_ALPHA
          : undefined,
      name: point.name ?? previousPoint.name
    };
  });
}

function toFriendlyCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera permission was blocked. Enable camera access in your browser, then try again.";
    }

    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "No compatible camera was found on this device.";
    }
  }

  return "Hand tracking could not start. Your browser may not support the required camera or ML features.";
}

export function useHandDetector(): HandDetectorState {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<HandDetector | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smoothedRef = useRef<LandmarkLike[][]>([]);
  const handsRef = useRef<DetectedHand[]>([]);
  const frameCounterRef = useRef({ frames: 0, lastTime: 0, lastStatePush: 0 });
  const isRunningRef = useRef(false);

  const [hands, setHands] = useState<DetectedHand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [facingMode, setFacingModeState] = useState<CameraFacingMode>("user");

  const stopCamera = useCallback(() => {
    isRunningRef.current = false;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    handsRef.current = [];
    smoothedRef.current = [];
    setHands([]);
    setIsActive(false);
  }, []);

  const runDetectionLoop = useCallback(() => {
    const detect = async (time: number) => {
      if (!isRunningRef.current || !detectorRef.current || !videoRef.current) {
        return;
      }

      const video = videoRef.current;

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          const estimatedHands = await detectorRef.current.estimateHands(video, {
            flipHorizontal: false
          });

          const normalizedHands = estimatedHands.slice(0, 2).map((hand: Hand, index) => {
            const normalized = normalizeKeypoints(hand.keypoints);
            const smoothed = smoothKeypoints(smoothedRef.current[index], normalized);
            smoothedRef.current[index] = smoothed;

            return {
              keypoints: smoothed,
              handedness: hand.handedness,
              score: getScore(hand)
            };
          });

          handsRef.current = normalizedHands;

          frameCounterRef.current.frames += 1;
          if (frameCounterRef.current.lastTime === 0) {
            frameCounterRef.current.lastTime = time;
          }

          if (time - frameCounterRef.current.lastTime >= 500) {
            const nextFps = Math.round((frameCounterRef.current.frames * 1000) / (time - frameCounterRef.current.lastTime));
            setFps(nextFps);
            frameCounterRef.current.frames = 0;
            frameCounterRef.current.lastTime = time;
          }

          if (time - frameCounterRef.current.lastStatePush >= 120) {
            setHands(normalizedHands);
            frameCounterRef.current.lastStatePush = time;
          }
        } catch (loopError) {
          if (DEV) {
            // eslint-disable-next-line no-console
            console.warn("Hand detection frame failed", loopError);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    };

    animationFrameRef.current = requestAnimationFrame(detect);
  }, []);

  const startCamera = useCallback(
    async (nextFacingMode?: CameraFacingMode) => {
      const requestedFacingMode = nextFacingMode ?? facingMode;
      setIsLoading(true);
      setError(null);
      stopCamera();
      setFacingModeState(requestedFacingMode);

      try {
        const [{ createDetector, SupportedModels }, tf] = await Promise.all([
          import("@tensorflow-models/hand-pose-detection"),
          import("@tensorflow/tfjs"),
          import("@tensorflow/tfjs-backend-webgl")
        ]).then(([handPoseDetection, tfModule]) => [handPoseDetection, tfModule] as const);

        await tf.setBackend("webgl");
        await tf.ready();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1280,
            height: 720,
            facingMode: requestedFacingMode
          },
          audio: false
        });

        streamRef.current = stream;

        if (!videoRef.current) {
          throw new Error("Video element is not mounted.");
        }

        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play();

        if (!detectorRef.current) {
          detectorRef.current = await createDetector(SupportedModels.MediaPipeHands, {
            runtime: "mediapipe",
            solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands",
            modelType: "full",
            maxHands: 2
          });
        }

        frameCounterRef.current = { frames: 0, lastTime: 0, lastStatePush: 0 };
        isRunningRef.current = true;
        setIsActive(true);
        runDetectionLoop();
      } catch (startError) {
        stopCamera();
        setError(toFriendlyCameraError(startError));
      } finally {
        setIsLoading(false);
      }
    },
    [facingMode, runDetectionLoop, stopCamera]
  );

  const setFacingMode = useCallback(
    (nextFacingMode: CameraFacingMode) => {
      setFacingModeState(nextFacingMode);
      if (isActive) {
        void startCamera(nextFacingMode);
      }
    },
    [isActive, startCamera]
  );

  useEffect(() => stopCamera, [stopCamera]);

  return {
    hands,
    handsRef,
    isLoading,
    isActive,
    error,
    fps,
    facingMode,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    setFacingMode
  };
}

export type GestureType =
  | "OPEN"
  | "FIST"
  | "POINT"
  | "PINCH"
  | "PEACE"
  | "THUMBS_UP"
  | "ROCK"
  | "OK"
  | "UNKNOWN";

export interface LandmarkLike {
  x: number;
  y: number;
  z?: number;
  name?: string;
}

export interface FingerState {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

const TIP_INDICES = [4, 8, 12, 16, 20] as const;
const MCP_INDICES = [2, 5, 9, 13, 17] as const;
const PIP_INDICES = [3, 6, 10, 14, 18] as const;

export function distance(a: LandmarkLike, b: LandmarkLike): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function getPalmCenter(landmarks: LandmarkLike[]): LandmarkLike {
  const indices = [0, 5, 9, 13, 17];
  const sum = indices.reduce(
    (accumulator, index) => {
      const point = landmarks[index];
      return {
        x: accumulator.x + point.x,
        y: accumulator.y + point.y,
        z: accumulator.z + (point.z ?? 0)
      };
    },
    { x: 0, y: 0, z: 0 }
  );

  return {
    x: sum.x / indices.length,
    y: sum.y / indices.length,
    z: sum.z / indices.length
  };
}

export function getPinchPoint(landmarks: LandmarkLike[]): LandmarkLike {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];

  return {
    x: (thumbTip.x + indexTip.x) * 0.5,
    y: (thumbTip.y + indexTip.y) * 0.5,
    z: ((thumbTip.z ?? 0) + (indexTip.z ?? 0)) * 0.5
  };
}

export function getFingerState(landmarks: LandmarkLike[]): FingerState {
  if (landmarks.length < 21) {
    return {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false
    };
  }

  const wrist = landmarks[0];
  const palmCenter = getPalmCenter(landmarks);
  const palmScale = Math.max(24, distance(wrist, landmarks[9]));
  const extendedByHeight = (tipIndex: number, mcpIndex: number, pipIndex: number) => {
    const tip = landmarks[tipIndex];
    const mcp = landmarks[mcpIndex];
    const pip = landmarks[pipIndex];
    const heightMargin = Math.max(7, palmScale * 0.08);
    const reachMargin = Math.max(8, palmScale * 0.1);

    return tip.y < mcp.y - heightMargin || distance(wrist, tip) > distance(wrist, pip) + reachMargin;
  };

  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbMcp = landmarks[2];
  const thumbAwayFromPalm = distance(thumbTip, palmCenter) > distance(thumbMcp, palmCenter) + palmScale * 0.18;
  const thumbReachesOut = distance(wrist, thumbTip) > distance(wrist, thumbIp) + palmScale * 0.08;

  return {
    thumb: thumbAwayFromPalm && thumbReachesOut,
    index: extendedByHeight(8, 5, 6),
    middle: extendedByHeight(12, 9, 10),
    ring: extendedByHeight(16, 13, 14),
    pinky: extendedByHeight(20, 17, 18)
  };
}

export function countExtendedFingers(state: FingerState): number {
  return Number(state.thumb) + Number(state.index) + Number(state.middle) + Number(state.ring) + Number(state.pinky);
}

export function areAllTipsAboveMcps(landmarks: LandmarkLike[]): boolean {
  return TIP_INDICES.every((tipIndex, order) => landmarks[tipIndex].y < landmarks[MCP_INDICES[order]].y);
}

export function areAllTipsCurledBelowPips(landmarks: LandmarkLike[]): boolean {
  return TIP_INDICES.every((tipIndex, order) => landmarks[tipIndex].y > landmarks[PIP_INDICES[order]].y);
}

export function classifyGesture(landmarks: LandmarkLike[]): GestureType {
  if (landmarks.length < 21) {
    return "UNKNOWN";
  }

  const state = getFingerState(landmarks);
  const extendedCount = countExtendedFingers(state);
  const pinchDistance = distance(landmarks[4], landmarks[8]);
  const palmScale = Math.max(24, distance(landmarks[0], landmarks[9]));
  const pinchThreshold = Math.max(26, Math.min(48, palmScale * 0.55));
  const isPinch = pinchDistance < pinchThreshold || pinchDistance < 40;
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];

  if (isPinch && state.middle && state.ring && state.pinky) {
    return "OK";
  }

  if (isPinch) {
    return "PINCH";
  }

  if (areAllTipsAboveMcps(landmarks) || extendedCount === 5) {
    return "OPEN";
  }

  if (areAllTipsCurledBelowPips(landmarks) || extendedCount === 0) {
    return "FIST";
  }

  if (state.thumb && !state.index && !state.middle && !state.ring && !state.pinky && wrist.y > thumbTip.y) {
    return "THUMBS_UP";
  }

  if (!state.thumb && state.index && !state.middle && !state.ring && !state.pinky) {
    return "POINT";
  }

  if (!state.thumb && state.index && state.middle && !state.ring && !state.pinky) {
    return "PEACE";
  }

  if (!state.middle && !state.ring && state.index && state.pinky) {
    return "ROCK";
  }

  return "UNKNOWN";
}

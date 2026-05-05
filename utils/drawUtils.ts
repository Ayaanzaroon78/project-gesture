import { THEMES, colorWithAlpha, getDynamicHue, getGestureHue, type ColorTheme, type ThemePalette } from "./colors";
import { getPalmCenter, getPinchPoint, type GestureType, type LandmarkLike } from "./gestures";

export type RenderContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export { getPinchPoint };

export interface ProjectedLandmark extends LandmarkLike {
  sourceX: number;
  sourceY: number;
}

export interface VisualHand {
  landmarks: ProjectedLandmark[];
  gesture: GestureType;
  handedness?: string;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

export interface Ripple {
  active: boolean;
  x: number;
  y: number;
  startTime: number;
}

export interface Shockwave {
  active: boolean;
  x: number;
  y: number;
  startTime: number;
}

export interface ConfettiPiece {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface FluidPoint {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  column: number;
  row: number;
}

export interface VideoFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface DrawSceneOptions {
  width: number;
  height: number;
  time: number;
  theme: ColorTheme;
  intensity: number;
  showSkeleton: boolean;
  showFluidMesh: boolean;
  showBackground: boolean;
  flashOpacity: number;
}

const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17]
];

const FINGERTIP_INDICES = new Set([4, 8, 12, 16, 20]);
const CONFETTI_COLORS = ["#06B6D4", "#EC4899", "#8B5CF6", "#FCD34D", "#22C55E", "#F97316"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value: number): number {
  const inverted = 1 - value;
  return 1 - inverted * inverted * inverted;
}

function distance(a: LandmarkLike, b: LandmarkLike): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext("2d", {
    alpha: true,
    desynchronized: true
  });
}

export function fitCanvasToViewport(canvas: HTMLCanvasElement, width: number, height: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.floor(width * dpr);
  const targetHeight = Math.floor(height * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function getVideoFrame(canvasWidth: number, canvasHeight: number, videoWidth: number, videoHeight: number): VideoFrame {
  if (videoWidth <= 0 || videoHeight <= 0) {
    return { x: 0, y: 0, width: canvasWidth, height: canvasHeight, scale: 1 };
  }

  const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;

  return {
    x: (canvasWidth - width) * 0.5,
    y: (canvasHeight - height) * 0.5,
    width,
    height,
    scale
  };
}

export function projectLandmarks(
  landmarks: LandmarkLike[],
  frame: VideoFrame,
  canvasWidth: number,
  mirrored = true
): ProjectedLandmark[] {
  return landmarks.map((point) => {
    const projectedX = frame.x + point.x * frame.scale;
    const projectedY = frame.y + point.y * frame.scale;

    return {
      x: mirrored ? canvasWidth - projectedX : projectedX,
      y: projectedY,
      z: point.z,
      name: point.name,
      sourceX: point.x,
      sourceY: point.y
    };
  });
}

export function drawVideoLayer(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  blurAmount: number
): void {
  const frame = getVideoFrame(width, height, video.videoWidth, video.videoHeight);
  context.save();
  context.clearRect(0, 0, width, height);
  context.globalAlpha = 0.2;
  context.filter = `blur(${blurAmount}px) saturate(1.25) brightness(0.65)`;
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(video, frame.x, frame.y, frame.width, frame.height);
  context.restore();
}

export function drawReactiveBackground(
  context: CanvasRenderingContext2D,
  hands: VisualHand[],
  options: DrawSceneOptions
): void {
  context.save();
  context.globalCompositeOperation = "source-over";
  context.fillStyle = "#000";
  context.fillRect(0, 0, options.width, options.height);

  if (options.showBackground) {
    hands.forEach((hand, index) => {
      if (hand.landmarks.length < 21) {
        return;
      }

      const palm = getPalmCenter(hand.landmarks);
      const gestureHue = getGestureHue(hand.gesture, options.time * 0.012);
      const hue = getDynamicHue(gestureHue, options.theme, index);
      const radius = Math.max(options.width, options.height) * 0.45;
      const gradient = context.createRadialGradient(palm.x, palm.y, 0, palm.x, palm.y, radius);
      gradient.addColorStop(0, `hsla(${hue}, 54%, 12%, 0.82)`);
      gradient.addColorStop(0.35, `hsla(${hue}, 38%, 8%, 0.34)`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, options.width, options.height);
    });
  }

  context.restore();
}

export function createFluidMesh(width: number, height: number, columns = 20, rows = 14): FluidPoint[] {
  const points: FluidPoint[] = [];
  const marginX = width / (columns + 1);
  const marginY = height / (rows + 1);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = marginX * (column + 1);
      const y = marginY * (row + 1);
      points.push({
        homeX: x,
        homeY: y,
        x,
        y,
        vx: 0,
        vy: 0,
        column,
        row
      });
    }
  }

  return points;
}

export function updateFluidMesh(points: FluidPoint[], landmarks: LandmarkLike[]): void {
  const radius = 120;
  const radiusSquared = radius * radius;

  points.forEach((point) => {
    let targetX = point.homeX;
    let targetY = point.homeY;

    landmarks.forEach((landmark) => {
      const dx = point.homeX - landmark.x;
      const dy = point.homeY - landmark.y;
      const distSquared = dx * dx + dy * dy;

      if (distSquared > 0.01 && distSquared < radiusSquared) {
        const dist = Math.sqrt(distSquared);
        const strength = clamp((radiusSquared / distSquared) * 2.4, 0, 60);
        targetX += (dx / dist) * strength;
        targetY += (dy / dist) * strength;
      }
    });

    const displacementX = clamp(targetX - point.homeX, -60, 60);
    const displacementY = clamp(targetY - point.homeY, -60, 60);
    point.vx += (point.homeX + displacementX - point.x) * 0.08;
    point.vy += (point.homeY + displacementY - point.y) * 0.08;
    point.vx *= 0.85;
    point.vy *= 0.85;
    point.x += point.vx;
    point.y += point.vy;
  });
}

export function drawFluidMesh(context: CanvasRenderingContext2D, points: FluidPoint[], columns = 20): void {
  context.save();
  context.globalCompositeOperation = "screen";
  context.lineWidth = 0.5;
  context.strokeStyle = "rgba(148, 163, 184, 0.15)";
  context.fillStyle = "rgba(226, 232, 240, 0.24)";

  points.forEach((point, index) => {
    const right = point.column < columns - 1 ? points[index + 1] : undefined;
    const down = points[index + columns];

    if (right) {
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(right.x, right.y);
      context.stroke();
    }

    if (down) {
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(down.x, down.y);
      context.stroke();
    }

    context.beginPath();
    context.arc(point.x, point.y, 1.3, 0, Math.PI * 2);
    context.fill();
  });

  context.restore();
}

export function drawSkeleton(context: CanvasRenderingContext2D, landmarks: LandmarkLike[], time: number, palette: ThemePalette): void {
  if (landmarks.length < 21) {
    return;
  }

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  context.lineJoin = "round";

  HAND_CONNECTIONS.forEach(([fromIndex, toIndex]) => {
    const from = landmarks[fromIndex];
    const to = landmarks[toIndex];
    const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y);
    gradient.addColorStop(0, colorWithAlpha(palette.secondary, 0.6));
    gradient.addColorStop(1, colorWithAlpha(palette.primary, 0.6));
    context.strokeStyle = gradient;
    context.lineWidth = 2;
    context.shadowColor = palette.primary;
    context.shadowBlur = 8;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  });

  landmarks.forEach((point, index) => {
    const isTip = FINGERTIP_INDICES.has(index);
    const pulse = isTip ? 1 + Math.sin((time / 1500) * Math.PI * 2) * 0.2 + 0.2 : 1;
    const radius = (isTip ? 10 : 6) * pulse;
    const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.4);
    gradient.addColorStop(0, index === 0 ? palette.secondary : palette.primary);
    gradient.addColorStop(1, "rgba(6, 182, 212, 0)");
    context.fillStyle = gradient;
    context.shadowColor = index === 0 ? palette.secondary : palette.primary;
    context.shadowBlur = isTip ? 18 : 10;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
  });

  context.restore();
}

export function drawParticles(context: RenderContext, particles: readonly Particle[]): void {
  context.save();
  context.globalCompositeOperation = "screen";

  particles.forEach((particle) => {
    if (!particle.active) {
      return;
    }

    const normalizedLife = clamp(particle.life / particle.maxLife, 0, 1);
    const alpha = 1 - easeOutCubic(normalizedLife);
    const size = Math.max(0.1, particle.size * (1 - normalizedLife));
    context.fillStyle = `hsla(${particle.hue}, 80%, 60%, ${alpha})`;
    context.shadowColor = `hsl(${particle.hue}, 80%, 60%)`;
    context.shadowBlur = size * 5;
    context.beginPath();
    context.arc(particle.x, particle.y, size, 0, Math.PI * 2);
    context.fill();
  });

  context.restore();
}

export function drawParticleLayer(
  targetContext: CanvasRenderingContext2D,
  particles: readonly Particle[],
  width: number,
  height: number,
  offscreen?: OffscreenCanvas | null
): void {
  if (offscreen) {
    if (offscreen.width !== width || offscreen.height !== height) {
      offscreen.width = width;
      offscreen.height = height;
    }

    const offscreenContext = offscreen.getContext("2d");
    if (offscreenContext) {
      offscreenContext.clearRect(0, 0, width, height);
      drawParticles(offscreenContext, particles);
      targetContext.drawImage(offscreen, 0, 0, width, height);
      return;
    }
  }

  drawParticles(targetContext, particles);
}

export function drawRipples(context: CanvasRenderingContext2D, ripples: readonly Ripple[], time: number, intensity: number): void {
  context.save();
  context.globalCompositeOperation = "screen";

  ripples.forEach((ripple) => {
    if (!ripple.active) {
      return;
    }

    const progress = clamp((time - ripple.startTime) / 800, 0, 1);
    const radius = easeOutCubic(progress) * 200 * intensity;
    const alpha = 1 - progress;
    context.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    context.lineWidth = 3 - 2.5 * progress;
    context.shadowColor = "#FFFFFF";
    context.shadowBlur = 24 * alpha;
    context.beginPath();
    context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    context.stroke();
  });

  context.restore();
}

export function drawFistEffect(
  context: CanvasRenderingContext2D,
  shockwaves: readonly Shockwave[],
  time: number,
  flashOpacity: number,
  width: number,
  height: number
): void {
  context.save();
  context.globalCompositeOperation = "screen";

  if (flashOpacity > 0) {
    context.fillStyle = `rgba(255, 255, 255, ${Math.min(0.3, flashOpacity)})`;
    context.fillRect(0, 0, width, height);
  }

  shockwaves.forEach((shockwave) => {
    if (!shockwave.active) {
      return;
    }

    const progress = clamp((time - shockwave.startTime) / 650, 0, 1);
    const radius = easeOutCubic(progress) * 260;
    const alpha = 1 - progress;
    context.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.75})`;
    context.lineWidth = 8 * (1 - progress) + 1;
    context.shadowColor = "#FFFFFF";
    context.shadowBlur = 36 * alpha;
    context.beginPath();
    context.arc(shockwave.x, shockwave.y, radius, 0, Math.PI * 2);
    context.stroke();
  });

  context.restore();
}

export function drawOpenBloom(context: CanvasRenderingContext2D, landmarks: LandmarkLike[], time: number, palette: ThemePalette): void {
  if (landmarks.length < 21) {
    return;
  }

  const palm = getPalmCenter(landmarks);
  const rotation = time * 0.0007;
  context.save();
  context.globalCompositeOperation = "screen";
  context.lineWidth = 2;
  context.shadowColor = palette.primary;
  context.shadowBlur = 18;

  for (let i = 0; i < 20; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / 20;
    const inner = 18 + Math.sin(time * 0.002 + i) * 4;
    const outer = inner + 60;
    const alpha = 0.35 + 0.2 * Math.sin(time * 0.003 + i);
    context.strokeStyle = colorWithAlpha(i % 2 === 0 ? palette.primary : palette.accent, alpha);
    context.beginPath();
    context.moveTo(palm.x + Math.cos(angle) * inner, palm.y + Math.sin(angle) * inner);
    context.lineTo(palm.x + Math.cos(angle) * outer, palm.y + Math.sin(angle) * outer);
    context.stroke();
  }

  context.restore();
}

export function drawPointLaser(context: CanvasRenderingContext2D, landmarks: LandmarkLike[], palette: ThemePalette): void {
  if (landmarks.length < 9) {
    return;
  }

  const tip = landmarks[8];
  const pip = landmarks[6];
  const dx = tip.x - pip.x;
  const dy = tip.y - pip.y;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const endX = tip.x + (dx / length) * 400;
  const endY = tip.y + (dy / length) * 400;

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  context.shadowBlur = 20;
  context.shadowColor = palette.primary;
  context.strokeStyle = palette.primary;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(tip.x, tip.y);
  context.lineTo(endX, endY);
  context.stroke();
  context.strokeStyle = "rgba(255, 255, 255, 0.85)";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(tip.x, tip.y);
  context.lineTo(endX, endY);
  context.stroke();
  context.restore();
}

export function drawPeaceTrails(context: CanvasRenderingContext2D, landmarks: LandmarkLike[], time: number): void {
  if (landmarks.length < 13) {
    return;
  }

  const tips = [
    { point: landmarks[8], color: "#EC4899" },
    { point: landmarks[12], color: "#8B5CF6" }
  ];

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";

  tips.forEach(({ point, color }, index) => {
    context.strokeStyle = colorWithAlpha(color, 0.72);
    context.shadowColor = color;
    context.shadowBlur = 24;
    context.lineWidth = 4;
    context.beginPath();
    for (let i = 0; i < 12; i += 1) {
      const angle = time * 0.008 + i * 0.65 + index;
      const radius = i * 6;
      const x = point.x - Math.cos(angle) * radius;
      const y = point.y - Math.sin(angle) * radius;
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();
  });

  context.restore();
}

export function drawConfetti(context: CanvasRenderingContext2D, confetti: readonly ConfettiPiece[]): void {
  context.save();
  context.globalCompositeOperation = "screen";

  confetti.forEach((piece) => {
    if (!piece.active) {
      return;
    }

    const progress = clamp(piece.life / piece.maxLife, 0, 1);
    context.save();
    context.globalAlpha = 1 - progress;
    context.fillStyle = piece.color;
    context.translate(piece.x, piece.y);
    context.rotate(piece.rotation);
    context.fillRect(-4, -2, 8, 4);
    context.restore();
  });

  context.restore();
}

export function drawRockLightning(context: CanvasRenderingContext2D, landmarks: LandmarkLike[], time: number): void {
  if (landmarks.length < 21) {
    return;
  }

  const start = landmarks[8];
  const end = landmarks[20];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const normalX = -dy / length;
  const normalY = dx / length;

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = "#FCD34D";
  context.shadowBlur = 26;
  context.strokeStyle = "#FCD34D";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(start.x, start.y);

  for (let i = 1; i < 8; i += 1) {
    const progress = i / 8;
    const jitter = Math.sin(time * 0.04 + i * 17.31) * 18 + Math.cos(time * 0.031 + i * 9.8) * 12;
    context.lineTo(start.x + dx * progress + normalX * jitter, start.y + dy * progress + normalY * jitter);
  }

  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
}

export function drawOkOrbit(context: CanvasRenderingContext2D, landmarks: LandmarkLike[], time: number, palette: ThemePalette): void {
  if (landmarks.length < 9) {
    return;
  }

  const center = getPinchPoint(landmarks);
  const radius = 32 + Math.sin(time * 0.003) * 4;
  const rotation = time * 0.003 * (Math.PI / 180) * 60;

  context.save();
  context.globalCompositeOperation = "screen";
  context.shadowColor = palette.accent;
  context.shadowBlur = 20;

  for (let i = 0; i < 12; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / 12;
    context.fillStyle = i % 2 === 0 ? palette.accent : palette.primary;
    context.beginPath();
    context.arc(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, 4, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

export function spawnConfetti(confetti: ConfettiPiece[], x: number, y: number): void {
  for (let i = 0; i < 40; i += 1) {
    const piece = confetti.find((candidate) => !candidate.active);
    if (!piece) {
      return;
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    piece.active = true;
    piece.x = x;
    piece.y = y;
    piece.vx = Math.cos(angle) * speed;
    piece.vy = Math.sin(angle) * speed - 3;
    piece.rotation = Math.random() * Math.PI;
    piece.spin = (Math.random() - 0.5) * 0.35;
    piece.life = 0;
    piece.maxLife = 80 + Math.random() * 40;
    piece.color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
  }
}

export function updateConfetti(confetti: ConfettiPiece[]): void {
  confetti.forEach((piece) => {
    if (!piece.active) {
      return;
    }

    piece.life += 1;
    piece.vy += 0.12;
    piece.vx *= 0.99;
    piece.vy *= 0.99;
    piece.x += piece.vx;
    piece.y += piece.vy;
    piece.rotation += piece.spin;

    if (piece.life >= piece.maxLife) {
      piece.active = false;
    }
  });
}

export function createConfettiPool(size = 160): ConfettiPiece[] {
  return Array.from({ length: size }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotation: 0,
    spin: 0,
    life: 0,
    maxLife: 100,
    color: "#FFFFFF"
  }));
}

export function drawGestureEffects(
  context: CanvasRenderingContext2D,
  hands: VisualHand[],
  options: DrawSceneOptions,
  shockwaves: readonly Shockwave[],
  confetti: readonly ConfettiPiece[]
): void {
  const palette = THEMES[options.theme];

  drawFistEffect(context, shockwaves, options.time, options.flashOpacity, options.width, options.height);

  hands.forEach((hand) => {
    switch (hand.gesture) {
      case "OPEN":
        drawOpenBloom(context, hand.landmarks, options.time, palette);
        break;
      case "POINT":
        drawPointLaser(context, hand.landmarks, palette);
        break;
      case "PEACE":
        drawPeaceTrails(context, hand.landmarks, options.time);
        break;
      case "ROCK":
        drawRockLightning(context, hand.landmarks, options.time);
        break;
      case "OK":
        drawOkOrbit(context, hand.landmarks, options.time, palette);
        break;
      default:
        break;
    }
  });

  drawConfetti(context, confetti);
}

export function getFingertips(landmarks: LandmarkLike[]): LandmarkLike[] {
  return [4, 8, 12, 16, 20].map((index) => landmarks[index]).filter(Boolean);
}

export function getThumbTip(landmarks: LandmarkLike[]): LandmarkLike | null {
  return landmarks[4] ?? null;
}

export function getWrist(landmarks: LandmarkLike[]): LandmarkLike | null {
  return landmarks[0] ?? null;
}

export function shouldSpawnRipple(previous: GestureType | undefined, next: GestureType): boolean {
  return previous !== "PINCH" && next === "PINCH";
}

export function shouldSpawnShockwave(previous: GestureType | undefined, next: GestureType): boolean {
  return previous !== "FIST" && next === "FIST";
}

export function shouldSpawnConfetti(previous: GestureType | undefined, next: GestureType): boolean {
  return previous !== "THUMBS_UP" && next === "THUMBS_UP";
}

export function distanceBetween(a: LandmarkLike, b: LandmarkLike): number {
  return distance(a, b);
}

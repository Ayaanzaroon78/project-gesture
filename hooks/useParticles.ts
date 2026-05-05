"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { THEMES, type ColorTheme } from "@/utils/colors";
import {
  drawParticleLayer,
  getFingertips,
  type Particle,
  type ProjectedLandmark,
  type VisualHand
} from "@/utils/drawUtils";

const MAX_PARTICLES = 3000;

interface PreviousPoint {
  x: number;
  y: number;
}

export interface ParticleEngine {
  particles: Particle[];
  emitFromHands: (hands: VisualHand[], intensity: number, theme: ColorTheme, time: number) => void;
  updateParticles: () => void;
  drawParticles: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  resetParticles: () => void;
}

function createParticlePool(): Particle[] {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 70,
    size: 2,
    hue: 188
  }));
}

export function useParticles(): ParticleEngine {
  const particles = useMemo(createParticlePool, []);
  const cursorRef = useRef(0);
  const previousTipsRef = useRef<Map<string, PreviousPoint>>(new Map());
  const offscreenRef = useRef<OffscreenCanvas | null>(null);

  useEffect(() => {
    if ("OffscreenCanvas" in window) {
      offscreenRef.current = new OffscreenCanvas(1, 1);
    }
  }, []);

  const getWritableParticle = useCallback((): Particle => {
    const startCursor = cursorRef.current;

    for (let offset = 0; offset < particles.length; offset += 1) {
      const index = (startCursor + offset) % particles.length;
      if (!particles[index].active) {
        cursorRef.current = (index + 1) % particles.length;
        return particles[index];
      }
    }

    let oldestIndex = 0;
    let oldestRatio = -1;
    particles.forEach((particle, index) => {
      const ratio = particle.life / particle.maxLife;
      if (ratio > oldestRatio) {
        oldestRatio = ratio;
        oldestIndex = index;
      }
    });

    cursorRef.current = (oldestIndex + 1) % particles.length;
    return particles[oldestIndex];
  }, [particles]);

  const emitParticle = useCallback(
    (point: ProjectedLandmark, velocityX: number, velocityY: number, hue: number, intensity: number) => {
      const particle = getWritableParticle();
      const speed = Math.min(18, Math.sqrt(velocityX * velocityX + velocityY * velocityY));
      const angle = Math.random() * Math.PI * 2;
      const magnitude = 0.45 + Math.random() * (1.4 + speed * 0.16 * Math.max(0.2, intensity));

      particle.active = true;
      particle.x = point.x;
      particle.y = point.y;
      particle.vx = Math.cos(angle) * magnitude + velocityX * 0.08;
      particle.vy = Math.sin(angle) * magnitude + velocityY * 0.08;
      particle.life = 0;
      particle.maxLife = 46 + Math.random() * 34;
      particle.size = 2 + Math.random() * 1.8;
      particle.hue = hue;
    },
    [getWritableParticle]
  );

  const emitFromHands = useCallback(
    (hands: VisualHand[], intensity: number, theme: ColorTheme, time: number) => {
      if (intensity <= 0) {
        return;
      }

      const palette = THEMES[theme];
      const baseHue = palette.monochrome ? 0 : (palette.hues[0] + time * 0.06) % 360;
      const particlesPerTip = Math.round(8 * intensity);

      hands.forEach((hand, handIndex) => {
        getFingertips(hand.landmarks).forEach((tip, tipIndex) => {
          const point = tip as ProjectedLandmark;
          const key = `${handIndex}:${tipIndex}`;
          const previous = previousTipsRef.current.get(key);
          const velocityX = previous ? point.x - previous.x : 0;
          const velocityY = previous ? point.y - previous.y : 0;
          const hue = palette.monochrome ? 0 : (baseHue + handIndex * 180 + tipIndex * 12) % 360;

          for (let i = 0; i < particlesPerTip; i += 1) {
            emitParticle(point, velocityX, velocityY, hue, intensity);
          }

          previousTipsRef.current.set(key, { x: point.x, y: point.y });
        });
      });
    },
    [emitParticle]
  );

  const updateParticles = useCallback(() => {
    particles.forEach((particle) => {
      if (!particle.active) {
        return;
      }

      particle.life += 1;
      particle.vy += 0.05;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.hue = (particle.hue + 1) % 360;

      if (particle.life >= particle.maxLife) {
        particle.active = false;
      }
    });
  }, [particles]);

  const drawParticles = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      drawParticleLayer(context, particles, width, height, offscreenRef.current);
    },
    [particles]
  );

  const resetParticles = useCallback(() => {
    particles.forEach((particle) => {
      particle.active = false;
    });
    previousTipsRef.current.clear();
  }, [particles]);

  return {
    particles,
    emitFromHands,
    updateParticles,
    drawParticles,
    resetParticles
  };
}

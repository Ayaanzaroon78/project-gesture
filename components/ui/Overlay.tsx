"use client";

interface OverlayProps {
  isLoading: boolean;
  error: string | null;
  onStart: () => void;
}

export default function Overlay({ isLoading, error, onStart }: OverlayProps) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/[0.82] px-5 backdrop-blur-xl">
      <div className="w-full max-w-md rounded-lg border border-white/[0.12] bg-zinc-950/[0.78] p-8 text-center shadow-glow">
        <div className="mx-auto mb-7 grid h-20 w-20 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-4xl text-cyan-100 handscape-float">
          ◇
        </div>
        <h1 className="handscape-shimmer bg-gradient-to-r from-white via-cyan-200 to-fuchsia-200 bg-clip-text text-5xl font-black tracking-normal text-transparent">
          HandScape
        </h1>
        <p className="mt-3 text-base text-slate-300">Move your hands to begin</p>

        {error ? (
          <p className="mt-6 rounded-md border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onStart}
          disabled={isLoading}
          className="mt-7 inline-flex h-12 min-w-44 items-center justify-center rounded-md bg-white px-6 text-sm font-bold text-black transition hover:bg-cyan-100 disabled:cursor-wait disabled:bg-white/60"
        >
          {isLoading ? "Starting..." : error ? "Retry Camera" : "Enable Camera"}
        </button>
      </div>
    </div>
  );
}

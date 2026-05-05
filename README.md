# HandScape

HandScape is a real-time hand-tracking generative art experience built with Next.js, TensorFlow.js, MediaPipe Hands, and layered canvas rendering.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/handscape)

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, enable camera access, and move one or both hands in view.

## Tech Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- TensorFlow.js
- `@tensorflow-models/hand-pose-detection`
- MediaPipe Hands runtime
- Custom canvas particle system with object pooling

## Gesture Effects

- `OPEN`: rotating palm bloom
- `FIST`: flash and shockwave
- `POINT`: fingertip laser
- `PINCH`: expanding ripple
- `PEACE`: twin color trails
- `THUMBS_UP`: confetti burst
- `ROCK`: lightning arc
- `OK`: orbiting pinch ring

## Screenshot

Add production screenshots here after deploying or running the app locally.

## Deployment

The project includes `vercel.json`:

```json
{
  "framework": "nextjs"
}
```

Deploying to Vercel works with the default Next.js preset.

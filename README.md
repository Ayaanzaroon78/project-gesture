# 🖐️ HandScape

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/TensorFlow.js-4.x-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/Deployed_on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />
</p>

<p align="center">
  <b>HandScape</b> is a real-time, browser-based generative art experience powered by hand-tracking.<br/>
  Move your hands in front of your webcam — every gesture triggers a unique visual effect on the canvas.
</p>


---

## 📸 Preview

<img width="1910" height="903" alt="image" src="https://github.com/user-attachments/assets/04596895-9c33-47ca-ab61-28c24fd2f53e" />



| Gesture | Effect |
|--------|--------|
| ✋ Open Palm | Rotating bloom of particles |
| ✊ Fist | Flash burst + shockwave ring |
| ☝️ Point | Fingertip laser beam |
| 🤏 Pinch | Expanding ripple wave |
| ✌️ Peace | Twin-color trailing streaks |
| 👍 Thumbs Up | Confetti explosion |
| 🤘 Rock | Electric lightning arc |
| 👌 OK | Orbiting ring at pinch point |

---

## ✨ Features

- **Zero-install hand tracking** — runs entirely in the browser using TensorFlow.js + MediaPipe Hands
- **8 distinct gesture effects** — each gesture maps to a unique real-time canvas animation
- **Dual-hand support** — detect and render effects for one or both hands simultaneously
- **Object-pooled particle system** — high-performance canvas rendering with memory-efficient pooling
- **Responsive layout** — works across desktop and laptop screens with webcam access
- **Vercel-ready deployment** — ships with a `vercel.json` for zero-config deployments

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| ML / Hand Tracking | [TensorFlow.js](https://www.tensorflow.org/js) |
| Hand Pose Model | [`@tensorflow-models/hand-pose-detection`](https://github.com/tensorflow/tfjs-models/tree/master/hand-pose-detection) |
| MediaPipe Runtime | [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands) |
| Canvas Rendering | Custom particle engine with object pooling |
| Deployment | [Vercel](https://vercel.com/) |

---

## 📁 Project Structure

```
project-gesture/
├── app/                    # Next.js 14 App Router (pages & layouts)
│   └── page.tsx            # Root page — mounts the HandScape canvas
├── components/             # Reusable React components
│   └── HandCanvas.tsx      # Main canvas + webcam + TF.js integration
├── hooks/                  # Custom React hooks
│   └── useHandTracking.ts  # TF.js model loading & frame-by-frame detection
├── utils/                  # Pure utility functions
│   └── gestureEffects.ts   # Per-gesture canvas drawing logic
│   └── particlePool.ts     # Object-pool implementation for particles
├── public/                 # Static assets
├── .eslintrc.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9+ (comes with Node.js)
- A device with a **webcam**
- A modern browser (Chrome or Edge recommended for best MediaPipe support)

### 1. Clone the Repository

```bash
git clone https://github.com/Ayaanzaroon78/project-gesture.git
cd project-gesture
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Camera Prompt:** When the page loads, your browser will ask for camera access — click **Allow**. Move one or both hands into the webcam frame to start generating art.

---

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the local development server at `localhost:3000` |
| `npm run build` | Compile and bundle the app for production |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint across the project |

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)

This project ships with a `vercel.json` pre-configured for Next.js:

```json
{
  "framework": "nextjs"
}
```

**Option 1 — One-click deploy:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Ayaanzaroon78/project-gesture)

**Option 2 — CLI deploy:**

```bash
npm install -g vercel
vercel login
vercel --prod --yes
```

> Vercel automatically detects the Next.js framework and applies the correct build settings. No extra configuration is needed.

---

## 🎮 How Gesture Detection Works

1. **Model Loading** — On page load, `useHandTracking.ts` initialises the MediaPipe Hands runtime backed by TensorFlow.js and downloads the model weights.
2. **Frame Loop** — A `requestAnimationFrame` loop continuously captures frames from the `<video>` element.
3. **Keypoint Extraction** — The model returns 21 3D keypoints per hand per frame (wrist, knuckles, fingertips).
4. **Gesture Classification** — `gestureEffects.ts` classifies the keypoint geometry into one of 8 gestures using angle and distance heuristics.
5. **Canvas Rendering** — The matched gesture triggers its corresponding particle/canvas routine, drawn on a layered `<canvas>` element rendered behind the live video feed.

---

## 🖌️ Gesture Effects Reference

| Gesture | Trigger Condition | Visual Effect |
|---------|------------------|---------------|
| `OPEN` | All 5 fingers extended | Rotating palm bloom of radial lines |
| `FIST` | All fingers curled | Flash white + expanding shockwave ring |
| `POINT` | Only index extended | Laser beam from fingertip |
| `PINCH` | Thumb + index < threshold | Expanding ripple wave at pinch point |
| `PEACE` | Index + middle extended | Twin-color particle trails per fingertip |
| `THUMBS_UP` | Thumb up, others curled | Multi-color confetti burst |
| `ROCK` | Index + pinky extended | Electric lightning arc between tips |
| `OK` | Pinch + ring orbiting | Orbiting particle ring at pinch center |

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-new-gesture`
3. Commit your changes: `git commit -m "feat: add new gesture effect"`
4. Push to your branch: `git push origin feature/my-new-gesture`
5. Open a Pull Request

Please make sure your code passes `npm run lint` before submitting.

---

## 👤 Author

**Ayaan**
- GitHub: [@Ayaanzaroon78](https://github.com/Ayaanzaroon78)
- Built as part of an ongoing portfolio in AI, web development, and creative computing.

---

<p align="center">Made with ❤️ and a webcam</p>

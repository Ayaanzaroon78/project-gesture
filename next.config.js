/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tensorflow/tfjs", "@tensorflow-models/hand-pose-detection"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin"
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), fullscreen=(self)"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;

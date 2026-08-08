import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages resolve their native binary / platform-specific submodule via a runtime
  // `require()` that Turbopack can't statically analyze — opt them out of bundling so Node's
  // own require handles it, same fix used for other native-binary deps like `sharp`/`canvas`.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "fluent-ffmpeg"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "googleapis",
    "google-auth-library",
    "@sinclair/typebox",
    "express",
    "open",
    "mime-types",
    "youtube-transcript",
  ],
};

export default nextConfig;

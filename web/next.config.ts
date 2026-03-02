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
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Leave ../../dist/ imports as runtime Node.js requires
      // Only match our project's dist/ path, not internal webpack/react modules
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push(({ request }: { request: string }, callback: (err: null, result?: string) => void) => {
          if (request.startsWith("../../dist/")) {
            return callback(null, `commonjs ${request}`);
          }
          callback(null);
        });
      }
    }
    return config;
  },
};

export default nextConfig;

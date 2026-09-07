/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: { instrumentationHook: true },
  webpack: (config, { isServer, nextRuntime }) => {
    // The instrumentation hook is also compiled for the edge runtime, where the
    // scheduler's node builtins cannot resolve. The runtime guard in
    // instrumentation.ts ensures they never execute there — stub them for that pass only.
    if (isServer && nextRuntime === "edge") {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        os: false,
        path: false,
        "dns/promises": false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

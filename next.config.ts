import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Developed photographs come back as signed URLs from Supabase Storage.
      // They are rendered with `unoptimized` because each URL is short-lived,
      // so there is nothing stable for the optimizer to cache.
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a second server (e.g. an automated test run) use its own build folder,
  // so two `next` processes never corrupt each other's .next directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;

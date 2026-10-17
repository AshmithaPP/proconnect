import fs from 'fs';

// Routes live in src/app. If a root-level app/ (or pages/) folder exists, Next.js silently
// uses it INSTEAD of src/app — usually an editor tab saving a file at its old path.
for (const stray of ['app', 'pages']) {
  if (fs.existsSync(stray)) {
    throw new Error(
      `Found a root-level "${stray}/" folder. Routes belong in "src/app". ` +
        `It was probably re-created by an editor tab still open on an old file path — ` +
        `close that tab and delete "${stray}/".`
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['connect-sdk-nodejs'],
  // Lets a second server (e.g. an automated test run) use its own build folder,
  // so two `next` processes never corrupt each other's .next directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;

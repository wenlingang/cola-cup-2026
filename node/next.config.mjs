/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serve /_next/static/* from a CDN (Cloudflare Pages) when ASSET_PREFIX is set.
  // Must be present at BUILD time so hashed asset URLs are rewritten.
  assetPrefix: process.env.ASSET_PREFIX || undefined,
  serverExternalPackages: ["better-sqlite3"],
  // Dev-only: allow the Tailscale Funnel host to load /_next/* dev resources
  // (HMR, chunks, fonts). Without this, cross-origin access is blocked and the
  // client never hydrates → buttons appear "frozen". No effect in production.
  allowedDevOrigins: ["macbook.tailc348df.ts.net"],
};

export default nextConfig;

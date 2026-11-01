/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Type errors fail the build on purpose; run `npm run typecheck` to see them.
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ['pg', '@node-rs/argon2', 'sharp'],
  experimental: {
    serverActions: { bodySizeLimit: '1mb' },
  },
  async headers() {
    // Content-Security-Policy is set per request in middleware.ts because it carries a nonce.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ];
  },
};

export default nextConfig;

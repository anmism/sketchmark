/** @type {import('next').NextConfig} */
const nextConfig = {
  // sketchmark + rough.js both access `document` and `window` —
  // they must never be server-rendered or pre-bundled by Next.js
  transpilePackages: ['sketchmark', 'roughjs'],
};

module.exports = nextConfig;

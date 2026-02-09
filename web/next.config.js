/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Production deploy serves a fully static build via nginx (see DEPLOYMENT.md).
  output: 'export',

  // Future-proofing: if someone introduces next/image later, static export requires this.
  images: { unoptimized: true }
};

module.exports = nextConfig;

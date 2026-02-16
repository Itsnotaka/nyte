/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@workspace/application",
    "@workspace/domain",
    "@workspace/integrations",
    "@workspace/ui",
  ],
};

export default nextConfig;

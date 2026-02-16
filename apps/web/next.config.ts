/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@workspace/application",
    "@workspace/contracts",
    "@workspace/domain",
    "@workspace/integrations",
    "@workspace/ui",
  ],
};

export default nextConfig;

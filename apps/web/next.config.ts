/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/domain", "@workspace/integrations", "@workspace/ui"],
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/domain", "@workspace/ui"],
};

export default nextConfig;

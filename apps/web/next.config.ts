/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@nyte/application",
    "@nyte/contracts",
    "@nyte/domain",
    "@nyte/integrations",
    "@nyte/ui",
  ],
};

export default nextConfig;

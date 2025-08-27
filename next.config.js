/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      serverExternalPackages: ["postgres"]
    }
  };
  
  export default nextConfig;
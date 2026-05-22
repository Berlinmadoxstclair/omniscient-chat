/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle pdf-parse — require it at runtime so its test wrapper
      // doesn't try to read a sample PDF during the build.
      config.externals = [...(config.externals ?? []), "pdf-parse"];
    }
    return config;
  },
};

export default nextConfig;

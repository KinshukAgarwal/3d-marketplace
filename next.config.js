/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vturbhfjbelphikvumtd.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'example.com',
        pathname: '/**',
      }
    ],
    domains: ['vturbhfjbelphikvumtd.supabase.co', 'example.com']
  },
  // Add this to potentially help with the static folder issue
  // outputFileTracing: true,
  // Add this to serve files from app/icons
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    });
    return config;
  }
};

module.exports = nextConfig;

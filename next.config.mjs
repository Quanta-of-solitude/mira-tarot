/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Lets the dev server be opened through a tunnel (for testing payments on localhost).
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.app"],
};
export default nextConfig;

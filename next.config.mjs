/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "pg"],
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;

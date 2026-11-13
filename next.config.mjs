/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "@libsql/client"],
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;

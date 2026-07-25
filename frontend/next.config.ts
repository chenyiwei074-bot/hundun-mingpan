import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 独立部署模式：生成独立的 Node.js 服务器，无需 node_modules
  output: 'standalone',

  // 生产环境 API 地址（Nginx 代理，同域）
  env: {
    NEXT_PUBLIC_API_URL: '/api',
  },
};

export default nextConfig;

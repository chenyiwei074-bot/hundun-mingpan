# 混沌阁命盘

> AI 融合八字 × 紫微斗数 — 生成你的专属命理档案

## 技术栈

| 层 | 技术 | 部署 |
|---|------|------|
| 前端 | Next.js 16 + Tailwind CSS | ▲ Vercel |
| 后端 | Express + TypeScript | 🚂 Railway |
| 数据库 | Prisma + PostgreSQL | ⚡ Supabase |
| AI 分析 | OpenAI GPT-4o | ☁️ OpenAI |
| 文件存储 | Cloudflare R2 | ☁️ Cloudflare |
| 支付 | 微信/支付宝 (预留) | — |

## 项目结构

```
HDAI/
├── frontend/          # Next.js 前端
│   ├── app/
│   │   ├── page.tsx           # 首页
│   │   ├── create/page.tsx    # 命盘输入
│   │   ├── chart/[id]/page.tsx # 免费结果
│   │   ├── report/[id]/page.tsx# 付费报告
│   │   ├── pay/[orderId]/page.tsx # 支付页
│   │   └── lib/api.ts         # API 客户端
│   ├── vercel.json
│   └── .env.example
│
├── server/            # Express 后端
│   ├── src/
│   │   ├── index.ts           # 入口
│   │   ├── api/routes.ts      # 12 个 API 端点
│   │   ├── controllers/       # 请求处理
│   │   ├── services/          # 业务逻辑
│   │   │   ├── chart.service.ts    # 排盘
│   │   │   ├── render.service.ts   # 海报渲染
│   │   │   ├── pipeline.service.ts # 流水线
│   │   │   ├── marketing.service.ts# 营销文案
│   │   │   └── storage.service.ts  # R2 存储
│   │   ├── core/              # 命盘算法 (不重写)
│   │   │   ├── yiqi-core/     # 八字+紫微引擎
│   │   │   └── bazi-enrich/   # 八字增强层
│   │   └── database/          # Prisma Client
│   ├── prisma/
│   │   ├── schema.prisma      # SQLite (本地)
│   │   └── schema.postgres.prisma # PostgreSQL (生产)
│   ├── Dockerfile
│   ├── Procfile
│   └── railway.json
│
├── DEPLOY.md          # 部署指南
└── README.md
```

## 快速开始

```bash
# 后端
cd server && npm install && npx prisma db push && npm run dev

# 前端
cd frontend && npm install && npm run dev
```

## API 端点 (12 个)

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | /api/user/register | 注册用户 |
| GET | /api/user/:id | 用户信息 |
| GET | /api/user/:userId/charts | 命盘列表 |
| GET | /api/user/:userId/orders | 订单列表 |
| GET | /api/user/:userId/quota | 免费额度 |
| POST | /api/chart/create | 创建命盘 |
| GET | /api/chart/status/:id | 查询状态 |
| GET | /api/chart/free/:id | 免费查看 |
| GET | /api/chart/report/:id | 付费报告 |
| GET | /api/chart/poster/:id | HTML 海报 |
| POST | /api/order/create | 创建订单 |
| POST | /api/order/pay/:id | 支付回调 |

## 许可证

MIT · 混沌阁

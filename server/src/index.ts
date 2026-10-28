import express from 'express';
import cors from 'cors';
import chartRoutes from './api/routes';

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGINS || 'https://hundunmp.vip,https://www.hundunmp.vip')
  .split(',').map(x => x.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // 无 Origin 的同源请求、本机开发/巡检需要保留；其余只允许站点域。
    const local = process.env.NODE_ENV !== 'production' && typeof origin === 'string'
      && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (!origin || allowedOrigins.includes(origin) || local) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  allowedHeaders: ['Content-Type', 'x-visitor-id'],
  maxAge: 600,
}));
// 私密报告/塔罗/命盘不落入共享缓存；统一在 API 层声明。
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});
app.use(express.json({ limit: '10mb' }));

app.use('/api', chartRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log('混沌命盘 API Server running on http://localhost:' + PORT);
});

export default app;

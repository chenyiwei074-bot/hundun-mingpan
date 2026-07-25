import express from 'express';
import cors from 'cors';
import chartRoutes from './api/routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', chartRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log('混沌命盘 API Server running on http://localhost:' + PORT);
});

export default app;

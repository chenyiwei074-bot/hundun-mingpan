import { Router } from 'express';
import { createLiuYao } from '../controllers/liuyao.controller';
import {
  createChart,
  getChartStatus,
  getChartResult,
  getPoster,
  getQuota,
  trackEvent,
  getStats,
} from '../controllers/chart.controller';

const router = Router();

router.post('/chart/create', createChart);
router.get('/chart/status/:id', getChartStatus);
router.get('/chart/result/:id', getChartResult);
router.get('/chart/poster/:id', getPoster);
router.get('/chart/quota', getQuota);
router.post('/event', trackEvent);
router.post('/liuyao/create', createLiuYao);
router.get('/admin/stats', getStats);

export default router;


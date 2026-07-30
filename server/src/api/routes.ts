import { Router } from 'express';
import { createLiuYao } from '../controllers/liuyao.controller';
import { saveReport, listReports, getReport } from '../controllers/report.controller';
import {
  createChart,
  getChartStatus,
  getChartResult,
  getPoster,
  getQuota,
  trackEvent,
  getStats,
  createReportOrder,
  confirmPayment,
  getReportStatus,
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

router.post('/report/create', createReportOrder);
router.post('/report/confirm-payment', confirmPayment);
router.get('/report/status/:id', getReportStatus);

router.post('/reports', saveReport);
router.get('/reports', listReports);
router.get('/reports/:id', getReport);

export default router;


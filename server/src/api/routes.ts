import { Router } from 'express';
import { createLiuYao } from '../controllers/liuyao.controller';
import { recognize, getFloorPlanImage } from '../controllers/fengshui.controller';
import { saveReport, listReports, getReport } from '../controllers/report.controller';
import { submitReceipt, getReceiptStatus } from '../controllers/receipt.controller';
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

router.post('/fengshui/recognize', recognize);
router.get('/fengshui/image/:id', getFloorPlanImage);

router.post('/receipts', submitReceipt);
router.get('/receipts/:recordHash', getReceiptStatus);

router.post('/chart/create', createChart);
router.get('/chart/status/:id', getChartStatus);
router.get('/chart/result/:id', getChartResult);
router.get('/chart/poster/:id', getPoster);
router.get('/chart/quota', getQuota);
router.post('/event', trackEvent);
router.post('/liuyao/create', createLiuYao);
router.get('/admin/stats', getStats);

// 2026-10-16 安全下线：该路由仍注册，但 controller 已改为 503 且不写库（见 confirmPayment）

router.post('/reports', saveReport);
router.get('/reports', listReports);
router.get('/reports/:id', getReport);

export default router;


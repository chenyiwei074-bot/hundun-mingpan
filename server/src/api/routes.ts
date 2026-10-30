import { Router } from 'express';
import { createLiuYao } from '../controllers/liuyao.controller';
import { recognize, getFloorPlanImage, deleteFloorPlanImage } from '../controllers/fengshui.controller';
import { recognizePhysiognomyImage } from '../controllers/physiognomy.controller';
import { getClassicSources } from '../controllers/classics.controller';
import { lookupPlace } from '../controllers/geo.controller';
import { createTarotReading } from '../controllers/tarot.controller';
import { deleteTarotReading, getTarotReading, listTarotReadings, saveTarotReading } from '../controllers/tarot-reading.controller';
import { interpret as interpretTool } from '../controllers/ai.controller';
import { rewrite as rewritePlainLanguage } from '../controllers/plain-language.controller';
import { calculatePillars } from '../controllers/bazi-pillars.controller';
import { avatarBrief } from '../controllers/avatar.controller';
import { createShareLink, getSharedChart, listShareLinks, revokeAllShareLinks, revokeShareLink } from '../controllers/share.controller';
import { saveReport, listReports, getReport } from '../controllers/report.controller';
import { submitReceipt, getReceiptStatus } from '../controllers/receipt.controller';
import {
  createChart,
  getChartStatus,
  getChartResult,
  getQuota,
  trackEvent,
  getStats,
} from '../controllers/chart.controller';

const router = Router();

router.post('/fengshui/recognize', recognize);
router.get('/fengshui/image/:id', getFloorPlanImage);
router.delete('/fengshui/image/:id', deleteFloorPlanImage);
router.post('/physiognomy/recognize', recognizePhysiognomyImage);

router.get('/classics/sources', getClassicSources);
router.get('/geo/lookup', lookupPlace);
router.post('/tarot/reading', createTarotReading);
router.post('/ai/interpret', interpretTool);
router.post('/ai/plain-language', rewritePlainLanguage);
router.post('/bazi/pillars/calculate', calculatePillars);
router.post('/avatar/brief', avatarBrief);
router.post('/tarot/readings', saveTarotReading);
router.get('/tarot/readings', listTarotReadings);
router.get('/tarot/readings/:id', getTarotReading);
router.delete('/tarot/readings/:id', deleteTarotReading);
router.post('/receipts', submitReceipt);
router.get('/receipts/:recordHash', getReceiptStatus);

router.get('/chart/:id/share-links', listShareLinks);
router.post('/chart/:id/share-links', createShareLink);
router.delete('/chart/:id/share-links', revokeAllShareLinks);
router.get('/chart/share/:token', getSharedChart);
router.delete('/chart/:id/share-links/:shareId', revokeShareLink);
router.post('/chart/create', createChart);
router.get('/chart/status/:id', getChartStatus);
router.get('/chart/result/:id', getChartResult);
router.get('/chart/quota', getQuota);
router.post('/event', trackEvent);
router.post('/liuyao/create', createLiuYao);
router.get('/admin/stats', getStats);

// 2026-10-16 安全下线：该路由仍注册，但 controller 已改为 503 且不写库（见 confirmPayment）

router.post('/reports', saveReport);
router.get('/reports', listReports);
router.get('/reports/:id', getReport);

export default router;

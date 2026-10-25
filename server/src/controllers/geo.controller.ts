import type { Request, Response } from 'express';
import { lookupGeoV2 } from '../services/geo.service';

/**
 * GET /api/geo/lookup?province=广东省&city=深圳市&district=南山区
 *
 * 中国地点 → 经纬度 / IANA 时区。坐标来源是站内已核对的 382 城数据
 * （腾讯地图城市中心经纬度，MIT；见 lib/true-solar/city-geo.ts），
 * 不做地址地理编码、不猜测未收录地点。
 * district 目前只用于契约占位，精确坐标仍按 city；响应里的 src 会如实标 city/province/county。
 */
export function lookupPlace(req: Request, res: Response) {
  const province = String(req.query.province || '').trim();
  const city = String(req.query.city || '').trim();
  const district = String(req.query.district || '').trim();
  if (!province && !city) {
    return res.status(400).json({ success: false, error: '至少提供 province 或 city' });
  }
  const geo = lookupGeoV2({ province, city, district });
  if (!geo) {
    return res.status(404).json({
      success: false,
      error: '该地点未收录，按不校正处理，不猜测坐标',
      data: { query: { province, city, district } },
    });
  }
  return res.json({
    success: true,
    data: {
      version: geo.precision === 'district' ? 'china-geo-v2' : 'china-city-geo-v1',
      query: { province, city, district },
      lng: geo.lng,
      lat: geo.lat,
      tz: geo.tz,
      src: geo.src,
      precision: geo.precision,
      districtMatched: geo.districtMatched,
    },
  });
}

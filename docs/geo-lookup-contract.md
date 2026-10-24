# 中国地点/时区查询接口（geo-lookup-v1）

后端：`GET /api/geo/lookup`

## 请求

| 参数 | 必填 | 说明 |
|---|---|---|
| `province` | 至少一个 | 省/直辖市/自治区/特别行政区名，如 `广东省` |
| `city` | 至少一个 | 地级市/直辖市/自治州/地区名，如 `深圳市` |
| `district` | 否 | 区县名；当前只作契约占位，坐标仍取 city 级 |

- `province` 与 `city` 至少给一个；都空返回 400。
- 名称允许带/不带行政后缀（`深圳` 与 `深圳市` 等价）；不做别名词典之外的猜测。

## 成功响应 200

```json
{
  "success": true,
  "data": {
    "version": "china-city-geo-v1",
    "query": { "province": "广东省", "city": "深圳市", "district": "" },
    "lng": 114.057939,
    "lat": 22.543527,
    "tz": "Asia/Shanghai",
    "src": "city"
  }
}
```

`src`：`city`（地级市/直辖市命中）、`county`（省直辖县级市）、`province`（省级兜底；坐标误差可能达数度）。
未收录 404，响应 `success:false`，前端应按“不做真太阳时校正”处理，**不猜坐标**。

## 数据与边界

- 数据：`server/src/lib/true-solar/city-geo.ts`，382 个城市（地级市 345、省级 6、区县级 31），来源为腾讯地图城市中心经纬度（npm `tmap-citycoordinate@1.0.1`，MIT），与前端 `frontend/app/lib/true-solar/city-geo.ts` 同源。
- 时区：中国大陆 `Asia/Shanghai`，香港 `Asia/Hong_Kong`，澳门 `Asia/Macau`，台湾 `Asia/Taipei`。
- 不在本接口做地址地理编码；用户输入的具体地址不转坐标。
- 区县级精确坐标尚未覆盖；需要时再引入 AreaCity 等带区县坐标的 MIT 数据，接口版本升 `v2`，旧字段保持兼容。
- 本接口与六爻/八字算法无关，只输出经度、纬度、时区。

## 验收

```bash
curl -s 'https://hundunmp.vip/api/geo/lookup?province=广东省&city=深圳市'
node --test tools/backend-unit/geo-lookup.test.mjs
```

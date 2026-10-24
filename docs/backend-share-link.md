# 命盘分享链接（后端，2026-10-24）

## 接口

### POST `/api/chart/:id/share-links`

- 请求头：`x-visitor-id: <创建命盘时的 visitorId>`
- 只有命盘所有者、且 `status ∈ {complete, completed}` 才能生成；否则 404 / 409。
- 201：

```json
{ "success": true, "data": {
  "shareId": "cuid",
  "token": "43 字符 base64url（32 字节 CSPRNG）",
  "expiresAt": "2026-10-31T05:22:48.401Z"
} }
```

- 有效期固定 **168 小时**（7 天），不接受客户端自定义。
- 数据库只存 `sha256(token)` 裸 hex，不存原始令牌。

### GET `/api/chart/share/:token`

- 无需 visitorId。
- 返回只读展示字段：`chartData / analysisData / aiAnalysis / expiresAt`。
- 白名单清洗：递归删除 `visitorId / birthInfo / birthPlace / currentPlace / errorMessage`（历史 poster 字段也一并防御性删除）；
  姓名与 visitorId 在任何字符串里替换成 `（已隐藏）`。
- 无效、撤回、过期、命盘已删、未完成 → **统一 404**。

### DELETE `/api/chart/:id/share-links/:shareId`

- 请求头 `x-visitor-id`，只有所有者可撤回；撤回后立即失效（幂等）。

## 存储

表 `chart_shares`：`id / chart_id / token_hash / created_at / expires_at / revoked_at`。

**不要用 `prisma db push`**：现有 schema 缺 `charts.ai_analysis`（历史 raw SQL 加的列），
push 会把它当多余列删除。建表用 `server/prisma/chart_shares.sql`（手工 DDL + 授权）。

## 所有者接口归属校验

`GET /api/chart/status/:id`、`/chart/result/:id` 均要求 `x-visitor-id`：

- 缺标识 401；
- 不存在/非本人 404；
- 分享页只走分享令牌，不把令牌当 visitorId。

## 清理

读取时实时校验 `expiresAt` 与 `revokedAt`，不依赖定时任务；过期记录可后续加 cron 清理
（不影响失效判断）。

## 海报（已从本站下线，2026-10-24）

- 本站没有面向用户的海报功能；`/api/chart/poster/:id` 与 `/api/chart/share/:token/poster` 已移除。
- 海报是 bot 侧独立流程（使用 `/srv/chaos/tools/bazi-ziwei/` 自带的模板与 render 脚本），不经过本站接口。
- 数据库里 123 份历史 `poster_html/poster_url` 已清空（备份库中仍会随备份保留期滚动消失）。

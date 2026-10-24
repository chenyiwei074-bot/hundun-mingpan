# 数据保留期（2026-10-24 确认）

## 口径

用户 2026-10-24 确认：

- **命盘（charts）与报告（reports）本体：7 天**，含存量一起清；
- **分享链接：7 天**（固定 168h，单独令牌，不影响本体保留期）；
- **户型图：主存储 7 天 + 每日备份最多 7 天**（合计最长约 14 天）；可 DELETE 立即删主存储；
- **回执摘要、Merkle 台账、已锚定哈希：长期保留**（不含问题/姓名/生辰原文，用于完整性校验）；
- 每日数据库备份保留 7 天（`offsite-sync.sh` 的 `KEEP_DAYS`）。

## 清理任务

- 脚本：`server/src/scripts/retention.ts`
  - 默认 dry-run；`--apply` 才删除；
  - 保留天数 `DATA_RETENTION_DAYS`，默认 7；
  - 只删 `charts` / `reports` 中 `createdAt` 早于保留期的行；回执/台账不动。
- 包装脚本：`/srv/chaos/tools/retention-clean.sh`（固定 apply，供 cron 用）。
- cron：`45 4 * * * /srv/chaos/tools/cron-wrap.sh 数据保留清理 -- /srv/chaos/tools/retention-clean.sh`
- 首次执行（2026-10-24）：删除 **135 个命盘 / 35 份报告**（执行前已备份
  `/srv/chaos/backup/hundun_mindpan-20261024-1348.dump`）；剩余 31 盘 / 129 报告。

## 生效边界

- 删除命盘后，旧的 `/chart/result/:id` 与指向它的分享链接会 404（本体已不存在）；
- 回执文件里的哈希不受影响，仍可离线复验；
- 备份中的旧数据随备份保留期（7 天）滚动消失，不单独逐条删除；
- 定时任务失败会经 `cron-wrap.sh` 告警，不会静默跳过。

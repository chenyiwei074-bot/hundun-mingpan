#!/usr/bin/env bash
# 命盘/报告 7 天保留期清理（2026-10-24 用户确认：含存量一起清）。
# - DATA_RETENTION_DAYS 默认 7，可用环境变量覆盖
# - 只删 charts / reports；回执摘要与哈希台账不动
# - 由 cron 每日 04:45 调用；输出进 change-log/日志
set -euo pipefail
cd /opt
exec env DATA_RETENTION_DAYS="${DATA_RETENTION_DAYS:-7}" \
  node server/node_modules/tsx/dist/cli.mjs \
    --tsconfig=server/tsconfig.json \
    server/src/scripts/retention.ts --apply

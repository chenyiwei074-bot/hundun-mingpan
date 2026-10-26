# 前端交接后端：三九秘宿与西方跨盘 AI 字段

日期：2026-10-26  
范围：只扩展 `POST /api/ai/interpret` 的 `xiu`、`synastry` payload 白名单与各自 AI profile。无需数据库迁移；不改八字或六爻算法，也不新增 `sourceId`。

## 当前实况

AI 通用接口由 `frontend/components/ai/ToolInterpretation.tsx` 调用。后端在 `server/src/services/tool-interpretation.service.ts` 对每个工具执行严格顶层字段白名单校验：

- `xiu` 目前只允许 `ben`、`pair`。前端 `/xiu` 已独立计算并展示三九二十七宿，但当前 AI payload 不包含三九结果；页面已在 AI 解读后说明这一范围。
- `synastry` 目前只允许 `first`、`second`、`aspects`。前端已本机计算双方行星宫位叠加与十颗行星黄经中点，但 AI 当前读不到这两项；页面已在 AI 解读后说明这一范围。

将未允许的新字段提前发送会被后端按现有契约拒绝为 400。因此前端在后端契约部署前不会发送这些字段。

## 1. `xiu`：纳入三九结果

### 建议新增字段

在现有 `{ ben, pair }` 之外允许一个可空的 `sanJiu` 对象：

```json
{
  "sanJiu": {
    "basis": "xiu-sanjiao-lahiri-v1",
    "self": {
      "natalXiu": "角",
      "rows": [
        { "xiu": "角", "relation": "命" },
        { "xiu": "亢", "relation": "荣" }
      ]
    },
    "partner": null,
    "pairRelation": null
  }
}
```

`rows` 实际包含 27 项。双人计算时：

```json
{
  "partner": {
    "natalXiu": "亢",
    "rows": [{ "xiu": "亢", "relation": "命" }]
  },
  "pairRelation": {
    "partnerInSelf": { "xiu": "亢", "relation": "荣" },
    "selfInPartner": { "xiu": "角", "relation": "衰" }
  }
}
```

示例省略号仅用于文档；真实请求的 `rows` 必须是完整数组。字段名按本建议固定为 `self`、`partner`、`pairRelation`，不要让模型自行重建或猜测双方关系。

### 后端改动

1. `ALLOWED_KEYS.xiu` 增加 `sanJiu`，保留现有 `ben`、`pair` 兼容性。
2. `TOOL_PROFILES.xiu.scope` 扩展为：分别解释通书二十八宿值日/原有合宿与三九二十七宿；两套宿法分开陈述。`sanJiu` 为空时不得声称已分析三九。
3. 明确约束：三九序列的宿名与关系类别参考《宿曜经》；`basis: xiu-sanjiao-lahiri-v1` 标识本站自研的出生宿定位（地心月球黄经转拉希里恒星黄经，再均分 27 宿），不能说成《宿曜经》原有的天文算法。
4. 双人时只根据 `pairRelation.partnerInSelf` 与 `pairRelation.selfInPartner` 分别叙述，不压成匹配分，不把一方关系套到另一方。
5. `avoid` 继续禁止混入六爻、梅花、八字、紫微、塔罗等体系。

### 隐私边界

只传派生后的宿名与关系标签。不要传出生日期、当地时间、时区、坐标、原始月球黄经或交角数据。AI 不负责复算三九命宿。

## 2. `synastry`：纳入宫位叠加与组合中点

### 建议新增字段

在现有 `{ first, second, aspects }` 之外允许 `houseOverlays` 与 `compositeMidpoints`：

```json
{
  "houseOverlays": {
    "houseSystem": "whole-sign",
    "firstPlanetsInSecond": {
      "available": true,
      "rows": [{ "key": "sun", "name": "太阳", "sign": "白羊", "longitude": 12.3, "house": 4 }]
    },
    "secondPlanetsInFirst": {
      "available": false,
      "rows": []
    }
  },
  "compositeMidpoints": [
    { "key": "sun", "name": "太阳", "longitude": 18.4, "sign": "白羊", "ambiguous": false },
    { "key": "moon", "name": "月亮", "longitude": null, "sign": null, "ambiguous": true }
  ]
}
```

`available` 用来区分“未能计算宫位叠加”和“计算成功但没有可列行”；`ambiguous: true` 表示双方黄经恰好相差 180°，中点有两个方向。真实 payload 中两侧的叠加行和中点行均为前端计算的完整结果。

### 后端改动

1. `ALLOWED_KEYS.synastry` 增加 `houseOverlays`、`compositeMidpoints`，保留现有字段。
2. `TOOL_PROFILES.synastry.scope` 加入双方行星落入对方宫位的**方向性**关系与行星黄经短弧中点。
3. 缺坐标或宫制不适用时按 `available: false` 说明无法判断；不得解释为空宫/没有落宫行星。
4. `ambiguous: true` 且经度/星座为空时，明确说明中点存在两个同等方向，不得替用户任选一个或生成单一落点。
5. `avoid` 继续禁止东方合盘、六爻、八字、紫微、塔罗、关系匹配分数及确定性的未来预测。不得推导组合盘宫头、上升点或中天；前端没有发送这些字段。

### 隐私边界

只传已计算的行星位置、相位、宫位落点与中点。不要把原始出生日期、当地时间、地点名称、经纬度或时区加入 AI payload。当前前端的 `first`、`second` 已只含派生行星位置。

## 验收要求

- 单测：两个工具的旧 payload 仍通过；新增完整 payload 通过；未知顶层字段继续 400；`sanJiu: null` 与宫位不可用状态均可正确处理。
- 语义检查：三九算法来源边界、双方方向性关系、宫位不可用与中点歧义规则均进入各自 profile 的 `scope` / `avoid` / sections。
- 线上 smoke：两项请求均返回正常解读；公开响应不包含 provider/model；服务端不得把客户端伪造的 `sourceIds` 透传成已核验来源。
- 前端待接：后端白名单和 profile 部署后，再把上面两项派生字段加入 `/xiu` 与 `/synastry` 的 `ToolInterpretation` payload，删去“AI 尚未读取”提示，并用真实接口核对。


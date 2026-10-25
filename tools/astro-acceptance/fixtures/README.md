# 上升点与宫头对拍夹具

## `ascendant-whole-sign-v1.json`

- 20 组中国大陆、香港、澳门与台湾地点，时刻覆盖 1965–2010。
- 主要参考：`natal-chart-math` + `astronomy-engine`；独立交叉核对：Celestine。
- 最大观测差 0.00216°，验收公差 0.05°。
- `ascendantDeg` 与 `wholeSignCuspsDeg` 是回归黄道经度，单位为度。
- 前端对应计算在 `frontend/lib/astro/angles.ts`；不关联古籍 sourceId。

## `house-systems-v1.json`

- 复用上面 20 组经纬度与世界时刻，逐组保存等宫、三分、Placidus、Koch 的 12 个宫头。
- 参考输出来自 `@swisseph/node` 1.4.0（Swiss Ephemeris）和 `celestine` 0.7.0；两套输出在这些样例上的最大差为 0.007003°。
- 规则参考：Swiss Ephemeris 的 [swehouse.c](https://github.com/aloistr/swisseph/blob/master/swehouse.c)；独立实现对照：[Celestine 宫位计算源码](https://github.com/Anonyfox/celestine/tree/main/src/houses)。
- 前端实现位于 `frontend/lib/astro/houses.ts`，没有将这些参考包加入网站依赖；验收会将每组输出分别与两套锁定参考值比较，公差 0.05°。
- Placidus 与 Koch 在极区不做静默替代，前端显示可切换的降级提示。
- 这些是数值计算夹具，不是古籍引文，也不生成 sourceId。

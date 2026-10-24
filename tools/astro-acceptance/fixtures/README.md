# Ascendant / whole-sign fixtures v1

- 20 synthetic cases, China / HK / Macau / Taiwan cities, 1965–2010.
- Primary generator: `natal-chart-math` (MIT) + `astronomy-engine` (MIT).
- Independent cross-check: `Celestine` (MIT), `houses.calculateHouses(..., 'whole-sign')`.
- Max observed difference: 0.00216° (< 0.05°).
- `ascendantDeg` / `wholeSignCuspsDeg` are tropical ecliptic longitudes in degrees.
- These are **not** a frontend implementation yet; they are the golden data for the
  上升点/整宫制 page and its acceptance gate. No source IDs or classical quotes here.

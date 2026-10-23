# Frontend redesign execution plan

## Goal
Redesign the Hundun frontend from baseline `432d3ba` using the approved mixed-3D direction. Preserve calculation/API behavior, existing data semantics, test hooks, Chinese copy, and all accessibility and authenticity constraints in `D:\deepseeek 的hermas\GPT-前端重做-BRIEF.md`.

## Tasks

1. **Shared design system and shell**
   - Audit existing tokens, navigation, footer, shared button/form/card primitives, and approved mockups.
   - Refine global East/West theme tokens, type/spacing rules, keyboard focus, reduced motion, and responsive shell without changing existing semantic hooks.
   - Add restrained 3D thematic illustration surfaces using installed Three.js/CSS with static fallback and lazy loading.
   - Verify: lint/build; 375px and desktop visual smoke tests; all existing navigation and focus states.

2. **Portal and workspaces**
   - Redesign `/`, `/oriental`, `/western`, `/tools` around the two large whole-panel entrances, shared workspace skeleton, Chinese AI question composer, tool groups, and separate Fengshui entry.
   - Preserve catalog status, href/note semantics, composer state machine, all required selectors and data attributes.
   - Verify directory and assistant acceptance suites, responsive and contrast checks.

3. **Tarot MVP**
   - Add `/tarot` and a deterministic 78-card factual deck interface; implement only Past/Present/Future upright draw with `crypto.getRandomValues`, a verifiable seed commitment, shuffle/deal/flip animation, reduced-motion and keyboard behavior.
   - Display `牌义待接入`, simplified-play disclaimer, and upright-only scope; never fabricate card meanings or classical citations.
   - Verify build, route states, three-card count, no external requests, keyboard, reduced-motion, and 375px layout.

4. **Tools and intake pages**
   - Redesign `/astro`, `/fengshui`, `/create`, `/bazi-chart`, `/liuyao`, `/liuyao/create`, `/meihua`, `/xiu`, `/huangli` while retaining form behavior, 2D/3D floor-plan editing, privacy removal, calculation output, and evidence layers.
   - Verify astro, fengshui, western, meihua, xiu, huangli, bazi, liuyao-ganzhi acceptance suites where environment permits.

5. **Results, reports, account, and legal pages**
   - Restyle chart/result/loading/preview routes, Liuyao results and receipts, `/report/[id]`, `/dashboard`, `/admin/dashboard`, `/verify`, and legal/contact routes.
   - Keep calculation output separate from AI interpretation, preserve the exact four receipt states and all privacy/disclaimer facts.
   - Verify receipt, hepan, scenario, kline, ziwei, api-contract, assistant, and route smoke suites where environment permits.

6. **Final acceptance and handoff**
   - Run build/lint, available acceptance suites, local server on port 3020, route and responsive checks; do not start services on ports 3000/3001.
   - Write `docs/HANDOFF-frontend-redesign.md` with changed-route summary, Tarot implementation and acceptance, decision log, raw verification outputs, known gaps, rollback, and final branch tip.
   - Commit in 3–6 cohesive commits and push only `feat/frontend-redesign` when network access permits; never deploy or modify `main`.

## Per-file working discipline
Before editing an existing source file, create a same-directory backup as required by the repository instructions. Keep changes in `D:\gpt-frontend`; do not alter the shared checkout. After each implementation group, inspect the rendered route and verify behavior before committing.

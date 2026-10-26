# Feature Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Implement separate face-reading and palm-reading flows with explicit consent, transient photo recognition, user-confirmed feature review, and isolated AI interpretation profiles.
**Architecture:** Add a dedicated in-memory physiognomy recognition service/controller; validate image type, magic bytes, size, request shape, and sanitized output. Add strict face/palm AI payload schemas and profiles. Build two routes on a shared client component, add directory entries, and update privacy/consent copy to distinguish site storage from transient recognition-service processing.
**Tech Stack:** Next.js 16 / React 19, Express, TypeScript, Zod, existing AI interpretation pipeline, existing tools acceptance harness.
## Global Constraints
- Base work on the detached `9256f458` worktree; do not checkout/reset/revert or commit.
- Before modifying an existing file, copy it to a same-directory `_bak` file; new files do not need a backup.
- Keep each change batch to at most two files and state the target files first.
- Do not modify Bazi, Ziwei, Liuyao algorithms, source registries, or signed CSVs.
- Never persist photos to disk, DB, object storage, cache, report, or logs. Do not expose image body, prompt, provider/model names, or image URL in errors/responses.
- UI must require explicit consent and an explicit recognize action before upload; AI receives only confirmed structured features, never the image or identifying/birth/location data.
- Public copy must say the image is transmitted to a recognition service for processing and is not saved in Hundun site storage/report. Do not claim anything about downstream retention beyond what repository configuration proves; do not name providers/models.
- User can clear image and state. Nothing is restored after refresh. No “My Reports” persistence.
- Continue Liuyao source review separately; source candidates remain immutable and HOLD unless an exact continuous original passage is located on a specific scan page.
---

## Task 1: Add isolated, non-persistent recognition backend
**Files:** `server/src/services/physiognomy.service.ts`, `server/src/controllers/physiognomy.controller.ts`
- [ ] Define face/palm-specific schemas, prompt boundaries, strict image MIME/magic/size validation (5 MB max), sanitized feature/region/confidence response, and generic structured error codes.
- [ ] Use only configured vision-capable endpoints; treat provider output as untrusted, validate JSON with Zod, and suppress internal provider/model names and raw provider errors.
- [ ] Keep image bytes/Base64 only in request memory, avoid file/database/cache writes and body logging, set `Cache-Control: no-store`, clear request image references after completion.
- [ ] Validate `kind`, `consent`, `hand` and reject unknown request fields; do not accept `visitorId`.

## Task 2: Wire the recognition endpoint and backend contract tests
**Files:** `server/src/api/routes.ts`, `tools/backend-unit/physiognomy.test.mjs`
- [ ] Register `POST /api/physiognomy/recognize` on the dedicated controller.
- [ ] Add contract coverage for consent, unknown fields, MIME/magic mismatch, malformed/oversize Base64, hand requirements, malformed model output, sanitized public errors, and no persistence hooks.
- [ ] Ensure tests use mocked vision fetch and never call a live provider.

## Task 3: Add strict face/palm AI interpretation profiles
**Files:** `server/src/services/tool-interpretation.service.ts`, `tools/backend-unit/ai-physiognomy.test.mjs`
- [ ] Add `face-reading` and `palm-reading` tools with distinct system/scope/avoid/sections.
- [ ] Permit only a bounded list of confirmed feature IDs and short user-corrected values for each kind; reject candidate-only fields, image data, birth/name/place/visitor data, prompts, provider/model, and source IDs.
- [ ] Treat confirmed values as untrusted user content, forbid identity/age/sex/ethnicity/emotion/health inference and deterministic predictions, and keep source IDs empty unless verified records exist.
- [ ] Test valid features, cross-kind IDs, extra fields, oversized/invalid strings, and source/prompt injection attempts.

## Task 4: Build shared consent, upload, confirmation, and clearing UI
**Files:** `frontend/components/physiognomy/PhysiognomyFlow.tsx`, `frontend/app/face-reading/page.tsx`
- [ ] Implement accessible consent gate, local preview, file type/size checks, recognize button, image removal/reset, loading/error/low-confidence states, and per-feature confirm/edit controls.
- [ ] Do not select or upload a photo until consent is checked; do not call recognition on file selection; keep image/result state memory-only.
- [ ] Render the shared component on the face-reading route with face-specific capture guidance and allowed feature categories.
- [ ] AI interpretation appears only after at least one valid feature is explicitly confirmed; its payload contains confirmed structured features only.

## Task 5: Add the palm-reading route on the shared UI
**Files:** `frontend/app/palm-reading/page.tsx`, `frontend/components/physiognomy/PhysiognomyFlow.tsx`
- [ ] Render palm-specific guidance, require left/right selection, use palm-specific candidate feature IDs, and pass only selected hand plus confirmed features to AI.
- [ ] Verify shared state resets when kind changes and palm validation is independent of face validation.

## Task 6: Add catalog entries and privacy disclosure
**Files:** `frontend/lib/tools/catalog.ts`, `frontend/app/privacy/page.tsx`
- [ ] Add distinct Eastern directory entries and routes for face and palm reading, accurately listing only implemented subfeatures and boundaries.
- [ ] Disclose photo purpose, explicit consent, transmission to a recognition service for transient processing, no site-side storage/report persistence, user confirmation before AI interpretation, and no downstream-retention claim unsupported by configuration.
- [ ] Preserve existing privacy statements and public “混沌自研 AI” language; do not name model providers.

## Task 7: Add page and privacy acceptance coverage
**Files:** `tools/remaining-tools-acceptance/acceptance.ts`, `tools/visual-harness/census.mjs`
- [ ] Cover consent-required state, file constraints, both tool routes, palm hand selection, confirmation gate, AI payload boundary, 375px layout, no horizontal overflow, and no image persistence or local-storage restoration.
- [ ] Run focused frontend/server builds and relevant acceptance suites; check local `localhost:3001` health and browser flow if the local backend is available.
- [ ] Report any unavailable internal retention/configuration evidence as a deployment dependency; do not claim production deployment.
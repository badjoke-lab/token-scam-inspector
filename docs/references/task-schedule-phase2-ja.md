## Phase 2 タスクスケジュール（案：全10本）

### Task 2-01：Phase 2 仕様書をdocsに追加（確定の土台）

* やること：`docs/specs/spec-phase2-ja.md` を追加し、参照ルール（Phase2以降はこれが正）を明記
* ねらい：以降の実装がブレない

### Task 2-02：共有URLの安定化（/inspect/{chain}/{address}）

* やること：Pages側で `/inspect/eth/0x...` 形式を受けて、そのまま検査を走らせて結果表示できる導線を作る
* ねらい：リンク共有できる＝「使われる」状態になる

### Task 2-03：meta強化（cacheState / upstream status / schemaVersion）

* やること：`meta.cacheState=fresh|stale|miss`、`meta.upstream.status/provider/note`、`meta.schemaVersion=2` を追加
* ねらい：**今の結果が信用できるか**（fresh/stale/制限）を明示して、分析として成立させる

### Task 2-04：Evidenceを“追跡可能”に（evidenceLinks導入＋UI優先表示）

* やること：APIに `evidenceLinks[]` を追加（URL + facts + notes）、UIは evidenceLinks を優先表示（無ければ従来evidence）
* ねらい：「根拠のリンク」が出る＝無価値ではなくなる

### Task 2-05：high乱発を止める（判定規約の実装）

* やること：**単語ヒットだけでhigh禁止**、highは「確認可能根拠（URL/値/具体箇所）」がある場合のみ、弱い場合はwarn/unknownへ
* ねらい：USDTみたいな有名トークンで high が出る事故を潰す（信頼性の最低ライン）

### Task 2-06：stale運用を完成させる（障害時でも“使える”）

* やること：rate_limited/timeout/upstream_error 時に stale があれば返す。返した場合は `cacheState=stale` と upstream理由を必ず入れる
* ねらい：無料枠＆レート制限でも止まらない

### Task 2-07：辞書/解説ページ（初心者が理解できる導線）

* やること：`/dictionary`（または `/learn`）を追加し、LP/mint/owner/pause/blacklist など用語＋各チェックの意味を短文で説明
* ねらい：初心者向け価値の“見える化”（ここで反映）

### Task 2-08：検証セット（docs固定）＋最低限スモーク手順

* やること：チェーン別に検証用アドレスリスト（段階導入）をdocsに固定し、「先頭N件を叩く」スモーク手順も固定
* ねらい：更新しても壊れてないことを確認できる（運用の命）

### Task 2-09：入力支援の強化（例・エラー文言・読み方）

* やること：入力例、エラーの人間語、結果の読み方（3行）をUIに追加。unknownの意味も固定表示
* ねらい：離脱を減らす（初心者が“使える”）

### Task 2-10：多言語の土台（辞書化→JA/EN切替）

* やること：UI文言を辞書キー化して JA/EN 切替、checksの短文も辞書で管理しやすい形へ寄せる（破壊変更なし）
* ねらい：日本語/英語を安全に増やせる

---

**Phase 2 のタスク文（10本）**

---

## Task 19 でできるようになること（完了後）

* Phase 2 の「仕様（spec）」と「ロードマップ（roadmap）」が docs に固定される
* Phase 2 の“成功条件”と“やる／やらない”が明文化され、以降ブレなくなる

```md
✅ タスク文ここから

# Task 19 — Phase 2 Docs: spec + roadmap (save to docs/specs)

## PR title rule (MUST)
PR title must start with:
- **Task 19: Phase 2 docs**

## Goal
Create Phase 2 documents in the same style as Phase 1:
- `docs/specs/spec-phase2-ja.md`
- `docs/specs/roadmap-phase2-ja.md`

## Source of truth (MUST FOLLOW)
- Existing Phase 1 docs: `docs/specs/spec-phase1-ja.md`, `docs/specs/roadmap-phase1-ja.md`
- Ops rules: `AGENTS.md`, `codex/**`
- Common rules: `codex/tasks/task-00-rules.md`

## Allowed changes
- Add: `docs/specs/spec-phase2-ja.md`, `docs/specs/roadmap-phase2-ja.md`
- Update: `docs/specs/index.md` (add links) if it exists
- Must NOT break Phase 1 docs

## Requirements
1) Phase 2 spec must define:
- Scope (what becomes “analysis” in practical terms)
- New/updated checks (still explainable; no “scam断定”; no investment advice)
- Data sources and limits (rate limit / stale / caching)
- UI behavior requirements (beginner-first reading order)
- Non-functional requirements (speed, stability, abuse)

2) Phase 2 roadmap must keep the “Stage制 / Product Phase分離版” tone:
- Stage list for Phase 2 only (10 tasks mapping)
- Each stage: Goal / Work items / Done criteria

## Acceptance checklist
- [ ] Both files exist under `docs/specs/`
- [ ] Phase 2 “success conditions” are explicit
- [ ] Phase 2 tasks can reference these docs as source-of-truth

✅ タスク文ここまで
```

---

## Task 20 でできるようになること（完了後）

* UIが「JSONベタ表示」から脱却し、**初心者が読める表示**（要点→一覧→詳細）になる
* raw JSON は “詳細” に隠れて、通常は見やすい画面になる

```md
✅ タスク文ここから

# Task 20 — UI: beginner-first result rendering (no raw JSON by default)

## PR title rule (MUST)
PR title must start with:
- **Task 20: UI readable results**

## Goal
Transform the Pages UI to display results in a beginner-friendly order:
1) Overall + summary + topReasons
2) Checks list (short)
3) Expandable detail (detail/evidence/howToVerify)
Raw JSON should be hidden behind a <details> block.

## Source of truth (MUST FOLLOW)
- UI spec: `docs/specs/ui-spec-ja.md`
- Spec: `docs/specs/spec-phase1-ja.md` (+ Phase 2 doc after Task19)
- Ops rules: `AGENTS.md`, `codex/**`

## Allowed changes
- Update: `app/index.html`, `app/style.css`, `app/app.js` (or equivalent UI files)
- Must NOT change API response shape in this task

## Requirements
- Render `result.overallRisk`, `result.summary`, `result.topReasons` prominently.
- Render checks as cards/rows with:
  - label, result badge, short
  - “Details” toggle shows detail/evidence/howToVerify
- Display “unknown means not confirmed” note near top.
- Keep mobile-first layout (360px OK).

## Acceptance checklist
- [ ] No longer default to raw JSON dump on screen
- [ ] Raw JSON is available via expandable details only
- [ ] Works with current `/api/inspect` response

✅ タスク文ここまで
```

---

## Task 21 でできるようになること（完了後）

* **共有しやすいURL**（`/inspect?chain=...&address=...` / `/?chain=...` 等）で結果が開ける
* ページ更新しても状態が消えず、リンク共有が成立する

```md
✅ タスク文ここから

# Task 21 — Shareable URL (deep link) for inspect results

## PR title rule (MUST)
PR title must start with:
- **Task 21: Shareable URL**

## Goal
Make results reproducible from URL parameters (shareable link).
If URL has `chain` and `address`, auto-run inspection on load.

## Source of truth (MUST FOLLOW)
- Spec/roadmap: `docs/specs/**`
- Ops rules: `AGENTS.md`, `codex/**`

## Allowed changes
- Update: `app/app.js` (and minimal HTML if needed)
- No Workers changes required

## Requirements
- Support query params:
  - `?chain=eth&address=0x...`
- On page load:
  - If params valid → auto-run inspect
  - If invalid → show human-readable error
- Add “Copy share link” button that copies current URL with params.

## Acceptance checklist
- [ ] Pasting a link opens same result after load
- [ ] Invalid params show clear message (not just console)
- [ ] Mobile safe

✅ タスク文ここまで
```

---

## Task 22 でできるようになること（完了後）

* Workers側が **レート制限・失敗理由を“分かる形”で返す**（rate_limited / upstream_error 等）
* “取れないなら stale を返す” が安定し、無価値な unknown 連発を減らす土台ができる

```md
✅ タスク文ここから

# Task 22 — Workers: error taxonomy + stable stale behavior

## PR title rule (MUST)
PR title must start with:
- **Task 22: Stable errors + stale**

## Goal
Harden Workers behavior:
- Normalize upstream failures into clear error codes
- Ensure stale cache return is consistent and explainable

## Source of truth (MUST FOLLOW)
- Spec: `docs/specs/spec-phase1-ja.md` (cache + stale rules)
- Ops rules: `AGENTS.md`, `codex/**`

## Allowed changes
- Update: `workers/**`
- No UI changes required

## Requirements
- Define consistent upstream error codes:
  - `missing_api_key`, `rate_limited`, `upstream_error`, `invalid_response`
- When upstream fails:
  - If stale exists → return stale with `meta.cached=true` AND `meta.stale=true`
  - If none → return ok:false with error object (no HTML)
- Add response header:
  - `x-tsi-cache: HIT|MISS|STALE`

## Acceptance checklist
- [ ] Stale responses are distinguishable (header + meta)
- [ ] Evidence explains “why unavailable” in plain terms
- [ ] No breaking change to existing fields (only add `meta.stale`)

✅ タスク文ここまで
```

---

## Task 23 でできるようになること（完了後）

* “ブラックリスト”などの**雑な単語一致で誤判定**しにくくなる（コメント/文字列の除外など）
* 解析が「それっぽい」ではなく「根拠として読める」方向に寄る

```md
✅ タスク文ここから

# Task 23 — Analysis quality: scan without false positives (strip comments/strings)

## PR title rule (MUST)
PR title must start with:
- **Task 23: Reduce false positives**

## Goal
Improve text-based checks so they don’t trigger on trivial matches.
At minimum:
- Strip comments and string literals before pattern matching
- Use word-boundary/structured patterns
- Evidence must state what was detected (and where feasible, which token)

## Source of truth (MUST FOLLOW)
- Spec: `docs/specs/spec-phase1-ja.md` (7 checks meaning)
- Ops rules: `AGENTS.md`, `codex/**`

## Allowed changes
- Update: `workers/**`
- No UI changes required

## Requirements
- Implement a small “source preprocess” function:
  - remove `// ...` and `/* ... */`
  - remove `"..."` and `'...'` and template strings (best-effort)
- Update pattern checks to run on preprocessed source.
- Evidence strings should be more specific than “Found pattern”.

## Acceptance checklist
- [ ] Patterns no longer match inside comments/strings (best-effort)
- [ ] Evidence is clearer and less noisy
- [ ] No new external services added

✅ タスク文ここまで
```

---

## Task 24 でできるようになること（完了後）

* 解析結果に **最低限の“トークン情報”**（name/symbol/decimals など）が出せる
* 初心者が「何を見ているのか」が分かる（アドレスだけの無味さが減る）

```md
✅ タスク文ここから

# Task 24 — Token identity (name/symbol/decimals) via free RPC + cache

## PR title rule (MUST)
PR title must start with:
- **Task 24: Token identity**

## Goal
Add token identity fields (best-effort) using free RPC calls:
- `name`, `symbol`, `decimals` (and optional `totalSupply`)
Cache results under the same inspect cache key or a sub-key.

## Source of truth (MUST FOLLOW)
- Spec/roadmap: `docs/specs/**`
- Ops rules: `AGENTS.md`, `codex/**`

## Allowed changes
- Update: `workers/**`
- UI changes optional ONLY to display new fields if already present

## Requirements
- Implement minimal eth_call for ERC20 methods (best-effort).
- If RPC fails → keep fields absent or set to null with evidence explaining failure.
- Add to response without breaking:
  - `result.token` object (new field)

Example:
`result.token = { name, symbol, decimals }`

## Acceptance checklist
- [ ] ETH token identity returns for known tokens (best-effort)
- [ ] Failures become explainable (not silent)
- [ ] No paid infra added

✅ タスク文ここまで
```

---

## Task 25 でできるようになること（完了後）

* “unknown だらけ”を減らし、**最低限の分析として読める**状態に近づく
* 7チェックのうち、少なくとも複数項目が「根拠つき」で埋まる確率が上がる（ETH/BSC）

```md
✅ タスク文ここから

# Task 25 — Make checks less-unknown (use ABI + verified-source where available)

## PR title rule (MUST)
PR title must start with:
- **Task 25: Reduce unknown checks**

## Goal
Increase determinism of existing Phase 1 checks using:
- Verified source code (already)
- ABI (when available)
- Simple structured signals (function presence / modifiers)

## Source of truth (MUST FOLLOW)
- `docs/specs/spec-phase1-ja.md` (7 checks fixed meaning)
- Ops rules: `AGENTS.md`, `codex/**`

## Allowed changes
- Update: `workers/**`

## Requirements
- If ABI exists:
  - detect presence of common admin functions (pause/unpause, blacklist setters, mint)
  - evidence should mention ABI signal vs source signal
- Adjust result severity rules to avoid “single weak signal => high”.
  - Use at least 2 strong signals for `high` where feasible.
- Keep language neutral (no scam断定).

## Acceptance checklist
- [ ] More checks become ok/warn/high with explicit evidence
- [ ] Fewer “unknown because rate_limited” when cache/stale exists
- [ ] No breaking response changes

✅ タスク文ここまで
```

---

## Task 26 でできるようになること（完了後）

* “このサイトの読み方”が用意され、初心者が迷わない
* SEO用の「危険サイン辞典」ページ群ができる（引用・共有しやすい）

```md
✅ タスク文ここから

# Task 26 — Beginner guide + checks dictionary pages (SEO/education)

## PR title rule (MUST)
PR title must start with:
- **Task 26: Guide + dictionary**

## Goal
Add static pages that explain:
- What this tool is / is not
- How to read results (overall/topReasons/checks)
- A dictionary page per check (7 pages)

## Source of truth (MUST FOLLOW)
- Spec: `docs/specs/spec-phase1-ja.md` (check definitions)
- Ops rules: `AGENTS.md`, `codex/**`

## Allowed changes
- Add under `app/`:
  - `app/guide.html` (or `app/guide/index.html`)
  - `app/checks/*.html` (7 pages)
- Minimal CSS reuse

## Requirements
- Each check page must include:
  - What it means / why it matters / how to verify (beginner language)
- Add nav links from main page.

## Acceptance checklist
- [ ] Guide page exists and is linked
- [ ] 7 check pages exist and are linked
- [ ] Mobile readable

✅ タスク文ここまで
```

---

## Task 27 でできるようになること（完了後）

* UI文言が **JA/EN 切替**できる（まずは2言語）
* “初心者向け説明”を日本語で読めるようになる（日本の利用者向けの価値が増える）

```md
✅ タスク文ここから

# Task 27 — i18n (JA/EN) for UI + guide pages (dictionary-based)

## PR title rule (MUST)
PR title must start with:
- **Task 27: i18n JA/EN**

## Goal
Introduce simple dictionary-based i18n:
- Default: Japanese
- Toggle: JA/EN
Applies to main UI + guide + check pages.

## Source of truth (MUST FOLLOW)
- UI/spec docs: `docs/specs/**`
- Ops rules: `AGENTS.md`, `codex/**`

## Allowed changes
- Update/add: `app/app.js` + page HTML files
- Add: `app/i18n.js` (or `app/assets/i18n.js`) and `ja/en` dictionaries

## Requirements
- Provide a language toggle UI.
- Text replacement should not require rebuilding (pure client-side).
- Keep it minimal; no framework.

## Acceptance checklist
- [ ] Toggle switches visible strings
- [ ] Default is Japanese
- [ ] Works on mobile

✅ タスク文ここまで
```

---

## Task 28 でできるようになること（完了後）

* “動いてるか？”の確認が毎回ラクになる（簡易スモーク）
* Workers/Pages の更新で壊れた時に、最低限すぐ気づける

```md
✅ タスク文ここから

# Task 28 — Smoke checks + ops notes (no heavy local dependency)

## PR title rule (MUST)
PR title must start with:
- **Task 28: Smoke checks**

## Goal
Add minimal, repeatable checks to confirm the service works:
- A simple smoke script (Node or bash) that calls:
  - `/api/hello`
  - `/api/inspect` with known sample inputs
- Document “what to check when it breaks”

## Source of truth (MUST FOLLOW)
- Ops rules: `AGENTS.md`, `codex/**`
- Spec: `docs/specs/**`

## Allowed changes
- Add: `scripts/smoke.sh` (or `scripts/smoke.mjs`)
- Update: `README.md` (short section)

## Requirements
- Script must be copy-paste runnable.
- Must not require paid tools.
- Include sample addresses for eth/bsc (public well-known tokens are OK).

## Acceptance checklist
- [ ] `scripts/` smoke script exists and is readable
- [ ] README has short “Smoke check” section
- [ ] No secrets printed

✅ タスク文ここまで
```

---

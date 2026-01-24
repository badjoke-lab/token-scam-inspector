# Token Scam Inspector

## 開発ロードマップ（Product Phase 2 / Task 19–28）

---

## 1. このロードマップの位置づけ（固定）

- 本書は Product Phase 2 の **実装タスク 19–28** を固定する。
- 仕様の正本は `docs/specs/spec-phase2-ja.md` とし、本書は「順番と完了条件」を明確化する。
- Task 19 は docs-only とし、API実装は変更しない。

---

## 2. Phase 2 のゴール（再掲・タスク設計の基準）

Phase 2 は次を満たして「分析として使える」状態を作る：

1) Evidence が URL + 事実（値）で追跡できる
2) high の乱発を止める（誤爆を減らす）
3) rate limit / upstream 障害でも止まらない（stale返却 + 状態表示）
4) 初心者が迷わない読む順番と説明導線を固定する

---

## 3. タスク一覧（Task 19–28）

### Task 19 — Phase 2 docs audit+patch（docs-only）

**Goal**
- Phase 2 仕様とロードマップを「後続タスクが迷わない状態」に補強する。

**Work items**
- Phase 2 spec / roadmap の監査
- 成功条件・非目標・互換性・stale・エラー分類・UX順序を明文化
- （存在すれば）spec index に Phase 2 への導線を追加

**Done criteria**
- spec と roadmap が Task 20–28 の参照元として十分に具体
- docs 以外の変更が含まれていない

**Dependencies / notes**
- docs-only（API実装は変更しない）

---

### Task 20 — UI skeleton upgrade（現行APIのまま）

**Goal**
- 現行の `/api/inspect` を変更せず、初心者が読める表示順へUI骨組みを更新する。

**Work items**
- summary/topReasons → checks → details → raw JSON（折りたたみ）
- unknown の注記を追加
- 360px を基準に崩れないことを優先

**Done criteria**
- API変更なしで表示順だけで理解できる
- raw JSON が初期非表示

**Dependencies / notes**
- Task 19 の仕様追記を前提にする
- APIレスポンス形は変更しない

---

### Task 21 — Shareable URL（/inspect/{chain}/{address}）

**Goal**
- 共有可能な安定URLで結果を再現できるようにする。

**Work items**
- ルーティング追加（`/inspect/{chain}/{address}`）
- URL からの自動入力と実行
- 共有リンク導線（コピー）

**Done criteria**
- URL を開くだけで同じ結果に到達できる
- 既存トップ導線を壊さない

**Dependencies / notes**
- Task 20 の UI 骨組みと整合すること

---

### Task 22 — Error taxonomy + stale/header（non-breaking）

**Goal**
- エラーと stale を UI/運用が扱える形で安定化する（互換性維持）。

**Work items**
- 安定 error code を導入
- `meta.stale` を追加
- `x-tsi-cache: HIT | MISS | STALE` ヘッダーを追加

**Done criteria**
- Phase 1 のレスポンス形を壊さない
- stale / error が UI で判別できる

**Dependencies / notes**
- Phase 1 互換を壊さない（追加のみ）
- Task 20 は現行API前提、Task 22 以降で拡張を読む

---

### Task 23 — Checks explainability hardening（誤爆を減らす）

**Goal**
- 7チェックの説明可能性を上げつつ、誤爆（特に high 乱発）を抑える。

**Work items**
- コメント/文字列ヒットの誤検知を best-effort で低減
- evidence に「検出シグナルの具体名」を入れる
- 単一の弱いシグナルで強判定に寄せない

**Done criteria**
- high は確認可能な根拠がある時だけ
- unknown / warn / ok の説明が一貫

**Dependencies / notes**
- Task 22 の error/stale 表現と矛盾しないこと

---

### Task 24 — Token identity best-effort（result.token）

**Goal**
- トークン名/シンボル等の identity を best-effort で補完する。

**Work items**
- Explorer / RPC を使った補完（無料枠で壊れにくい範囲）
- `result.token` を追加（互換性維持）

**Done criteria**
- identity 取得失敗でも壊れない
- 追加は互換性を壊さない

**Dependencies / notes**
- Task 22 の互換性ルールを厳守

---

### Task 25 — Verification set + smoke check

**Goal**
- 「広く破綻していない」を確認できる検証導線を固定する。

**Work items**
- チェーン別検証セットを docs に固定
- 先頭N件を叩くスモーク手順を明文化

**Done criteria**
- 少数例検証から脱却できている
- 破壊的変更を検知しやすい

**Dependencies / notes**
- Task 23–24 の変更を受け止める安全網

---

### Task 26 — Guide + Dictionary pages（静的導線）

**Goal**
- 初心者が「なぜ重要か／どう確認するか」に到達できる静的導線を用意する。

**Work items**
- Guide 1本
- 7チェック分の辞書ページ（meaning / why / howToVerify）

**Done criteria**
- UI から静的導線に到達できる
- 説明がページとして資産化される

**Dependencies / notes**
- Task 20–21 の画面導線と接続する

---

### Task 27 — i18n toggle（辞書ベース JA/EN）

**Goal**
- 辞書ベースで JA/EN を切り替えられる最小構成を入れる。

**Work items**
- 文言辞書の導入
- JA/EN 切替トグル
- 既存文言を段階的に辞書へ寄せる

**Done criteria**
- 主要導線が JA/EN で崩れない
- 追加言語の拡張余地がある

**Dependencies / notes**
- Task 26 の静的ページ群と相性が良い

---

### Task 28 — Ops notes + smoke script

**Goal**
- 無料枠運用で「壊れても理由が分かる」状態を整える。

**Work items**
- smoke check スクリプト（または手順）
- README / 運用メモに制限と見え方を追記

**Done criteria**
- デプロイ後に最低限の健全性確認ができる
- rate limit / upstream 失敗時の見え方が言語化されている

**Dependencies / notes**
- Task 22 の error/stale と整合すること

---

## 4. 依存関係（明示ルール）

- Task 19 は docs-only（実装変更なし）。
- Task 20 は現行APIを前提にし、API実装を変更しない。
- Task 22 は Phase 1 互換を壊さない追加（`meta.stale` / header など）のみを行う。
- Task 23 以降は Task 22 の error/stale 表現を前提に UI/説明を強化する。

---

## 5. Phase 2 に含めないこと（spec と整合）

Phase 2 では次を含めない（Non-goals）：

- 詐欺の断定（verdict を出さない）
- 投資助言（売買・投資判断の推奨をしない）
- 点数化・ランキング化
- 有料インフラ必須化（paid API / DB 必須）
- 高頻度リアルタイム監視
- 全チェーン完全対応（無制限追加）

---

## 6. PR運用単位（固定）

- 1 task = 1 PR を厳守する。
- 関連しない改善を同一PRに混ぜない。

---

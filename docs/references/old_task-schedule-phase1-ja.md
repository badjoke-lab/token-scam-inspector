## Codexタスクスケジュール（Phase 1）

### Stage 0：基盤（まずデプロイできる形）

**Task 01 — ディレクトリ構造 + Skeleton静的ページ最小**

* `app/`（index/style/app.js空） `workers/` `codex/` の骨組み
* Pagesで最低限表示できる状態

**Task 02 — Workers Hello World + wrangler最小設定**

* Workersがdeploy/ローカル実行できる状態（まだロジック無し）

---

### Stage 1：API骨格（ロジック無しでJSON固定）

**Task 03 — `/api/inspect` ルーティング作成 + 入力バリデーション**

* `chain=eth|bsc` / `address=0x...` の検証
* 成功/失敗とも **JSON形式固定**（この時点はダミーでOK）

**Task 04 — レスポンスJSONスキーマの固定（specどおり）**

* `overallRisk / summary / topReasons / checks / meta` の形を揃える
* まだ中身は“unknown中心”でOK（形の安定が目的）

---

### Stage 2：キャッシュ（無料枠防衛の要）

**Task 05 — Cache API導入（TTL 24h） + cache hit/miss**

* key: `inspect:{chain}:{address}`
* `meta.cached` / `generatedAt` を埋める

**Task 06 — 外部API失敗時の stale cache 戦略**

* cacheがあれば古い結果を返す
* cacheが無ければエラーJSON（形は固定）

---

### Stage 3：外部API接続（事実データ取得）

**Task 07 — Explorer API 接続（eth/bsc）共通ラッパ**

* APIキーをenvで参照（Etherscan/BscScan想定）
* タイムアウト/失敗を “unknown理由付き” で扱う

**Task 08 — 取得データの正規化（Phase1で必要な最低限）**

* 例：verified状態 / owner候補 / 上位ホルダー比率取得可否 など
* “取れない理由”を内部で保持できる形にする

---

### Stage 4：判定ロジック（7項目を1つずつ）

ここは **「1項目=1タスク」**で安全に積む。

**Task 09 — Check① Sell Restriction / Honeypot（unknown含む）**
**Task 10 — Check② Owner Privileges**
**Task 11 — Check③ Mint Capability**
**Task 12 — Check④ Liquidity Lock Status（Phase1制限を明記しつつ）**
**Task 13 — Check⑤ Holder Concentration（Top1/5/10%）**
**Task 14 — Check⑥ Contract Verification（verified）**
**Task 15 — Check⑦ Trading Enable Control（pause/tradingEnabled系）**

**Task 16 — Overall Risk算出 + Top Reasons生成（最大3）**

* 仕様表のルールで `low/medium/high/unknown`
* high/warn原因を人間語で topReasons にまとめる

---

### Stage 5：UI（理解重視のSkeleton）

**Task 17 — UI入力フォーム（chain選択+address+inspect）**
**Task 18 — 結果表示（Overall 3点セット + checksサマリー）**
**Task 19 — 詳細展開（Why/Evidence/HowToVerify） + Unknown表現**
**Task 20 — エラー表示・ローディング・スマホ崩れ防止**

---

### Stage 6：安全策・免責・仕上げ

**Task 21 — 簡易レート制限（無料枠即死防止）**
**Task 22 — 免責文言の固定表示（UI） + 文言最終調整**
**Task 23 — 最終README更新（使い方/免責/範囲）**

---

## 進め方のルール（最短で事故らない）

* **この順番でしか投げない**（特に Task05 以前に判定実装しない）
* 判定は常に **ok/warn/high/unknown** の4値で返す
* 取れない時は **unknown + 理由**（黙ってokにしない）
* **1タスク=1PR**（でかくしない）



# Token Scam Inspector

## 仕様書（Phase 2 / 無料拡張・確定案 v1.0）

---

## 1. 目的とスコープ（Phase 2）

### 目的（Phase 2 で “価値” を出す定義）

Phase 1 で「動く」状態は成立したが、Phase 2 では以下を満たして **“分析として使える”** 状態にする：

1) **Evidence が追跡可能**（URL + 事実/値 で示せる）  
2) **high の乱発を止める**（誤爆を減らし、根拠があるときだけ high）  
3) **rate limit / upstream 障害でも止まらない**（stale返却 + 状態表示）  
4) **広い範囲で破綻していないことを担保**（検証セット固定）

### スコープ外（Phase 2でもやらない）

* 詐欺の断定
* 投資助言
* ブラックボックス数値スコア（点数化）
* 高頻度リアルタイム監視
* 大規模DB前提の分析（D1/KV/外部DB必須のもの）
* 全チェーン完全対応（無制限追加）

---

## 2. 対応チェーン（Phase 2 方針）

Phase 2 では **段階的追加**を許可するが、無制限に増やさない。

* 既存：Ethereum（ERC-20）, BNB Smart Chain（BEP-20）
* 追加候補（優先順の例）：Polygon, Arbitrum, Optimism, Base など
* 追加条件（必須）
  * Explorer/Provider が無料枠で現実的に動く
  * rate limit 対策（キャッシュ/バックオフ/失敗時stale）が仕様で担保される
  * 検証セットに追加できること

---

## 3. システム構成（Phase 2）

構成は Phase 1 と同じ：Pages（UI） + Workers（API） + Cache API（無料運営の要）

Phase 2 では **以下を追加**する（ただし DB はまだ不要）：

* 検証セット（docsに固定）
* 共有ページ（/inspect/{chain}/{address}）
* 辞書/解説ページ（危険サインの説明、SEO兼教育）

---

## 4. API仕様（Phase 2 固定）

### エンドポイント

* 既存：`GET /api/inspect?chain=...&address=...`
* 追加（UI用途）：`GET /api/health`（任意・簡易）  
  - 目的：Workers稼働確認、レート制限状態/バージョン確認（UIが壊れにくい）

※ Phase 2 でも **inspect 以外の高機能APIは増やさない**（無料運営の破綻防止）

---

## 5. キャッシュ設計（Phase 2 強化）

Phase 1 の方針を維持しつつ、**stale の状態を明示**して “分析として嘘をつかない” に寄せる。

### 5.1 キャッシュキー（固定）

```

inspect:{chain}:{address}:v

````

※ schemaVersion を必須にする（将来の拡張でキャッシュ破壊が可能）

### 5.2 TTL（固定）

* 24時間（原則維持）
* ただし Phase 2 では `meta.cache` に fresh/stale を明示する

### 5.3 stale 戦略（必須）

* upstream が失敗（rate_limited / timeout / upstream_error）の場合：
  * stale があれば **stale を返す**
  * stale がなければ **エラーJSON**（ただしUIは落とさない）

---

## 6. レスポンスJSON（Phase 2：拡張のみ、破壊禁止）

Phase 1 のレスポンス構造は維持し、**追加フィールドのみ許可**。

### 6.1 互換性ルール（最重要）

* ✅ フィールド追加：OK
* ✅ `meta` 内の拡張：OK
* ✅ `checks[*]` に追加情報を増やす：OK
* ❌ 既存キーの削除・型変更：禁止（breaking change禁止）

### 6.2 追加する meta（推奨：固定）

```json
"meta": {
  "cached": true,
  "generatedAt": "ISO",
  "schemaVersion": 2,
  "cacheState": "fresh | stale | miss",
  "upstream": {
    "status": "ok | rate_limited | timeout | error | skipped",
    "provider": "etherscan | bscscan | ...",
    "note": "human readable"
  }
}
````

### 6.3 evidence の “追跡可能化”（Phase 2 の核）

Phase 1 では `evidence: string[]` だったが、
Phase 2 では **UI表示を壊さず**、以下の形式も併用できるようにする：

* 互換維持：`evidence` は string[] のまま残す（既存UIを壊さない）
* 追加：`evidenceLinks`（構造化 evidence）

例：

```json
"evidence": [
  "Contract verified: yes"
],
"evidenceLinks": [
  {
    "label": "Etherscan Code tab",
    "url": "https://etherscan.io/address/0x...#code",
    "facts": [
      { "key": "verified", "value": true }
    ],
    "notes": "Verified source code is available."
  }
]
```

※ Phase 2 のUIは evidenceLinks を優先表示し、無いときは evidence を表示する。

---

## 7. 判定ロジック（Phase 2：誤爆を止める規約）

### 7.1 high の条件（固定）

**high は “確認可能な根拠” があるときだけ**返す。

禁止例：

* 単語ヒットだけで high（例：blacklist 文字列がある → 即 high）

許可例：

* Explorer上の verified source から、具体的に該当関数/挙動が確認できる
* 特定の設定値（税率・制限）が数値として取得できる
* 明確な権限/役割が確認できる（owner/role + 変更可能な対象が具体）

### 7.2 warn / unknown の使い分け（固定）

* **unknown**：データが取れず確認不能（理由を必ず表示）
* **warn**：弱いシグナルはあるが断定できない（根拠URLを付ける）
* **ok**：確認した範囲で問題が見当たらない（ただし「安全」ではない）

---

## 8. UI仕様（Phase 2）

### 8.1 共有ページ（必須）

* `/#/` ではなく、安定URL：

  * `/inspect/{chain}/{address}`
    → 直リンクで結果が再現される（キャッシュと相性が良い）

### 8.2 表示順（初心者導線・固定）

1. **Top Reasons（最大3）**
2. **チェック一覧（short）**
3. **詳細（detail + evidenceLinks + howToVerify）**
4. **状態表示（fresh/stale / upstream制限）**

### 8.3 辞書/解説ページ（必須）

* `/dictionary`（または `/learn`）

  * 用語：LP, mint, owner, pause, blacklist など
* 各チェックの “なぜ重要か/どう見るか” を単独ページ化（SEO兼教育）

---

## 9. 検証（Phase 2：少数例禁止）

### 9.1 検証セット（必須）

* チェーンごとに 50〜200 程度のアドレスセット（段階導入可）
* カテゴリ：bluechip / random / suspicious（既知 or ユーザー提供）
* docs に固定し、更新はPRで記録する

### 9.2 最低限のスモーク手順（必須）

* “このセットの先頭N件” を叩いて、レスポンス形が崩れてないことを確認できる手順を docs に固定

---

## 10. 多言語（Phase 2 で導入可）

* Phase 2 の後半で実施（辞書ページ整備と相性が良い）
* 方針：

  * UI文言の辞書化（キー化）
  * JA/EN の切替（まず2言語）
  * checks の short/detail も辞書管理に寄せる（将来拡張しやすい）

---

## 11. Phase 2 完了条件（公開基準）

* Evidence が URL＋事実で追跡できる（分析として成立）
* high の乱発が止まっている（誤爆が目立たない）
* rate limit でも stale で“使える状態”を維持
* 共有URLが安定して機能する
* 辞書/解説ページが存在し、初心者が理解できる導線がある
* 検証セットと手順が docs に固定されている

---

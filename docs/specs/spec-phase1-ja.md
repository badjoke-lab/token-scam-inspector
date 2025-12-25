# Token Scam Inspector

## MVP仕様書（Phase 1 / 確定・改訂版 v1.1）

---

## 1. 目的とスコープ（Phase 1）

### 目的

* トークン購入前に **明確に危険なサインがないか** を短時間で確認できる
* 判定理由を **初心者でも理解できる言葉** で提示する
* 判定結果の **妥当性・根拠がUIから読み取れる** ことを重視する
* 無料運営で **壊れにくい構成** を成立させる

### スコープ外（Phase 1ではやらない）

* 詐欺の断定
* 投資助言
* 高頻度リアルタイム監視
* ブラックボックススコア（数値評価）
* 全チェーン対応

---

## 2. 対応チェーン（固定）

Phase 1 では以下 **2チェーンのみ** を対象とする：

* **Ethereum（ERC-20）**
* **BNB Smart Chain（BEP-20）**

※ チェーン追加は Phase 2 以降
※ API・UI・判定ロジックはチェーン非依存で拡張可能な設計とする

---

## 3. システム構成（確定）

### 全体構成

```
[ Browser ]
    |
    |  GET /api/inspect
    v
[ Cloudflare Workers ]
    |
    |  (cache hit → return)
    |  (cache miss → external API)
    v
[ External APIs (Free tier) ]
```

### 使用技術

* UI：Cloudflare Pages（静的 HTML / CSS / JS）
* API：Cloudflare Workers
* キャッシュ：Workers Cache API
* DB：なし（Phase 1）

---

## 4. API仕様（Phase 1 固定）

### エンドポイント

```
GET /api/inspect
```

### クエリパラメータ

| name    | type   | required | note           |
| ------- | ------ | -------- | -------------- |
| chain   | string | yes      | `eth` or `bsc` |
| address | string | yes      | トークンコントラクト     |

### バリデーション

* address：`0x` で始まる 40 hex
* chain：許可リスト方式（eth / bsc）

---

## 5. キャッシュ設計（超重要・確定）

### キャッシュキー

```
inspect:{chain}:{address}
```

### TTL

* **24時間（固定）**

### キャッシュ戦略

* cache hit → 即返却
* cache miss → 外部API取得 → 判定 → キャッシュ → 返却
* 外部API失敗時：

  * キャッシュがあれば **stale cache を返す**
  * キャッシュがなければエラーJSON

---

## 6. レスポンスJSON（固定スキーマ・改訂）

```json
{
  "chain": "eth",
  "address": "0x...",
  "overallRisk": "low | medium | high | unknown",
  "summary": "Human-readable one-line verdict",
  "topReasons": [
    "Potential sell restriction detected",
    "Owner can modify trading rules"
  ],
  "checks": [
    {
      "id": "sell_restriction",
      "label": "Sell Restriction / Honeypot",
      "result": "ok | warn | high | unknown",
      "short": "You may not be able to sell this token.",
      "detail": "Some scam tokens allow buying but block selling for regular users.",
      "evidence": [
        "Sell tax appears extremely high"
      ],
      "howToVerify": [
        "Check swap behavior using a tiny amount on a trusted tool."
      ]
    }
  ],
  "meta": {
    "cached": true,
    "generatedAt": "ISO-8601"
  }
}
```

※ Phase 2 以降は **フィールド追加のみ許可**（breaking change禁止）

---

## 7. 判定項目（Phase 1：7項目に固定）

> 各項目は **Result + Short + Why + Evidence + How to verify** を必ず表示する。

---

### ① Sell Restriction / Honeypot

* **Short**：You may not be able to sell this token.
* **Why**：Buying is allowed but selling may be blocked or heavily taxed.
* **Evidence**：売却失敗・極端な税率・取得不可（unknown）
* **妥当性**：詐欺トークンで最頻出
* **短文要約**：

  > 売れないトークンは最も危険

---

### ② Owner Privileges

* **Short**：The owner may change critical rules.
* **Why**：Owner-controlled parameters can turn a token into a trap later.
* **Evidence**：Owner存在・権限関数の検出有無
* **妥当性**：後出し仕様変更が可能
* **短文要約**：

  > 開発者が自由に変更できるか

---

### ③ Mint Capability

* **Short**：Token supply might increase later.
* **Why**：Unlimited minting can crash price.
* **Evidence**：mint 関数の有無・不明
* **妥当性**：供給操作リスク
* **短文要約**：

  > 勝手に増やせる設計か

---

### ④ Liquidity Lock Status

* **Short**：Liquidity might be removable.
* **Why**：Removing liquidity makes selling impossible.
* **Evidence**：LPロック確認可否（Phase 1制限明記）
* **妥当性**：ラグプル対策の基本
* **短文要約**：

  > 流動性が逃げられるか

---

### ⑤ Holder Concentration

* **Short**：A few wallets may control most tokens.
* **Why**：Large holders can dump and crash price.
* **Evidence**：Top 1 / 5 / 10 holders %
* **妥当性**：価格操作リスク
* **短文要約**：

  > 一部が握りすぎていないか

---

### ⑥ Contract Verification

* **Short**：Contract code may be hidden.
* **Why**：Unverified code hides malicious logic.
* **Evidence**：Explorer 上の verified 状態
* **妥当性**：透明性の最低条件
* **短文要約**：

  > 中身が公開されているか

---

### ⑦ Trading Enable Control

* **Short**：Trading might be paused or restricted.
* **Why**：Trading can be stopped after users buy.
* **Evidence**：pause / tradingEnabled パターン
* **妥当性**：後出し売買停止
* **短文要約**：

  > 取引を止められる設計か

---

## 8. Overall Risk 表示ルール（改訂）

### 判定ロジック

| 条件         | overallRisk |
| ---------- | ----------- |
| high が1つ以上 | high        |
| warn が2つ以上 | medium      |
| warn が1つ   | medium      |
| 全て ok      | low         |
| unknown 多数 | unknown     |

### 表示仕様（必須）

Overall は **必ず以下3点セットで表示**する：

1. **Risk Level バッジ**（Low / Medium / High / Unknown）
2. **One-line Verdict（summary）**
3. **Top Reasons（最大3件）**

   * high / warn の原因項目を人間語で列挙

※ 数値スコアは Phase 1 では表示しない

---

## 9. UI仕様（MVP・改訂）

### 画面構成

1. トップ

   * チェーン選択
   * コントラクト入力
   * Inspect ボタン

2. 結果画面

   * Overall Risk（色付きラベル）
   * 一文サマリー
   * Top Reasons（箇条書き）
   * 判定項目サマリー表

3. 詳細展開

   * What we checked
   * Why it matters
   * Evidence
   * How to double-check

4. 免責・説明

   * 投資助言ではない
   * 判定は保証ではない
   * Unknown は「未確認」であることを明示

---

## 10. 非機能要件

* 1リクエスト 5秒以内
* API障害時も UI は落とさない
* キャッシュ優先で無料枠を保護
* ログは最小限（Workers console）

---

## 11. 免責（必須・固定文）

> This tool does not provide investment advice.
> Results are based on automated checks and may be incomplete or incorrect.
> Always do your own research (DYOR).

---

## 12. Phase 1 完了条件（公開基準）

* `/api/inspect` が安定動作
* キャッシュが有効
* Overall と各判定項目の **理由がUIから理解できる**
* 無料枠で継続稼働可能

---


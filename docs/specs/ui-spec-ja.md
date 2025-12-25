# Token Scam Inspector

## UI仕様書（Phase 1 / Skeleton UI）

---

## 1. UI設計方針（最重要）

### 基本思想

* **装飾しない**
* **判断させるUIではなく、理解させるUI**
* **すべて縦積み（1カラム）を基本**
* **CSSでの視覚的区切りは“余白”のみ**
* **色は情報補助として最小限に使用（意味を持たせすぎない）**

### 非目標

* 派手なバッジ
* ゲージ・スコア表示
* ランキング・比較UI
* アニメーション

---

## 2. レイアウト全体構成

```
[ Header ]
[ Input Area ]
[ Status / Error ]
[ Result: Overall ]
[ Result: Checks List ]
[ Result: Check Details ]
[ Footer / Disclaimer ]
```

* **全画面1ページ**
* スクロール前提
* PC / Mobile 共通構造（レスポンシブ切替なし）

---

## 3. ヘッダー領域

### 表示要素

* サービス名：`Token Scam Inspector`
* サブテキスト（1行）：

  > Explainable risk signals. Not a scam verdict.
* テキストリンク（小さく）：

  * `Dev Log`
  * `Methodology`

### 仕様

* 固定ヘッダーにはしない
* 文字サイズは本文よりやや大きい程度
* スマホではリンクは縦に並んでもOK

---

## 4. 入力エリア（最初の操作）

### 要素

1. チェーン選択

   * select
   * options: `Ethereum (ERC-20)`, `BSC (BEP-20)`
2. コントラクトアドレス入力

   * text input
   * placeholder: `0x...`
3. 実行ボタン

   * label: `Inspect`

### レイアウト

* **常に縦積み**
* 幅は親に依存（max-widthのみ制限）
* ボタンは横幅いっぱいでもOK

### バリデーション表示

* 入力欄直下にテキスト表示

  * 例：`Invalid address format`
* 色に頼らず文章で説明

---

## 5. ステータス表示（実行中・エラー）

### 実行中

* 表示文：

  > Inspecting token… Cached results may be used.
* ローディングアニメ不要（テキストのみ）

### エラー

* 種別ごとに文章を変える

  * 無効入力
  * API失敗
  * キャッシュ使用中

### 仕様

* 新しい画面に切り替えない
* 入力エリアの直下に表示

---

## 6. 結果表示：Overall Risk

### 構成

* Risk Label（テキスト）

  * `Overall Risk: High / Medium / Low / Unknown`
* Summary（1文）

  * 例：

    > Multiple high-risk signals were detected. Extreme caution is advised.
* Top reasons（最大3行）

  * 箇条書き or 改行テキスト

### 表示ルール

* **数値化しない**
* **色だけで意味を持たせない**
* テキストの順序で重要度を伝える

---

## 7. 判定項目一覧（Checks List）

### 表示形式

* **テーブル禁止**
* **リスト形式（1項目＝1ブロック）**

### 各項目の構成

```
[ Check Label ]
Result: OK / Warn / High / Unknown
Short explanation (1 line)
```

### 仕様

* 結果はテキストで明示
* アイコン不要
* 項目間の区切りは余白のみ

---

## 8. 判定詳細（Details）

### 表示方式

* 折りたたみ（HTML `<details>` 想定）
* 初期状態：閉じる

### 展開時の内容

1. What we checked
2. Why it matters
3. Evidence
4. How to double-check

### 仕様

* 初心者向け文章を優先
* 専門用語は避ける or 補足説明を添える
* API値が取れない場合は理由を明記

---

## 9. フッター・免責

### 表示内容（固定）

* 投資助言ではない
* 判定は保証ではない
* DYORを促す文言

### 仕様

* 小さな文字でOK
* 目立たせないが必ず表示

---

## 10. スマホ対応ルール（明文化）

* 1カラム固定
* 横スクロールを発生させない
* 最小フォントサイズ 14px
* タップ領域は十分な余白を確保
* hover前提のUIは禁止

---

## 11. Phase 2 以降に委ねるもの（明示）

* 色・視覚的強調
* スコア化
* アイコン
* ダークモード
* 比較UI
* アニメーション

---

## 12. UI完成の定義（Phase 1）

* スマホで崩れない
* 結果と理由が理解できる
* 判定ロジックがUIに正直に反映されている
* 見た目が「未完成」に見えても問題ない

---

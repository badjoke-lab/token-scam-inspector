# Token Scam Inspector

## 開発ロードマップ（Stage制 / Product Phase分離版）

---

## 用語定義（最初に固定）

### ■ Product Phase（プロダクト段階）

* **Product Phase 1**：MVP（無料・最小）
* **Product Phase 2**：無料拡張（利用者増・精度向上）
* **Product Phase 3**：有料前提の高度化

👉 これは「プロダクトの成長段階」

---

### ■ Development Stage（開発ステージ）

* **Stage 0〜7**：実装の進行手順
* 各 Stage は **単独で完結・停止可能**

👉 これは「作業の順番」

---

## Development Stage 一覧（0–7）

---

## Stage 0：プロジェクト基盤構築

### 🎯 ゴール

壊れない土台を先に作る（まだ何もしないがデプロイできる）

### 作業内容

* Git リポジトリ作成
* ディレクトリ構成確定

  ```
  /pages    (UI)
  /workers  (API)
  /docs     (specs)
  ```
* Cloudflare Pages / Workers の接続
* 環境変数設定（Explorer API Key）
* README（概要・免責のみ）

### 完了条件

* Pages に仮ページが表示される
* Workers が deploy 可能

---

## Stage 1：API 骨格実装（ロジックなし）

### 🎯 ゴール

`/api/inspect` が **常に JSON を返す**

### 作業内容

* `/api/inspect` エンドポイント作成
* chain / address のバリデーション
* ダミーレスポンス JSON 実装
* エラーレスポンス形式の固定

### 完了条件

* 正常・異常入力で JSON が返る
* フロントから fetch 可能

---

## Stage 2：キャッシュ層実装（無料運営の要）

### 🎯 ゴール

外部APIを無駄に叩かない

### 作業内容

* Cache API 組み込み
* キャッシュキー：`inspect:{chain}:{address}`
* TTL：24h
* stale cache 戦略

### 完了条件

* 2回目以降は cache hit
* 外部API障害時も結果が返る（キャッシュあり）

---

## Stage 3：外部API接続（生データ取得）

### 🎯 ゴール

判定に必要な **事実データ** を取得

### 作業内容

* Ethereum / BSC Explorer API 接続
* 以下データの取得：

  * コントラクト検証状態
  * Owner 情報
  * ホルダー分布（上位）
* APIエラー時の graceful handling

### 完了条件

* Workers 内で生データが取得できる
* API失敗でも処理が止まらない

---

## Stage 4：判定ロジック実装（7項目）

### 🎯 ゴール

各チェックが意味を持つ判定を返す

### 作業内容

* 判定関数の分離（1項目1関数）
* 7判定項目の実装
* Evidence / HowToVerify の生成
* Overall Risk 算出

### 完了条件

* 全項目が `ok / warn / high / unknown` を返す
* unknown が暗黙に ok にならない

---

## Stage 5：UI 実装（理解重視）

### 🎯 ゴール

「危険かどうか」ではなく
**「なぜそう判断されたか」が読める**

### 作業内容

* 入力フォーム
* Overall 表示（3点セット）
* 判定項目サマリー表
* 詳細展開 UI
* エラー / unknown 表示

### 完了条件

* 初心者が理由を追える
* バッジだけで終わらない

---

## Stage 6：安全策・免責・仕上げ

### 🎯 ゴール

無料で **放置可能な状態** にする

### 作業内容

* 簡易レート制限
* 免責文言の固定表示
* ログ最小化
* UI文言の最終調整

### 完了条件

* abuse で即死しない
* 誤解を生まない表示

---

## Stage 7：Product Phase 1 公開（MVP）

### 🎯 ゴール

一般公開できる完成度

### 作業内容

* Pages 本番デプロイ
* 最終動作確認
* README 更新

### 完了条件

* 公開URLで正常動作
* キャッシュ前提で安定稼働

---

## Product Phase 2（将来）：無料拡張

* 対応チェーン追加
* 判定項目の軽微拡張
* 共有URLの安定化
* 教育・解説ページ追加

---

## Product Phase 3（将来）：有料前提の進化

* 高精度データプロバイダ導入
* リスク変化履歴
* 監視・通知
* プロ向け詳細分析

---

## Codex投入単位（最重要）

❌ 全部まとめて
⭕ 以下の単位で投入：

1. Stage 1 + Stage 2（API骨格＋キャッシュ）
2. Stage 3（外部API）
3. Stage 4（判定ロジック）
4. Stage 5（UI）

---
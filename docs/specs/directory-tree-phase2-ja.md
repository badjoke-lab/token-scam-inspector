token-scam-inspector/
  AGENTS.md                         # 運用ルール（Codex/PR運用/禁止事項など）
  README.md                          # リポジトリ概要・実行方法・免責（短く）
  LICENSE                            # ライセンス

  app/                               # Cloudflare Pages（ツール本体：静的UI）
    index.html                       # トップ（入力・説明・使い方導線）
    style.css                        # UIスタイル（最小・読みやすさ優先）
    app.js                           # ブラウザ側エントリ（入力→API→表示）

    inspect/
      index.html                     # 結果ページ（/inspect と /inspect/* 両対応の入口）
                                    # 例: /inspect/eth/0x... を表示できる

    dictionary/
      index.html                     # 危険サイン辞書の目次（SEO/教育）
      sell-restriction.html          # 用語説明：売却制限（例）
      owner-privileges.html          # 用語説明：オーナー権限（例）
      mint-capability.html           # 用語説明：ミント権限（例）
      contract-verification.html     # 用語説明：コード検証（例）
      trading-control.html           # 用語説明：取引停止（例）
      liquidity-lock.html            # 用語説明：流動性ロック（例）
      holder-concentration.html      # 用語説明：保有集中（例）

    i18n/                            # 多言語（Phase 2で導入：まずJA/EN）
      ja.json                        # 日本語UI文言辞書
      en.json                        # 英語UI文言辞書

    assets/                          # 静的アセット
      img/                           # アイコン等
      css/                           # 必要ならCSS分割
      js/                            # 必要ならJS分割（api/render/utilなど）

    _headers                          # セキュリティ/キャッシュ/COOP等のHTTPヘッダ設定
    _redirects                        # ルーティング補助（/inspect/* → /inspect/index.html 等）

  functions/                         # Cloudflare Pages Functions（同一オリジン /api を作る）
    api/
      inspect.ts                      # Pages→Workersのプロキシ（UIは /api/inspect を叩くだけでOK）
      hello.ts                        # 疎通確認用（必要なら）
      health.ts                       # ヘルスチェック（必要なら）

  workers/                           # Cloudflare Workers（解析API本体：キャッシュ/レート制限/外部取得）
    src/
      index.ts                        # ルーティング入口（/api/inspect）
      inspect.ts                      # inspect本体（入力→取得→判定→整形）
      schema.ts                       # レスポンスJSONスキーマ定義（破壊的変更禁止の核）
      cache.ts                        # Cache API（TTL24h + stale方針）
      rate-limit.ts                   # 最小レート制限
      providers/
        etherscan.ts                  # ETH Explorer取得（キー/失敗理由の整形）
        bscscan.ts                    # BSC Explorer取得（キー/失敗理由の整形）
        common.ts                     # 共通HTTP/エラー正規化
      checks/
        sell_restriction.ts           # 判定①（例：売却制限シグナル）
        owner_privileges.ts           # 判定②（例：オーナー権限）
        mint_capability.ts            # 判定③（例：ミント権限）
        liquidity_lock.ts             # 判定④（Phase2で強化するならここ）
        holder_concentration.ts       # 判定⑤（可能な範囲で）
        contract_verification.ts      # 判定⑥
        trading_enable_control.ts     # 判定⑦
      explain/
        top-reasons.ts                # topReasons生成（初心者向けの“読める要点”を必ず出す）
        copy.ts                       # 文言テンプレ（初心者向け文章の集中管理：i18nと連携も可）
      utils/
        normalize.ts                  # chain/address正規化
        http.ts                       # fetchヘルパ・タイムアウト等
        safe-json.ts                  # JSON出力の安全化

    wrangler.toml                     # Workers設定（最小）
    package.json                      # Workers側依存（使う場合）
    tsconfig.json                     # TS設定（使う場合）

  codex/                              # Codex運用（タスク/手順/ルール）
    README.md                         # Codex実行の前提と手順
    tasks/
      task-00-rules.md                # タスク運用ルール
      task-01-setup-structure.md      # Phase1タスク
      ...                             # Phase2タスク群（Task 19〜 等、あなたの番号運用に合わせる）

  docs/                               # GitHub Pages（仕様/ログ/メモ公開：コードは基本置かない）
    index.md                          # docs入口（仕様・ログ・本体URLへのリンク）
    dev-log/
      index.md                        # 開発ログ一覧
      2026-....md                     # ログ本文
    specs/
      index.md                        # 仕様一覧
      spec-phase1-ja.md               # Phase1仕様（既存）
      roadmap-phase1-ja.md            # Phase1ロードマップ（既存）
      directory-tree-phase1-ja.md     # Phase1ディレクトリ図（既存）
      spec-phase2-ja.md               # Phase2仕様（新規）
      roadmap-phase2-ja.md            # Phase2ロードマップ（新規）
      directory-tree-phase2-ja.md     # Phase2ディレクトリ図（新規：この内容）
    assets/
      img/                            # docs用画像

  scripts/                            # 補助（任意：公開不要）
    smoke.sh                          # 3本テスト等の簡易スモーク（任意）

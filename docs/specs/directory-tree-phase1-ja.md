
* **ツール本体**：Cloudflare Pages で公開（＝GitHub Pages に載せない）
* **開発ログ（md）**：GitHub Pages で公開（＝`/docs` を公開ルートにするのが定石）

この場合、ルート直下に `log/app/docs/workers/scripts` を並べてもいいけど、**GitHub Pages が見るのは `/docs` だけ**に固定するのが安全で運用がラク。

---

## ディレクトリ構造（ツール=CF Pages / ログ=GitHub Pages）

```
token-scam-inspector/
  app/                      # ← Cloudflare Pages のビルド対象（静的ツール本体）
    index.html
    style.css
    app.js
    assets/
      ...

  workers/                  # ← Cloudflare Workers（API + cache）
    src/
    wrangler.toml

  docs/                     # ← GitHub Pages 公開ルート（開発ログ/仕様/メモだけ）
    index.md                # ログの入口（最新ログ、主要リンク）
    dev-log/
      index.md              # ログ一覧
      2025-12-25.md
      2025-12-26.md
      ...
    specs/
      index.md              # 仕様一覧
      mvp-spec-v1.1.md
      roadmap.md
      methodology.md        # 妥当性・表示方針など
    notes/
      competitors.md
      api-providers.md
    assets/
      img/

  scripts/                  # 任意：生成・整形・チェック用（公開不要）
    ...

  README.md                 # リポジトリの説明（GitHub上）
  LICENSE
```

### この構造が「最適」な理由

* GitHub Pages は **`/docs` だけ**を公開対象にできる（ログが漏れなく公開、余計なコードは出ない）
* Cloudflare Pages は `app/` をデプロイ対象にすればOK（ビルド不要の静的でもいける）
* Workers は `workers/` に隔離（デプロイも管理もしやすい）
* 将来、ログや仕様が増えても `docs/` 内で完結して破綻しない

---

## 運用ルール（短く）

* **Cloudflare Pages**：`app/` を Production ブランチからデプロイ（Root directory = `app`）
* **GitHub Pages**：Source を **`/docs`** に設定
* リンク導線：

  * GitHub Pages（ログ）側 `docs/index.md` に **Cloudflare Pages のツールURL** を貼る
  * ツール側（任意）に「Dev Log」リンクを置くなら GitHub Pages のURLを貼る

---

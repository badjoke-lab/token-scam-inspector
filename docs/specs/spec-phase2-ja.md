# Token Scam Inspector

## 仕様書（Phase 2 / 無料拡張・確定案 v1.1）

---

## 1. 目的と成功条件（Phase 2）

### 1.1 目的（Phase 2 で “価値” を出す定義）

Phase 1 で「動く」状態は成立したが、Phase 2 では以下を満たして **“分析として使える”** 状態にする：

1) **Evidence が追跡可能**（URL + 事実/値 で示せる）  
2) **high の乱発を止める**（誤爆を減らし、根拠があるときだけ high）  
3) **rate limit / upstream 障害でも止まらない**（stale返却 + 状態表示）  
4) **広い範囲で破綻していないことを担保**（検証セット固定）

### 1.2 Phase 2 完了条件（minimum bar / これを満たして「Phase 2 done」）

以下をすべて満たしたときに Phase 2 を完了とする：

- UI の表示順が **初心者ファーストの読む順番**で固定されている（summary/topReasons → checks → details/evidence/howToVerify → raw JSON は折りたたみ）。
- 結果を **共有可能な安定URL**（`/inspect/{chain}/{address}`）で再現できる。
- 失敗時でも **人間が読めるエラー理由**を JSON で返し、UI に表示できる（HTML を返さない）。
- キャッシュは 24h を基本とし、**stale を明示して返せる**（止まらないことを優先）。
- 既存の Phase 1 レスポンス形を壊さず、unknown を減らす方向でチェックを改善している（unknown は「未確認」であり「安全」ではない）。
- Guide ページと辞書ページ（7チェック分）が存在し、「なぜ重要か／どう確認するか」に到達できる。

---

## 2. スコープ / 非目標（Non-goals）

### 2.1 スコープ（Phase 2 で扱う範囲）

#### 対応チェーン（段階的追加・無制限追加は禁止）

- 既存：Ethereum（ERC-20）, BNB Smart Chain（BEP-20）
- 追加候補（優先順の例）：Polygon, Arbitrum, Optimism, Base など
- 追加条件（必須）
  - Explorer/Provider が無料枠で現実的に動く
  - rate limit 対策（キャッシュ/バックオフ/失敗時stale）が仕様で担保される
  - 検証セットに追加できること

#### 入力（Inputs）

- `GET /api/inspect?chain=...&address=...`
  - chain：対応チェーンのみ
  - address：コントラクトアドレス（形式エラーは input error として扱う）

#### 出力（Outputs）

- Phase 1 のレスポンス形を維持した JSON
- 追加は **互換性を壊さない範囲**でのみ許可（詳細は §5 互換性ルール）

### 2.2 非目標（Phase 2 でもやらないこと）

- 詐欺の断定（ verdict を出さない）
- 投資助言（売買・投資判断の推奨をしない）
- ブラックボックス数値スコア（点数化・ランキング化）
- 有料インフラ前提の構成（paid API / DB 必須化）
- 高頻度リアルタイム監視
- 全チェーン完全対応（無制限追加）

---

## 3. システム構成（Phase 2）

構成は Phase 1 と同じ：Pages（UI） + Workers（API） + Cache API（無料運営の要）。

Phase 2 では **以下を追加**する（ただし DB はまだ不要）：

- 検証セット（docsに固定）
- 共有ページ（`/inspect/{chain}/{address}`）
- Guide / 辞書ページ（危険サインの説明、SEO兼教育）

---

## 4. データソース方針と制限（無料運営前提）

### 4.1 データソース方針

- Explorer（Etherscan系 / Blockscout系 など）を一次情報源とする。
- トークン identity（name / symbol / decimals など）は RPC を **best-effort** で補完してよい。
- ただし、無料枠で壊れやすい依存は「取れなくても止まらない」設計を優先する。

### 4.2 失敗・制限の扱い（隠さない）

- rate limit / upstream 失敗 / API key 不足は、理由を JSON に明示する。
- 失敗を「無かったこと」にせず、unknown や error として説明可能に返す。

---

## 5. API仕様（Phase 2 固定 / 互換性最優先）

### 5.1 エンドポイント

- 既存：`GET /api/inspect?chain=...&address=...`
- 追加（UI用途）：`GET /api/health`（任意・簡易）  
  - 目的：Workers稼働確認、レート制限状態/バージョン確認（UIが壊れにくい）

※ Phase 2 でも **inspect 以外の高機能APIは増やさない**（無料運営の破綻防止）

### 5.2 レスポンス互換性ルール（最重要）

Phase 1 のレスポンス構造は維持し、**追加フィールドのみ許可**する。

- ✅ フィールド追加：OK
- ✅ `meta` 内の拡張：OK
- ✅ `checks[*]` に追加情報を増やす：OK
- ❌ 既存キーの削除・型変更：禁止（breaking change禁止）

### 5.3 Phase 2 で許可される追加（互換性を壊さない範囲）

以下の追加は Phase 1 互換を保ったまま導入してよい：

- `meta.stale: boolean`
  - stale キャッシュ返却時は `true`
- `result.token: { ... }`
  - token identity を best-effort で補完するための領域
- ヘッダー：`x-tsi-cache: HIT | MISS | STALE`
  - UI / 運用確認用の状態ヘッダー

---

## 6. キャッシュ設計（TTL 24h + stale 明示）

Phase 1 の方針（TTL 24h）を維持しつつ、**stale の状態を明示**して「分析として嘘をつかない」設計に寄せる。

### 6.1 キャッシュキー（固定）

```
inspect:{chain}:{address}:v{schemaVersion}
```

※ schemaVersion をキーに含め、将来の拡張でキャッシュ破壊が可能な状態を維持する。

### 6.2 TTL（固定）

- 24時間（原則維持）
- Phase 2 では fresh / stale / miss を区別して扱う（ヘッダーと `meta.stale` で表現）

### 6.3 stale 返却の優先ルール（必須・明文化）

レスポンスは次の優先順位で決定する：

1) upstream 成功 ＋ fresh 生成できた → **fresh を返す**
   - `meta.stale = false`
   - `x-tsi-cache: MISS`（新規生成時）または `HIT`（fresh cache）
2) upstream 失敗 ＋ stale cache が存在 → **stale を返す**
   - `meta.stale = true`
   - `x-tsi-cache: STALE`
3) upstream 失敗 ＋ stale cache なし → **ok:false のエラーJSONを返す**
   - `x-tsi-cache: MISS`

---

## 7. エラー分類（Error taxonomy / Task 22 で固定利用）

Phase 2 では「人間が読める」ことに加えて、UI/運用で扱いやすい **安定した error code** を定義する。

### 7.1 エラーコード（安定キー）

最低限、以下のコードをサポート対象とする：

- 入力系
  - `invalid_chain`
  - `invalid_address`
  - `missing_chain`
  - `missing_address`
- 上流/運用系
  - `missing_api_key`
  - `rate_limited`
  - `upstream_error`
  - `invalid_response`

### 7.2 エラー時のレスポンス原則

- エラー時も **必ず JSON を返す**（HTML を返さない）。
- `ok: false` とし、`error.code` に安定コード、`error.message` に人間向け説明を入れる。
- 可能であれば `error.details` に補助情報（provider / status など）を入れてよい（互換性を壊さない範囲）。

---

## 8. レスポンスJSON（Phase 2：拡張のみ、破壊禁止）

### 8.1 meta 拡張（推奨形）

```json
"meta": {
  "cached": true,
  "generatedAt": "ISO",
  "schemaVersion": 2,
  "stale": false,
  "cacheState": "fresh | stale | miss",
  "upstream": {
    "status": "ok | rate_limited | timeout | error | skipped",
    "provider": "etherscan | bscscan | ...",
    "note": "human readable"
  }
}
```

### 8.2 token identity（best-effort 追加領域）

```json
"result": {
  "token": {
    "name": "...",
    "symbol": "...",
    "decimals": 18,
    "totalSupply": "...",
    "source": "rpc | explorer | unknown"
  }
}
```

- `result.token` は best-effort とし、取得できない場合は省略または `unknown` を許容する。
- Phase 1 の `result` 構造は壊さない。

### 8.3 evidence の “追跡可能化”（Phase 2 の核）

Phase 1 では `evidence: string[]` だったが、Phase 2 では **UI表示を壊さず**、以下の形式も併用できるようにする：

- 互換維持：`evidence` は string[] のまま残す（既存UIを壊さない）
- 追加：`evidenceLinks`（構造化 evidence）

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

## 9. 判定ロジックと explainability（誤爆を止める規約）

### 9.1 high の条件（固定）

**high は “確認可能な根拠” があるときだけ**返す。

禁止例：

- 単語ヒットだけで high（例：blacklist 文字列がある → 即 high）

許可例：

- Explorer上の verified source から、具体的に該当関数/挙動が確認できる
- 特定の設定値（税率・制限）が数値として取得できる
- 明確な権限/役割が確認できる（owner/role + 変更可能な対象が具体）

### 9.2 warn / unknown の使い分け（固定）

- **unknown**：データが取れず確認不能（理由を必ず表示）
- **warn**：弱いシグナルはあるが断定できない（根拠URLを付ける）
- **ok**：確認した範囲で問題が見当たらない（ただし「安全」ではない）

### 9.3 7チェックの explainability ルール（Task 23 の目標）

- 目的は「unknown を減らす」ことよりも「誤爆を減らし、説明可能にする」ことを優先する。
- コメントや文字列リテラル由来の単純ヒットは誤検知になりやすいため、**best-effort で除去/低優先**にする。
- evidence / detail では「何のシグナルを検出したか」を具体的に書く（例：関数名、設定値、role 名、参照URL）。
  - 「Found pattern」だけの説明は禁止。
- 単一の弱いシグナルだけで overall を強く上げない（高判定の乱発を避ける）。

---

## 10. UX要件（初心者ファースト / mobile-first）

### 10.1 初心者ファーストの読む順番（固定）

表示順は必ず次の順番にする：

1) overall / summary / topReasons（最大3）
2) checks の一覧（short）
3) details（detail + evidenceLinks + howToVerify）
4) raw JSON（初期状態は非表示 / 折りたたみ）

### 10.2 unknown の説明（誤解を避ける注記）

- unknown は「未確認」を意味し、「問題ない」ことを意味しない。
- UI 上に「unknown = not confirmed（安全の意味ではない）」を明示する。

### 10.3 mobile-first（必須要件）

- 最小幅 360px で読み切れる構成を要件とする。
- 横スクロール前提のレイアウトや、装飾優先のUIは採用しない。

### 10.4 エラー表示（人間が次に行動できること）

- エラー時も画面が空にならないことを優先する。
- 可能なら「次に試すべきこと」（例：時間をおく / chain を確認）を短く添える。

---

## 11. 静的ページ要件（Task 26 の固定仕様）

Phase 2 では以下の静的ページを必須とする：

- Guide ページ：1本（使い方・読み方の導線）
- 辞書ページ：7本（各チェックに対応）
  - 各ページは minimum で以下を含む
    - meaning（何のシグナルか）
    - why it matters（なぜ重要か）
    - how to verify（どう確認するか）

---

## 12. 検証（Phase 2：少数例禁止）

### 12.1 検証セット（必須）

- チェーンごとに 50〜200 程度のアドレスセット（段階導入可）
- カテゴリ：bluechip / random / suspicious（既知 or ユーザー提供）
- docs に固定し、更新はPRで記録する

### 12.2 最低限のスモーク手順（必須）

- “このセットの先頭N件” を叩いて、レスポンス形が崩れてないことを確認できる手順を docs に固定

---

## 13. i18n と運用確認（Task 27–28 の固定方針）

### 13.1 i18n（Task 27）

- 辞書ベース（キー/値）の JA/EN 切替を採用する。
- まずは 2言語（JA/EN）のみを対象にする。
- 文言は「辞書に寄せる」ことを優先し、動的生成よりも保守性を重視する。

### 13.2 運用確認（Task 28）

- smoke check スクリプト（または手順）を用意し、壊れていないことを確認できる状態を維持する。
- README または運用メモに「無料枠で壊れやすい箇所」と「壊れたときの見え方」を明記する。

---

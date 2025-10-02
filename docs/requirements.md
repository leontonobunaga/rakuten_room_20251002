# 楽天ROOM自動投稿システム 要件定義書（完全版）

## 1. 目的

楽天ROOMに毎日最大100件のアイテムを安全（セーフ）かつ半自動〜全自動で投稿し、月数万円の利益を安定的に狙う運用システムを構築する。対象プラットフォームはWindowsのみとし、ブラウザ自動操作はNode.jsとPlaywrightを想定する。Chrome拡張機能は利用しない。オリジナル写真の使用は不可（既存画像の軽微な調整は将来的に検討）。売上データは月次で手動ダウンロードし、システムに取り込む（ETL）。

## 2. スコープ

### 2.1 含む範囲
- **収集**：楽天WebService（RWS）から売れ筋商品を自動リサーチする。
  - Ichiba Item Search（キーワード／価格／在庫／レビューなどでフィルタ）【<https://webservice.rakuten.co.jp>】
  - Ichiba Item Ranking（ジャンル別ランキングの取得）【<https://webservice.rakuten.co.jp>】
  - 必要パラメータ：applicationId（App ID）、affiliateId（任意）など【<https://webservice.faq.rakuten.net>】
- **選定／スコアリング**：優先ジャンル・NGワード・価格帯・レビュー閾値・在庫・ショップDeny／Allowで候補を絞り込み、スコアリングする。
- **コピー生成**：LLM AdapterでOpenAI／Claude／Gemini／自前（Llama等）を切替可能にし、投稿文を生成する。
- **投稿**：商品ページからROOM投稿画面に遷移し、タイトル／本文／ハッシュタグを自動入力する。
- **重複抑止**：DB（`posted.json`）とUI検知（「すでにコレしている商品です」）の二重判定で重複投稿を防ぐ。
- **運用**：セーフモードを既定とし（最終クリックは人間）、フルオートはオプションで許可する。
- **月次ETL**：売上CSVを手動でドロップフォルダに投入し、自動取り込みする。

### 2.2 含まない範囲
- RMS（出店者向け）操作
- 外部広告運用
- 画像生成
- Chrome拡張の配布

## 3. KGI / KPI

- **KGI**：月間利益 数万円を達成する。
- **KPI（一例）**：
  - 収集→候補化：毎日300件以上
  - 投稿：毎日100件上限、未投稿率＜5％（UI／DB重複で弾かれたものを除く）
  - クリック率／購入率／1投稿あたり収益、NGワード違反0件

## 4. 業務フロー（E2E）

1. **収集（RWS）**
   - キーワード／ジャンル／価格／在庫／レビュー条件で検索・ランキング取得（API：`IchibaItem/Search`、`IchibaItem/Ranking`）【<https://webservice.rakuten.co.jp>】
   - 注意：カラー／サイズはAPIで取得できないため、必要に応じてタグID検索を併用【<https://webservice.faq.rakuten.net>】
2. **選定**
   - NGワード／優先ジャンル／ショップDeny／Allow／レビュー・価格閾値でフィルタし、レビュー件数×平均やランキング重みなどでスコアを付与。
   - `posted.json`のキー（`shopCode:itemCode`）とCSV重複を排除。
3. **文面生成（LLM Adapter）**
   - 入力：商品名、レビュー情報、価格帯、注意語彙（薬機・景表）。
   - 出力：日本語140字前後、誇大・断定表現は不可、`#PR`は本文に含めず（ハッシュタグ側で付与）、最大160字。
   - ベンダー非依存：`provider=openai|anthropic|google|groq|local`で切替。
   - ポリシーフィルタ：NGワード・正規表現でブロック／置換（違反時は再生成またはテンプレ適用）。
   - キャッシュ：`copy_cache.json`（`itemCode`キー）。
4. **投稿**
   - 単一タブで商品ページを開き、「ROOMに投稿／コレ／紹介」ボタンをクリックしてROOM投稿画面へ遷移。
   - 投稿UI（タイトル／本文／タグ／投稿ボタン）を検知し、自動入力する。
   - セーフモード：最終投稿を人間がクリック。フルオート：自動クリック（ブラックアウト時間と日次上限を順守）。
   - UI重複：「すでにコレしている商品です」を検知した場合はDB登録のみ行い投稿処理をスキップ。
5. **運用**
   - 日次上限（例：100件）、投稿間隔（乱数＋ジッタ）、投稿禁止時間帯（例：0:00–6:00）。
   - 連続エラーしきい値で当日停止。
6. **月次ETL**
   - 売上CSVを`/drop`に手置きし、自動取り込み。列マッピングはYAMLで定義。

## 5. 機能要件（要点）

### 5.1 収集
- API：`IchibaItem/Search`、`IchibaItem/Ranking`（App ID必須、Affiliate ID任意）【<https://webservice.rakuten.co.jp>】
- 入力：`keywords[]`、`genre_ids[]`、`min/max_price`、`availability`、`min_review_count/average`、`exclude_keywords[]`
- スコアリング：ジャンル重み、レビュー重み、ランキング位置、価格帯合致

### 5.2 コピー生成
- LLM Adapterインターフェース：`generate({name, reviews, rating, hints}) -> {title, body, hashtags[]}`
- プロバイダ別実装（OpenAI Responses／Anthropic Messages／Google Gemini／Local（Ollama等））
- OpenAI推奨設定：Responses API／`gpt-4o-mini`から開始（コストと品質のバランス）【<https://platform.openai.com>】
- 将来的にはStructured Outputs（JSON Schema）で安全な構造化と長さ・語彙制限の保証を検討【<https://platform.openai.com>】

### 5.3 投稿（Playwright）
- 単一タブ運用：ポップアップが開いたら切り替え、旧タブを閉じる。
- コンソール入力に依存しない：ブラウザ内オーバーレイ（次へ／スキップ／終了）で人間承認を取得。
- UIセレクタは多候補＋iframe横断で堅牢化（`textarea`、`input[name='title']`、`button:has-text('投稿')`など）。
- UI重複検知：本文に「すでにコレしている…」が表示されたらDBに記録して次へ。

### 5.4 重複抑止
- DBキー：`{shopCode}:{itemCode}`（例：`seiu8:10005959`）。
- 投稿前：DBヒットでスキップ。投稿後：DBに登録。

### 5.5 ログ
- 構造化ログ（JSON lines）：`stage`（collect/select/generate/post）、`itemCode`、`action`、`result`、`latency`。

### 5.6 レポート
- 日次：投稿件数、スキップ理由内訳、重複件数、平均入力時間。
- 月次：ETLからクリック数／購入件数／売上／成果報酬を集計。

## 6. 非機能要件

- **性能**：1投稿のUI充填は3秒以内（画像読み込み待ちを除く）。日次100件で30分以内（セーフ運用の人間承認時間は別）。
- **信頼性**：エラー3回連続で当日停止。再開は次回起動時に継続。
- **可観測性**：エラー分類（ネットワーク／ログイン／セレクタ／LLM／レート制限）。
- **セキュリティ**：
  - APIキーは環境変数またはOSの資格情報ストアに保管。
  - `session.json`はWindows DPAPIでローカル暗号化。
  - ログに個人情報・秘密鍵を出力しない。

## 7. 設定ファイル（完全版サンプル）

```yaml
run:
  mode: safe                  # safe | auto
  headless: false
  daily_cap: 100
  min_interval_sec: 60
  max_interval_sec: 180
  jitter: 0.25
  blackout:
    - { start: "00:00", end: "06:00" }
  max_errors_per_hour: 3
  hard_stop_on_error: true

browser:
  channel: "chrome"           # or executable_path: "./browsers/chromium/chrome.exe"
  storage_state: "./data/session.json"

credentials:
  applicationId: "YOUR_RAKUTEN_APP_ID"    # RWS 必須（applicationId）
  affiliateId:  "YOUR_AFFILIATE_ID"       # 任意

sources:
  keywords: ["加湿器", "ワイヤレスイヤホン"]
  exclude_keywords: ["中古", "アウトレット"]
  genre_ids: ["100371", "558944"]          # 例
  min_price: 1000
  max_price: 30000
  min_review_count: 50
  min_review_average: 3.8
  availability_only: true

priority:
  genre_weights: { default: 1.0, "100371": 1.4, "558944": 1.3 }
  genre_quotas:  { default: 0, "100371": 30, "558944": 20, others: 50 }

shops:
  allowlist: []
  denylist: ["ng_shop_foo"]

policy:
  banned_terms: ["必ず","絶対","100%","副作用","治る","痩せる","クリックして"]
  banned_regex:
    - { id: yakki, pattern: "(痩せる|治る|完治|効果覿面|副作用なし)", severity: block }
  exceptions_terms: ["非医薬品","医薬部外品"]

copy:
  max_len: 160
  add_pr_tag: true
  variants_per_item: 3
  hashtag_presets: ["#おすすめ", "#楽天ROOM", "#PR"]

etl:
  enabled: true
  watch_dir: "./drop"
  schedule: monthly
  csv_mapping:
    item_code: "商品番号"
    clicks: "クリック数"
    purchases: "購入件数"
    revenue: "売上金額"
    points: "成果報酬"

llm:
  provider: "openai"          # openai | anthropic | google | groq | local
  openai:
    api_key: ""               # OPENAI_API_KEY を推奨（空なら環境変数を見る）
    model: "gpt-4o-mini"      # 実在モデルを使用
    mode: "responses"         # responses | chat
    temperature: 0.7
    max_tokens: 280
  anthropic:
    api_key: ""
    model: "claude-3-haiku"
  google:
    api_key: ""
    model: "gemini-1.5-flash"
  groq:
    api_key: ""
    model: "llama-3.1-70b-versatile"
  local:
    endpoint: "http://localhost:11434"     # Ollama等
    model: "llama3.1"
```

## 8. 受け入れ条件（サンプル）

1. 投稿：CSV上位3件でROOM投稿画面まで到達し、タイトル／本文／ハッシュタグが自動入力される。
2. 重複：UIで「すでにコレ…」が表示された商品は投稿せずDB登録される。
3. 制御：セーフモード時は最終投稿を人がクリックでき、フルオートでは自動投稿される。
4. 生成：LLMの本文は禁止語が除外され、`#PR`がタグに付与される（本文末付与ではなくハッシュタグ側）。
5. ログ：各商品で`stage=generate/post`の成功／失敗が記録される。

## 9. テスト計画

- **単体テスト**：
  - LLM Adapter（プロバイダごと）— モデル名誤り・キー未設定・タイムアウト・レート制限をモックで確認。
  - Policyフィルタ — NG語／例外語／長さ制御の検証。
  - RWS — キーワード／ジャンル／在庫／レビュー閾値の組み合わせ、ランキング取得（API疎通はサンドボックス＆レート制限に注意）【<https://webservice.rakuten.co.jp>】
- **結合テスト**：CSV→候補→生成→投稿（ダミー商品ページのUIで自動入力が成功すること）。
- **運用テスト**：ブラックアウト時間、日次上限、連続エラー停止、再起動時のレジューム。

## 10. リスクと対策

- **UI変更**：セレクタ多候補＋iframe横断・テキスト近傍探索で耐性を高め、定期的にメンテナンスを行う。
- **RWS制限**：App IDのレート制限、ランキング更新時刻の揺れに注意【<https://webservice.faq.rakuten.net>】。
- **ポリシー**：薬機・景表・誇大表現の静的チェックとLLMプロンプト制約で対応。
- **キー管理**：環境変数／Secret Managerで管理し、Gitへのコミットは禁止。

## 11. 他AIプロバイダへの切替時の実装ポイント

- LLM Adapterインターフェースは固定（`generate(input) -> {title, body, hashtags}`）。
- プロバイダ別の差分は1ファイル内に閉じ込める（例：`llm/openai.ts`、`llm/anthropic.ts`、`llm/google.ts`）。
- プロンプトは共通テンプレート（禁止語・分量・トーン）とし、出力はJSON（Structured出力相当）で正規化。
- タイムアウト／再試行は全プロバイダで統一（例：5秒×最大2回）。

## 12. 端末の [Enter/S/Q] が効かない対策

- コンソール入力を廃止し、ブラウザ内の固定オーバーレイのみで操作（次へ／スキップ／終了）。
- Playwright側で `page.addInitScript()` を用い、`window.__ROOM_DECISION` にクリック結果を書き込ませ、無限待機ポーリングで取得する。
- これにより端末やシェルの差異（PowerShell／TTY／Rawモード）を吸収する。

## 13. 最小是正アクション

1. モデル名の是正：`gpt-4o-mini`など実在モデルに変更（`llm.openai.model`）。【<https://platform.openai.com>】
2. エンドポイント統一：Responses API（SDKの`responses.create`）に切り替え。【<https://platform.openai.com>】
3. キーの読み込み：環境変数`OPENAI_API_KEY`を参照（`config.yaml`に空でも可）。【<https://platform.openai.com>】
4. コンソール入力の廃止：ブラウザ内オーバーレイのみで人の承認を取得する設計に変更。
5. NG語＆ハッシュタグ：本文末ではなくタグフィールドに`#PR`を付与（本文は純粋な説明文）。
6. DB重複＋UI重複の二重ガード：「既コレ」表示を検知したらDB登録して即スキップ。


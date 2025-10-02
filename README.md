# rakuten_room_20251002

楽天ROOMの自動投稿システムに関する要件定義書は[`docs/requirements.md`](docs/requirements.md)を参照してください。

## 開発環境のセットアップ

```bash
npm install
```

`.env`または環境変数でAPIキー等を設定し、`config/config.yaml`を`config/config.sample.yaml`からコピーして編集してください。

## アプリケーションの起動

```bash
npm start
```

設定ファイルの内容がバリデーションされ、基本情報がコンソールに出力されます。

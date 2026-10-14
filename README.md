# 退屈を、たおせ！

「退屈の化身」タ・イクツに気になるスキルを5つぶつけて倒すと、選んだスキルをもとに次に遊ぶゲームが見つかる、1画面のブラウザゲームです。

## 公開ページ

GitHub Pages で公開しています。`main` ブランチへの push で [.github/workflows/deploy-pages.yml](./.github/workflows/deploy-pages.yml) がデプロイします。

| ページ           | URL                                 | 内容                     |
| ---------------- | ----------------------------------- | ------------------------ |
| アプリケーション | https://baco16g.github.io/taikutsu/ | 「退屈を、たおせ！」本体 |

## ドキュメント

| 文書                                                           | 役割                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| [docs/product-spec.md](./docs/product-spec.md)                 | プロダクト仕様（目的、対象、中心となる流れ、やらないこと） |
| [docs/ux-spec.md](./docs/ux-spec.md)                           | 画面構成と、画面ごとの操作の決まり                         |
| [docs/architecture.md](./docs/architecture.md)                 | 実装構成（依存関係・状態遷移・主要シーケンス図、Mermaid）  |
| [docs/quality-targets.md](./docs/quality-targets.md)           | アクセシビリティ・パフォーマンスの目標と実測値             |
| [docs/development-workflow.md](./docs/development-workflow.md) | 企画の背景、データの作り方、推薦の仕組み、開発の進め方     |
| [docs/glossary.md](./docs/glossary.md)                         | 用語集                                                     |

## セットアップ

GitHub Actions のビルドは Node.js 22 で実行しています。

```sh
npm ci
```

## 主なコマンド

| コマンド                                  | 内容                                              |
| ----------------------------------------- | ------------------------------------------------- |
| `npm run dev`                             | 開発サーバーを起動                                |
| `npm run build`                           | 型チェック付きの本番ビルド（`dist/`）             |
| `npm run preview`                         | 本番ビルドをローカルで確認（`/taikutsu/` で配信） |
| `npm run lint` / `npm run lint:fix`       | ESLint                                            |
| `npm run format` / `npm run format:check` | Prettier                                          |
| `npm test`                                | Vitest（単体テスト）を1回実行                     |

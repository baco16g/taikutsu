# 退屈を、たおせ！

「退屈の化身」タ・イクツに気になるスキルを5つぶつけて倒すと、選んだスキルをもとに次に遊ぶゲームが見つかる、1画面のブラウザゲームです。

## 資料

- [アプリのしくみ（開発者以外の方向け）](docs/product-overview.md)
- [技術リファレンス（構成・設計・守るべき制約）](docs/architecture.md)

## 開発

GitHub Actions のビルドは Node.js 22 で実行しています。

```sh
npm ci
npm run dev          # 開発サーバー
npm run lint         # ESLint
npm test             # Vitest
npm run build        # 型チェック + 本番ビルド（dist/）
npm run preview      # 本番ビルドの確認（/taikutsu/ で配信）
npm run format:check # Prettier
```

`main` ブランチへの push で、GitHub Actions が GitHub Pages へデプロイします（[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)）。

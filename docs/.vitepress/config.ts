import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// GitHub Pages ではアプリを https://baco16g.github.io/taikutsu/ 、
// このサイトをその下の docs/ から配信する（.github/workflows/deploy-pages.yml で1つにまとめる）。
const appBase = '/taikutsu/'

export default withMermaid(
  defineConfig({
    lang: 'ja',
    title: '退屈を、たおせ！ Docs',
    description: '「退屈を、たおせ！」のプロダクト仕様・画面の振る舞い・実装構成のドキュメント',
    base: `${appBase}docs/`,
    cleanUrls: true,
    // favicon はアプリのものを共有する（ローカルの docs:preview ではアプリが同居しないため表示されない）。
    head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${appBase}favicon.svg` }]],
    themeConfig: {
      nav: [
        { text: 'トップ', link: '/' },
        { text: 'アーキテクチャ', link: '/architecture' },
        { text: 'アプリを開く', link: `https://baco16g.github.io${appBase}` },
      ],
      sidebar: [
        {
          text: 'ドキュメント',
          items: [
            { text: 'プロダクト仕様', link: '/product-spec' },
            { text: 'UX仕様', link: '/ux-spec' },
            { text: 'アーキテクチャ', link: '/architecture' },
            { text: '品質目標', link: '/quality-targets' },
            { text: '開発の進め方', link: '/development-workflow' },
            { text: '用語集', link: '/glossary' },
          ],
        },
      ],
      outline: { label: '目次' },
      docFooter: { prev: '前のページ', next: '次のページ' },
      socialLinks: [{ icon: 'github', link: 'https://github.com/baco16g/taikutsu' }],
    },
  }),
)

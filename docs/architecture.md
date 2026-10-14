# 技術リファレンス

コードレビュー用の資料です。アプリの構成、2026-10-14 のリファクタで何をなぜ変えたか、今後の変更で守るべき制約をまとめます。開発者以外の方向けの説明は [product-overview.md](product-overview.md) にあります。

根拠の確かさを、次の印で書き分けています。

- **【確認】** コードを読んで確かめ、テストまたはブラウザでの実行でも確かめたこと
- **【コード】** コードを読んで確かめたが、実行しての確認はしていないこと
- **【推測】** 根拠はあるが確かめきれていないこと
- **【提案】** 今後の改善案（今回は実施していない）

## 1. 全体像

- 1画面だけのブラウザゲームです。React 19、TypeScript、Vite 8 で作っています。アニメーションは GSAP 3（`@gsap/react` の `useGSAP`）、効果音は Tone.js、スタイルは CSS Modules（ファイルごとにクラス名を閉じ込める仕組み）を使います。
- 入口は [src/main.tsx](../src/main.tsx) → [src/App.tsx](../src/App.tsx) → [src/pages/HomePage.tsx](../src/pages/HomePage.tsx) です。ルートは `/` の1つだけです。
- サーバーとの通信はありません。スキルとゲームのデータは `data/*.json` をビルド時にバンドル（1つの JS ファイルへの同梱）しています。【確認】

## 2. リファクタ前の問題と、選んだ設計

| 問題（変更前）                                                                                                                                                                                                                      | 変更                                                                                                                                                                                                                                                                                                                                                                                                                            | 理由                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `HomePage.tsx`（315行）に、進行管理、イントロ画面と戦闘画面のマークアップ、読み上げ文、フォーカス制御が同居していた                                                                                                                 | イントロ画面を [IntroScreen](../src/features/intro/components/IntroScreen.tsx)、戦闘画面を [BattleScreen](../src/features/battle/components/BattleScreen.tsx) に切り出した。HomePage は機能どうしをつなぐことだけを担う（190行）                                                                                                                                                                                                | 画面ごとの見た目の変更と、進行ルールの変更とで、触るファイルを分けるため                   |
| 撃破〜ギャラリーの進行が `defeated`/`revealActive`/`showGallery` の3つの boolean と、二重処理防止・タイマー用の ref 2つに分かれていた                                                                                               | 進行段階 `SessionStage` 1つにまとめた（[homeSession.ts](../src/pages/homeSession.ts)）                                                                                                                                                                                                                                                                                                                                          | ありえない組み合わせ（例: ギャラリー表示中なのに未撃破）を状態として表せないようにするため |
| 着弾数を `hitSignal`・`impactCount`・`chosenMovesRef` の3か所で別々に数えていた                                                                                                                                                     | 着弾した技の配列 `landedMoves` 1つにまとめた。HP 表示、タ・イクツの被弾、推薦の入力をすべてここから導く                                                                                                                                                                                                                                                                                                                         | 同じ事実の持ち主を1つにするため                                                            |
| 何を表示し何を読み上げるかの条件が、JSX のあちこちに散らばっていた                                                                                                                                                                  | 純粋関数 `deriveSessionView(introPhase, stage)` にまとめ、ルール表としてテストした                                                                                                                                                                                                                                                                                                                                              | 表示ルールを React なしで読めて、テストもできるようにするため                              |
| `useCommandMenuInteraction` が16個の引数（DOM の ref 6つを含む）を受け取り、コンポーネントの中身を hook に移しただけになっていた                                                                                                    | DOM の ref は、それを直接操作する [useCommandMenuAnimation](../src/features/commandMenu/hooks/useCommandMenuAnimation.ts) が持つようにした。この hook は行番号で指示できる API（`revealList`/`glideBandTo`/`playAttack` など）を出す。[useCommandMenuInteraction](../src/features/commandMenu/hooks/useCommandMenuInteraction.ts) は DOM に触れず、カーソル・攻撃中の入力停止・タッチ端末の2回タップ判定だけを扱う（引数は7個） | 「何をするか（操作ルール）」と「どう見せるか（DOM の振り付け）」を分けるため               |
| `BattleStatus` がクリーチャー描画の `taikutsu` に、文言のない撃破演出 `DefeatMessage` が画面遷移の `reveal` に置かれていた                                                                                                          | 新しい `features/battle` に移した。`DefeatMessage` は中身に合わせて `DefeatDebris`（破片）に改名した                                                                                                                                                                                                                                                                                                                            | フォルダ名から中身を正しく推測できるようにするため                                         |
| `gallery` が `commandMenu` の `RawMove` 型を import し、同じ JSON を2か所で読み込んで、`as` で型を断定していた                                                                                                                      | JSON を読む場所を [src/catalog/](../src/catalog/) に集め、型もそこで定義した。断定（`as RawMove[]`/`as RawGame[]`）はなくした                                                                                                                                                                                                                                                                                                   | データの出どころを1か所にし、機能どうしの依存をなくすため                                  |
| 汎用の乱数生成器（PRNG）`mulberry32` が `taikutsu` の中にあり、`gallery` からも import されていた                                                                                                                                   | [src/lib/prng.ts](../src/lib/prng.ts) に移した                                                                                                                                                                                                                                                                                                                                                                                  | 複数の機能が使う汎用部品だから                                                             |
| 呼び出し元のない API（CommandMenu のイベント5種のうち4種、クリーチャー操作の `setHp`/`getHp`/`isAttacking`、`useCommandMenuController` の `reset`、`useMediaQuery`）と、実際には通らない分岐（選んだ技が0件のときの既定値）があった | 削除した                                                                                                                                                                                                                                                                                                                                                                                                                        | 読む量を減らし、使われていない約束を残さないため                                           |
| 実装と食い違うコメントがあった（「推薦は常に6件」など）                                                                                                                                                                             | 修正した。経緯を語るだけのコメントも整理した                                                                                                                                                                                                                                                                                                                                                                                    | コメントを信頼できる状態に戻すため                                                         |

## 3. 依存関係の変化

矢印は「import する側 → される側」です。

変更前の依存関係は次のとおりです。

```
pages → components, hooks, features/{commandMenu, gallery, intro, reveal, taikutsu}
features/gallery     → features/commandMenu（RawMove型）, features/taikutsu（PRNG）, hooks
features/intro       → features/taikutsu, hooks
features/commandMenu → hooks
features/taikutsu    → hooks
```

変更後は次のとおりです。

```
pages → components, hooks, features/{battle, commandMenu, gallery, intro, reveal, taikutsu}
features/battle      → features/commandMenu, features/taikutsu
features/intro       → features/taikutsu, hooks
features/commandMenu → catalog, hooks
features/gallery     → catalog, hooks, lib
features/taikutsu    → hooks, lib
```

- 機能どうしの import は、画面を組み立てる `battle`/`intro` から部品の `commandMenu`/`taikutsu` へ向かうものだけです。`gallery` は他の機能に依存しません。
- 循環依存はありません。【コード】
- `pages` は `commandMenu` の効果音 hook と型、`taikutsu` の型も直接使います（イントロのホバー音とタ・イクツの操作のため）。

## 4. ディレクトリ構成と各モジュールの責務

```
src/
  main.tsx, App.tsx            入口。ルートは `/` のみ（BrowserRouter の basename は Vite の BASE_URL）
  pages/
    HomePage.tsx               画面全体の進行。各機能をつなぎ、タ・イクツを1体だけ描画する
    homeSession.ts             進行段階 SessionStage、撃破後の待ち時間、表示と読み上げのルール（純粋関数）
  features/
    intro/                     イントロ画面と、イントロから戦闘位置への移動
      components/IntroScreen   見出し・紹介文・「たたかう」ボタン
      components/IntroActor    タ・イクツ本体を包む枠（位置・出現マスク・集まる粒）
      hooks/useIntroPhase      イントロのフェーズ管理と、目印（dock）への移動アニメーション
    battle/                    戦闘画面
      components/BattleScreen  見出し・HP表示・コマンドメニュー・撃破後の破片の配置。HP = 攻撃上限 − 着弾数
      components/BattleStatus  タ・イクツの名前とHPゲージ
      components/DefeatDebris  撃破後に残る破片の演出
    commandMenu/               スキルを選んで攻撃するメニュー
      hooks/useCommandMenuController   技の山札（表示中の6つ・使用済み・未表示）と攻撃回数
      hooks/useCommandMenuInteraction  カーソル、攻撃中の入力停止、タッチの2回タップ、矢印キー
      hooks/useCommandMenuAnimation    DOM の振り付け（選択帯・一覧の出現・アイコンの飛翔）とその DOM ref
      hooks/useCommandSound            効果音（Tone.js）
      lib/moves.ts                     山札から引く純粋関数、攻撃上限 ATTACK_LIMIT
    taikutsu/                  タ・イクツの描画（形・テクスチャ・被弾の変形・破片）
      data/creatureProfile.ts  肩書きと名前（イントロと戦闘の両方で表示）
    reveal/                    戦闘画面からギャラリーへの画面遷移（斜めのシート）
    gallery/                   ゲームのギャラリー（カルーセル・情報パネル・推薦）
      lib/recommend.ts         推薦ロジック（純粋関数）
  catalog/                     data/*.json を読む唯一の場所と、その型
  lib/prng.ts                  決まった数列を返す乱数生成器（mulberry32）
  hooks/                       機能をまたいで使う hook（メディアクエリ、ホバー可否、動きを減らす設定、canvas のサイズ合わせ）
  components/WorldFrame/       画面の枠と背景の装飾
  test/browserStubs.ts         テスト用に、jsdom にないブラウザ API を補うスタブ
```

## 5. 状態の持ち主・データの流れ・外部との境界

### 5.1 状態の持ち主

| 状態                                                                          | 持ち主                                       | 生存期間                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| サウンドのオン/オフ                                                           | `HomePage`                                   | ページを開いている間（保存しない）                   |
| イントロのフェーズ（`arrival`→`ready`→`depart`→`moving`→`settling`→`battle`） | `useIntroPhase`                              | 同上。再戦で `arrival` に戻る                        |
| 進行段階（`undefeated`→`defeated`→`covering`→`uncovering`→`gallery`）         | `HomePage`                                   | 同上。再戦で `undefeated` に戻る                     |
| 着弾した技の配列                                                              | `HomePage`                                   | 同上。再戦で空に戻る                                 |
| 山札・表示中の6つ・攻撃回数                                                   | `useCommandMenuController`（CommandMenu 内） | 戦闘画面が表示されている間。戦闘のたびに作り直される |
| カーソル位置・攻撃中フラグ・タッチの1回目の選択                               | `useCommandMenuInteraction`                  | 同上                                                 |
| タ・イクツの形（HP 段階）                                                     | `TaikutsuCreature`/`useCreatureAnimation`    | ページを開いている間。再戦で `reset()`               |
| ギャラリーの表示中の作品                                                      | `GameGallery`/`GalleryCarousel`              | ギャラリーが表示されている間                         |

HP の値は意図的に3つのタイミングで変わります。【確認】

1. HP ゲージ: アイコンがタ・イクツに届いた瞬間（`landedMoves` の長さ）
2. メニューの攻撃回数: 着弾処理が終わって次の6つを並べるとき（`commitAttack`）
3. タ・イクツの形: 被弾の変形（約0.5秒）が終わったとき（`onHpChange`）

撃破の判定は3を使います。着弾数から推測するのではなく、撃破のアニメーションが実際に終わったことを合図にしています。

### 5.2 1回の攻撃の流れ

1. スキルの行をクリックすると `useCommandMenuInteraction.confirmAttack` が呼ばれる（タッチ端末では同じ行の2回目のタップで呼ばれる）。入力を止め、攻撃音を鳴らす。
2. `useCommandMenuAnimation.playAttack` が、選択帯のバウンス → 90ms 後にアイコンを約0.4秒かけて飛ばす。
3. 着弾すると `onImpact(move)` が呼ばれ、`HomePage` の `landedMoves` に追加される。HP ゲージが減る。
4. `landedMoves` の長さが増えたことを effect が検知し、`creatureRef.current.attack()` でタ・イクツの被弾を1段階進める。
5. 着弾処理が終わると `onLanded` から `commitAttack` が呼ばれ、次の6つが並ぶ（5回目は並べずにメニューを終了状態にする）。
6. 5回目の被弾でタ・イクツが崩れきると `onHpChange(0)` が呼ばれ、`stage` が `defeated` になる。
7. 800ms 後（`DEFEAT_HOLD_MS`）に `covering` になり、`RevealTransition` がシートで画面を覆う。
8. 覆い終わると `onCovered` で `flushSync` を使って `uncovering` にし、ギャラリーへ差し替える。
9. シートが外れると `gallery` になり、ギャラリーの見出しにフォーカスを移す。

### 5.3 外部との境界

| 対象                 | 内容                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 同梱データ           | [data/specialMoves.json](../data/specialMoves.json)（スキル27種）と [data/gameIntros.json](../data/gameIntros.json)（ゲーム399件）。[src/catalog/](../src/catalog/) だけが import する。【確認】            |
| ゲーム画像           | 外部の販売サイトの画像URLに `?sw=880`（幅880px指定）を付けて `<img>` で読み込む。正面と隣の作品を先に読み、それが済んでから残りを読む。読み込みに失敗した作品は画像の代わりにゲーム名を表示する。【コード】 |
| 販売ページへのリンク | `target="_blank" rel="noopener noreferrer"` で別タブに開く。【コード】                                                                                                                                      |
| 効果音               | Tone.js でブラウザ内で合成する。音声ファイルはない。ブラウザの自動再生の制限により、ユーザーの操作のあとでだけ鳴る。既定はオフ。【コード】                                                                  |
| フォントと背景画像   | `public/` に同梱。見出し用フォントは使う8文字だけのサブセット。背景は OpenStreetMap をもとにした画像で、表示中は枠の左下にクレジットを出す。【コード】                                                      |
| 保存                 | localStorage・Cookie などには何も保存しない。再読み込みで最初から始まる。【確認】（`src` 内に該当 API の呼び出しがないことを検索で確認）                                                                    |
| 配信                 | `main` への push で GitHub Actions が GitHub Pages へデプロイする（[deploy-pages.yml](../.github/workflows/deploy-pages.yml)）。本番のパスは `/taikutsu/`。今回はデプロイの設定に触れていない。             |

## 6. 検討したが採らなかった案

- app/features/domain/shared の4層構造にする: このアプリは実質1画面です。層を増やすと、読む人が行き来するファイルが増えるだけなので、既存の `features/*` の構成を保ちました。
- 進行管理に `useReducer` や状態管理ライブラリを使う: 段階の遷移は4つの単純な `setStage` だけです。「何を表示するか」は純粋関数 `deriveSessionView` で十分に表せるため、仕組みを増やしませんでした。
- イントロのフェーズと進行段階を1つの状態にまとめる: `useIntroPhase` のフェーズは GSAP のアニメーションと密に結びついています。まとめると書き直しになり、振る舞いを保つ確認の範囲が広がりすぎるため見送りました。
- `useCommandMenuInteraction` をコンポーネントに戻す: CommandMenu が約300行に戻ります。そのため、ref の持ち主を振り付けの hook へ移す形を選びました。
- リサイズ時の帯の補正やアイドル明滅を、攻撃中フラグごと振り付けの hook に移す: フラグを ref ではなく state で渡すことになり、攻撃開始直後の判定タイミングが変わるため、見送りました。
- アイドル明滅がレンダーごとに再起動する問題を、関数の memo 化などで直す: 見た目の挙動が変わるため、今回は直さず既知の課題として記録しました（9.2）。
- 着弾時に effect を経由せず、その場でタ・イクツの `attack()` を呼ぶ: 被弾の開始が最大1フレーム早まり、挙動が変わります。effect による同期（React の状態に合わせて命令的なアニメーションを動かす）のまま残しました。
- 推薦に `docs/research/gameMoveAssociations.json` を使う: このファイルの `confidence` は `relevance` から機械的に導かれており、`grounds` は根拠の引用文で、点数ではありません。同梱している全ゲームについて、strong/medium の組は `data/gameIntros.json` と一致します（差の約70件は、同梱していないゲームの分）。判断材料が増えないのに約644KB を配信することになるため、使っていません。以前はこの理由がコードのコメントに長く書かれていたため、ここへ移しました。
- 見出しの小さな英字（`.eyebrowText`）の CSS を共有ファイルにする: 3行の宣言のために CSS Modules の境界をまたぐより、[IntroScreen.module.css](../src/features/intro/components/IntroScreen.module.css) と [BattleScreen.module.css](../src/features/battle/components/BattleScreen.module.css) に1つずつ持つ方が単純なので、そうしました。

## 7. 今後の変更で守るべき制約

- タ・イクツは `HomePage` で1体だけ描画します。各画面は立ち位置の目印（`creatureDockRef`）だけを持ちます。画面の中で描画すると切り替えのたびに再マウントされ、呼吸の動きやテクスチャが途切れます。
- 戦闘画面のセクションは `position: static` のままにします（[HomePage.module.css](../src/pages/HomePage.module.css) の `.battleSection`）。BattleScreen の各要素は World Container を基準に絶対配置され、`useIntroPhase` も同じ要素を基準に目印の位置を測っています。
- `RevealTransition` の `onCovered` の中では、ギャラリーへの差し替えを `flushSync` で同期的に commit します。シートはこの呼び出しが戻った直後に外れ始めます。
- 「5」という数はまとめて変えます。攻撃上限 `ATTACK_LIMIT`（[moves.ts](../src/features/commandMenu/lib/moves.ts)）、タ・イクツの形の段階 `HP_SHAPES`（[shapeStates.ts](../src/features/taikutsu/lib/shapeStates.ts)、HP5〜0）、推薦の strong-tie 枠 `STRONG_TIE_TARGET`（[recommend.ts](../src/features/gallery/lib/recommend.ts)）、イントロの文言「スキルを5つ選んで」（[introCopy.ts](../src/features/intro/data/introCopy.ts)）、ヒット音の5段階（[useCommandSound.ts](../src/features/commandMenu/hooks/useCommandSound.ts)）は連動しています。これをコードで強制する仕組みはありません。【提案】一致をテストで確かめることを勧めます。
- 着弾が1つ増えるごとに `attack()` を1回呼びます。`attack()` は前の被弾の変形が終わるまで新しい被弾を受け付けません（9.1）。
- フォーカスの移動先の id（`intro-battle-title`、`gallery-heading-title`）と、スクロールを止める対象の目印 `data-scroll-root` は変えません。`HomePage` と `RevealTransition` が参照しています。
- `HomePage.module.css` は `WorldFrame` より後に読み込みます。`.galleryWorld` は WorldFrame の枠の高さを上書きするため、CSS の順序に依存しています（`HomePage.tsx` の import の順で決まります）。
- データの整合性を保ちます。`relatedMoves` の `moveId` は `specialMoves.json` に存在する必要があります（ないと推薦時に例外）。各スキルの id には [moveIcons.tsx](../src/features/commandMenu/data/moveIcons.tsx) のアイコンが必要です（ないと読み込み時に例外）。
- 見出しの文言を変えたら、フォントのサブセットを作り直します（[src/index.css](../src/index.css) のコメント参照）。
- 本番ビルドと `vite preview` のパスは `/taikutsu/` です（[vite.config.ts](../vite.config.ts)）。
- `useGSAP` の `contextSafe()` は呼ぶたびに新しい関数を返します。これに依存する effect は毎レンダー再実行されます。

## 8. 検証

### 8.1 自動チェック

| チェック               | 変更前                                                        | 変更後                                       |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| `npm run lint`         | 成功                                                          | 成功                                         |
| `tsc -b`（型チェック） | 成功                                                          | 成功                                         |
| `npm test`             | 44件成功                                                      | 62件成功                                     |
| `npm run build`        | 成功（チャンク500kB超の警告あり。JS 1,133.15kB、CSS 25.93kB） | 成功（同じ警告。JS 1,132.65kB、CSS 26.07kB） |
| `npm run format:check` | 成功                                                          | 成功                                         |

追加したテストは次の3つです。

- [CommandMenu.test.tsx](../src/features/commandMenu/components/CommandMenu.test.tsx): ホバー端末は1クリックで攻撃、タッチ端末は同じ行の2回目のタップで攻撃、別の行へ移ると1回目の選択が解除される、矢印キーで先頭と末尾を行き来する、「ほかのスキルを見る」で攻撃回数を使わずに6つが入れ替わる、5回で入力を受け付けなくなる。リファクタの前に書き、変更前のコードで成功することを確かめてから変更しました。
- [HomePage.test.tsx](../src/pages/HomePage.test.tsx): 動きを減らす設定で、イントロ→5回着弾でHPが減る→撃破の読み上げ→ギャラリーの表示と見出しへのフォーカス→再戦でイントロに戻る、までを実時間で通します。これもリファクタの前に書きました。
- [homeSession.test.ts](../src/pages/homeSession.test.ts): フェーズと段階ごとの表示・操作可否・読み上げのルール表。

### 8.2 ブラウザでの確認（Playwright、Chromium、開発サーバー＝StrictMode あり）

- 通しフローの比較: 乱数を固定した状態で、次の観測結果を記録し、ダイジェスト（SHA-256）で前後を比べました。デスクトップ（1440×900）、スマホ幅（390×844）、動きを減らす設定の3通りで、すべて変更前と一致しました。
  - 操作: イントロ→「たたかう」→矢印キー→「ほかのスキルを見る」→5回攻撃→撃破→ギャラリーで次の作品へ→再戦
  - 記録した値: 各時点のテキスト、読み上げ文、フォーカスの位置、HP、表示された技、推薦された10作品
- レイアウトの比較: 画面上の全要素（SVG・canvas・aria-hidden の中を除く）について、位置、寸法、表示方法、フォント、色、z-index、aria 属性を記録しました。イントロ・戦闘・撃破・ギャラリーの4画面 × 2つの画面幅のすべてで、変更前と一致しました。
- 撃破後の待ち時間: 撃破の読み上げから画面遷移が始まるまでを3回ずつ測りました。変更前は 799〜815ms、変更後は 810〜819ms で、計測の粒度（約16ms）の範囲内です。
- 連続攻撃: 9.1の不具合は、変更前と変更後の両方で同じように再現しました（直していないことの確認）。
- コンソールに出る警告（`AudioContext was not allowed to start` が2件、GSAP の `Invalid scope` が4件）は、変更前と同じです。
- 本番ビルド: `vite preview` で `/taikutsu/` から配信し、イントロからギャラリーまで進めること、コンソールにエラーが出ないこと、見出しフォントと背景画像が読み込まれることを確認しました。

### 8.3 確認できていないこと

- 実機のタッチ端末での操作（2回タップの判定は jsdom のテストで確認しただけ）
- スクリーンリーダーでの実際の読み上げ（DOM の属性と読み上げ用テキストは確認済み）
- Safari と Firefox での表示
- 効果音が実際に鳴ること（ブラウザでの確認はサウンドをオフのまま行った）
- GitHub Pages へデプロイした状態（ローカルでのビルドと `vite preview` までは確認）
- ゲーム画像の読み込みに失敗したときの表示
- 画面遷移の途中でのウィンドウサイズの変更、途中で動きを減らす設定を切り替えた場合

## 9. 既知の課題（今回は直していない）

### 9.1 素早い連続攻撃で撃破に進めなくなる

- 再現【確認】: ボタンが再び押せるようになった瞬間に、プログラムから次の行をクリックし続けました（約0.5秒間隔）。HP は 0/5 になりますが、撃破もギャラリーへの移動も起きません。約1.3秒間隔で操作した場合は正常でした。
- 原因【コード】: `TaikutsuCreature` の `attack()` は前の被弾の変形（約0.6秒）が終わるまで新しい被弾を無視します（[useCreatureAnimation.ts](../src/features/taikutsu/hooks/useCreatureAnimation.ts) の `attack` の冒頭）。無視された分は取り戻されないため、タ・イクツの形が HP0 に届かず、撃破の判定（`onHpChange(0)`）が来ません。
- 人の手でこれが起きるには、次の一覧が表示され始めてから約0.1秒以内にクリックする必要があります。【推測】
- 【提案】直し方は2通り考えられます。受け付けなかった被弾を順番に再生する方法と、変形が終わるまで次の攻撃を受け付けない方法です。どちらにするかは、ゲームとしてどう振る舞うべきかの判断が必要です。

### 9.2 選択帯のアイドル明滅がレンダーのたびにやり直しになる

【コード】CommandMenu の `contextSafe()` が毎回新しい関数を返すため、明滅の effect が毎レンダー再実行されます。コメントの意図（一度開始したら続ける）とは食い違いますが、見た目への影響は目視で確かめていません。リファクタでは挙動を保つため、そのまま残しています。

### 9.3 山札のシャッフルがレンダーのたびに実行される

【コード】`useCommandMenuController` の `useRef(createShuffledPool())` は、レンダーのたびに山札をシャッフルします。結果は最初の1回分しか使われず、残りは捨てられます。実害は小さいものの、無駄な処理です。

### 9.4 推薦テストの一部が存在しないスキル id を使っている

[recommend.test.ts](../src/features/gallery/lib/recommend.test.ts) の「別の組み合わせなら結果が変わる」テストは、存在しないスキル id（C02・C08・C19）を含む組み合わせを使っています。テストは通りますが、実質2つのスキルでしか確かめていません。

### 9.5 開発時のコンソールに GSAP の `Invalid scope` 警告が出る

【推測】`useGSAP` に渡す scope の ref が、最初のレンダーの時点ではまだ空であることが原因と考えられます。動作への影響は確認されていません。

### 9.6 バンドルサイズの警告

JS バンドルが約1.1MB（gzip 後で約340KB）あり、Vite が警告を出します。主な原因は同梱している `data/gameIntros.json`（約457KB）です。【推測】

import type { Icon } from '@phosphor-icons/react'
import {
  GhostIcon,
  SkullIcon,
  ArrowClockwiseIcon,
  ShuffleIcon,
  PuzzlePieceIcon,
  SwordIcon,
  HouseIcon,
  CampfireIcon,
  CookingPotIcon,
  StorefrontIcon,
  MagnifyingGlassIcon,
  MagicWandIcon,
  UsersIcon,
  BombIcon,
  LightningIcon,
  TrophyIcon,
  HeartIcon,
  EnvelopeIcon,
  PathIcon,
  MusicNotesIcon,
  BrainIcon,
  FireIcon,
  ConfettiIcon,
  KeyIcon,
  WrenchIcon,
  DoorOpenIcon,
  PlantIcon,
} from '@phosphor-icons/react'

/** Semantic icon per move id (see `data/specialMoves.json` for each move's playExperience). */
export const MOVE_ICONS: Record<string, Icon> = {
  C01: GhostIcon, // シャドウステップ: 気配を消す
  C03: SkullIcon, // ナイトメアサバイブ: 恐怖から生き延びる
  C04: ArrowClockwiseIcon, // ワンモアトライ: 何度も挑む
  C05: ShuffleIcon, // マップシャッフル: 毎回変わる迷路
  C06: PuzzlePieceIcon, // シナジークラフト: 組み合わせの発見
  C07: SwordIcon, // ジャイアントスレイヤー: 強大な敵と戦う
  C09: HouseIcon, // マイランドクラフト: 拠点・まちづくり
  C10: CampfireIcon, // サバイバルクラフト: 荒野で生き延びる
  C11: CookingPotIcon, // クックマスター: 料理
  C12: StorefrontIcon, // ドリームショップ: 店・施設の経営
  C13: MagnifyingGlassIcon, // トゥルースハント: 手がかりを探す
  C15: MagicWandIcon, // フォームチェンジ: 姿を変える
  C16: UsersIcon, // ツインリンク: 二人で進む
  C17: BombIcon, // ホードクラッシュ: 大群をなぎ倒す
  C18: LightningIcon, // スピードダッシュ: 駆け抜ける
  C20: TrophyIcon, // コンプリートハント: 揃える達成感
  C21: HeartIcon, // ハートコネクト: 絆を深める
  C22: EnvelopeIcon, // ラブレター: 想いを伝える
  C23: PathIcon, // ディシジョンロード: 選んだ道を進む
  C24: MusicNotesIcon, // ビートシンク: リズムに合わせる
  C25: BrainIcon, // マインドゲーム: 読み合い
  C27: FireIcon, // カオスブレイク: 大暴れ
  C28: ConfettiIcon, // ワイワイフェス: みんなで盛り上がる
  C29: KeyIcon, // トリックアンロック: 仕掛けを解き明かす
  C30: WrenchIcon, // マイマシンチューン: マシンを仕立てる
  C33: DoorOpenIcon, // エリアオープナー: 行ける場所が増える
  C35: PlantIcon, // スローライフデイズ: のんびり日課を重ねる
}

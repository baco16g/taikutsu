import { useCallback, useEffect, useRef } from 'react'
import * as Tone from 'tone'

interface Synths {
  move: Tone.Synth
  attack: Tone.MembraneSynth
  hit: Tone.NoiseSynth
  /** `hit`のノイズに重ねる音程付きアクセント — ノイズの音色だけ
   * （当初の5バリアント案）では小さなスピーカーでは「盛り上がっている」
   * ことが伝わりにくいと分かった。上がっていく音程の方がはるかに
   * 読み取りやすい合図なので、今はこちらが盛り上がりを担い、ノイズ層は
   * その下に質感を足すだけの役割になっている。 */
  hitTone: Tone.Synth
}

/** 1発分のヒットが持つノイズの音色/エンベロープ/音量/長さと、その上に
 * 重ねる音程付きのアクセント音 — 共有のsynthインスタンスへトリガー直前に
 * 値を上書きする（バリアントごとにsynthを用意するより軽く、Tone.jsの
 * synthはトリガー間でパラメータを自由に差し替えられる設計になっている）。
 * ランダムではなく、戦闘5回の攻撃を通じて盛り上がる順（静か/短い/低い →
 * 大きい/長い/高い=とどめの一撃）に並んでおり、これにより「タ・イクツが
 * 弱っていっている」ことが伝わる。 */
interface HitVariant {
  noiseType: 'white' | 'pink' | 'brown'
  decay: number
  volume: number
  duration: string
  tone: string
}

const HIT_VARIANTS: HitVariant[] = [
  { noiseType: 'white', decay: 0.08, volume: -14, duration: '32n', tone: 'C5' },
  { noiseType: 'white', decay: 0.11, volume: -12, duration: '16n', tone: 'D5' },
  { noiseType: 'pink', decay: 0.15, volume: -10, duration: '16n', tone: 'E5' },
  { noiseType: 'pink', decay: 0.19, volume: -8, duration: '8n', tone: 'G5' },
  { noiseType: 'brown', decay: 0.26, volume: -5, duration: '8n', tone: 'C6' },
]

/** ATTACK_LIMIT=5で実際に使われる技は、1戦ごとに低音域スケール上の
 * 別々の音へ、スロット位置（rerollのたびに変わる）ではなく技自身のidから
 * 決定的に割り当てられる——同じ技は常に同じ音になり、同じ一覧内の
 * 別々の技が同じ音になることはまずない。あくまでMembraneSynthの低音域に
 * 収めているので、メロディーではなく「ドスン」という音の高さ違いとして
 * 聞こえる。 */
const ATTACK_NOTES = ['C2', 'D2', 'E2', 'G2', 'A2', 'C3', 'D3', 'E3']

function hashToIndex(id: string, length: number): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return hash % length
}

/**
 * Tone.jsによる3種類の短い電子音（カーソル移動/攻撃/ヒット）。
 * ブラウザの自動再生ポリシーにより、Tone.start()は実際のユーザー操作の
 * コールスタック内（クリック/keydownハンドラ）でしか成功しない。失敗は
 * 全て握りつぶす: サウンドは戦闘フローの上に乗る演出であり、その
 * 依存先では決してない。
 */
export function useCommandSound(enabled: boolean) {
  const synthsRef = useRef<Synths | null>(null)
  const startedRef = useRef(false)

  const ensureStarted = useCallback(async () => {
    if (startedRef.current) return
    try {
      await Tone.start()
      startedRef.current = true
    } catch {
      // まだユーザー操作がない、またはオーディオが利用不可 — 無音のままにする。
    }
  }, [])

  const ensureSynths = useCallback((): Synths => {
    if (synthsRef.current) return synthsRef.current
    const move = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    }).toDestination()
    move.volume.value = -16

    const attack = new Tone.MembraneSynth({
      octaves: 3,
      envelope: { attack: 0.001, decay: 0.22, sustain: 0 },
    }).toDestination()
    attack.volume.value = -6

    const hit = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
    }).toDestination()
    hit.volume.value = -10

    // 'triangle'にしている（move自身の波形'square'でもMembraneSynth
    // （attackのもの）でもなく）— hitのノイズバーストと一緒に鳴ったときに
    // 埋もれない、3つ目の独立した音色にするため。
    const hitTone = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
    }).toDestination()
    hitTone.volume.value = -14

    synthsRef.current = { move, attack, hit, hitTone }
    return synthsRef.current
  }, [])

  useEffect(
    () => () => {
      synthsRef.current?.move.dispose()
      synthsRef.current?.attack.dispose()
      synthsRef.current?.hit.dispose()
      synthsRef.current?.hitTone.dispose()
      synthsRef.current = null
    },
    [],
  )

  const safePlay = useCallback(
    (fn: (s: Synths) => void) => {
      if (!enabled) return
      void (async () => {
        await ensureStarted()
        if (!startedRef.current) return
        try {
          fn(ensureSynths())
        } catch {
          // 再生の失敗が戦闘フローを止めることは絶対にあってはならない。
        }
      })()
    },
    [enabled, ensureStarted, ensureSynths],
  )

  const playMove = useCallback(
    () => safePlay((s) => s.move.triggerAttackRelease('E6', '32n')),
    [safePlay],
  )
  /** `moveId`からATTACK_NOTESの中のこの技自身の音を選ぶ（同じ技なら
   * 毎回同じ音、別の技が同じ音になることはまずない）——指定なしの場合は
   * 元の固定音'C2'にフォールバックする（例えば手元に特定の技がない
   * 呼び出し元向け）。 */
  const playAttack = useCallback(
    (moveId?: string) =>
      safePlay((s) => {
        const note = moveId ? ATTACK_NOTES[hashToIndex(moveId, ATTACK_NOTES.length)] : 'C2'
        s.attack.triggerAttackRelease(note, '8n')
      }),
    [safePlay],
  )
  /** `attackNumber`は戦闘自身の1〜5のカウント（CommandMenuの
   * `payload.attackNumber`）——範囲外や未指定の場合は例外を投げず最後
   * （最も大きい）バリアントにフォールバックする。音選びのためだけに
   * ヒットフローを壊すようなことがあってはならないため。ノイズ
   * バースト（質感）と音程付きトーン（実際に聞こえる盛り上がりの合図）は
   * 毎回のヒットで同時に鳴る。 */
  const playHit = useCallback(
    (attackNumber?: number) =>
      safePlay((s) => {
        const variant =
          HIT_VARIANTS[(attackNumber ?? HIT_VARIANTS.length) - 1] ??
          HIT_VARIANTS[HIT_VARIANTS.length - 1]
        s.hit.noise.type = variant.noiseType
        s.hit.envelope.decay = variant.decay
        s.hit.volume.value = variant.volume
        s.hit.triggerAttackRelease(variant.duration)
        s.hitTone.triggerAttackRelease(variant.tone, variant.duration)
      }),
    [safePlay],
  )

  return { playMove, playAttack, playHit }
}

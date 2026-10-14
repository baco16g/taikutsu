import { useCallback, useEffect, useRef } from 'react'
import * as Tone from 'tone'

interface Synths {
  move: Tone.Synth
  attack: Tone.MembraneSynth
  hit: Tone.NoiseSynth
  /** The pitched accent layered on top of `hit`'s noise — noise color
   * alone (the original 5-variant design) turned out too subtle to read
   * as "escalating" through small speakers; a rising pitch is a far more
   * legible cue, so it carries the escalation now and the noise layer
   * just adds texture underneath it. */
  hitTone: Tone.Synth
}

/** One hit's own noise color/envelope/volume/length, plus the pitched
 * accent note layered on top — mutated onto the shared synth instances
 * just before they trigger (cheaper than one synth per variant, and
 * Tone.js synths are built to have their own params reassigned freely
 * between triggers). Ordered to escalate across a battle's 5 attacks
 * (quiet/short/low → loud/long/high for the KO hit) rather than picked at
 * random, so the escalation reads as "タ・イクツ is wearing down." */
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

/** The ATTACK_LIMIT=5 moves a battle actually uses each cycle through a
 * different point in a low-register scale, picked deterministically from
 * the move's own id (not its slot position, which changes every reroll) —
 * the same move always sounds the same, but two different moves in the
 * same list are very unlikely to sound alike. Kept in MembraneSynth's own
 * low range so this still reads as "a thud," just a differently-pitched
 * one, not a melody. */
const ATTACK_NOTES = ['C2', 'D2', 'E2', 'G2', 'A2', 'C3', 'D3', 'E3']

function hashToIndex(id: string, length: number): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return hash % length
}

/**
 * Three short electronic blips (cursor move / attack / hit) via Tone.js.
 * Tone.start() only ever runs inside a real user-gesture call stack (a
 * click/keydown handler), per the browser autoplay policy, and every
 * failure is swallowed: sound is a layer on top of the battle flow, never
 * a dependency of it.
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
      // No user gesture yet, or audio is unavailable — stays silent.
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

    // 'triangle', not 'square' (move's own waveform) or MembraneSynth
    // (attack's) — a third, distinct timbre so this doesn't get lost
    // against either of them when it fires alongside hit's noise burst.
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
          // Playback failure must never interrupt the battle flow.
        }
      })()
    },
    [enabled, ensureStarted, ensureSynths],
  )

  const playMove = useCallback(
    () => safePlay((s) => s.move.triggerAttackRelease('E6', '32n')),
    [safePlay],
  )
  /** `moveId` picks this skill's own note out of ATTACK_NOTES (same move
   * → same note every time; different moves are very unlikely to land on
   * the same one) — omit it to fall back to the original fixed 'C2', e.g.
   * for a caller that doesn't have a specific move in hand. */
  const playAttack = useCallback(
    (moveId?: string) =>
      safePlay((s) => {
        const note = moveId ? ATTACK_NOTES[hashToIndex(moveId, ATTACK_NOTES.length)] : 'C2'
        s.attack.triggerAttackRelease(note, '8n')
      }),
    [safePlay],
  )
  /** `attackNumber` is the battle's own 1-5 count (CommandMenu's
   * `payload.attackNumber`) — out-of-range or omitted falls back to the
   * last (loudest) variant rather than throwing, since a stray call here
   * should never be able to break the hit flow over a sound choice. The
   * noise burst (texture) and pitched tone (the actually-audible escalation
   * cue) fire together on every hit. */
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

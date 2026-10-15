import { describe, expect, it } from 'vitest'
import type { IntroPhase } from '../features/intro/hooks/useIntroPhase'
import { ANNOUNCEMENTS, deriveSessionView, type SessionStage } from './homeSession'

describe('deriveSessionView', () => {
  it.each<[IntroPhase, boolean, boolean, boolean]>([
    // phase, showIntro, showBattleSection, introInert
    ['arrival', true, false, false],
    ['ready', true, false, false],
    ['depart', true, false, true],
    ['moving', false, true, true],
    ['settling', false, true, true],
    ['battle', false, true, true],
  ])('in intro phase %s: intro=%s, battle section=%s, intro inert=%s', (phase, ...expected) => {
    const view = deriveSessionView(phase, 'undefeated')
    expect([view.showIntro, view.showBattleSection, view.introInert]).toEqual(expected)
  })

  it.each<[SessionStage, boolean, boolean, boolean]>([
    // stage, defeated, revealActive, showGallery
    ['undefeated', false, false, false],
    ['defeated', true, false, false],
    ['covering', true, true, false],
    ['uncovering', true, true, true],
    ['gallery', true, false, true],
  ])('at stage %s: defeated=%s, reveal=%s, gallery=%s', (stage, ...expected) => {
    const view = deriveSessionView('battle', stage)
    expect([view.defeated, view.revealActive, view.showGallery]).toEqual(expected)
  })

  it('accepts battle input only once the creature has arrived and no reveal is running', () => {
    expect(deriveSessionView('settling', 'undefeated').battleInert).toBe(true)
    expect(deriveSessionView('battle', 'undefeated').battleInert).toBe(false)
    expect(deriveSessionView('battle', 'defeated').battleInert).toBe(false)
    expect(deriveSessionView('battle', 'covering').battleInert).toBe(true)
    expect(deriveSessionView('battle', 'gallery').battleInert).toBe(false)
  })

  it('announces arrival, defeat and the gallery, and stays silent during the intro', () => {
    expect(deriveSessionView('arrival', 'undefeated').announcement).toBe('')
    expect(deriveSessionView('moving', 'undefeated').announcement).toBe('')
    expect(deriveSessionView('battle', 'undefeated').announcement).toBe(ANNOUNCEMENTS.appeared)
    for (const stage of ['defeated', 'covering', 'uncovering'] as const) {
      expect(deriveSessionView('battle', stage).announcement).toBe(ANNOUNCEMENTS.defeated)
    }
    expect(deriveSessionView('battle', 'gallery').announcement).toBe(ANNOUNCEMENTS.galleryShown)
  })

  it('announces the load failure instead of the gallery when the gallery could not be loaded', () => {
    expect(deriveSessionView('battle', 'uncovering', true).announcement).toBe(
      ANNOUNCEMENTS.defeated,
    )
    expect(deriveSessionView('battle', 'gallery', true).announcement).toBe(
      ANNOUNCEMENTS.galleryFailed,
    )
  })
})

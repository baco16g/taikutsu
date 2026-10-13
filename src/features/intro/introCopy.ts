/**
 * Intro screen copy, centralized so editing it never means hunting through
 * JSX. `body`'s entries are each an array of line segments (same shape as
 * `title`, joined with <br/> by HomePage.tsx) rather than a single string —
 * deliberately breaking at a phrase boundary (the comma) regardless of the
 * container's width, instead of leaving the wrap point to whatever the
 * browser's natural reflow lands on, which drifted between 1 line and an
 * awkward mid-phrase 2-line break as the window resized.
 */
export const INTRO_COPY = {
  eyebrow: 'PLAY OUTSIDE THE LINES.',
  title: ['退屈を、', 'たおせ！'],
  body: [
    ['気になるスキルを5つ選んで、', 'タ・イクツをたおそう！'],
    ['選んだスキルから、', '次に遊ぶゲームを見つけよう。'],
  ],
  cta: 'たたかう',
  creatureKicker: '退屈のかたまり',
  creatureName: 'タ・イクツ',
}

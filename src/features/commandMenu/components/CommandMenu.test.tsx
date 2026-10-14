import { createRef } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installBrowserStubs } from '../../../test/browserStubs'
import { ATTACK_LIMIT, VISIBLE_COUNT } from '../lib/moves'
import { CommandMenu } from './CommandMenu'

// reducedMotion=trueでは攻撃の飛翔が同期的に完了するため、クリック1回で
// 「確定→着弾→次の6つ」までが1回のact()の中で進む。
function renderMenu({ hover }: { hover: boolean }) {
  installBrowserStubs({ hover, reducedMotion: true })
  const onImpact = vi.fn<(move: { id: string; name: string }) => void>()
  render(
    <CommandMenu
      targetRef={createRef<HTMLElement>()}
      soundEnabled={false}
      reducedMotion
      onImpact={onImpact}
    />,
  )
  return { onImpact }
}

function skillButtons() {
  return within(screen.getByRole('list', { name: 'スキルコマンド' })).getAllByRole('button')
}

function skillName(button: HTMLElement) {
  // 行内のspanは「番号」「技名+説明の包み」「技名」「説明」の順に並ぶ。
  return button.querySelectorAll('span')[2].textContent
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('CommandMenu', () => {
  it('shows six skills and lands a hit with the clicked skill on hover-capable devices', () => {
    const { onImpact } = renderMenu({ hover: true })
    const buttons = skillButtons()
    expect(buttons).toHaveLength(VISIBLE_COUNT)
    const chosenName = skillName(buttons[2])

    fireEvent.click(buttons[2])

    expect(onImpact).toHaveBeenCalledTimes(1)
    expect(onImpact.mock.calls[0][0].name).toBe(chosenName)
    // 使った技は次の6つに二度と現れない。
    const nextNames = skillButtons().map(skillName)
    expect(nextNames).toHaveLength(VISIBLE_COUNT)
    expect(nextNames).not.toContain(chosenName)
  })

  it('needs a second tap on the same row before attacking on touch devices', () => {
    const { onImpact } = renderMenu({ hover: false })

    fireEvent.click(skillButtons()[0])
    expect(onImpact).not.toHaveBeenCalled()

    // 別の行へカーソルが移ると、1回目のタップの選択は解除される。
    fireEvent.focus(skillButtons()[1])
    fireEvent.click(skillButtons()[0])
    expect(onImpact).not.toHaveBeenCalled()

    fireEvent.click(skillButtons()[0])
    expect(onImpact).toHaveBeenCalledTimes(1)
  })

  it('wraps keyboard focus between the first and last rows', () => {
    renderMenu({ hover: true })
    const list = screen.getByRole('list', { name: 'スキルコマンド' })

    fireEvent.keyDown(list, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(skillButtons()[VISIBLE_COUNT - 1])

    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(skillButtons()[0])
  })

  it('swaps all six skills on reroll without spending an attack', () => {
    const { onImpact } = renderMenu({ hover: true })
    const before = skillButtons().map(skillName)

    fireEvent.click(screen.getByRole('button', { name: 'ほかのスキルを見る' }))

    const after = skillButtons().map(skillName)
    expect(after).toHaveLength(VISIBLE_COUNT)
    expect(after.some((name) => before.includes(name))).toBe(false)
    expect(onImpact).not.toHaveBeenCalled()
  })

  it('stops accepting input after the attack limit is reached', () => {
    const { onImpact } = renderMenu({ hover: true })

    for (let i = 0; i < ATTACK_LIMIT; i += 1) fireEvent.click(skillButtons()[0])
    expect(onImpact).toHaveBeenCalledTimes(ATTACK_LIMIT)

    for (const button of skillButtons()) expect(button.hasAttribute('disabled')).toBe(true)
    expect(
      screen.getByRole('button', { name: 'ほかのスキルを見る' }).hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.click(skillButtons()[0])
    expect(onImpact).toHaveBeenCalledTimes(ATTACK_LIMIT)
  })
})

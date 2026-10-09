import { act } from 'react'
import { expect } from 'vitest'
import { waitForUi } from './waitForUi'

/** A mouse press as a browser sends it. Ariakit's Select opens on mousedown and picks on mouseup, so `.click()` alone
    neither opens a Select nor picks from it. */
export async function pointerClick(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
	})
}

/** Opens a Select from its trigger and picks the option with exactly this name. */
export async function pickOption(trigger: HTMLElement, name: string) {
	await pointerClick(trigger)
	const option = await waitForUi(() => {
		const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((el) => el.textContent === name)
		expect(found).toBeDefined()
		return found!
	})
	await pointerClick(option)
}

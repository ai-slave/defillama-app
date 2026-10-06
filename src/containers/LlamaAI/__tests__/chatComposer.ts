import { act } from 'react'
import { expect } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'

/**
 * The composer a reader can type into. While the landing hands over to the conversation, an inert copy of the
 * landing composer stays on screen for its exit animation; it is skipped.
 */
export function liveComposer() {
	return [...document.querySelectorAll<HTMLTextAreaElement>('form textarea')].find((input) => !input.closest('[inert]'))
}

/** The composer's Stop button, shown while an answer streams. */
export const stopButton = () =>
	[...document.querySelectorAll('form button')].find((button) => button.textContent === 'Stop')

export const waitForComposer = () =>
	waitForUi(() => {
		const input = liveComposer()
		expect(input).toBeDefined()
		return input!
	})

/** Types `text` into the composer and submits its form, as Enter or the send button does. */
export async function sendFromComposer(text: string) {
	const input = await waitForComposer()
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, text)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await submitComposer()
}

/** Submits what the composer holds, as Enter or the send button does. */
export async function submitComposer() {
	const input = await waitForComposer()
	await act(async () => {
		input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
}

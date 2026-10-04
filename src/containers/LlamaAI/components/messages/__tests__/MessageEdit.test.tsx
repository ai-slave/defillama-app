// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Message } from '~/containers/LlamaAI/types'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { MessageBubble } from '../MessageBubble'

const session = installSubscriberSession('reader', { resolved: true })
const message: Message = { id: 'm1', role: 'user', content: 'What is the TVL of Aave?' }
let root: Root
let host: HTMLDivElement
beforeEach(() => {
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})

const button = (name: string) =>
	[...host.querySelectorAll('button')].find((el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name)!

async function startEditing(onEditMessage: () => Promise<void>) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<MessageBubble message={message} sessionId="s1" isLatest onEditMessage={onEditMessage} />
			</session.Wrapper>
		)
	)
	await act(async () => button('Edit message').click())
	const field = host.querySelector('textarea')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
			field,
			'What is the TVL of Uniswap?'
		)
		field.dispatchEvent(new Event('input', { bubbles: true }))
	})
	return field
}

test('Escape closes the editor and hands focus back to Edit message', async () => {
	const field = await startEditing(vi.fn())
	await act(async () => field.focus())
	await act(async () => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
	expect(host.querySelector('textarea')).toBeNull()
	expect(document.activeElement).toBe(button('Edit message'))
})

test('a saved edit closes the editor and hands focus back to Edit message', async () => {
	const onEditMessage = vi.fn(async () => {})
	await startEditing(onEditMessage)
	const save = button('Save')
	await act(async () => save.focus())
	await act(async () => save.click())
	expect(onEditMessage).toHaveBeenCalledWith('m1', 'What is the TVL of Uniswap?', message)
	expect(host.querySelector('textarea')).toBeNull()
	expect(document.activeElement).toBe(button('Edit message'))
})

// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ArticleAuthorProfile } from '../../types'
import { AuthorProfileForm } from '../AuthorProfileForm'

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))
const session = installSubscriberSession('author')

const profile: ArticleAuthorProfile = {
	id: 'profile-1',
	pbUserId: 'author',
	slug: 'sam',
	displayName: 'Sam',
	bio: 'Covers lending.',
	socials: {},
	createdAt: '',
	updatedAt: ''
}

let root: Root
let container: HTMLDivElement
let save: Promise<Response>
beforeEach(() => {
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({
		[`${FEATURES_SERVER}/article-authors/me`]: (_url: URL, init?: RequestInit) =>
			init?.method === 'PATCH' ? save : { author: profile }
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const field = (label: string) =>
	[...container.querySelectorAll('label')]
		.find((entry) => entry.textContent?.startsWith(label))!
		.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!

async function type(target: HTMLInputElement | HTMLTextAreaElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')!.set!.call(target, value)
		target.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('typing while a save runs keeps what was typed, unsaved, once the save lands', async () => {
	const held = Promise.withResolvers<Response>()
	save = held.promise
	await act(async () =>
		root.render(
			<session.Wrapper>
				<AuthorProfileForm />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(field('Display name').value).toBe('Sam'))
	await type(field('Display name'), 'Sam Lee')
	await act(async () => container.querySelector('form')!.requestSubmit())
	await type(field('About you'), 'Covers lending and stablecoins.')
	await act(async () => held.resolve(Response.json({ author: { ...profile, displayName: 'Sam Lee' } })))
	await waitForUi(() => expect(container.textContent).not.toContain('Saving…'))
	expect(field('Display name').value).toBe('Sam Lee')
	expect(field('About you').value).toBe('Covers lending and stablecoins.')
	expect(container.textContent).toContain('Unsaved changes')
})

test('a save with no edits during it shows the saved profile as saved', async () => {
	save = Promise.resolve(Response.json({ author: { ...profile, displayName: 'Sam Lee' } }))
	await act(async () =>
		root.render(
			<session.Wrapper>
				<AuthorProfileForm />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(field('Display name').value).toBe('Sam'))
	await type(field('Display name'), 'Sam Lee')
	await act(async () => container.querySelector('form')!.requestSubmit())
	await waitForUi(() => expect(container.textContent).toContain('All changes saved'))
	expect(field('Display name').value).toBe('Sam Lee')
})

test('adding and removing custom links keeps focus in the links section', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<AuthorProfileForm />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(field('Display name').value).toBe('Sam'))
	const press = (button: HTMLElement) =>
		act(async () => {
			button.focus()
			button.click()
		})
	const buttonNamed = (text: string) =>
		[...container.querySelectorAll<HTMLElement>('button')].find((button) => button.textContent?.trim() === text)!

	await press(buttonNamed('+ add custom link'))
	expect(document.activeElement).toBe(container.querySelector('input[placeholder="kind"]'))

	await press(container.querySelector<HTMLElement>('button[aria-label^="Remove custom link"]')!)
	expect(container.querySelector('input[placeholder="kind"]')).toBeNull()
	expect(document.activeElement).toBe(buttonNamed('Add a custom link'))

	await press(buttonNamed('Add a custom link'))
	expect(document.activeElement).toBe(container.querySelector('input[placeholder="kind"]'))
})

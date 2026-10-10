// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { fieldErrorOf } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DashboardAuthorProfileCard } from '../DashboardAuthorProfileCard'
import type { PublicDashboardAuthor } from '../types'

// The upload button pulls in the article editor stack; nothing here asserts on it.
vi.mock('~/containers/Articles/upload/ImageUploadButton', () => ({ ImageUploadButton: () => null }))

const session = installSubscriberSession('ada')

const profile: PublicDashboardAuthor = {
	slug: 'ada',
	displayName: 'Ada Lovelace',
	bio: 'Writes about analytical engines.',
	avatarUrl: '',
	socials: { twitter: 'https://x.com/ada' },
	createdAt: '2025-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
} as PublicDashboardAuthor

let container: HTMLDivElement
let root: Root
let respond: () => Response

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	respond = () => Response.json({ author: profile })
	session.serve({ '/authors/me': () => respond() })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardAuthorProfileCard />
			</session.Wrapper>
		)
	)
}

async function type(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

const saves = () => session.requests.filter((request) => request.init?.method === 'PATCH')

async function renderLoaded() {
	await render()
	await waitForUi(() => expect(inputValues()).toContain('ada'), { timeout: 1000 })
	const inputs = [...container.querySelectorAll<HTMLInputElement>('input')]
	return {
		displayName: inputs.find((input) => input.value === 'Ada Lovelace')!,
		handle: inputs.find((input) => input.value === 'ada')!
	}
}

function inputValues() {
	return Array.from(container.querySelectorAll('input')).map((input) => input.value)
}

describe('the dashboard author profile card', () => {
	test('a failed load shows the error card instead of spinning forever, and Try again loads the form', async () => {
		respond = fixtureStatus(500, { error: 'nope' })
		await render()
		await waitForUi(
			() => expect(container.querySelector('[role="alert"]')?.textContent).toBe("Couldn't load your profile."),
			{ timeout: 1000 }
		)
		const tryAgain = [...container.querySelectorAll('button')].find((button) => accessibleName(button) === 'Try again')!

		respond = () => Response.json({ author: profile })
		await act(async () => tryAgain.click())
		await waitForUi(() => expect(inputValues()).toContain('ada'), { timeout: 1000 })
	})

	test('the form opens on the loaded profile', async () => {
		await render()
		await waitForUi(() => expect(inputValues()).toEqual(expect.arrayContaining(['Ada Lovelace', 'ada'])), {
			timeout: 1000
		})
		expect(container.querySelector('textarea')?.value).toBe('Writes about analytical engines.')
	})

	test('a handle takes dashes as they are typed', async () => {
		const { handle } = await renderLoaded()
		// Each keystroke is its own input event, so the dash must survive before the next letter arrives.
		await type(handle, 'ada-')
		expect(handle.value).toBe('ada-')
		await type(handle, 'ada-l')
		expect(handle.value).toBe('ada-l')
	})

	test('saving says what is wrong under each field, focuses the first and sends nothing', async () => {
		const { displayName, handle } = await renderLoaded()
		await type(displayName, ' ')
		await type(handle, 'ada-')
		const save = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Save profile')!
		await act(async () => save.focus())
		await act(async () => save.click())

		expect(fieldErrorOf(displayName)).toBe('Enter a display name.')
		expect(fieldErrorOf(handle)).toBe('Enter a handle that ends with a letter or number.')
		expect(document.activeElement).toBe(displayName)
		expect(saves()).toHaveLength(0)
		await type(displayName, 'Ada')
		expect(displayName.hasAttribute('aria-invalid')).toBe(false)
	})
})

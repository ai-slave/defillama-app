// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
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

function inputValues() {
	return Array.from(container.querySelectorAll('input')).map((input) => input.value)
}

describe('the dashboard author profile card', () => {
	test('a failed load shows the error card instead of spinning forever', async () => {
		respond = fixtureStatus(500, { error: 'nope' })
		await render()
		await waitForUi(() => expect(container.textContent).toContain('Profile could not be loaded.'), { timeout: 1000 })
	})

	test('the form opens on the loaded profile', async () => {
		await render()
		await waitForUi(() => expect(inputValues()).toEqual(expect.arrayContaining(['Ada Lovelace', 'ada'])), {
			timeout: 1000
		})
		expect(container.querySelector('textarea')?.value).toBe('Writes about analytical engines.')
	})
})

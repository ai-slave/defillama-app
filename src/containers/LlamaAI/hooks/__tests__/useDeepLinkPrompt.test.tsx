// @vitest-environment happy-dom

import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useDeepLinkPrompt } from '~/containers/LlamaAI/hooks/useDeepLinkPrompt'
import {
	setPendingEntrySource,
	setPendingPageContext,
	setPendingPrompt,
	setPendingSuggestedFlag
} from '~/containers/LlamaAI/pendingPrompt'
import { installUmamiSink } from '~/utils/testing/umamiSink'

const track = installUmamiSink()

const options = vi.hoisted(() => ({
	isNewChat: true,
	sharedSession: false,
	deepLinkPrompt: undefined as string | undefined,
	utmSource: null as string | null,
	utmCampaign: null as string | null,
	clearDeepLinkFromUrl: vi.fn(),
	submitPrompt: vi.fn()
}))

let api: ReturnType<typeof useDeepLinkPrompt>

const committed: Array<string | null> = []

function Harness() {
	api = useDeepLinkPrompt({
		isNewChat: options.isNewChat,
		sharedSession: options.sharedSession,
		deepLinkPrompt: options.deepLinkPrompt,
		utmSource: options.utmSource,
		utmCampaign: options.utmCampaign,
		clearDeepLinkFromUrl: options.clearDeepLinkFromUrl,
		submitPrompt: options.submitPrompt
	})
	// Recorded after commit, so a value the effect corrects afterwards is still caught.
	useLayoutEffect(() => {
		committed.push(api.confirmationPrompt)
	})
	return null
}

describe('useDeepLinkPrompt', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		localStorage.clear()
		options.isNewChat = true
		options.sharedSession = false
		options.deepLinkPrompt = undefined
		options.utmSource = null
		options.utmCampaign = null
		options.clearDeepLinkFromUrl.mockReset()
		options.submitPrompt.mockReset()
		committed.length = 0
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	async function mount() {
		await act(async () => root.render(<Harness />))
		// The hook takes the handover one task after mount.
		await act(async () => new Promise((resolve) => setTimeout(resolve)))
	}

	test('submits a pending floating-button prompt without opening the modal', async () => {
		setPendingPrompt('from floating button')
		setPendingPageContext({ route: '/protocol/aave' })
		setPendingSuggestedFlag()
		await mount()

		expect(options.submitPrompt).toHaveBeenCalledWith({
			prompt: 'from floating button',
			pageContext: { route: '/protocol/aave' },
			isSuggestedQuestion: true
		})
		expect(api.confirmationPrompt).toBeNull()
	})

	test('asks before running a shareable deep-link prompt', async () => {
		options.deepLinkPrompt = 'what is tvl'
		await mount()

		expect(api.confirmationPrompt).toBe('what is tvl')
		expect(options.submitPrompt).not.toHaveBeenCalled()

		act(() => api.confirm())

		expect(options.submitPrompt).toHaveBeenCalledWith({ prompt: 'what is tvl', entrySource: 'deep-link' })
		expect(options.clearDeepLinkFromUrl).toHaveBeenCalled()
		expect(api.confirmationPrompt).toBeNull()
		expect(track.mock.calls.map(([event]) => event)).toEqual(['llamaai-deeplink-view', 'llamaai-deeplink-run'])
	})

	// A pending prompt outranks the link, and the banner must not flash over the answer while the url
	// change lands.
	test('a pending prompt supersedes a deep link without showing its banner', async () => {
		setPendingPrompt('from floating button')
		options.deepLinkPrompt = 'what is tvl'
		await mount()

		// Not just at the end: the banner must never reach the screen, not even for the commit before
		// the effect settles precedence. Asserted on what was committed, not how many times.
		expect(committed.filter((value) => value !== null)).toEqual([])
		expect(api.confirmationPrompt).toBeNull()
		expect(options.clearDeepLinkFromUrl).toHaveBeenCalled()
		expect(options.submitPrompt).toHaveBeenCalledWith({ prompt: 'from floating button' })
	})

	// The queue and the link can both arrive after mount, so precedence cannot be settled once at
	// mount: the confirmation must never reach a commit even then.
	test('a pending prompt arriving with a later link still suppresses its banner', async () => {
		await mount()
		expect(api.confirmationPrompt).toBeNull()
		committed.length = 0

		setPendingPrompt('from floating button')
		options.deepLinkPrompt = 'later url'
		await mount()

		expect(committed.filter((value) => value !== null)).toEqual([])
		expect(options.submitPrompt).toHaveBeenCalledWith({ prompt: 'from floating button' })
	})

	test('a pending prompt keeps the entry point it came from, once, so funnels can tell a strip click from a typed question', async () => {
		setPendingPrompt('why is aave tvl down')
		setPendingEntrySource('entity-strip')
		await mount()

		expect(options.submitPrompt).toHaveBeenCalledWith({ prompt: 'why is aave tvl down', entrySource: 'entity-strip' })
		expect(localStorage.getItem('llamaai-pending-entry-source')).toBeNull()
	})

	test('a deep link run from a newsletter is attributed to its utm source so its bounce can be compared with shared chats', async () => {
		options.deepLinkPrompt = 'what is tvl'
		options.utmSource = 'newsletter'
		await mount()

		act(() => api.confirm())

		expect(options.submitPrompt).toHaveBeenCalledWith({ prompt: 'what is tvl', entrySource: 'newsletter' })
	})

	test('asks again when the same link comes back after a dismissal', async () => {
		options.deepLinkPrompt = 'what is tvl'
		await mount()
		act(() => api.dismiss())
		expect(api.confirmationPrompt).toBeNull()

		options.deepLinkPrompt = undefined
		await mount()
		options.deepLinkPrompt = 'what is tvl'
		await mount()

		expect(api.confirmationPrompt).toBe('what is tvl')
	})

	test('closes the banner for a link padded with whitespace', async () => {
		options.deepLinkPrompt = '  what is tvl  '
		await mount()
		expect(api.confirmationPrompt).toBe('  what is tvl  ')

		act(() => api.confirm())
		expect(options.submitPrompt).toHaveBeenCalledWith({ prompt: 'what is tvl', entrySource: 'deep-link' })
		expect(api.confirmationPrompt).toBeNull()
	})

	test('clears the url when the deep-link prompt is dismissed', async () => {
		options.deepLinkPrompt = 'what is tvl'
		await mount()

		act(() => api.dismiss())

		expect(options.submitPrompt).not.toHaveBeenCalled()
		expect(options.clearDeepLinkFromUrl).toHaveBeenCalled()
		expect(api.confirmationPrompt).toBeNull()
		expect(track).toHaveBeenLastCalledWith('llamaai-deeplink-dismiss', {
			source: null,
			campaign: null,
			prompt: 'what is tvl'
		})
	})
})

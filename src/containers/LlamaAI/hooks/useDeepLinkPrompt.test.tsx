// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeepLinkPrompt } from '~/containers/LlamaAI/hooks/useDeepLinkPrompt'

const pending = vi.hoisted(() => ({
	prompt: null as string | null,
	pageContext: null as { route: string } | null,
	suggested: false
}))

vi.mock('~/components/LlamaAIFloatingButton', () => ({
	consumePendingPrompt: () => {
		const prompt = pending.prompt
		pending.prompt = null
		return prompt
	},
	consumePendingPageContext: () => {
		const context = pending.pageContext
		pending.pageContext = null
		return context
	},
	consumePendingSuggestedFlag: () => {
		const suggested = pending.suggested
		pending.suggested = false
		return suggested
	}
}))

vi.mock('~/utils/analytics/umami', () => ({
	trackUmamiEvent: vi.fn()
}))

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
	return null
}

describe('useDeepLinkPrompt', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		pending.prompt = null
		pending.pageContext = null
		pending.suggested = false
		options.isNewChat = true
		options.sharedSession = false
		options.deepLinkPrompt = undefined
		options.utmSource = null
		options.utmCampaign = null
		options.clearDeepLinkFromUrl.mockReset()
		options.submitPrompt.mockReset()
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
	}

	it('submits a pending floating-button prompt without opening the modal', async () => {
		pending.prompt = 'from floating button'
		pending.pageContext = { route: '/protocol/aave' }
		pending.suggested = true
		await mount()

		expect(options.submitPrompt).toHaveBeenCalledWith('from floating button', { route: '/protocol/aave' }, true)
		expect(api.confirmationPrompt).toBeNull()
	})

	it('asks before running a shareable deep-link prompt', async () => {
		options.deepLinkPrompt = 'what is tvl'
		await mount()

		expect(api.confirmationPrompt).toBe('what is tvl')
		expect(options.submitPrompt).not.toHaveBeenCalled()

		act(() => api.confirm())

		expect(options.submitPrompt).toHaveBeenCalledWith('what is tvl')
		expect(options.clearDeepLinkFromUrl).toHaveBeenCalled()
		expect(api.confirmationPrompt).toBeNull()
	})

	it('clears the url when the deep-link prompt is dismissed', async () => {
		options.deepLinkPrompt = 'what is tvl'
		await mount()

		act(() => api.dismiss())

		expect(options.submitPrompt).not.toHaveBeenCalled()
		expect(options.clearDeepLinkFromUrl).toHaveBeenCalled()
		expect(api.confirmationPrompt).toBeNull()
	})
})

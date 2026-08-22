// @vitest-environment happy-dom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatLandingProps } from '~/containers/LlamaAI/components/ChatLanding'
import type { ConversationViewModel } from '~/containers/LlamaAI/components/ConversationView'

let mountCount = 0

vi.mock('~/containers/LlamaAI/components/ConversationView', () => ({
	ConversationView: () => {
		useEffect(() => {
			mountCount += 1
		}, [])
		return <textarea data-testid="composer" />
	}
}))

vi.mock('~/containers/LlamaAI/components/ChatLanding', () => ({
	ChatLanding: () => <div>landing</div>
}))

import { ChatSurface } from '~/containers/LlamaAI/components/ChatSurface'

describe('ChatSurface landing transition vs composer focus', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		mountCount = 0
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	it('preserves ConversationView and composer focus when the landing transition ends', async () => {
		const baseProps = {
			showLanding: false,
			animateConversationTransition: false,
			landingOverride: null,
			landingProps: {} as ChatLandingProps,
			conversationViewModel: {} as ConversationViewModel,
			conversationKey: 'conversation-0'
		}

		await act(async () => {
			root.render(<ChatSurface {...baseProps} animateLandingTransition={true} />)
		})
		expect(mountCount).toBe(1)
		const textarea = container.querySelector('[data-testid="composer"]') as HTMLTextAreaElement
		textarea.focus()
		expect(document.activeElement).toBe(textarea)

		await act(async () => {
			root.render(<ChatSurface {...baseProps} animateLandingTransition={false} />)
		})

		expect(mountCount).toBe(1)
		expect(container.querySelector('[data-testid="composer"]')).toBe(textarea)
		expect(document.activeElement).toBe(textarea)
	})
})

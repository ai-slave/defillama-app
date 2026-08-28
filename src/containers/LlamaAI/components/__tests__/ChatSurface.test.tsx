// @vitest-environment happy-dom

import { act, createRef, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatLandingProps } from '~/containers/LlamaAI/components/ChatLanding'
import type { ConversationViewModel } from '~/containers/LlamaAI/components/ConversationView'

let mountCount = 0

vi.mock('~/containers/LlamaAI/components/ConversationView', () => ({
	ConversationView: ({ viewModel }: { viewModel: ConversationViewModel }) => {
		useEffect(() => {
			mountCount += 1
		}, [])
		return <textarea data-testid="composer" ref={viewModel.promptInputRef} />
	}
}))

vi.mock('~/containers/LlamaAI/components/ChatLanding', () => ({
	ChatLanding: ({ promptInputRef }: ChatLandingProps) => (
		<textarea data-testid="landing-composer" ref={promptInputRef} />
	)
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

	it('keeps the shared promptInputRef attached to the conversation composer after the exit layer unmounts', async () => {
		// The landing and conversation composers share one promptInputRef in the real app.
		// Unmounting the landing-exit copy must not null it (React nulls refs on unmount).
		const promptInputRef = createRef<HTMLTextAreaElement>()
		const baseProps = {
			showLanding: false,
			animateConversationTransition: false,
			landingOverride: null,
			landingProps: { promptInputRef } as ChatLandingProps,
			conversationViewModel: { promptInputRef } as ConversationViewModel,
			conversationKey: 'conversation-0'
		}

		await act(async () => {
			root.render(<ChatSurface {...baseProps} animateLandingTransition={true} />)
		})
		const composer = container.querySelector('[data-testid="composer"]')
		expect(promptInputRef.current).toBe(composer)

		await act(async () => {
			root.render(<ChatSurface {...baseProps} animateLandingTransition={false} />)
		})

		expect(container.querySelector('[data-testid="composer"]')).toBe(composer)
		expect(promptInputRef.current).toBe(composer)
	})
})

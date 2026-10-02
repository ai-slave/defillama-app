// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
	consumePendingEntrySource,
	consumePendingPrompt,
	consumePendingSuggestedFlag
} from '~/containers/LlamaAI/pendingPrompt'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { DailyBrief } from '../api'
import { HomeDailyBrief } from '../HomeDailyBrief'
import sample from './sample.json'

const mocks = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: mocks.push }) }))
// The real sign-in dialog, without the wallet picker, Turnstile and third-party scripts it loads.
vi.mock('next/script', () => ({ default: () => null }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('~/containers/Subscription/Turnstile', () => ({ Turnstile: () => null }))

const track = installUmamiSink()
const brief = sample as DailyBrief

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.push.mockReset()
	sessionStorage.clear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(() => {
	act(() => root.unmount())
	container.remove()
})

const chipLabels = () =>
	[...container.querySelectorAll('button[aria-label^="Ask LlamaAI: "]')].map((b) => b.getAttribute('aria-label'))

describe('signed out', () => {
	const session = installSubscriberSession('visitor', { account: 'signed-out', resolved: true })

	test('a tap opens sign-in with the question, keeps the handoff, is counted, and credits the sign-up to the brief', async () => {
		act(() =>
			root.render(
				<session.Wrapper>
					<HomeDailyBrief brief={brief} />
				</session.Wrapper>
			)
		)
		act(() => (container.querySelector('button[aria-label^="Ask LlamaAI: "]') as HTMLButtonElement).click())
		await waitForUi(() =>
			expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
				'Sign in to ask for free: “What is the latest status of the Bitget hack?”'
			)
		)
		expect(mocks.push).not.toHaveBeenCalled()
		expect(localStorage.getItem('llamaai-pending-prompt')).toBe('What is the latest status of the Bitget hack?')
		expect(track).toHaveBeenCalledWith('llamaai-daily-brief-click', { signedIn: false })
		expect(sessionStorage.getItem('signup_source')).toBe('daily-brief')
	})
})

describe('HomeDailyBrief', () => {
	const session = installSubscriberSession('reader', { account: 'free', resolved: true })
	const draw = () =>
		act(() =>
			root.render(
				<session.Wrapper>
					<HomeDailyBrief brief={brief} />
				</session.Wrapper>
			)
		)

	test('chips are the first question of each of the first three sections, in order', () => {
		draw()
		expect(chipLabels()).toEqual([
			'Ask LlamaAI: What is the latest status of the Bitget hack?',
			"Ask LlamaAI: What's driving Sentora's TVL growth?",
			'Ask LlamaAI: Which chains drive the TVL decline?'
		])
		expect(container.textContent).not.toContain(brief.summary)
	})

	test('a signed-in chip hands its question to /ai/chat as a suggested daily-brief question', () => {
		draw()
		act(() => (container.querySelector('button[aria-label^="Ask LlamaAI: "]') as HTMLButtonElement).click())
		expect(consumePendingPrompt()).toBe('What is the latest status of the Bitget hack?')
		expect(consumePendingSuggestedFlag()).toBe(true)
		expect(consumePendingEntrySource()).toBe('daily-brief')
		expect(mocks.push).toHaveBeenCalledWith('/ai/chat')
	})

	test('opening the brief is counted for every visitor, not only those in the A/B test', async () => {
		draw()
		act(() => [...container.querySelectorAll('button')].find((b) => b.textContent === brief.headline)!.click())
		await waitForUi(() => expect(container.querySelector('[role="tablist"]')).not.toBeNull())
		expect(track).toHaveBeenCalledWith('llamaai-daily-brief-open', undefined)
	})

	const headerButton = () => container.querySelector<HTMLButtonElement>('header button')!
	const headline = () => [...container.querySelectorAll('button')].find((b) => b.textContent === brief.headline)!
	const tabs = () => [...container.querySelectorAll('[role="tab"]')] as Array<HTMLButtonElement>
	const panelLines = () =>
		[...container.querySelectorAll('[role="tabpanel"] li')].map((li) => li.querySelector('span')?.textContent)
	const titlesOf = (i: number) => brief.sections[i].bullets.map((b) => b.text)

	test('the header button expands the card to one tab per section, showing only the first section', async () => {
		draw()
		expect(headerButton().textContent).toBe('Read full brief · 5')
		expect(tabs()).toEqual([])
		act(() => headerButton().click())
		await waitForUi(() => expect(panelLines()).toEqual(titlesOf(0)))
		expect(tabs().map((t) => t.textContent)).toEqual(brief.sections.map((s) => s.title))
		expect(headerButton().getAttribute('aria-expanded')).toBe('true')
		expect(headerButton().textContent).toBe('Hide full brief')
	})

	test('the headline expands the card too, and collapses it again', async () => {
		draw()
		act(() => headline().click())
		await waitForUi(() => expect(tabs()).toHaveLength(brief.sections.length))
		act(() => headline().click())
		expect(tabs()).toEqual([])
	})

	test('selecting a tab shows that section’s lines and hides the others', async () => {
		draw()
		act(() => headline().click())
		act(() => tabs()[3].click())
		await waitForUi(() => expect(panelLines()).toEqual(titlesOf(3)))
		expect(container.textContent).not.toContain(brief.sections[0].bullets[0].text)
	})

	test('while expanded the chips hide, and a line in a later tab hands off its own question as daily-brief', async () => {
		draw()
		act(() => headline().click())
		expect(chipLabels()).toEqual([])
		act(() => tabs()[1].click())
		const row = await waitForUi(() => {
			const button = [...container.querySelectorAll('[role="tabpanel"] button')].find((b) =>
				b.textContent?.startsWith('-$570M from Steakhouse')
			)
			expect(button).toBeDefined()
			return button as HTMLButtonElement
		})
		act(() => row.click())
		expect(consumePendingPrompt()).toBe("Why did Steakhouse Financial's TVL drop?")
	})
})

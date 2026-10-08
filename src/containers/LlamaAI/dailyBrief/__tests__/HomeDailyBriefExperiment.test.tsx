// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getExperimentAttribute, getVariant } from '~/utils/analytics/experiment'
import { renderHydrated } from '~/utils/testing/hydration'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { DailyBrief } from '../api'
import { HomeDailyBrief } from '../HomeDailyBrief'
import sample from './sample.json'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const session = installSubscriberSession('reader', { account: 'free', resolved: true })
const ID = 'home-brief-default-v1'
const SEED_A = '00000000-0000-4000-8000-000000000000'
const SEED_B = '00000000-0000-4000-8000-000000000020'
const brief = sample as DailyBrief

let root: Root | null = null
let container: HTMLDivElement
const track = vi.fn()
const experimentCalls = () => track.mock.calls.filter(([name]) => String(name).startsWith('experiment-'))
let viewportWidth = 1440

const setVariantFor = (seed: string) =>
	document.documentElement.setAttribute(getExperimentAttribute(ID), getVariant(ID, seed))
const tabs = () => container.querySelectorAll('[role="tab"]')
const chips = () => container.querySelectorAll('button[aria-label^="Ask LlamaAI: "]')
const headerButton = () => container.querySelector<HTMLButtonElement>('header button')!

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	window.umami = { track } as unknown as typeof window.umami
	viewportWidth = 1440
	vi.spyOn(window, 'matchMedia').mockImplementation(
		(query) =>
			({
				matches: viewportWidth >= Number(/min-width: (\d+)px/.exec(query)?.[1] ?? Infinity),
				media: query,
				addEventListener: () => {},
				removeEventListener: () => {}
			}) as unknown as MediaQueryList
	)
	container = document.createElement('div')
	document.body.appendChild(container)
})

afterEach(() => {
	act(() => root?.unmount())
	root = null
	container.remove()
	document.documentElement.removeAttribute(getExperimentAttribute(ID))
	sessionStorage.clear()
	track.mockReset()
	delete window.umami
	vi.restoreAllMocks()
	vi.useRealTimers()
})

describe('home-brief-default-v1', () => {
	test('the seed decides the default: B opens on the first section, A stays closed with chips, no seed stays closed and unexposed', () => {
		expect([getVariant(ID, SEED_A), getVariant(ID, SEED_B)]).toEqual(['a', 'b'])

		setVariantFor(SEED_B)
		root = createRoot(container)
		act(() =>
			root!.render(
				<session.Wrapper>
					<HomeDailyBrief brief={brief} />
				</session.Wrapper>
			)
		)
		expect(tabs()).toHaveLength(brief.sections.length)
		expect(tabs()[0].getAttribute('aria-selected')).toBe('true')
		expect(chips()).toHaveLength(0)
		act(() => root!.unmount())

		setVariantFor(SEED_A)
		root = createRoot(container)
		act(() =>
			root!.render(
				<session.Wrapper>
					<HomeDailyBrief brief={brief} />
				</session.Wrapper>
			)
		)
		expect(tabs()).toHaveLength(0)
		expect(chips()).toHaveLength(3)
		act(() => root!.unmount())

		track.mockReset()
		sessionStorage.clear()
		document.documentElement.removeAttribute(getExperimentAttribute(ID))
		root = createRoot(container)
		act(() =>
			root!.render(
				<session.Wrapper>
					<HomeDailyBrief brief={brief} />
				</session.Wrapper>
			)
		)
		expect(tabs()).toHaveLength(0)
		expect(experimentCalls()).toEqual([])
	})

	test('desktop only: B on a phone width starts closed, sends no exposure and no actions, and a desktop B is exposed', async () => {
		setVariantFor(SEED_B)
		viewportWidth = 390
		root = createRoot(container)
		act(() =>
			root!.render(
				<session.Wrapper>
					<HomeDailyBrief brief={brief} />
				</session.Wrapper>
			)
		)
		expect(tabs()).toHaveLength(0)
		expect(chips()).toHaveLength(3)
		act(() => headerButton().click())
		await waitForUi(() => expect(tabs()).toHaveLength(brief.sections.length))
		expect(experimentCalls()).toEqual([])
		act(() => root!.unmount())

		viewportWidth = 1440
		root = createRoot(container)
		act(() =>
			root!.render(
				<session.Wrapper>
					<HomeDailyBrief brief={brief} />
				</session.Wrapper>
			)
		)
		await waitForUi(() => expect(tabs()).toHaveLength(brief.sections.length))
		expect(experimentCalls()).toEqual([['experiment-exposure', { experiment: ID, variant: 'b' }]])
	})

	test('ISR html carries both states for the pre-paint CSS, and B hydrates open without a mismatch', async () => {
		// HTML cached an hour after the brief was written, opened three hours after it.
		const generatedSec = Date.parse(brief.generatedAt) / 1000
		vi.useFakeTimers({ toFake: ['Date'], now: (generatedSec + 3 * 3600) * 1000 })
		// The pre-paint script marks the variant before hydration; the server render never reads it.
		setVariantFor(SEED_B)
		const rendered = await renderHydrated(
			<session.Wrapper>
				<HomeDailyBrief brief={brief} />
			</session.Wrapper>,
			{ pageClockSec: generatedSec + 3600 }
		)
		root = rendered.root
		expect(rendered.errors).toEqual([])

		container.innerHTML = rendered.serverHtml
		expect(tabs()).toHaveLength(brief.sections.length)
		expect(chips()).toHaveLength(3)
		expect(container.querySelector('header span[title]')?.textContent).toBe('Updated 1h ago')

		const hydrated = rendered.container
		expect(hydrated.querySelectorAll('[role="tab"]')).toHaveLength(brief.sections.length)
		expect(hydrated.querySelectorAll('button[aria-label^="Ask LlamaAI: "]')).toHaveLength(0)
		expect(hydrated.querySelector('header span[title]')?.textContent).toBe('Updated 3h ago')
		hydrated.remove()
	})

	test('exposure fires once per session; opening and tapping a question each fire one action, closing fires none', () => {
		setVariantFor(SEED_A)
		root = createRoot(container)
		act(() =>
			root!.render(
				<session.Wrapper>
					<HomeDailyBrief brief={brief} />
				</session.Wrapper>
			)
		)
		act(() => root!.unmount())
		root = createRoot(container)
		act(() =>
			root!.render(
				<session.Wrapper>
					<HomeDailyBrief brief={brief} />
				</session.Wrapper>
			)
		)

		act(() => headerButton().click())
		act(() => (container.querySelector('[role="tabpanel"] button') as HTMLButtonElement).click())
		act(() => headerButton().click())

		expect(experimentCalls()).toEqual([
			['experiment-exposure', { experiment: ID, variant: 'a' }],
			['experiment-action', { experiment: ID, variant: 'a', metric: 'brief-open' }],
			['experiment-action', { experiment: ID, variant: 'a', metric: 'brief-question' }]
		])
	})
})

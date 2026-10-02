// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { FreeUsage } from '~/containers/LlamaAI/types'
import { formatDateTime } from '~/utils/dateFormat'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { FreeUsageNote, getFreeUsageNote, getPhonePromptPlaceholder } from '../FreeUsageNote'

const bonus = { dailyQuestions: 5, endsAt: '2026-10-09T09:00:00.000Z' }
const RESET = '2026-10-02T00:00:00.000Z'
const typed = (remaining: number, limit: number) => ({ remaining, limit, period: 'daily', resetTime: RESET })
const usage = (typedQuestions: FreeUsage['typed'], extra: Partial<FreeUsage> = {}): FreeUsage => ({
	typed: typedQuestions,
	suggested: null,
	bonus: null,
	...extra
})

describe('getFreeUsageNote', () => {
	test('shows nothing before the backend sends the fields, and nothing on a normal free day', () => {
		expect(getFreeUsageNote(null, true, false)).toEqual({ kind: 'none' })
		expect(getFreeUsageNote(usage(null), true, false)).toEqual({ kind: 'none' })
		expect(getFreeUsageNote(usage(typed(1, 1)), true, false)).toEqual({ kind: 'none' })
	})

	test('during the welcome week the sidebar shows the card until it is dismissed', () => {
		expect(getFreeUsageNote(usage(typed(3, 5), { bonus }), true, false)).toEqual({
			kind: 'welcome',
			remaining: 3,
			limit: 5,
			resetTime: RESET,
			endsAt: '2026-10-09T09:00:00.000Z'
		})
		expect(getFreeUsageNote(usage(typed(3, 5), { bonus }), true, true)).toEqual({ kind: 'none' })
	})

	test('a dismissed welcome card comes back for the last question and the used-up day', () => {
		expect(getFreeUsageNote(usage(typed(1, 5), { bonus }), true, true)).toMatchObject({ kind: 'welcome', remaining: 1 })
		expect(getFreeUsageNote(usage(typed(0, 5), { bonus }), true, true)).toMatchObject({ kind: 'welcome', remaining: 0 })
	})

	test('the slot under the phone input shows the low states but never the welcome card', () => {
		expect(getFreeUsageNote(usage(typed(4, 5), { bonus }), false, false)).toEqual({ kind: 'none' })
		expect(getFreeUsageNote(usage(typed(1, 5), { bonus }), false, false)).toEqual({
			kind: 'last-question',
			resetTime: RESET
		})
	})

	test('a used free question says so, and points to the trial only once ready-made questions are gone too', () => {
		expect(getFreeUsageNote(usage(typed(0, 1), { suggested: typed(2, 3) }), true, false)).toEqual({
			kind: 'typed-used',
			resetTime: RESET
		})
		expect(getFreeUsageNote(usage(typed(0, 1), { suggested: typed(0, 3) }), true, false)).toEqual({
			kind: 'all-used',
			resetTime: RESET
		})
	})
})

test('the phone placeholder carries today’s count during the welcome week, until the last question', () => {
	expect(getPhonePromptPlaceholder(usage(typed(3, 5), { bonus }))).toBe('Ask LlamaAI · 3 of 5 left today')
	expect(getPhonePromptPlaceholder(usage(typed(1, 5), { bonus }))).toBe('Ask LlamaAI…')
	expect(getPhonePromptPlaceholder(usage(typed(3, 5)))).toBe('Ask LlamaAI…')
	expect(getPhonePromptPlaceholder(null)).toBe('Ask LlamaAI…')
})

describe('FreeUsageNote', () => {
	const session = installSubscriberSession('reader', { account: 'free', resolved: true })
	const track = installUmamiSink()
	let root: Root
	let container: HTMLDivElement

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})
	afterEach(() => {
		act(() => root.unmount())
		container.remove()
		vi.useRealTimers()
	})

	const show = (value: FreeUsage) => {
		act(() => root.unmount())
		root = createRoot(container)
		act(() =>
			root.render(
				<session.Wrapper>
					<FreeUsageNote usage={value} showBonus className="" />
				</session.Wrapper>
			)
		)
		return container.textContent
	}

	test('the welcome card shows today’s count on a meter and when the week ends, and a dismissal lasts', async () => {
		// Six days before the week ends, so the relative end time reads the same on every run.
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2026-10-03T09:00:00.000Z'))
		expect(show(usage(typed(3, 5), { bonus }))).toBe('Welcome week · ends in 6d3 of 5 questions left today')
		expect(container.querySelector('[title]')?.getAttribute('title')).toBe(
			formatDateTime('2026-10-09T09:00:00.000Z', { timeZone: 'UTC' })
		)
		const meter = container.querySelector('[role="meter"]')!
		expect([meter.getAttribute('aria-valuenow'), meter.getAttribute('aria-valuemax')]).toEqual(['3', '5'])
		expect(meter.querySelectorAll('[data-state="remaining"]')).toHaveLength(3)

		// The storage store notifies its readers in a batch one task after the write.
		await act(async () => {
			container.querySelector<HTMLButtonElement>('button[aria-label="Dismiss welcome week"]')!.click()
			await new Promise((resolve) => setTimeout(resolve))
		})
		expect(container.textContent).toBe('')
		expect(track).toHaveBeenCalledWith('llamaai-welcome-card-dismiss', { remaining: 3 })
		expect(show(usage(typed(3, 5), { bonus }))).toBe('')
	})

	test('before the first question the card says the week starts when you ask', () => {
		expect(show(usage(typed(5, 5), { bonus: { dailyQuestions: 5, endsAt: null } }))).toContain(
			'Welcome week · starts when you ask'
		)
	})

	test('a used-up day offers the trial in place of the dismiss button', () => {
		show(usage(typed(0, 5), { bonus, suggested: typed(0, 3) }))
		expect(container.querySelector('a[href="/subscription"]')?.textContent).toBe('Try Pro free')
		expect(container.querySelector('button')).toBeNull()
	})
})

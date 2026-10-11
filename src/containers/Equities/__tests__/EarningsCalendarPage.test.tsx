// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { buildEarningsCalendarBootstrap } from '../earningsCalendarData'
import { EarningsCalendarPage } from '../EarningsCalendarPage'
import { makeCompany, makeEvent } from './calendarFixture'

const api = vi.hoisted(() => ({ calendar: vi.fn() }))
vi.mock('next/router', () => ({
	useRouter: () => ({
		query: {},
		pathname: '/equities/earnings-calendar',
		asPath: '/equities/earnings-calendar',
		push: vi.fn()
	})
}))
// fetchJson is the network boundary for the full calendar request.
vi.mock('~/utils/async', async (original) => ({
	...(await original<typeof import('~/utils/async')>()),
	fetchJson: () => api.calendar()
}))
// The charts draw on canvas and nothing here asserts on them.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const TODAY = '2026-10-27'
const events = [
	makeEvent({ ticker: 'AAPL', report_date: TODAY }),
	makeEvent({ ticker: 'MSFT', report_date: TODAY, accession_number: null }),
	makeEvent({ ticker: 'NEXT', report_date: '2026-11-03' })
]
const companies = [
	makeCompany({ ticker: 'AAPL', name: 'Apple Inc.' }),
	makeCompany({ ticker: 'MSFT', name: 'Microsoft Corporation', marketCap: 3_000_000_000 }),
	makeCompany({ ticker: 'NEXT' })
]
const bootstrap = {
	...buildEarningsCalendarBootstrap(events, companies, TODAY),
	todayET: TODAY,
	updatedAt: null,
	stale: false
}
const fullCalendar = { rows: events, companies, updatedAt: null, generatedAt: 0, stale: false, todayET: TODAY }

let root: Root
let container: HTMLDivElement
let queryClient: QueryClient

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	queryClient = new QueryClient()
	api.calendar.mockReset()
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	queryClient.clear()
})

async function mount() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={queryClient}>
				<EarningsCalendarPage bootstrap={bootstrap} />
			</QueryClientProvider>
		)
	)
}

function alertText() {
	return container.querySelector('[role="alert"]')?.textContent ?? null
}

function button(name: string) {
	return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent?.trim() === name
	)!
}

test('a failed first load keeps this week on screen and Try again loads the calendar', async () => {
	api.calendar.mockRejectedValue(new Error('upstream down'))
	await mount()
	// The hook retries once before it reports the error.
	await waitForUi(() => expect(button('Try again')).not.toBeUndefined(), { timeout: 1900 })
	expect(alertText()).toBeTruthy()
	expect(container.textContent).toContain('AAPL')
	expect(button('Next week').getAttribute('aria-disabled')).toBe('true')

	api.calendar.mockResolvedValue(fullCalendar)
	await act(async () => button('Try again').click())
	await waitForUi(() => expect(alertText()).toBeNull())
	expect(button('Next week').getAttribute('aria-disabled')).toBeNull()
}, 4000)

test('a failed refresh over a loaded calendar shows no error', async () => {
	api.calendar.mockResolvedValue(fullCalendar)
	await mount()
	await waitForUi(() => expect(button('Next week').getAttribute('aria-disabled')).toBeNull())

	// Stands in for the 30-minute refetch interval; it settles after the hook's one retry.
	api.calendar.mockRejectedValue(new Error('upstream down'))
	await act(async () => {
		await queryClient.refetchQueries({ queryKey: ['equities-earnings-calendar'] })
	})
	// React Query renders the settled refetch on a later task, which waitForUi flushes.
	await waitForUi(() => expect(api.calendar).toHaveBeenCalledTimes(3))
	expect(alertText()).toBeNull()
	expect(button('Next week').getAttribute('aria-disabled')).toBeNull()
}, 4000)

test('a day in At stake this week opens its companies with cap and share of the day', async () => {
	api.calendar.mockResolvedValue(fullCalendar)
	await mount()
	const tuesday = button('Tue: $4B across 2 companies')
	await act(async () => tuesday.click())
	await waitForUi(() => expect(document.body.textContent).toContain('Tue · '))
	const card = [...document.querySelectorAll('[role="dialog"]')].at(-1)!
	expect(card.textContent).toBe(
		'Tue · Oct 27, 2026$4B across 2 companiesMSFT · Microsoft CorporationProjected$3B75%AAPL · Apple Inc.SEC-confirmed$1B25%'
	)
})

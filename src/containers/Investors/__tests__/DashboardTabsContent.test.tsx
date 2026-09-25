// @vitest-environment happy-dom

import { act, type ReactNode, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), pathname: '/investors', query: {} }) }))

const events = { mount: vi.fn(), unmount: vi.fn() }
const session = installSubscriberSession('investor')
import { CustomOnlyContent, InvestorsContent } from '../DashboardTabsContent'
import type { DashboardTabConfig } from '../dashboardTypes'

function CustomTab({ label }: { label: string }) {
	useEffect(() => {
		events.mount(label)
		return () => events.unmount(label)
	}, [label])
	return <div data-testid={`custom-${label}`}>{label}</div>
}

function FIRST_TAB() {
	return <CustomTab label="first" />
}
function SECOND_TAB() {
	return <CustomTab label="second" />
}

const INVESTOR_TABS: Array<DashboardTabConfig> = [
	{ id: 'dashboard', label: 'Overview' },
	{ id: 'first', label: 'First', component: FIRST_TAB },
	{ id: 'second', label: 'Second', component: SECOND_TAB }
]

describe('DashboardTabsContent', () => {
	let container: HTMLDivElement
	let root: Root
	let signal: AbortSignal | undefined
	let closeStream: (() => void) | undefined

	function render(children: ReactNode) {
		root.render(<session.Wrapper>{children}</session.Wrapper>)
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		vi.clearAllMocks()
		signal = undefined
		closeStream = undefined
		session.serve({
			'/lite/dashboards': { items: [] },
			'/dashboards': { items: [] },
			'http://localhost:3000/api/dynamic/pro-dashboard/': (_url: URL, init?: RequestInit) => {
				signal = init!.signal!
				return new Response(
					new ReadableStream({
						start(controller) {
							closeStream = () => controller.close()
						}
					}),
					{ headers: { 'content-type': 'application/x-ndjson' } }
				)
			}
		})
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		closeStream?.()
		container.remove()
	})

	test('unmounts an inactive investor dashboard tab instead of keeping it hidden', async () => {
		await act(async () =>
			render(
				<InvestorsContent
					tabs={INVESTOR_TABS}
					activeTab="dashboard"
					displayName="Investor"
					dashboardId="dashboard"
					hideDuplicateButton
				/>
			)
		)
		await vi.waitFor(() => expect(signal).toBeDefined())
		expect(signal!.aborted).toBe(false)

		await act(async () =>
			render(
				<InvestorsContent
					tabs={INVESTOR_TABS}
					activeTab="first"
					displayName="Investor"
					dashboardId="dashboard"
					hideDuplicateButton
				/>
			)
		)
		expect(signal!.aborted).toBe(true)
		expect(container.querySelector('[data-testid="custom-first"]')).not.toBeNull()

		await act(async () =>
			render(
				<InvestorsContent
					tabs={INVESTOR_TABS}
					activeTab="second"
					displayName="Investor"
					dashboardId="dashboard"
					hideDuplicateButton
				/>
			)
		)
		expect(container.querySelector('[data-testid="custom-first"]')).toBeNull()
		expect(container.querySelector('[data-testid="custom-second"]')).not.toBeNull()
		expect(events.unmount).toHaveBeenCalledWith('first')
	})

	test('unmounts custom-only Pro dashboard tabs when a component tab becomes active', async () => {
		const tabs: Array<DashboardTabConfig> = [
			{ id: 'pro', label: 'Pro', proDashboardId: 'pro-dashboard' },
			{ id: 'first', label: 'First', component: FIRST_TAB }
		]

		await act(async () =>
			render(<CustomOnlyContent tabs={tabs} activeTab="pro" displayName="Investor" hideDuplicateButton />)
		)
		await vi.waitFor(() => expect(signal).toBeDefined())
		expect(signal!.aborted).toBe(false)

		await act(async () =>
			render(<CustomOnlyContent tabs={tabs} activeTab="first" displayName="Investor" hideDuplicateButton />)
		)
		expect(signal!.aborted).toBe(true)
		expect(container.querySelector('[data-testid="custom-first"]')).not.toBeNull()
	})
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { appMetadataFixtures } from '~/utils/testing/appMetadata'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AppMetadataProvider } from '../../../AppMetadataContext'
import type { MetricChartType } from '../../../types'
import { MetricSentenceBuilder } from '../MetricSentenceBuilder'
const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
test('chart type arrows update the draft once and None remains a selectable value', async () => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	http.serve(appMetadataFixtures())
	const change = vi.fn()
	function Harness() {
		const [type, setType] = useState<MetricChartType>('sparkline')
		return (
			<MetricSentenceBuilder
				aggregator="latest"
				metricType="tvl"
				metricSubjectType="chain"
				metricChain={null}
				metricProtocol={null}
				metricWindow="7d"
				chartType={type}
				availableMetricTypes={[]}
				chains={[]}
				protocols={[]}
				onAggregatorChange={vi.fn()}
				onMetricTypeChange={vi.fn()}
				onSubjectTypeChange={vi.fn()}
				onChainChange={vi.fn()}
				onProtocolChange={vi.fn()}
				onWindowChange={vi.fn()}
				onChartTypeChange={(next) => {
					change(next)
					setType(next)
				}}
			/>
		)
	}
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<AppMetadataProvider>
					<DashboardTestProvider>
						<Harness />
					</DashboardTestProvider>
				</AppMetadataProvider>
			</QueryClientProvider>
		)
	)
	expect(change).not.toHaveBeenCalled()
	const radio = (value: string) => container.querySelector<HTMLInputElement>(`input[value="${value}"]`)!
	async function arrow(value: string, key: string) {
		await act(async () => {
			radio(value).focus()
			radio(value).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		})
	}
	await arrow('sparkline', 'ArrowRight')
	await waitForUi(() => expect(radio('bar').checked).toBe(true))
	await arrow('bar', 'ArrowRight')
	await waitForUi(() => expect(radio('none').checked).toBe(true))
	await arrow('none', 'ArrowLeft')
	await waitForUi(() => expect(radio('bar').checked).toBe(true))
	expect(change.mock.calls).toEqual([['bar'], ['none'], ['bar']])
})

async function renderBuilder() {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	http.serve(appMetadataFixtures())
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<AppMetadataProvider>
					<DashboardTestProvider>
						<MetricSentenceBuilder
							aggregator="latest"
							metricType="tvl"
							metricSubjectType="chain"
							metricChain={null}
							metricProtocol={null}
							metricWindow="7d"
							chartType="sparkline"
							availableMetricTypes={['tvl']}
							chains={[]}
							protocols={[]}
							onAggregatorChange={vi.fn()}
							onMetricTypeChange={vi.fn()}
							onSubjectTypeChange={vi.fn()}
							onChainChange={vi.fn()}
							onProtocolChange={vi.fn()}
							onWindowChange={vi.fn()}
							onChartTypeChange={vi.fn()}
						/>
					</DashboardTestProvider>
				</AppMetadataProvider>
			</QueryClientProvider>
		)
	)
}
function token(label: string) {
	const button = [...container.querySelectorAll<HTMLButtonElement>('button[data-metric-token]')].find(
		(node) => node.textContent?.trim() === label
	)
	if (!button) throw new Error(`No "${label}" token`)
	return button
}
const subjectSearch = () => document.querySelector<HTMLInputElement>('[role="dialog"] input[aria-label="Search"]')

test('opening the subject token puts the cursor in the subject search', async () => {
	await renderBuilder()
	await act(async () => token('a chain').click())
	await waitForUi(() => expect(document.activeElement).toBe(subjectSearch()))
})

test('switching from another open token to the subject token puts the cursor in the subject search', async () => {
	await renderBuilder()
	await act(async () => token('7 days').click())
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
	expect(subjectSearch()).toBeNull()

	await act(async () => token('a chain').click())
	await waitForUi(() => expect(document.activeElement).toBe(subjectSearch()))
})

test('switching from the subject token to another drops the subject search, and reopening starts empty', async () => {
	await renderBuilder()
	await act(async () => token('a chain').click())
	await waitForUi(() => expect(document.activeElement).toBe(subjectSearch()))
	await act(async () => {
		const input = subjectSearch()!
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'eth')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(subjectSearch()!.value).toBe('eth')

	await act(async () => token('7 days').click())
	await waitForUi(() => expect(subjectSearch()).toBeNull())
	expect(document.querySelector('[role="dialog"]')).not.toBeNull()

	await act(async () => token('a chain').click())
	await waitForUi(() => expect(document.activeElement).toBe(subjectSearch()))
	expect(subjectSearch()!.value).toBe('')
})

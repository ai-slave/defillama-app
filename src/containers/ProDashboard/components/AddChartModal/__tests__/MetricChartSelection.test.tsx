// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import type { MetricChartType } from '../../../types'
import { MetricSentenceBuilder } from '../MetricSentenceBuilder'
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => false }))
vi.mock('../../../AppMetadataContext', () => ({
	useAppMetadata: () => ({ availableProtocolChartTypes: () => [], availableChainChartTypes: () => [] })
}))
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
	await act(async () => root.render(<Harness />))
	expect(change).not.toHaveBeenCalled()
	const radio = (value: string) => container.querySelector<HTMLInputElement>(`input[value="${value}"]`)!
	async function arrow(value: string, key: string) {
		await act(async () => {
			radio(value).focus()
			radio(value).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		})
	}
	await arrow('sparkline', 'ArrowRight')
	await vi.waitFor(() => expect(radio('bar').checked).toBe(true))
	await arrow('bar', 'ArrowRight')
	await vi.waitFor(() => expect(radio('none').checked).toBe(true))
	await arrow('none', 'ArrowLeft')
	await vi.waitFor(() => expect(radio('bar').checked).toBe(true))
	expect(change.mock.calls).toEqual([['bar'], ['none'], ['bar']])
})

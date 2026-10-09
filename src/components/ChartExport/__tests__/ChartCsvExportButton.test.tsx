// @vitest-environment happy-dom
import type { ECharts } from 'echarts'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installDownloadSink } from '~/utils/testing/downloadSink'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ChartCsvExportButton } from '../ChartCsvExportButton'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/charts' }) }))
const { Wrapper } = installSubscriberSession('subscriber')
const downloads = installDownloadSink()
let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function mount(props: ComponentProps<typeof ChartCsvExportButton>) {
	await act(async () =>
		root.render(
			<Wrapper>
				<ChartCsvExportButton {...props} />
			</Wrapper>
		)
	)
	const button = container.querySelector<HTMLButtonElement>('button')!
	await waitForUi(() => expect(button.disabled).toBe(false))
	return button
}
async function prepareCsvFromDataset(instance: ECharts) {
	const prepareDataset = vi.fn(() => ({
		dimensions: ['timestamp', 'Solana', 'Ethereum'],
		source: [[Date.UTC(2024, 0, 1), 50, 100]]
	}))
	const button = await mount({
		chartInstance: () => instance,
		filename: 'app-revenue',
		source: { type: 'dataset', prepare: prepareDataset }
	})
	expect(prepareDataset).not.toHaveBeenCalled()
	await act(async () => button.click())
	expect(downloads).toHaveLength(1)
	return { csv: await downloads[0]!.blob.text(), filename: downloads[0]!.filename }
}

describe('ChartCsvExportButton', () => {
	test('prefers an explicit canonical dataset over the rendered chart presentation', async () => {
		const instance = {
			getOption: () => ({
				dataset: {
					dimensions: ['timestamp', 'Top Protocol', 'Others'],
					source: [[Date.UTC(2024, 0, 1), 100, 50]]
				}
			})
		} as unknown as ECharts

		const result = await prepareCsvFromDataset(instance)

		expect(result.csv).toBe('Timestamp,Date,Solana,Ethereum\n1704067200000,2024-01-01,50,100')
	})

	test('names the period each row of a grouped dataset covers', async () => {
		const button = await mount({
			chartInstance: () => null,
			filename: 'monthly-fees',
			source: {
				type: 'dataset',
				prepare: () => ({ dimensions: ['timestamp', 'Fees'], source: [[Date.UTC(2024, 0, 1), 7]], groupBy: 'monthly' })
			}
		})
		await act(async () => button.click())

		expect(await downloads[0]!.blob.text()).toBe(
			'Timestamp,Month start,Month end,Fees\n1704067200000,2024-01-01,2024-01-31,7'
		)
	})

	test('awaits an asynchronous dataset before downloading or reporting the export', async () => {
		const pending = Promise.withResolvers<{ dimensions: Array<string>; source: Array<Array<number>> }>()
		const onExport = vi.fn()
		const prepare = vi.fn(() => pending.promise)
		const button = await mount({
			chartInstance: () => null,
			filename: 'complete-data',
			source: { type: 'dataset', prepare },
			onExport
		})
		button.focus()
		await act(async () => button.click())
		expect(button.getAttribute('aria-disabled')).toBe('true')
		expect(document.activeElement).toBe(button)
		await act(async () => button.click())
		expect(prepare).toHaveBeenCalledOnce()
		expect(downloads).toHaveLength(0)
		expect(onExport).not.toHaveBeenCalled()
		await act(async () => pending.resolve({ dimensions: ['Value'], source: [[1]] }))
		expect(downloads).toHaveLength(1)
		expect(await downloads[0]!.blob.text()).toBe('Value\n1')
		expect(downloads[0]!.filename).toMatch(/^complete-data-\d{4}-\d{2}-\d{2}\.csv$/)
		expect(onExport).toHaveBeenCalledWith({ filename: downloads[0]!.filename.replace(/\.csv$/, '') })
		expect(button.disabled).toBe(false)
	})
})

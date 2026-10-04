// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { BreakdownTable, type BreakdownRowConfig, sortBreakdownRows } from '../BreakdownTable'

const ROWS: Array<BreakdownRowConfig> = [
	{ label: 'Bid & Ask Depth 50 bps (USD)', key: 'bidAskDepth50', kind: 'usd' },
	{ label: 'Uptime %, Bid & Ask Depth 50 bps', key: 'bidAskDepth50Uptime', kind: 'percent' },
	{ label: 'Ask Depth 50 bps (USD)', key: 'askDepth50', kind: 'usd' }
]
const DATA = {
	bidAskDepth50: { value: 266_553_520, percentile: 95, rank: 2 },
	bidAskDepth50Uptime: { value: 99.5, percentile: null, rank: 7 }
}

function rowTexts(html: string) {
	return [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)]
		.slice(1)
		.map((row) => [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((cell) => cell[1]))
}

test('shows each metric value, percentile and rank, with N/A for missing parts', () => {
	const html = renderToStaticMarkup(<BreakdownTable title="Depth KPIs" badge="Last 30D" rows={ROWS} data={DATA} />)
	expect(html).toContain('Depth KPIs, Detailed Breakdown')
	expect(rowTexts(html)).toEqual([
		['Bid &amp; Ask Depth 50 bps (USD)', '$266.55M', '95%', '2'],
		['Uptime %, Bid &amp; Ask Depth 50 bps', '99.5%', 'N/A', '7'],
		['Ask Depth 50 bps (USD)', 'N/A', 'N/A', 'N/A']
	])
})

test('sorts rows by a numeric column with missing values last in both directions', () => {
	const labels = (sort: Parameters<typeof sortBreakdownRows>[2]) =>
		sortBreakdownRows(ROWS, DATA, sort).map((row) => row.key)
	expect(labels({ key: 'rank', dir: 'desc' })).toEqual(['bidAskDepth50Uptime', 'bidAskDepth50', 'askDepth50'])
	expect(labels({ key: 'rank', dir: 'asc' })).toEqual(['bidAskDepth50', 'bidAskDepth50Uptime', 'askDepth50'])
	expect(labels({ key: 'metric', dir: 'asc' })).toEqual(['askDepth50', 'bidAskDepth50', 'bidAskDepth50Uptime'])
	expect(labels(null)).toEqual(['bidAskDepth50', 'bidAskDepth50Uptime', 'askDepth50'])
})

test('a sorted column header tells screen readers its direction', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	await act(async () => root.render(<BreakdownTable title="Depth KPIs" badge="Last 30D" rows={ROWS} data={DATA} />))
	const rankHeader = () => [...container.querySelectorAll('th')].find((th) => th.textContent?.startsWith('Rank'))!
	expect(rankHeader().getAttribute('aria-sort')).toBeNull()

	await act(async () => rankHeader().querySelector('button')!.click())
	expect(rankHeader().getAttribute('aria-sort')).toBe('descending')
	await act(async () => rankHeader().querySelector('button')!.click())
	expect(rankHeader().getAttribute('aria-sort')).toBe('ascending')

	await act(async () => root.unmount())
	container.remove()
})

// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, test } from 'vitest'
import {
	buildHistoryStrip,
	HistoryStrip,
	type HistoryIncident,
	type ProtocolIncidentInput
} from '../components/HistoryStrip'
import type { Audit } from '../types'
import { makeAudit } from './factories'

function audit(date: string, firm = 'Firm'): Audit {
	return makeAudit({ date, firm })
}

function incident(partial: Partial<HistoryIncident>): HistoryIncident {
	return {
		date: '2025-01-01',
		usdLost: 0,
		usdRecovered: 0,
		title: 'Test',
		...partial
	}
}

function protoIncident(partial: Partial<ProtocolIncidentInput>): ProtocolIncidentInput {
	return Object.assign(
		{
			date: '2025-01-01',
			kind: 'oracle-misconfiguration',
			classification: 'protocol',
			chain: 'ethereum',
			technique: 'configuration error',
			usdLost: 0,
			usdRecovered: 0,
			fullyRecovered: false,
			postMortemUrl: null
		},
		partial
	)
}

// Two firms per quarter across 2023-Q1 → 2025-Q3 (~2.5y): packed enough that clustering must
// merge chips, and spanning years so year ticks appear.
const auditQuarters = ['01-15', '01-22', '04-15', '04-22', '07-15', '07-22', '10-15', '10-22']
const manyAudits: Array<Audit> = []
for (const year of ['2023', '2024', '2025']) {
	for (const md of auditQuarters) {
		// keep 2025 short of Q4 so the span is ~2.5y, not a clean 3y
		if (year === '2025' && (md.startsWith('10') || md.startsWith('07'))) continue
		manyAudits.push(audit(`${year}-${md}`, `Firm-${year}-${md}`))
	}
}

// Protocol-wide track record for the "own lane" tests: one loss, one made-whole, and a
// frontend whitehat ($0 lost, funds returned → reads as recovered).
const morphoProtoIncidents: Array<ProtocolIncidentInput> = [
	protoIncident({
		date: '2024-04-01',
		kind: 'oracle-misconfiguration',
		classification: 'protocol',
		usdLost: 230_000,
		usdRecovered: 0,
		fullyRecovered: false
	}),
	protoIncident({
		date: '2024-11-01',
		kind: 'bad-debt',
		classification: 'collateral',
		technique: 'illiquid-collateral price manipulation',
		usdLost: 900_000,
		usdRecovered: 900_000,
		fullyRecovered: true
	}),
	protoIncident({
		date: '2025-03-01',
		kind: 'frontend-compromise',
		classification: 'ecosystem',
		usdLost: 0,
		usdRecovered: 2_600_000,
		fullyRecovered: true
	})
]

describe('buildHistoryStrip', () => {
	test('returns null with nothing to show, renders with any one lane alone', () => {
		expect(buildHistoryStrip([], [], [], '2026-06-01')).toBeNull()
		expect(buildHistoryStrip([audit('2025-01-01')], [], [], '2026-06-01')?.audits).toHaveLength(1)
		expect(buildHistoryStrip([], [incident({ usdLost: 5 })], [], '2026-06-01')?.incidents).toHaveLength(1)
		// protocol incidents alone are enough to render the strip
		expect(buildHistoryStrip([], [], [protoIncident({ usdLost: 5 })], '2026-06-01')?.protocolIncidents).toHaveLength(1)
	})

	test('clusters all real morpho audits without losing any, in-bounds and chronological', () => {
		const vm = buildHistoryStrip(manyAudits, [], [], '2026-06-08')!
		expect(vm.audits.reduce((a, c) => a + c.count, 0)).toBe(manyAudits.length)
		expect(vm.audits.length).toBeLessThan(manyAudits.length) // 22 audits over ~2.5y must merge
		for (const marker of vm.audits) {
			expect(marker.x).toBeGreaterThanOrEqual(2)
			expect(marker.x).toBeLessThanOrEqual(98)
			expect(marker.items.length).toBe(marker.count)
		}
		// Strictly increasing: sorted, and no two markers share a position.
		const positions = vm.audits.map((marker) => marker.x)
		expect(positions).toEqual([...positions].sort((left, right) => left - right))
		expect(new Set(positions).size).toBe(positions.length)
		expect(vm.years.length).toBeGreaterThan(0)
		expect(vm.years.map((y) => y.label)).toEqual(vm.years.map((y) => y.label).sort())
	})

	test('merges same-week audits into one counted chip, keeps distant ones apart', () => {
		const vm = buildHistoryStrip(
			[audit('2025-12-04', 'A'), audit('2025-12-04', 'B'), audit('2023-01-01', 'C')],
			[],
			[],
			'2026-06-01'
		)!
		expect(vm.audits).toHaveLength(2)
		const dec = vm.audits.find((c) => c.from === '2025-12-04')!
		expect(dec.count).toBe(2)
		expect(dec.items.map((i) => i.firm)).toEqual(['A', 'B'])
	})

	test('classifies incident tones: loss, made whole, averted', () => {
		const vm = buildHistoryStrip(
			[],
			[
				incident({
					date: '2024-01-01',
					usdLost: 100,
					usdRecovered: 0,
					title: 'L'
				}),
				incident({
					date: '2025-01-01',
					usdLost: 100,
					usdRecovered: 100,
					title: 'W'
				}),
				incident({
					date: '2025-06-01',
					usdLost: 0,
					usdRecovered: 50,
					title: 'A'
				})
			],
			[],
			'2026-06-01'
		)!
		expect(vm.incidents.map((i) => i.tone)).toEqual(['loss', 'made-whole', 'averted'])
		expect(vm.incidents[0]!.money).toContain('not recovered')
		expect(vm.incidents[1]!.money).toContain('made whole')
		expect(vm.incidents[2]!.money).toContain('before depositors lost anything')
		// bigger dollars → bigger dot
		expect(vm.incidents[0]!.r).toBeGreaterThan(vm.incidents[2]!.r)
	})

	test('distinguishes unavailable recovery from explicit zero recovery', () => {
		const vm = buildHistoryStrip(
			[],
			[
				incident({
					date: '2024-01-01',
					usdLost: 100,
					usdRecovered: null,
					title: 'Unknown'
				}),
				incident({
					date: '2025-01-01',
					usdLost: 100,
					usdRecovered: 0,
					title: 'Zero'
				})
			],
			[],
			'2026-06-01'
		)!

		expect(vm.incidents[0]!.money).toContain('recovery unavailable')
		expect(vm.incidents[0]!.money).not.toContain('not recovered')
		expect(vm.incidents[1]!.money).toContain('not recovered')
	})

	test('a lone event still gets a readable axis instead of a zero-width domain', () => {
		const vm = buildHistoryStrip([], [incident({ date: '2025-04-10', usdRecovered: 2_600_000 })], [], undefined)!
		expect(vm.incidents[0]!.x).toBeGreaterThan(2)
		expect(vm.incidents[0]!.x).toBeLessThan(98)
	})

	test('keeps protocol incidents in their own lane, separate from pool incidents (never summed)', () => {
		const vm = buildHistoryStrip(
			[],
			[incident({ date: '2024-06-01', usdLost: 10, title: 'pool loss' })],
			morphoProtoIncidents,
			'2026-06-25'
		)!
		// pool lane carries only the pool incident; protocol lane carries the protocol-wide ones
		expect(vm.incidents).toHaveLength(1)
		expect(vm.protocolIncidents).toHaveLength(morphoProtoIncidents.length)
		// every protocol point is framed as "not recorded on this vault" and keeps its classification
		for (const p of vm.protocolIncidents) {
			expect(p.contextLabel).toContain('not recorded on this vault')
			expect(['protocol', 'ecosystem', 'collateral']).toContain(p.classification)
		}
		// the frontend whitehat event ($0 lost, funds returned) reads as recovered, not a loss
		const frontend = vm.protocolIncidents.find((p) => p.classification === 'ecosystem')!
		expect(frontend.recovered).toBe(true)
		expect(frontend.money).toContain('before depositors lost anything')
	})
})

test('closing a marker’s detail hands focus back to the marker that opened it', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	await act(async () =>
		root.render(
			<HistoryStrip
				audits={[]}
				incidents={[incident({ date: '2024-06-01', usdLost: 10, title: 'pool loss' })]}
				nowIso="2026-06-25"
			/>
		)
	)
	const marker = container.querySelector<HTMLButtonElement>('[data-hs-pt]')!
	await act(async () => marker.click())
	const close = container.querySelector<HTMLButtonElement>('button[aria-label="Close detail"]')!
	await act(async () => {
		close.focus()
		close.click()
	})
	expect(container.querySelector('[role="region"]')).toBeNull()
	expect(document.activeElement).toBe(marker)
	await act(async () => root.unmount())
	container.remove()
})

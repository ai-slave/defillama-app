// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { LedgerTile } from './ui'

const TX_COUNT_REF = { label: 'KPK transaction count — Dune', url: 'https://dune.com/kpk/kpk-tx-count' }

describe('LedgerTile', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	const renderTile = async (node: React.ReactElement) => {
		await act(async () => root.render(node))
	}

	test('links the query behind the metric, beside the pair it belongs to', async () => {
		await renderTile(
			<LedgerTile
				label="Deployed onchain"
				value="$8.03bn"
				metric="10,382"
				metricLabel="onchain transactions"
				metricRef={TX_COUNT_REF}
			/>
		)

		const link = container.querySelector<HTMLAnchorElement>('a[href="https://dune.com/kpk/kpk-tx-count"]')
		expect(link).not.toBeNull()
		expect(link!.target).toBe('_blank')
		expect(link!.parentElement!.textContent).toContain('10,382 onchain transactions')
	})

	test('leaves the metric unlinked when no query is sent with it', async () => {
		await renderTile(
			<LedgerTile label="Deployed onchain" value="$8.03bn" metric="10,382" metricLabel="onchain transactions" />
		)

		expect(container.querySelector('a')).toBeNull()
		expect(container.textContent).toContain('10,382 onchain transactions')
	})

	test('links each pair of a multi-metric row on its own ref', async () => {
		await renderTile(
			<LedgerTile
				label="Total Value Allocated"
				value="$217.41m"
				metrics={[
					{ value: '$157.13m', label: 'mandates', ref: { label: 'Mandates', url: 'https://example.com/mandates' } },
					{ value: '$60.28m', label: 'vaults' }
				]}
			/>
		)

		expect(container.querySelectorAll('a')).toHaveLength(1)
		expect(container.querySelector('a[href="https://example.com/mandates"]')).not.toBeNull()
	})
})

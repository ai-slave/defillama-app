import { describe, expect, test } from 'vitest'
import { getLegacyProtocolTableColumnPolicy } from './legacyProtocolTableColumnPolicy'

describe('legacy protocol table column policy', () => {
	test('keeps classic point comparisons distinct from Unified v1 period comparisons', () => {
		expect(getLegacyProtocolTableColumnPolicy('feesChange_7d')).toMatchObject({
			disposition: 'rename',
			target: 'fees24hChange7dAgo'
		})
	})

	test('records filtered-table shares without substituting global dominance', () => {
		expect(getLegacyProtocolTableColumnPolicy('fees_24h_share')).toMatchObject({
			disposition: 'rename',
			target: 'filteredShare_fees24h'
		})
	})
})

import { describe, expect, it } from 'vitest'
import { getLegacyProtocolTableColumnPolicy } from './legacyProtocolTableColumnPolicy'

describe('legacy protocol table column policy', () => {
	it('keeps classic point comparisons distinct from Unified v1 period comparisons', () => {
		expect(getLegacyProtocolTableColumnPolicy('feesChange_7d')).toMatchObject({
			disposition: 'rename',
			target: 'fees24hChange7dAgo'
		})
	})

	it('records filtered-table shares without substituting global dominance', () => {
		expect(getLegacyProtocolTableColumnPolicy('fees_24h_share')).toMatchObject({
			disposition: 'rename',
			target: 'filteredShare_fees24h'
		})
	})
})

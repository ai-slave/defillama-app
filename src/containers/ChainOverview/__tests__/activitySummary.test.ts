import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { fetchChainActivityProtocolMetricTotal } from '../queries.server'

const { serve } = installFixtureFetch()

describe('chain activity totals', () => {
	test.each([
		{ adapterType: 'active-users', dataType: undefined },
		{ adapterType: 'active-users', dataType: 'dailyTransactionsCount' },
		{ adapterType: 'new-users', dataType: undefined }
	] as const)('returns $adapterType $dataType from the chain protocol metric', async ({ adapterType, dataType }) => {
		serve({
			[`${V2_SERVER_URL}/metrics/${adapterType}/protocol/ethereum${dataType ? `?dataType=${dataType}` : ''}`]: {
				total24h: 123
			}
		})
		expect(await fetchChainActivityProtocolMetricTotal({ chain: 'Ethereum', adapterType, dataType })).toBe(123)
	})
})

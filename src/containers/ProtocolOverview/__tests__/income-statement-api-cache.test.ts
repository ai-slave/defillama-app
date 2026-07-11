import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProtocolIncomeStatementMock = vi.hoisted(() => vi.fn())

vi.mock('~/containers/ProtocolOverview/queries', () => ({
	getProtocolIncomeStatement: getProtocolIncomeStatementMock
}))

vi.mock('~/utils/metadata', () => ({
	default: {
		protocolMetadata: {
			'serialized-cache-protocol': { displayName: 'Serialized Cache Protocol' }
		}
	}
}))

import { incomeStatement } from '../server/api'

beforeEach(() => {
	vi.clearAllMocks()
})

describe('income statement serialized response cache', () => {
	it('serializes the final aggregate once per normalized protocol', async () => {
		getProtocolIncomeStatementMock.mockResolvedValue({ monthly: { revenue: 42 } })
		const request = {
			method: 'GET',
			url: '/api/public/income-statement?protocol=Serialized%20Cache%20Protocol',
			query: { protocol: 'Serialized Cache Protocol' },
			headers: {}
		}

		const first = await incomeStatement.handle(request)
		const second = await incomeStatement.handle(request)

		expect(first).toMatchObject({
			status: 200,
			serializedJson: JSON.stringify({ monthly: { revenue: 42 } })
		})
		expect(second).toEqual(first)
		expect(getProtocolIncomeStatementMock).toHaveBeenCalledTimes(1)
	})
})

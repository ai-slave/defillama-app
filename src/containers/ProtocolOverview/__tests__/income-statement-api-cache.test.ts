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
	it('isolates legacy and v2 wire shapes while sharing normalized computation', async () => {
		const normalized = {
			data: {
				monthly: {
					'2026-01': {
						timestamp: 1_767_225_600_000,
						values: { Revenue: { value: 42, 'by-label': { Swap: 40 } }, Expenses: { value: 2 } }
					}
				},
				quarterly: {
					'2026-Q1': {
						timestamp: 1_767_225_600_000,
						values: { Expenses: { value: 6 } }
					}
				},
				yearly: {
					'2026': {
						timestamp: 1_767_225_600_000,
						values: { Expenses: { value: 24 } }
					}
				},
				cumulative: {
					cumulative: {
						timestamp: 1_767_225_600_000,
						values: { Expenses: { value: 2 } }
					}
				}
			},
			labelsByType: { Revenue: ['Swap'] },
			methodology: {},
			breakdownMethodology: {},
			hasOtherTokenHolderFlows: false,
			hasTokenHolderNetIncome: false
		}
		getProtocolIncomeStatementMock.mockResolvedValue(normalized)
		const legacyRequest = {
			method: 'GET',
			url: '/api/public/income-statement?protocol=Serialized%20Cache%20Protocol',
			query: { protocol: 'Serialized Cache Protocol' },
			headers: {}
		}
		const v2Request = {
			...legacyRequest,
			url: `${legacyRequest.url}&version=2`,
			query: { ...legacyRequest.query, version: '2' }
		}

		const v2First = await incomeStatement.handle(v2Request)
		const legacyFirst = await incomeStatement.handle(legacyRequest)
		const v2Second = await incomeStatement.handle(v2Request)
		const legacySecond = await incomeStatement.handle(legacyRequest)
		const legacy = {
			...normalized,
			data: {
				monthly: {
					'2026-01': {
						Revenue: { value: 42, 'by-label': { Swap: 40 } },
						Expenses: { value: 2 },
						timestamp: 1_767_225_600_000
					}
				},
				quarterly: {
					'2026-Q1': {
						Expenses: { value: 6 },
						timestamp: 1_767_225_600_000
					}
				},
				yearly: {
					'2026': {
						Expenses: { value: 24 },
						timestamp: 1_767_225_600_000
					}
				},
				cumulative: {
					cumulative: {
						Expenses: { value: 2, 'by-label': {} },
						timestamp: 1_767_225_600_000
					}
				}
			}
		}

		expect(v2First).toMatchObject({
			status: 200,
			serializedJson: JSON.stringify(normalized)
		})
		expect(legacyFirst).toMatchObject({ status: 200, serializedJson: JSON.stringify(legacy) })
		expect(v2First).not.toEqual(legacyFirst)
		expect(v2Second).toEqual(v2First)
		expect(legacySecond).toEqual(legacyFirst)
		expect(getProtocolIncomeStatementMock).toHaveBeenCalledTimes(1)
	})

	it('rejects unsupported response versions before computing data', async () => {
		const result = await incomeStatement.handle({
			method: 'GET',
			url: '/api/public/income-statement?protocol=Serialized%20Cache%20Protocol&version=3',
			query: { protocol: 'Serialized Cache Protocol', version: '3' },
			headers: {}
		})

		expect(result).toMatchObject({ status: 400, body: { error: 'Invalid version: 3' } })
		expect(getProtocolIncomeStatementMock).not.toHaveBeenCalled()
	})
})

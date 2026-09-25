import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { UserActivity } from '../AdditionalInfo'
import type { IProtocolOverviewPageData } from '../types'

const renderUserActivity = (
	users: NonNullable<IProtocolOverviewPageData['users']>,
	gasUsedValueSymbol: string | null = 'POL'
) => renderToStaticMarkup(<UserActivity users={users} gasUsedValueSymbol={gasUsedValueSymbol} />)

const emptyActivity: NonNullable<IProtocolOverviewPageData['users']> = {
	activeUsers: null,
	newUsers: null,
	transactions: null,
	gasUsed: null,
	gasUsedUsd: null
}

describe('UserActivity', () => {
	test('renders native gas usage and USD gas cost as separate metrics', () => {
		const markup = renderUserActivity({
			...emptyActivity,
			gasUsed: 398_354,
			gasUsedUsd: 28_520
		})

		expect(markup).toContain('Gas Used (24h)')
		expect(markup).toContain('398,354 POL')
		expect(markup).toContain('Gas Cost (24h)')
		expect(markup).toContain('$28,520')
	})

	test('preserves zero and independent availability for both gas metrics', () => {
		const nativeOnly = renderUserActivity({ ...emptyActivity, gasUsed: 0 })
		expect(nativeOnly).toContain('0 POL')
		expect(nativeOnly).not.toContain('Gas Cost (24h)')

		const usdOnly = renderUserActivity({ ...emptyActivity, gasUsedUsd: 0 })
		expect(usdOnly).not.toContain('Gas Used (24h)')
		expect(usdOnly).toContain('Gas Cost (24h)')
		expect(usdOnly).toContain('$0')
	})
})

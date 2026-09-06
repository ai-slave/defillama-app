import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { assignColors, fetchDuneQuery } from '../spark/api'

export interface EtherfiCashTxnRow {
	// Dune returns a UTC date/timestamp string; Date.parse handles both date-only and timestamp variants.
	date: string
	txn_class: string
	num_txns: number
	num_users: number
	total_txns: number
	total_users: number
	total_avg_per_user: number
	last_week_txns: number
	last_week_users: number
	last_week_avg: number
	all_time_txns: number
	all_time_users: number
	all_time_avg: number
}

export function buildEtherfiCashTransactions(rows: Array<EtherfiCashTxnRow>) {
	// KPIs from counter columns (same on every row)
	const first = rows[0]
	const kpis = first
		? {
				allTimeTxns: first.all_time_txns,
				allTimeUsers: first.all_time_users,
				allTimeAvg: first.all_time_avg,
				lastWeekTxns: first.last_week_txns,
				lastWeekUsers: first.last_week_users,
				lastWeekAvg: first.last_week_avg
			}
		: null

	const classSet = new Set<string>()
	const weekMap = new Map<
		number,
		{
			transactions: Map<string, number>
			users: Map<string, number>
			totalTxns: number
			totalUsers: number
			totalAvgPerUser: number
		}
	>()
	for (const row of rows) {
		classSet.add(row.txn_class)
		const timestamp = Math.floor(Date.parse(row.date) / 1000) * 1000
		let week = weekMap.get(timestamp)
		if (!week) {
			week = {
				transactions: new Map(),
				users: new Map(),
				totalTxns: row.total_txns,
				totalUsers: row.total_users,
				totalAvgPerUser: row.total_avg_per_user
			}
			weekMap.set(timestamp, week)
		}
		week.transactions.set(row.txn_class, (week.transactions.get(row.txn_class) ?? 0) + row.num_txns)
		week.users.set(row.txn_class, (week.users.get(row.txn_class) ?? 0) + row.num_users)
	}

	const txnClasses = Array.from(classSet).sort()
	const colors = assignColors(txnClasses)
	const classCharts = new Array<MultiSeriesChartSeriesConfig>(txnClasses.length)
	for (let i = 0; i < txnClasses.length; i++) {
		const name = txnClasses[i]
		classCharts[i] = {
			name,
			type: 'bar',
			encode: { x: 0, y: i + 1 },
			color: colors[name],
			stack: 'a'
		}
	}

	const sortedWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a - b)
	const transactionsByClassSource: MultiSeriesChartDataset['source'] = new Array(sortedWeeks.length)
	const usersByClassSource: MultiSeriesChartDataset['source'] = new Array(sortedWeeks.length)
	const weeklyTxnsSource = new Array<Array<number>>(sortedWeeks.length)
	const weeklyUsersSource = new Array<Array<number>>(sortedWeeks.length)
	const weeklyAvgSource = new Array<Array<number>>(sortedWeeks.length)
	for (let i = 0; i < sortedWeeks.length; i++) {
		const [timestamp, week] = sortedWeeks[i]
		const transactionRow = new Array<number | null>(txnClasses.length + 1).fill(null)
		const userRow = new Array<number | null>(txnClasses.length + 1).fill(null)
		transactionRow[0] = timestamp
		userRow[0] = timestamp
		for (let classIndex = 0; classIndex < txnClasses.length; classIndex++) {
			const name = txnClasses[classIndex]
			transactionRow[classIndex + 1] = week.transactions.get(name) ?? null
			userRow[classIndex + 1] = week.users.get(name) ?? null
		}
		transactionsByClassSource[i] = transactionRow
		usersByClassSource[i] = userRow
		weeklyTxnsSource[i] = [timestamp, week.totalTxns]
		weeklyUsersSource[i] = [timestamp, week.totalUsers]
		weeklyAvgSource[i] = [timestamp, week.totalAvgPerUser]
	}

	return {
		kpis,
		classCharts,
		transactionsByClassDataset: {
			source: transactionsByClassSource,
			dimensions: ['timestamp', ...txnClasses]
		} satisfies MultiSeriesChartDataset,
		usersByClassDataset: {
			source: usersByClassSource,
			dimensions: ['timestamp', ...txnClasses]
		} satisfies MultiSeriesChartDataset,
		weeklyTxnsDataset: {
			source: weeklyTxnsSource,
			dimensions: ['timestamp', 'Transactions']
		} satisfies MultiSeriesChartDataset,
		weeklyUsersDataset: {
			source: weeklyUsersSource,
			dimensions: ['timestamp', 'Active Users']
		} satisfies MultiSeriesChartDataset,
		weeklyAvgDataset: {
			source: weeklyAvgSource,
			dimensions: ['timestamp', 'Avg Txns per User']
		} satisfies MultiSeriesChartDataset
	}
}

export function useEtherfiCashTransactions() {
	const query = useQuery({
		queryKey: ['dune-etherfi-cash-txns'],
		queryFn: () => fetchDuneQuery<EtherfiCashTxnRow>('6370257'),
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	return useMemo(
		() => ({ ...buildEtherfiCashTransactions(query.data?.result?.rows ?? []), isLoading: query.isLoading }),
		[query.data, query.isLoading]
	)
}

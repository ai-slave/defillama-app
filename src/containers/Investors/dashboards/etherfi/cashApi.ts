import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createChartRecord, createChartRow } from '~/components/ECharts/dynamicRow'
import type { MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
import { assignColors, fetchDuneQuery } from '../spark/api'

interface EtherfiCashTxnRow {
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

export function useEtherfiCashTransactions() {
	const query = useQuery({
		queryKey: ['dune-etherfi-cash-txns'],
		queryFn: () => fetchDuneQuery<EtherfiCashTxnRow>('6370257'),
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const rows = query.data?.result?.rows ?? []

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
				transactions: Record<string, number>
				users: Record<string, number>
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
					transactions: createChartRecord<number>(),
					users: createChartRecord<number>(),
					totalTxns: row.total_txns,
					totalUsers: row.total_users,
					totalAvgPerUser: row.total_avg_per_user
				}
				weekMap.set(timestamp, week)
			}
			week.transactions[row.txn_class] = (week.transactions[row.txn_class] ?? 0) + row.num_txns
			week.users[row.txn_class] = (week.users[row.txn_class] ?? 0) + row.num_users
		}

		const txnClasses = Array.from(classSet).sort()
		const colors = assignColors(txnClasses)
		const classCharts = new Array<MultiSeriesChart2SeriesConfig>(txnClasses.length)
		for (let i = 0; i < txnClasses.length; i++) {
			const name = txnClasses[i]
			classCharts[i] = {
				name,
				type: 'bar',
				encode: { x: 'timestamp', y: name },
				color: colors[name],
				stack: 'a'
			}
		}

		const sortedWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a - b)
		const transactionsByClassSource: MultiSeriesChart2Dataset['source'] = new Array(sortedWeeks.length)
		const usersByClassSource: MultiSeriesChart2Dataset['source'] = new Array(sortedWeeks.length)
		const weeklyTxnsSource = new Array<{ timestamp: number; Transactions: number }>(sortedWeeks.length)
		const weeklyUsersSource = new Array<{ timestamp: number; 'Active Users': number }>(sortedWeeks.length)
		const weeklyAvgSource = new Array<{ timestamp: number; 'Avg Txns per User': number }>(sortedWeeks.length)
		for (let i = 0; i < sortedWeeks.length; i++) {
			const [timestamp, week] = sortedWeeks[i]
			const transactionRow = createChartRow<number | null>(timestamp)
			const userRow = createChartRow<number | null>(timestamp)
			for (const name in week.transactions) transactionRow[name] = week.transactions[name]
			for (const name in week.users) userRow[name] = week.users[name]
			transactionsByClassSource[i] = transactionRow
			usersByClassSource[i] = userRow
			weeklyTxnsSource[i] = { timestamp, Transactions: week.totalTxns }
			weeklyUsersSource[i] = { timestamp, 'Active Users': week.totalUsers }
			weeklyAvgSource[i] = { timestamp, 'Avg Txns per User': week.totalAvgPerUser }
		}

		return {
			kpis,
			isLoading: query.isLoading,
			classCharts,
			transactionsByClassDataset: {
				source: transactionsByClassSource,
				dimensions: ['timestamp', ...txnClasses]
			} satisfies MultiSeriesChart2Dataset,
			usersByClassDataset: {
				source: usersByClassSource,
				dimensions: ['timestamp', ...txnClasses]
			} satisfies MultiSeriesChart2Dataset,
			weeklyTxnsDataset: {
				source: weeklyTxnsSource,
				dimensions: ['timestamp', 'Transactions']
			} satisfies MultiSeriesChart2Dataset,
			weeklyUsersDataset: {
				source: weeklyUsersSource,
				dimensions: ['timestamp', 'Active Users']
			} satisfies MultiSeriesChart2Dataset,
			weeklyAvgDataset: {
				source: weeklyAvgSource,
				dimensions: ['timestamp', 'Avg Txns per User']
			} satisfies MultiSeriesChart2Dataset
		}
	}, [query.data, query.isLoading])
}

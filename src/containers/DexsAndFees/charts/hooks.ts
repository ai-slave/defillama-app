import * as React from 'react'
import { IJoin2ReturnType } from '~/api/categories/adaptors'
import { useFetchChartsSummary } from '~/api/categories/adaptors/client'
import { chartBreakdownByChain } from '~/api/categories/adaptors/utils'
import { capitalizeFirstLetter, slug } from '~/utils'
import { chartFormatterBy } from './utils'

export const useGetFeesAndRevenueChartData = ({
	name,
	type,
	enableBreakdownChart,
	disabled
}: {
	name: string
	type: string
	enableBreakdownChart: boolean
	disabled: boolean
}) => {
	const { data, loading, error } = useFetchChartsSummary('fees', slug(name), undefined, disabled)

	const mainChart = React.useMemo(() => {
		if (loading)
			return {
				dataChart: [[], []] as [IJoin2ReturnType, string[]],
				title: 'Loading'
			}

		if (error)
			return {
				dataChart: [[], []] as [IJoin2ReturnType, string[]],
				title: 'Loading'
			}

		let chartData: IJoin2ReturnType
		let title: string
		let legend: string[]
		if (!enableBreakdownChart) {
			chartData = data?.totalDataChart[0]
			legend = data?.totalDataChart[1]
		} else {
			const [cd, lgnd] = chartBreakdownByChain(data?.totalDataChartBreakdown)
			chartData = cd
			legend = lgnd
		}
		title = Object.keys(legend).length <= 1 ? `${capitalizeFirstLetter(type)} by chain` : ''
		return {
			dataChart: [chartData, legend] as [IJoin2ReturnType, string[]],
			title: title
		}
	}, [data, error, loading, enableBreakdownChart, type])

	return chartFormatterBy('chain')(mainChart.dataChart, data?.totalDataChartBreakdown)
}

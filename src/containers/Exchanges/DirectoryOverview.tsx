import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { DirectoryChart } from './DirectoryChart'
import type { ExchangeDirectoryModel, ExchangeOverviewChartModel } from './models'
import { getResearchRange, type ExchangeResearchRange } from './queryState'
import { useLazyVisible } from './useLazyVisible'

const STALE_TIME = 60 * 60 * 1000

interface DirectoryOverviewProps {
	directory: ExchangeDirectoryModel
	loadOverview: (range: ExchangeResearchRange) => Promise<ExchangeOverviewChartModel>
	showGlobalDataNotice: boolean
}

export function DirectoryOverview({ directory, loadOverview, showGlobalDataNotice }: DirectoryOverviewProps) {
	const router = useRouter()
	const range = getResearchRange(router.query)
	const { ref, visible } = useLazyVisible<HTMLDivElement>()
	// Range is part of the key, so switching it refetches instead of redrawing the
	// window we already had.
	const query = useQuery({
		queryKey: ['exchanges-directory-overview', directory.updatedAt, range],
		queryFn: () => loadOverview(range),
		enabled: visible,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return (
		<div ref={ref}>
			{query.data ? (
				<DirectoryChart chart={query.data} range={range} showGlobalDataNotice={showGlobalDataNotice} />
			) : (
				<DirectoryChart
					chart={null}
					range={range}
					status={query.isError ? 'error' : 'loading'}
					showGlobalDataNotice={showGlobalDataNotice}
				/>
			)}
		</div>
	)
}

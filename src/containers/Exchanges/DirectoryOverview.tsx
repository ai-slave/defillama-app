import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useInViewOnce } from '~/hooks/useInViewOnce'
import { queryReadFailed } from '~/utils/query'
import { DirectoryChart } from './DirectoryChart'
import type { ExchangeDirectoryModel, ExchangeOverviewChartModel } from './models'
import { getResearchRange, type ExchangeResearchRange } from './queryState'

const STALE_TIME = 60 * 60 * 1000

interface DirectoryOverviewProps {
	directory: ExchangeDirectoryModel
	loadOverview: (range: ExchangeResearchRange) => Promise<ExchangeOverviewChartModel>
	country: string | null
}

export function DirectoryOverview({ directory, loadOverview, country }: DirectoryOverviewProps) {
	const router = useRouter()
	const range = getResearchRange(router.query)
	const { ref, seen } = useInViewOnce({ rootMargin: '400px' })
	// Range is part of the key, so switching it refetches instead of redrawing the
	// window we already had.
	const query = useQuery({
		queryKey: ['exchanges-directory-overview', directory.updatedAt, range],
		queryFn: () => loadOverview(range),
		enabled: seen,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return (
		<div ref={ref}>
			{query.data ? (
				<DirectoryChart chart={query.data} range={range} country={country} />
			) : (
				<DirectoryChart
					chart={null}
					range={range}
					failedRead={queryReadFailed(query) ? query : null}
					country={country}
				/>
			)}
		</div>
	)
}

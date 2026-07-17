import { useQuery } from '@tanstack/react-query'
import { DirectoryChart } from './DirectoryChart'
import type { ExchangeDirectoryModel, ExchangeOverviewChartModel } from './models'
import { useLazyVisible } from './useLazyVisible'

const STALE_TIME = 60 * 60 * 1000

interface DirectoryOverviewProps {
	directory: ExchangeDirectoryModel
	loadOverview: () => Promise<ExchangeOverviewChartModel>
}

export function DirectoryOverview({ directory, loadOverview }: DirectoryOverviewProps) {
	const { ref, visible } = useLazyVisible<HTMLDivElement>()
	const query = useQuery({
		queryKey: ['exchanges-directory-overview', directory.updatedAt],
		queryFn: () => loadOverview(),
		enabled: visible,
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return (
		<div ref={ref}>
			{query.data ? (
				<DirectoryChart chart={query.data} />
			) : (
				<DirectoryChart chart={null} status={query.isError ? 'error' : 'loading'} />
			)}
		</div>
	)
}

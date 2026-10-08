import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useCallback } from 'react'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelLoadingStatus } from '~/ui/Status'
import { Tabs, TabPanel } from '~/ui/Tabs'
import type { ChartOptionsMap } from './chart-datasets'
import { DownloadsCatalog as SimpleCatalog } from './DownloadsCatalog'

const SqlWorkspace = dynamic(() => import('./sql/SqlWorkspace').then((m) => m.SqlWorkspace), {
	ssr: false,
	loading: () => <PanelLoadingStatus label="Loading SQL Studio" />
})

type DownloadsMode = 'simple' | 'sql'

const MODE_OPTIONS = [
	{
		value: 'simple',
		label: (
			<span className="inline-flex items-center gap-1.5">
				<Icon name="download-cloud" className="size-3.5" />
				Simple
			</span>
		)
	},
	{
		value: 'sql',
		label: (
			<span className="inline-flex items-center gap-1.5">
				<Icon name="code" className="size-3.5" />
				SQL Studio
				<span className="rounded-sm bg-pro-success-200/15 px-1 label-xs tracking-wider text-pro-success-300">NEW</span>
			</span>
		)
	}
] as const

interface DownloadsCatalogProps {
	chartOptionsMap: ChartOptionsMap
}

export function DownloadsCatalog({ chartOptionsMap }: DownloadsCatalogProps) {
	const router = useRouter()

	const rawMode = router.query.mode
	const mode: DownloadsMode = (Array.isArray(rawMode) ? rawMode[0] : rawMode) === 'sql' ? 'sql' : 'simple'

	const handleModeChange = useCallback(
		(next: DownloadsMode) => {
			const { mode: _discard, ...rest } = router.query
			const query = next === 'sql' ? { ...rest, mode: 'sql' } : rest
			router.replace({ pathname: router.pathname, query }, undefined, { shallow: true })
		},
		[router]
	)

	return (
		<div className="flex flex-col gap-6">
			<Tabs value={mode} onValueChange={handleModeChange} values={['simple', 'sql']}>
				<ModeBand mode={mode} />
				<TabPanel value={mode}>
					{mode === 'sql' ? (
						<SqlWorkspace chartOptionsMap={chartOptionsMap} />
					) : (
						<SimpleCatalog chartOptionsMap={chartOptionsMap} />
					)}
				</TabPanel>
			</Tabs>
		</div>
	)
}

function ModeBand({ mode }: { mode: DownloadsMode }) {
	const isSql = mode === 'sql'
	const title = isSql ? 'SQL Studio' : 'Power user? Try SQL Studio'
	const subtitle = isSql
		? "You're in SQL Studio — switch back to the simple catalog anytime."
		: 'Run live SQL across every DefiLlama dataset — joins, rolling windows, and instant CSV exports.'

	return (
		<div className="flex flex-col gap-3 rounded-xl border border-sub-brand-primary/25 bg-linear-to-br from-sub-brand-primary/8 to-surface p-3 sm:flex-row sm:items-center sm:gap-5 sm:p-4">
			<div className="flex flex-col gap-0.5">
				<span className="title-md tracking-tight text-pro-text-primary">{title}</span>
				<span className="body-sm text-pro-text-secondary">{subtitle}</span>
			</div>
			{isSql ? null : (
				<div aria-hidden className="hidden shrink-0 items-center sm:ml-auto sm:flex">
					<span className="rounded-md border border-subtle bg-surface px-2.5 py-1 mono-sm tracking-tight">
						<span className="font-semibold text-sub-brand-primary">SELECT</span>
						<span className="text-pro-text-tertiary"> * </span>
						<span className="font-semibold text-sub-brand-primary">FROM</span>
						<span className="text-pro-text-secondary"> chains</span>
					</span>
				</div>
			)}
			<div className={`shrink-0 ${isSql ? 'sm:ml-auto' : ''}`}>
				<SegmentedControl semantics="tabs" label="Downloads mode" variant="default" size="md" options={MODE_OPTIONS} />
			</div>
		</div>
	)
}

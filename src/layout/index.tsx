import * as React from 'react'
import { useProtocolsFilterState } from '~/components/Filters/useProtocolFilterState'
import { MetricsAndTools } from '~/components/Metrics'
import { Nav } from '~/components/Nav'
import { DesktopSearch } from '~/components/Search'
import { Select } from '~/components/Select/Select'
import { selectTriggerStyles } from '~/components/Select/types'
import { type ISEOProps, SEO } from '~/components/SEO'
import { useIsClient } from '~/hooks/useIsClient'

const Toaster = React.lazy(() => import('~/components/Toast').then((m) => ({ default: m.Toast })))

interface ILayoutProps extends ISEOProps {
	children: React.ReactNode
	tvlOptions?: { name: string; key: string }[]
	pageName?: Array<string>
	announcement?: React.ReactNode
	hideDesktopSearchLlamaAiButton?: boolean
	hideDesktopSearch?: boolean
}

function Layout({
	title,
	description,
	canonicalUrl,
	noIndex,
	jsonLd,
	children,
	pageName,
	tvlOptions,
	announcement,
	hideDesktopSearchLlamaAiButton = false,
	hideDesktopSearch = false,
	...props
}: ILayoutProps) {
	const isClient = useIsClient()
	return (
		<>
			<SEO title={title} description={description} canonicalUrl={canonicalUrl} noIndex={noIndex} jsonLd={jsonLd} />
			<Nav tvlOptions={tvlOptions} />
			<main
				{...props}
				className="app-main-shell isolate col-span-full flex min-h-[calc(100dvh-68px)] flex-col gap-2 p-1 text-primary lg:col-span-1 lg:min-h-dvh lg:p-4 lg:pl-0"
			>
				{hideDesktopSearch ? null : (
					<span className="hidden items-center justify-between gap-3 lg:flex lg:min-h-8">
						<DesktopSearch hideLlamaAiCta={hideDesktopSearchLlamaAiButton} />

						{!tvlOptions || tvlOptions.length === 0 ? null : <TvlFilters options={tvlOptions} />}
					</span>
				)}
				{announcement ?? null}
				{pageName ? <MetricsAndTools currentMetric={pageName} /> : null}
				{children}
			</main>
			{isClient ? (
				<React.Suspense fallback={<></>}>
					<Toaster />
				</React.Suspense>
			) : null}
		</>
	)
}

function TvlFilters({ options }: { options: { name: string; key: string }[] }) {
	const { selectedValues, setSelectedValues } = useProtocolsFilterState(options)

	return (
		<>
			<Select
				allValues={options}
				selectedValues={selectedValues}
				setSelectedValues={setSelectedValues}
				label="Include in TVL"
				variant="default"
				size="sm"
				triggerProps={{
					className: `${selectTriggerStyles('default', 'sm')} ml-auto whitespace-nowrap *:shrink-0`
				}}
				placement="bottom-end"
				unmountOnHide={false}
			/>
		</>
	)
}

export default Layout

// sidebar + gap between nav & main + padding right
// 228px + 4px + 16px = 248px

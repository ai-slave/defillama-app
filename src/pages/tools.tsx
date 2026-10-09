import { matchSorter } from 'match-sorter'
import { useDeferredValue, useId, useMemo, useState } from 'react'
import { LinkToMetricOrToolPage, usePinnedRoutes } from '~/components/Metrics'
import Layout from '~/layout'
import defillamaPages from '~/public/pages.json'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'

export default function Tools() {
	const searchInputId = useId()
	const [searchValue, setSearchValue] = useState('')
	const deferredSearchValue = useDeferredValue(searchValue)

	const pages = useMemo(() => {
		if (!deferredSearchValue) return defillamaPages.Tools
		return matchSorter(defillamaPages.Tools, deferredSearchValue, {
			keys: ['name', 'description'],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [deferredSearchValue])

	const pinnedRoutes = usePinnedRoutes()

	return (
		<Layout
			title="DeFi Analytics & Research Tools - DefiLlama"
			description="Explore DeFi analytics tools: token comparisons, correlation matrix, borrow optimizer, and more. Free open-source research tools on DefiLlama."
			canonicalUrl="/tools"
		>
			<Card padding="sm" className="flex flex-col gap-2">
				<h1 className="heading-sm">Tools</h1>
				<div className="relative">
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<Input
						id={searchInputId}
						type="text"
						placeholder="Search…"
						className={searchFieldInputPlacementStyles}
						onInput={(e) => setSearchValue(e.currentTarget.value)}
					/>
				</div>
			</Card>
			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{pages.map((tool: any) => (
					<LinkToMetricOrToolPage
						key={`tool-${tool.name}-${tool.route}`}
						page={tool}
						totalTrackedByMetric={null}
						pinnedRoutes={pinnedRoutes}
					/>
				))}
			</div>
		</Layout>
	)
}

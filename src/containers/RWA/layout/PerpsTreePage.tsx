import { useMemo } from 'react'
import type { IRWAAssetsOverview, RWASpotFilterKey } from '../api.types'
import { RWAOverview } from '../index'
import { unpackRwaPerpsMarkets } from '../perpsPayload'
import type { RWAPerpsPageProps } from '../perpsQueries'
import type { RWAPageKind } from './pageLayout'

/** The container reads the spot filter lists on every page; the Perps tree filters through its rows, so they stay empty. */
const NO_SPOT_FILTERS: Pick<IRWAAssetsOverview, RWASpotFilterKey> = {
	typeOptions: [],
	assetClassOptions: [],
	rwaClassificationOptions: [],
	accessModelOptions: [],
	categoriesOptions: [],
	platforms: [],
	assetGroups: [],
	assetNames: [],
	issuers: [],
	selectedPlatform: 'All',
	selectedChain: 'All',
	selectedCategory: 'All',
	chainSlug: null,
	categorySlug: null,
	platformSlug: null
}

/**
 * A Perps tree page: its packed markets unpacked once, then the same overview container as the Assets pages.
 * `perpsAsset`: the underlying of /rwa/perps/asset/:key, for its chart scope and its h1; null on the other two.
 */
export function RWAPerpsTreePage({
	overview,
	markets,
	cards,
	pageKind,
	perpsAsset,
	entityQuestions
}: RWAPerpsPageProps & {
	pageKind: Extract<RWAPageKind, 'perpsOverview' | 'perpsAssetGroup' | 'perpsAsset'>
	perpsAsset: string | null
	entityQuestions?: Array<string>
}) {
	const assets = useMemo(() => unpackRwaPerpsMarkets(markets), [markets])
	return (
		<RWAOverview
			{...NO_SPOT_FILTERS}
			{...overview}
			assets={assets}
			pageKind={pageKind}
			perpsCards={cards}
			perpsAsset={perpsAsset}
			entityQuestions={entityQuestions}
		/>
	)
}

import { DirectoryHeader } from './DirectoryHeader'
import { DirectoryOverview } from './DirectoryOverview'
import { DirectoryTable } from './DirectoryTable'
import type { useExchangeCountry } from './ExchangeCountrySelect'
import type { ExchangeDirectoryModel, ExchangeDirectoryRowModel, ExchangeOverviewChartModel } from './models'
import { selectVenueDestination } from './venueLinks'

// ponytail: static sponsor banner — move behind the Research banner API if this ever
// needs targeting, scheduling or more than one creative.
const SPONSOR_BANNER = {
	slug: 'bybit',
	imageUrl: '/assets/exchanges/bybit-banner.jpg',
	alt: 'Bybit — a smarter way to trade',
	// Only reached when the venue is missing from the directory payload.
	fallbackUrl: 'https://www.bybit.com'
}

/** Same referral the venue's own row links to, so the banner never points somewhere staler. */
export function sponsorBannerHref(rows: Array<ExchangeDirectoryRowModel>): string {
	const venue = rows.find((row) => row.slug === SPONSOR_BANNER.slug)
	if (!venue) return SPONSOR_BANNER.fallbackUrl
	return selectVenueDestination(venue.slug, venue.referralUrl, venue.websiteUrl)?.url ?? SPONSOR_BANNER.fallbackUrl
}

interface ExchangeDirectoryProps {
	directory: ExchangeDirectoryModel
	loadOverview: () => Promise<ExchangeOverviewChartModel>
	countryState: ReturnType<typeof useExchangeCountry>
}

export function ExchangeDirectory({ directory, loadOverview, countryState }: ExchangeDirectoryProps) {
	return (
		<div className="flex flex-1 flex-col gap-2">
			<div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
				<DirectoryHeader summary={directory.summary} />
				<div className="xl:col-[2/-1]">
					<DirectoryOverview
						directory={directory}
						loadOverview={loadOverview}
						showGlobalDataNotice={countryState.country !== null}
					/>
				</div>
			</div>
			<a
				href={sponsorBannerHref(directory.rows)}
				target="_blank"
				rel="noopener noreferrer sponsored"
				className="mx-auto block w-full overflow-hidden rounded-md sm:w-3/5"
			>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={SPONSOR_BANNER.imageUrl}
					alt={SPONSOR_BANNER.alt}
					width={2560}
					height={421}
					className="block h-auto w-full"
					loading="lazy"
				/>
			</a>
			<DirectoryTable
				rows={directory.rows}
				country={countryState.country}
				catalog={countryState.catalog}
				catalogFailed={countryState.catalogFailed}
				executionAvailable={directory.executionAvailable}
				executionCostBasket={directory.executionCostBasket}
				executionFillBasket={directory.executionFillBasket}
				onCountryChange={countryState.setCountry}
			/>
		</div>
	)
}

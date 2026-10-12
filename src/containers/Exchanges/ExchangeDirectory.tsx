import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { DirectoryHeader } from './DirectoryHeader'
import { DirectoryOverview } from './DirectoryOverview'
import { DirectoryTable } from './DirectoryTable'
import { EXCHANGES_METHODOLOGY_URL, LIST_YOUR_EXCHANGE_URL } from './docsLinks'
import type { useExchangeCountry } from './ExchangeCountrySelect'
import type { ExchangeDirectoryModel, ExchangeDirectoryRowModel, ExchangeOverviewChartModel } from './models'
import { selectVenueDestination } from './venueLinks'

// ponytail: static sponsor banner — move behind the Research banner API if this ever
// needs targeting, scheduling or more than one creative.
const SPONSOR_BANNER = {
	slug: 'bybit',
	imageUrl: '/assets/exchanges/bybit-banner.jpg',
	alt: 'Bybit: a smarter way to trade',
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
					<DirectoryOverview directory={directory} loadOverview={loadOverview} country={countryState.country} />
				</div>
			</div>
			<a
				href={sponsorBannerHref(directory.rows)}
				target="_blank"
				rel="noopener noreferrer sponsored"
				data-umami-event="bybit-banner-click"
				className="relative mx-auto block w-full max-w-[1800px] overflow-hidden rounded-md"
			>
				{/* Colors are inline rather than classes: the badge sits on the banner art, which is
				    dark in both themes, so it must not follow the theme the way a semantic token would. */}
				<span
					className="absolute top-2 right-2 z-10 rounded-sm px-1.5 py-0.5 label-xs tracking-wide uppercase backdrop-blur-sm"
					style={{ background: 'rgb(0 0 0 / 0.55)', color: 'rgb(255 255 255 / 0.85)' }}
				>
					Sponsored
				</span>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={SPONSOR_BANNER.imageUrl}
					alt={SPONSOR_BANNER.alt}
					width={3840}
					height={362}
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
				onCountryChange={countryState.setCountry}
			/>
			<p className="px-1 pb-2 body-sm text-tertiary">
				Exchange missing?{' '}
				<Button
					as={BasicLink}
					href={LIST_YOUR_EXCHANGE_URL}
					target="_blank"
					rel="noopener noreferrer"
					variant="inlineLink"
				>
					List your exchange
				</Button>
				. How every number here is built:{' '}
				<Button
					as={BasicLink}
					href={EXCHANGES_METHODOLOGY_URL}
					target="_blank"
					rel="noopener noreferrer"
					variant="inlineLink"
				>
					Methodology
				</Button>
				.
			</p>
		</div>
	)
}

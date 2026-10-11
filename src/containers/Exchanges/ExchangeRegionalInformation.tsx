import { useQuery } from '@tanstack/react-query'
import { BasicLink } from '~/components/Link'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { InlineStatus, LoadingIndicator, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { type Status, StatusBadge } from '~/ui/StatusBadge'
import { type QueryRetry, queryReadFailed } from '~/utils/query'
import { countryLabel, ExchangeCountrySelect, type useExchangeCountry } from './ExchangeCountrySelect'
import { fetchExchangeRegionalMetadata } from './master.api'
import { MetadataGroups } from './MetadataGroups'
import { METADATA_GROUP_ORDER, METADATA_GROUP_PRESENTATION } from './metadataPresentation'
import type {
	ExchangeMetadataGroupKey,
	ExchangeProfileModel,
	ExchangeRegionalMetadataModel,
	ExchangeRegionStatus
} from './models'
import { ProfilePromotions } from './ProfilePromotions'

const REGIONAL_METADATA_STALE_TIME = 60 * 60 * 1000

export function useExchangeRegionalMetadata(slug: string, country: string | null) {
	return useQuery<ExchangeRegionalMetadataModel>({
		queryKey: ['exchange-regional-metadata', slug, country],
		queryFn: () => fetchExchangeRegionalMetadata(slug, country!),
		enabled: country !== null,
		staleTime: REGIONAL_METADATA_STALE_TIME,
		refetchOnWindowFocus: false
	})
}

export type ProfileCountryView =
	| { status: 'global' }
	| { status: 'loading'; country: string }
	| { status: 'error'; country: string; query: QueryRetry }
	| {
			[Availability in ExchangeRegionStatus]: {
				status: Availability
				country: string
				regional: Extract<ExchangeRegionalMetadataModel, { availability: Availability }>
			}
	  }[ExchangeRegionStatus]

export function resolveProfileCountryView(
	country: string | null,
	query: {
		data?: ExchangeRegionalMetadataModel | undefined
		isPlaceholderData: boolean
		isFetching: boolean
		errorUpdatedAt: number
		dataUpdatedAt: number
		refetch: () => unknown
	}
): ProfileCountryView {
	if (!country) return { status: 'global' }
	if (query.data) {
		switch (query.data.availability) {
			case 'available':
				return { status: 'available', country, regional: query.data }
			case 'restricted':
				return { status: 'restricted', country, regional: query.data }
			case 'leaving':
				return { status: 'leaving', country, regional: query.data }
			case 'unavailable':
				return { status: 'unavailable', country, regional: query.data }
		}
	}
	if (queryReadFailed(query)) return { status: 'error', country, query }
	return { status: 'loading', country }
}

export function profileInformationMetadata(
	profile: ExchangeProfileModel,
	view: ProfileCountryView
): ExchangeProfileModel['metadata'] | null {
	if (view.status === 'global' || view.status === 'error') return profile.metadata
	if (view.status === 'loading' || view.status === 'unavailable') return null
	return view.regional.metadata
}

const STATUS_PRESENTATION: Record<
	ExchangeRegionStatus,
	{ label: string; status: Status; sentence: (exchange: string, country: string) => string }
> = {
	available: {
		label: 'Available',
		status: 'good',
		sentence: (exchange, country) => `${exchange} is available in ${country}.`
	},
	restricted: {
		label: 'Restricted',
		status: 'caution',
		sentence: (exchange, country) => `${exchange} has restrictions in ${country}.`
	},
	leaving: {
		label: 'Leaving',
		status: 'caution',
		sentence: (exchange, country) => `${exchange} is leaving ${country}.`
	},
	unavailable: {
		label: 'Unavailable',
		status: 'bad',
		sentence: (exchange, country) => `${exchange} is not available in ${country}.`
	}
}

export function ProfileCountryCard({
	profileName,
	view,
	countryState
}: {
	profileName: string
	view: ProfileCountryView
	countryState: ReturnType<typeof useExchangeCountry>
}) {
	const country = view.status === 'global' ? null : view.country
	return (
		<Card padding="sm" className="flex flex-col gap-3">
			<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
				<div>
					<p className="label-md">Country-specific information</p>
					<p className="body-sm text-tertiary">Choose a country to view its availability, products, and rules.</p>
				</div>
				<ExchangeCountrySelect
					catalog={countryState.catalog}
					catalogFailed={countryState.catalogFailed}
					selectedCountry={countryState.country}
					onCountryChange={countryState.setCountry}
				/>
			</div>

			{view.status === 'loading' ? (
				<div role="status" aria-live="polite">
					<LoadingIndicator label={`Loading information for ${countryLabel(view.country)}`} />
				</div>
			) : view.status === 'error' ? (
				<InlineStatus variant="error" retry={view.query}>
					Couldn&apos;t load country-specific information for {countryLabel(view.country)}. Showing global information.
				</InlineStatus>
			) : view.status !== 'global' && country ? (
				<RegionalAvailability profileName={profileName} country={countryLabel(country)} regional={view.regional} />
			) : null}
		</Card>
	)
}

export function ExchangeRegionalInformation({
	profile,
	asOfDate,
	view
}: {
	profile: ExchangeProfileModel
	asOfDate: string
	view: ProfileCountryView
}) {
	if (view.status === 'loading') {
		return (
			<Card padding="sm">
				<SurfaceBodyLoadingStatus label={`Loading information for ${countryLabel(view.country)}`} className="min-h-0" />
			</Card>
		)
	}
	if (view.status === 'unavailable') {
		const country = countryLabel(view.country)
		return (
			<Card as="section" padding="none" className="overflow-hidden">
				<div className="flex items-center gap-2 border-b border-subtle px-3 py-2.5">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-error-tint text-error">
						<Icon name="circle-x" className="size-4" />
					</span>
					<h2 className="label-lg">Not available in {country}</h2>
				</div>
				<div className="p-3">
					<p className="label-md">
						Country-specific information is not available because {profile.name} is not offered in {country}.
					</p>
				</div>
			</Card>
		)
	}
	const metadata = profileInformationMetadata(profile, view)
	if (!metadata) return null
	const metadataKeys = new Set(metadata.groups.map((group) => group.key))
	const globalMetadataKeys = new Set(profile.metadata.groups.map((group) => group.key))
	const placeholders: Array<{ key: ExchangeMetadataGroupKey; message: string }> = []
	if (view.status === 'global' && !metadataKeys.has('funding')) {
		placeholders.push({
			key: 'funding',
			message: 'Select a country to view available deposit and withdrawal methods.'
		})
	} else if (view.status === 'available' || view.status === 'restricted' || view.status === 'leaving') {
		for (const key of METADATA_GROUP_ORDER) {
			if (metadataKeys.has(key) || (key !== 'funding' && !globalMetadataKeys.has(key))) continue
			placeholders.push({
				key,
				message: `Nothing ${countryLabel(view.country)}-specific is published here. That does not mean the feature is unavailable.`
			})
		}
	}
	return (
		<div className="flex flex-col gap-2">
			<ProfilePromotions promotions={metadata.promotions} asOfDate={asOfDate} />
			<MetadataGroups groups={metadata.groups} exchangeName={profile.name} />
			{placeholders.length > 0 ? (
				<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
					{placeholders.map((placeholder) => {
						const presentation = METADATA_GROUP_PRESENTATION[placeholder.key]
						return (
							<Card key={placeholder.key} as="section" padding="none" className="overflow-hidden">
								<div className="flex items-center gap-2 border-b border-subtle px-3 py-2.5">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-link">
										<Icon name={presentation.icon} className="size-4" />
									</span>
									<h2 className="label-lg">{presentation.title}</h2>
								</div>
								<p className="p-3 body-sm text-secondary">{placeholder.message}</p>
							</Card>
						)
					})}
				</div>
			) : null}
		</div>
	)
}

function RegionalAvailability({
	profileName,
	country,
	regional
}: {
	profileName: string
	country: string
	regional: ExchangeRegionalMetadataModel
}) {
	const presentation = STATUS_PRESENTATION[regional.availability]
	return (
		<div className="flex flex-col gap-1.5" role="status">
			<div className="flex flex-wrap items-center gap-2">
				<StatusBadge status={presentation.status}>{presentation.label}</StatusBadge>
				<p className="label-md">{regional.note ?? presentation.sentence(profileName, country)}</p>
			</div>
			<p className="body-sm text-tertiary">
				{country} maps to {regional.region.label} rules.
				{regional.usedFallback ? ' The global report is used because no specific regional report is authored.' : ''}
			</p>
			{regional.source ? (
				<p className="body-sm text-tertiary">
					Source:{' '}
					<BasicLink
						href={regional.source.url}
						target="_blank"
						rel="noopener noreferrer"
						className="text-link hover:underline"
					>
						{regional.source.note ?? 'Regional availability'}
					</BasicLink>
					{regional.source.asOf ? ` · ${regional.source.asOf}` : ''}
				</p>
			) : null}
		</div>
	)
}

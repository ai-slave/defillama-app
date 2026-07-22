import type { MasterExchangeRegionCatalogResponse, MasterExchangeRegionManifestResponse } from './master.types'
import type { ExchangeCountryAvailabilityModel } from './models'

/** Resolve the producer-authored effective availability for one published country. */
export function resolveCountryAvailability(
	catalog: MasterExchangeRegionCatalogResponse,
	manifest: Pick<MasterExchangeRegionManifestResponse, 'variants'>,
	country: string
): ExchangeCountryAvailabilityModel {
	const region = catalog.country_regions[country]
	const exact = manifest.variants[region]
	const variant = exact ?? manifest.variants.global

	const override = variant.country_overrides[country]
	const availability =
		variant.status === 'unavailable' || override?.status === 'unavailable'
			? 'unavailable'
			: (override?.status ?? variant.status)
	return {
		country,
		region: { key: region, label: catalog.regions[region].label },
		availability,
		segments: availability === 'unavailable' ? [] : variant.segments,
		note: override?.note ?? variant.note ?? null,
		source: override?.source ?? variant.source ?? null,
		usedFallback: !exact
	}
}

import type { MasterExchangeRegionCatalogResponse, MasterExchangeRegionManifestResponse } from './master.types'
import type { ExchangeCountryAvailabilityModel } from './models'

/** Resolve the producer-authored effective availability for one published country. */
export function resolveCountryAvailability(
	catalog: MasterExchangeRegionCatalogResponse,
	manifest: Pick<MasterExchangeRegionManifestResponse, 'variants'>,
	country: string
): ExchangeCountryAvailabilityModel {
	const region = catalog.country_regions[country]
	if (!region) throw new Error(`Missing region for ${country}`)
	const regionDefinition = catalog.regions[region]
	if (!regionDefinition) throw new Error(`Missing region definition for ${region}`)
	const exact = manifest.variants[region]
	const variant = exact ?? manifest.variants.global

	const override = variant.country_overrides[country]
	const availability =
		variant.status === 'unavailable' || override?.status === 'unavailable'
			? 'unavailable'
			: (override?.status ?? variant.status)
	return {
		country,
		region: { key: region, label: regionDefinition.label },
		availability,
		segments: availability === 'unavailable' ? [] : variant.segments,
		note: override?.note ?? variant.note ?? null,
		source: override?.source ?? variant.source ?? null,
		usedFallback: !exact
	}
}

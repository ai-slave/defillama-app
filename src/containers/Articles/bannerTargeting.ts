import { useQuery } from '@tanstack/react-query'
import type { Banner } from '~/containers/Articles/types'

export type VisitorRegionResult = {
	country: string | null
	audience: 'eu' | 'rest' | 'unknown'
}

const VISITOR_REGION_QUERY_KEY = ['visitor-region'] as const

function targetCountries(banner: Banner): string[] {
	return Array.isArray(banner.targetCountries)
		? banner.targetCountries
				.filter((country): country is string => typeof country === 'string')
				.map((country) => country.trim().toUpperCase())
				.filter((country) => /^[A-Z]{2}$/.test(country) && country !== 'XX')
		: []
}

export function bannerNeedsVisitorCountry(banner: Banner | null | undefined): boolean {
	return !!banner?.enabled && targetCountries(banner).length > 0
}

export function candidatesNeedVisitorCountry(candidates: Array<Banner | null | undefined>): boolean {
	for (const banner of candidates) {
		if (!banner?.enabled) continue
		if (!bannerNeedsVisitorCountry(banner)) return false
		return true
	}
	return false
}

export function selectBannerForCountry(
	candidates: Array<Banner | null | undefined>,
	country: string | null,
	visitorResolved: boolean
): Banner | null {
	const normalizedCountry = country?.trim().toUpperCase() ?? null

	for (const banner of candidates) {
		if (!banner?.enabled) continue
		const targets = targetCountries(banner)
		if (targets.length === 0) return banner
		if (!visitorResolved) return null
		if (normalizedCountry && normalizedCountry !== 'XX' && normalizedCountry !== 'T1') {
			if (targets.includes(normalizedCountry)) return banner
		}
	}

	return null
}

async function fetchVisitorRegion(): Promise<VisitorRegionResult> {
	const response = await fetch('/api/dynamic/visitor-region', { cache: 'no-store' })
	if (!response.ok) throw new Error(`Failed to resolve visitor region (${response.status})`)
	const data = (await response.json()) as Partial<VisitorRegionResult>
	return {
		country: typeof data.country === 'string' ? data.country.toUpperCase() : null,
		audience: data.audience === 'eu' || data.audience === 'rest' ? data.audience : 'unknown'
	}
}

export function useEligibleBanner(
	candidates: Array<Banner | null | undefined>,
	candidatesLoading = false
): Banner | null {
	const needsVisitor = !candidatesLoading && candidatesNeedVisitorCountry(candidates)
	const visitorQuery = useQuery<VisitorRegionResult>({
		queryKey: VISITOR_REGION_QUERY_KEY,
		queryFn: fetchVisitorRegion,
		enabled: typeof window !== 'undefined' && needsVisitor,
		retry: false,
		staleTime: Infinity,
		refetchOnWindowFocus: false
	})

	if (candidatesLoading) return null
	const visitorResolved = !needsVisitor || visitorQuery.data !== undefined || visitorQuery.isError
	return selectBannerForCountry(candidates, visitorQuery.data?.country ?? null, visitorResolved)
}

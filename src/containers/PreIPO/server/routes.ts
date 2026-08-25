import { getMetadataCache, type StaticParamPath } from '~/server/routeRegistry/common'
import type { MetadataCache } from '~/utils/metadata/artifactContract'

const PRE_RENDERED_COMPANY_LIMIT = 50

export function resolvePreIpoCompanyId(
	companyParam: string,
	metadata: Pick<MetadataCache, 'preIpoCompanyIdsSet'>
): string | null {
	const company = companyParam.toLowerCase()
	return metadata.preIpoCompanyIdsSet.has(company) ? company : null
}

export async function getPreIpoCompanyStaticPaths(): Promise<Array<StaticParamPath<'company'>>> {
	const metadata = await getMetadataCache()
	const paths: Array<StaticParamPath<'company'>> = []
	for (const company of metadata.preIpoCompanyIds) {
		if (paths.length >= PRE_RENDERED_COMPANY_LIMIT) break
		paths.push({ params: { company } })
	}
	return paths
}

export function getPreIpoSitemapRoutes(metadata: Pick<MetadataCache, 'preIpoCompanyIds'>): string[] {
	const routes: string[] = []
	for (const company of metadata.preIpoCompanyIds) routes.push(`pre-ipo/${company}`)
	return routes
}

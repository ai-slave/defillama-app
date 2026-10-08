import { resolveCexParamFromMetadata } from '~/containers/Cexs/server/routes'
import { resolveProtocolParamFromMetadata } from '~/containers/ProtocolOverview/server/routes'
import type { MetadataCache } from '~/utils/metadata/artifactContract'

/**
 * The platforms index names a protocol slug for most platforms, and About links /protocol/<slug>. A slug the protocol
 * page cannot resolve (a protocol or a CEX) would be a dead link, so it is dropped here, where the metadata is.
 */
export function keepKnownProtocolSlug<T extends { protocolSlug: string | null }>(
	meta: T,
	metadataCache: MetadataCache
): T {
	const slug = meta.protocolSlug
	if (!slug) return meta
	const known =
		resolveCexParamFromMetadata(slug, metadataCache) != null ||
		resolveProtocolParamFromMetadata(slug, metadataCache) != null
	return known ? meta : { ...meta, protocolSlug: null }
}

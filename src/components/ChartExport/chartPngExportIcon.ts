export function getChartExportIconFetchUrl(url: string): string {
	const protocolSlug = url.match(/\/protocols\/([^?]+)/)?.[1]
	if (protocolSlug) {
		return `/api/public/protocol-icon?slug=${encodeURIComponent(protocolSlug)}`
	}

	const chainSlug = url.match(/\/chains\/rsz_([^?]+)/)?.[1]
	if (chainSlug) {
		return `/api/public/chain-icon?slug=${encodeURIComponent(chainSlug)}`
	}

	return `/api/public/icon-proxy?url=${encodeURIComponent(url)}`
}

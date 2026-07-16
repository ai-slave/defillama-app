const ICONS_CDN = 'https://icons.llamao.fi/icons'

export function protocolIconUrl(slug: string, size = 48): string {
	return `${ICONS_CDN}/protocols/${slug}?w=${size}&h=${size}`
}

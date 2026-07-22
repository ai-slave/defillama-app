import { ICONS_CDN } from '~/constants'

const STRIP_QUOTES_AND_PARENS = /[()'"]/g
const WHITESPACE = /\s+/g
const INVALID_CHARS = /[^\w.!&-]/g

export function tokenIconUrl(name: string, size: number = 48): string {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(STRIP_QUOTES_AND_PARENS, '')
		.replace(WHITESPACE, '-')
		.replace(INVALID_CHARS, '')

	return `${ICONS_CDN}/protocols/${slug}?w=${size}&h=${size}`
}

export function exchangeIconUrl(exchange: string, size: number = 48): string {
	return `${ICONS_CDN}/exchanges/${encodeURIComponent(exchange.toLowerCase())}?w=${size}&h=${size}`
}

export function chainIconUrl(chain: string, size: number = 48): string {
	return `${ICONS_CDN}/chains/rsz_${chain.toLowerCase()}?w=${size}&h=${size}`
}

export function peggedAssetIconUrl(name: string, size: number = 48): string {
	const slug = name.trim().toLowerCase().replace(WHITESPACE, '-')

	return `${ICONS_CDN}/pegged/${encodeURIComponent(slug)}?w=${size}&h=${size}`
}

export function equityIconUrl(symbol: string, country: string, size: number = 48): string {
	return `${ICONS_CDN}/equities/${encodeURIComponent(country.toUpperCase())}/${encodeURIComponent(symbol.toUpperCase())}?w=${size}&h=${size}`
}

export function equityCountryFlagUrl(country: string, size: number = 48): string {
	return `${ICONS_CDN}/equities/${encodeURIComponent(country.toUpperCase())}/flag?w=${size}&h=${size}`
}

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }

/** Inline SVG data URI showing the name's first character — a fallback logo so a missing icon doesn't read as broken. */
export function letterLogoDataUri(name: string, size: number = 48): string {
	const char = (name.trim()[0] ?? '?').toUpperCase().replace(/[&<>"']/g, (c) => XML_ESCAPES[c])
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size / 2}" fill="#3b4252"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${size * 0.5}" fill="#e5e9f0">${char}</text></svg>`
	return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function geckoTokenIconUrl(nk: string, size: number = 48): string {
	const raw = nk.startsWith('coingecko:') ? nk.slice('coingecko:'.length) : nk
	const slug = raw.trim().toLowerCase()
	return `https://token-icons.llamao.fi/icons/tokens/gecko/${encodeURIComponent(slug)}?w=${size}&h=${size}`
}

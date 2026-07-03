const REGION_NAMES =
	typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

export function countryFromCode(code: string | null | undefined): { flag: string; name: string } | null {
	if (!code) return null
	const cc = code.trim().toUpperCase()
	if (!/^[A-Z]{2}$/.test(cc)) return null
	const name = REGION_NAMES?.of(cc) ?? cc
	const flag = String.fromCodePoint(...[...cc].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65))
	return { flag, name }
}

import type { CSSProperties } from 'react'

export function avatarColorStyle(seed: string): CSSProperties {
	let hash = 5381
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 33) ^ seed.charCodeAt(i)
	}
	const hue = Math.abs(hash) % 360
	return {
		backgroundColor: `oklch(0.52 0.11 ${hue})`,
		color: '#fff'
	}
}

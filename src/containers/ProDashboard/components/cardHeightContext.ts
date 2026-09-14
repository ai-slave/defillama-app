import { createContext, useContext } from 'react'

export const CardHeightScaleContext = createContext(1)

export function useCardHeightScale() {
	return useContext(CardHeightScaleContext)
}

export function scaledPx(base: number, scale: number) {
	return `${Math.round(base * scale)}px`
}

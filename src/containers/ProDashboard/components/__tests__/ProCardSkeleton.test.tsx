// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { ProCardSkeleton, type ProCardSkeletonVariant, skeletonVariantForItemKind } from '../ProCardSkeleton'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const VARIANTS: Array<ProCardSkeletonVariant> = ['chart', 'metric', 'table', 'text', 'pie']

test.each(VARIANTS)('the %s skeleton stays out of the accessibility tree', async (variant) => {
	await act(async () => root.render(<ProCardSkeleton kind={variant} />))
	const skeleton = container.querySelector(`[data-skeleton="${variant}"]`)
	expect(skeleton).not.toBeNull()
	expect(skeleton?.getAttribute('aria-hidden')).toBe('true')
	expect(skeleton?.textContent).toBe('')
})

test('item kinds map onto the skeleton that matches their card', () => {
	expect(skeletonVariantForItemKind('metric')).toBe('metric')
	expect(skeletonVariantForItemKind('unified-table')).toBe('table')
	expect(skeletonVariantForItemKind('dataset-table')).toBe('table')
	expect(skeletonVariantForItemKind('custom-data')).toBe('table')
	expect(skeletonVariantForItemKind('sql')).toBe('table')
	expect(skeletonVariantForItemKind('unlocks-pie')).toBe('pie')
	expect(skeletonVariantForItemKind('text')).toBe('text')
	expect(skeletonVariantForItemKind('chart')).toBe('chart')
	expect(skeletonVariantForItemKind('multi')).toBe('chart')
	expect(skeletonVariantForItemKind('advanced-tvl')).toBe('chart')
	expect(skeletonVariantForItemKind(undefined)).toBe('chart')
})

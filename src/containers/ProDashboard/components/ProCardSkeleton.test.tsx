// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { ProCardSkeleton, type ProCardSkeletonVariant, skeletonVariantForItemKind } from './ProCardSkeleton'

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

test.each(VARIANTS)('the %s variant renders a shape and stays out of the accessibility tree', async (variant) => {
	await act(async () => root.render(<ProCardSkeleton kind={variant} />))
	const skeleton = container.querySelector(`[data-skeleton="${variant}"]`)
	expect(skeleton).not.toBeNull()
	expect(skeleton?.getAttribute('aria-hidden')).toBe('true')
	expect(skeleton?.textContent).toBe('')
	expect(skeleton?.querySelector('.animate-shimmer')).not.toBeNull()
})

test('the chart variant draws a deterministic wave and axis ticks', async () => {
	await act(async () => root.render(<ProCardSkeleton kind="chart" />))
	const paths = Array.from(container.querySelectorAll('path'))
	expect(paths).toHaveLength(2)
	expect(paths[0]?.getAttribute('d')).toContain('L100,32 L0,32 Z')
	expect(paths[1]?.getAttribute('class')).toBe('stroke-pro-text-tertiary/30')

	const firstRender = container.innerHTML
	await act(async () => root.render(<div />))
	await act(async () => root.render(<ProCardSkeleton kind="chart" />))
	expect(container.innerHTML).toBe(firstRender)
})

test('the table variant lays out a header and six rows', async () => {
	await act(async () => root.render(<ProCardSkeleton kind="table" />))
	const rows = container.querySelectorAll('[data-skeleton="table"] > div > div')
	expect(rows).toHaveLength(7)
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

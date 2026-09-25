import { describe, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from '../../../dashboardItemConfig'
import {
	chartPlanSourceKey,
	createStreamItemReadiness,
	createStreamSourceRegistry,
	streamSourceKey
} from '../itemReadiness'

const items: Array<DashboardItemConfig> = [
	{ id: 'text-1', kind: 'text', content: 'hello' },
	{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' },
	{ id: 'chart-1', kind: 'chart', subjectType: 'protocol', protocol: 'aave', type: 'fees' },
	{
		id: 'multi-1',
		kind: 'multi',
		items: [
			{ id: 'a', kind: 'chart', subjectType: 'protocol', protocol: 'aave', type: 'fees' },
			{ id: 'b', kind: 'chart', subjectType: 'protocol', protocol: 'lido', type: 'tvl' }
		]
	}
]

describe('createStreamItemReadiness', () => {
	test('an item is ready once every registered source settled', () => {
		const readiness = createStreamItemReadiness(items)
		readiness.register('multi-1', 'chart:a')
		readiness.register('multi-1', 'chart:b')

		expect(readiness.settle('chart:a')).toEqual([])
		expect(readiness.pending()).toEqual(['text-1', 'section-1', 'chart-1', 'multi-1'])
		expect(readiness.settle('chart:b')).toEqual(['multi-1'])
		expect(readiness.pending()).toEqual(['text-1', 'section-1', 'chart-1'])
	})

	test('a shared source readies every dependent item at once', () => {
		const readiness = createStreamItemReadiness(items)
		readiness.register('chart-1', 'chart:a')
		readiness.register('multi-1', 'chart:a')

		expect(readiness.settle('chart:a')).toEqual(['chart-1', 'multi-1'])
		expect(readiness.settle('chart:a')).toEqual([])
	})

	test('a synthetic plan source holds an item until its real sources are registered', () => {
		const readiness = createStreamItemReadiness(items)
		readiness.register('chart-1', chartPlanSourceKey('chart-1'))
		readiness.register('chart-1', 'chart:a')

		expect(readiness.settle(chartPlanSourceKey('chart-1'))).toEqual([])
		expect(readiness.settle('chart:a')).toEqual(['chart-1'])
	})

	test('unregistered lists only items without sources that are not ready yet', () => {
		const readiness = createStreamItemReadiness(items)
		readiness.register('chart-1', 'chart:a')
		readiness.register('multi-1', 'chart:a')

		expect(readiness.unregistered()).toEqual(['text-1', 'section-1'])
		expect(readiness.markReady(readiness.unregistered())).toEqual(['text-1', 'section-1'])
		expect(readiness.unregistered()).toEqual([])
		expect(readiness.markReady(['text-1', 'chart-1'])).toEqual(['chart-1'])
		expect(readiness.settle('chart:a')).toEqual(['multi-1'])
	})

	test('registering a source for a ready item is ignored', () => {
		const readiness = createStreamItemReadiness(items)
		readiness.markReady(['text-1'])
		readiness.register('text-1', 'chart:a')

		expect(readiness.unregistered()).toEqual(['section-1', 'chart-1', 'multi-1'])
		expect(readiness.settle('chart:a')).toEqual([])
	})
})

describe('createStreamSourceRegistry', () => {
	const runImmediately = (run: () => Promise<void>) => run()

	// Claims dedupe by key, so two different sources sharing a key would leave one card without data.
	test('source keys match for equal query keys and differ for any other kind or key', () => {
		const key = streamSourceKey('chart', ['pro-dashboard', 'fees', 'aave'])
		expect(streamSourceKey('chart', ['pro-dashboard', 'fees', 'aave'])).toBe(key)
		expect(streamSourceKey('advanced-tvl', ['pro-dashboard', 'fees', 'aave'])).not.toBe(key)
		expect(streamSourceKey('chart', ['pro-dashboard', 'fees,aave'])).not.toBe(key)
		expect(streamSourceKey('chart', ['pro-dashboard', 'fees', 1])).not.toBe(
			streamSourceKey('chart', ['pro-dashboard', 'fees', '1'])
		)
	})

	test('claims each source once', () => {
		const registry = createStreamSourceRegistry(createStreamItemReadiness(items), runImmediately, async () => {})

		expect(registry.claim('chart:a')).toBe(true)
		expect(registry.claim('chart:a')).toBe(false)
		expect(registry.claim('chart:b')).toBe(true)
	})

	test('settles the source and reports ready items after a successful run', async () => {
		const onItemsReady = vi.fn(async () => {})
		const registry = createStreamSourceRegistry(createStreamItemReadiness(items), runImmediately, onItemsReady)
		registry.register('chart-1', 'chart:a')

		await registry.schedule('chart:a', async () => {})

		expect(onItemsReady).toHaveBeenCalledWith(['chart-1'])
	})

	test('settles the source when the run rejects and keeps the rejection', async () => {
		const onItemsReady = vi.fn(async () => {})
		const registry = createStreamSourceRegistry(createStreamItemReadiness(items), runImmediately, onItemsReady)
		registry.register('chart-1', 'chart:a')

		await expect(registry.schedule('chart:a', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')

		expect(onItemsReady).toHaveBeenCalledWith(['chart-1'])
	})

	test('settles the source when the scheduler cancels the run without executing it', async () => {
		const onItemsReady = vi.fn(async () => {})
		const run = vi.fn(async () => {})
		const registry = createStreamSourceRegistry(createStreamItemReadiness(items), () => Promise.resolve(), onItemsReady)
		registry.register('chart-1', 'chart:a')

		await registry.schedule('chart:a', run)

		expect(run).not.toHaveBeenCalled()
		expect(onItemsReady).toHaveBeenCalledWith(['chart-1'])
	})
})

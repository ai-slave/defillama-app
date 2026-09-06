import { describe, expect, test, vi } from 'vitest'
import { registerTreemapFocusTracking } from './focus'

describe('treemap focus tracking', () => {
	test('tracks drilldown paths, clears on restore, and removes its listeners', () => {
		const handlers = new Map<string, (params?: unknown) => void>()
		const node = {
			getId: () => 'technology/apple',
			getAncestors: () => [
				{ name: 'Technology', getChildIndex: () => -1 },
				{ name: 'Apple', getChildIndex: () => 2 }
			]
		}
		const instance = {
			on: vi.fn((event: string, handler: (params?: unknown) => void) => handlers.set(event, handler)),
			off: vi.fn(),
			getModel: () => ({
				getSeriesByIndex: () => ({
					getData: () => ({ tree: { getNodeByDataIndex: () => node } })
				})
			})
		}

		const unregister = registerTreemapFocusTracking(
			instance as unknown as Parameters<typeof registerTreemapFocusTracking>[0]
		)
		handlers.get('click')?.({ seriesType: 'treemap', seriesIndex: 0, dataIndex: 2 })

		expect(instance).toHaveProperty('__llamaTreemapFocusNode', {
			id: 'technology/apple',
			path: ['Technology', 'Apple'],
			indexPath: [2]
		})

		handlers.get('restore')?.()
		expect(instance).not.toHaveProperty('__llamaTreemapFocusNode')

		unregister()
		expect(instance.off).toHaveBeenCalledWith('click', handlers.get('click'))
		expect(instance.off).toHaveBeenCalledWith('restore', handlers.get('restore'))
	})
})

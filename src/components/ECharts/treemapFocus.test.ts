import { describe, expect, it, vi } from 'vitest'
import { registerTreemapFocusTracking } from './treemapFocus'

describe('treemap focus tracking', () => {
	it('tracks drilldown paths, clears on restore, and removes its listeners', () => {
		const handlers = new Map<string, (params?: unknown) => void>()
		const node = {
			getId: () => 'technology/apple',
			getAncestors: () => [{ name: 'Technology' }, { name: 'Apple' }]
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
			path: ['Technology', 'Apple']
		})

		handlers.get('restore')?.()
		expect(instance).not.toHaveProperty('__llamaTreemapFocusNode')

		unregister()
		expect(instance.off).toHaveBeenCalledWith('click', handlers.get('click'))
		expect(instance.off).toHaveBeenCalledWith('restore', handlers.get('restore'))
	})
})

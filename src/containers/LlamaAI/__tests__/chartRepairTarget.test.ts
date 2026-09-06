import { describe, expect, test } from 'vitest'
import { buildChartRepairHref, parseChartRepairTarget } from '../chartRepairTarget'

describe('chart repair target', () => {
	test('validates the browser handoff before allowing a generated chart to replace a dashboard slot', () => {
		expect(parseChartRepairTarget('{"dashboardId":"dashboard-1","itemId":"item-1"}')).toEqual({
			dashboardId: 'dashboard-1',
			itemId: 'item-1'
		})
		expect(parseChartRepairTarget('{"dashboardId":"","itemId":"item-1"}')).toBeNull()
		expect(parseChartRepairTarget('not-json')).toBeNull()
	})

	test('opens a confirmation-gated LlamaAI prompt without putting internal artifact IDs in the URL', () => {
		const href = buildChartRepairHref('Protocol revenue', 'source_shape_changed')
		expect(href).toContain('/ai/chat?prompt=')
		expect(decodeURIComponent(href)).toContain('Protocol revenue')
		expect(decodeURIComponent(href)).toContain('source shape changed')
		expect(href).not.toContain('artifactId')
	})
})

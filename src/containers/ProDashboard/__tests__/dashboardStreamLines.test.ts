import { describe, expect, test, vi } from 'vitest'
import { createDashboardStreamLineParser } from '../dashboardStreamLines'

describe('createDashboardStreamLineParser', () => {
	test('emits complete lines in order across arbitrary response fragments', () => {
		const onLine = vi.fn()
		const parser = createDashboardStreamLineParser(onLine)

		parser.push('{"type":"dash')
		parser.push('board"}\n{"type":"chartData"}\n{"type":')
		parser.push('"done"}')
		parser.finish()

		expect(onLine.mock.calls.map(([line]) => line)).toEqual([
			'{"type":"dashboard"}',
			'{"type":"chartData"}',
			'{"type":"done"}'
		])
	})

	test('emits empty complete lines and does not duplicate a trailing newline', () => {
		const lines: Array<string> = []
		const parser = createDashboardStreamLineParser((line) => lines.push(line))

		parser.push('\n{"type":"done"}\n')
		parser.finish()

		expect(lines).toEqual(['', '{"type":"done"}'])
	})
})

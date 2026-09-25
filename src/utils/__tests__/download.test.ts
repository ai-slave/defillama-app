import { describe, expect, test, vi } from 'vitest'
import { addTimestampToFilename, downloadCSV } from '../download'

describe('downloadCSV', () => {
	test('escapes CSV syntax and neutralizes formula strings without changing numeric values', async () => {
		let csvBlob: Blob | undefined
		const link = { href: '', download: '', style: { display: '' }, click: vi.fn() }
		vi.stubGlobal('window', {
			URL: {
				createObjectURL: (blob: Blob) => {
					csvBlob = blob
					return 'blob:csv'
				},
				revokeObjectURL: vi.fn()
			}
		})
		vi.stubGlobal('document', {
			createElement: () => link,
			body: { appendChild: vi.fn(), removeChild: vi.fn() }
		})

		try {
			downloadCSV('test.csv', [
				['Name', 'Value', 'Notes', 'Formula'],
				['Alpha, Inc.', 0, 'Line one\nLine "two"', '=HYPERLINK("https://example.com")'],
				['Typed values', -42, true, { source: 'API', count: 2 }],
				['Text values', '-42', '@SUM(A1:A2)', '＝1+1'],
				['More formulas', '+1+1', '-1+1', '＠SUM(A1:A2)'],
				['Missing', null, undefined, 'Plain text']
			])

			if (!csvBlob) throw new Error('CSV download did not create a Blob')
			expect(await csvBlob.text()).toBe(
				'Name,Value,Notes,Formula\n"Alpha, Inc.",0,"Line one\nLine ""two""","\'=HYPERLINK(""https://example.com"")"\nTyped values,-42,true,"{""source"":""API"",""count"":2}"\nText values,"\'-42","\'@SUM(A1:A2)","\'＝1+1"\nMore formulas,"\'+1+1","\'-1+1","\'＠SUM(A1:A2)"\nMissing,,,Plain text'
			)
			expect(link.download).toBe('test.csv')
		} finally {
			vi.unstubAllGlobals()
		}
	})
})

describe('addTimestampToFilename', () => {
	test('inserts the date before the final extension', () => {
		expect(addTimestampToFilename('bridge.activity.csv', '2026-07-28')).toBe('bridge.activity_2026-07-28.csv')
	})

	test('preserves a filename without an extension', () => {
		expect(addTimestampToFilename('bridge-activity', '2026-07-28')).toBe('bridge-activity_2026-07-28')
	})

	test('does not add the same date twice', () => {
		expect(addTimestampToFilename('bridge-activity_2026-07-28.csv', '2026-07-28')).toBe(
			'bridge-activity_2026-07-28.csv'
		)
	})
})

test('CSV fallback retains escaped rows, formula protection, and the dated filename', () => {
	const attributes: Record<string, string> = {}
	const link = {
		style: {},
		setAttribute: (name: string, value: string) => {
			attributes[name] = value
		},
		click: vi.fn()
	}
	vi.useFakeTimers()
	vi.setSystemTime(new Date('2026-09-08T00:00:00Z'))
	vi.spyOn(console, 'log').mockImplementation(() => {})
	vi.stubGlobal('window', {
		URL: {
			createObjectURL: () => {
				throw new Error('Blob URLs unavailable')
			}
		}
	})
	vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn(), removeChild: vi.fn() } })
	try {
		downloadCSV(
			'protocols.csv',
			[
				['Name', 'Value'],
				['Alpha, Inc.', '=1+1'],
				['Beta', 0]
			],
			{ addTimestamp: true }
		)
		expect(attributes.download).toBe('protocols_2026-09-08.csv')
		expect(decodeURIComponent(attributes.href)).toBe(
			'data:text/plain;charset=utf-8,Name,Value\n"Alpha, Inc.","\'=1+1"\nBeta,0'
		)
		expect(link.click).toHaveBeenCalledOnce()
	} finally {
		vi.useRealTimers()
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	}
})

import { describe, expect, test } from 'vitest'
import { NAME_COLUMN_WIDTH, TOKENS_HIDEABLE_COLUMN_SPECS } from '../columnSpecs'
import { TOKENS_FILTER_CONFIGS } from '../filters'
import { EXPANDABLE_TOKENS_COLUMNS, TOKENS_COLUMNS } from '../index'
import { TOKENS_NUMERIC_FILTER_FIELDS } from '../types'

describe('token column specs stay in sync with the table columns', () => {
	const columns = TOKENS_COLUMNS
	const columnById = new Map(columns.map((column) => [column.id, column]))

	test('every spec has a matching column with the same header and width class', () => {
		for (const spec of TOKENS_HIDEABLE_COLUMN_SPECS) {
			const column = columnById.get(spec.id)
			expect(column, spec.id).toBeDefined()
			expect(column!.header, spec.id).toBe(spec.header)
			const headerClassName = (column!.meta as { headerClassName?: string } | undefined)?.headerClassName ?? ''
			expect(headerClassName, `${spec.id} width`).toContain(`w-[${spec.width}px]`)
		}
	})

	test('covers every hideable column exactly once', () => {
		const hideableColumnIds = columns
			.filter((column) => column.id !== 'rank' && column.id !== 'name')
			.map((column) => column.id)
		expect(TOKENS_HIDEABLE_COLUMN_SPECS.map((spec) => spec.id)).toEqual(hideableColumnIds)
	})

	test('name column width matches the spec constant', () => {
		const headerClassName = (columnById.get('name')!.meta as { headerClassName?: string }).headerClassName ?? ''
		expect(headerClassName).toContain(`w-[${NAME_COLUMN_WIDTH}px]`)
	})

	test('adds only the Markets expander after the token name', () => {
		const baseIds = TOKENS_COLUMNS.map((column) => column.id)
		const expandedIds = EXPANDABLE_TOKENS_COLUMNS.map((column) => column.id)
		const nameIndex = baseIds.indexOf('name')

		expect(expandedIds).toEqual([...baseIds.slice(0, nameIndex + 1), 'expander', ...baseIds.slice(nameIndex + 1)])
	})

	test('filterable spec fields are allowed by the server filter allowlist', () => {
		const allowed = new Set<string>(TOKENS_NUMERIC_FILTER_FIELDS)
		for (const config of TOKENS_FILTER_CONFIGS) {
			if (config.id === 'rank') continue
			expect(allowed.has(config.id), config.id).toBe(true)
		}
	})
})

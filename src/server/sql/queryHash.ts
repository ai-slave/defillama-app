import { createHash } from 'node:crypto'
import type { TableSource } from '~/containers/Downloads/sql/useTableRegistry'
import type { SqlQueryRecipe } from '~/containers/ProDashboard/types'

function canonicalSource(source: TableSource): { kind: string; slug: string; param?: string } {
	if (source.kind === 'dataset') return { kind: 'dataset', slug: source.slug }
	return { kind: 'chart', slug: source.slug, param: source.param }
}

export function hashSqlQuery(recipe: SqlQueryRecipe, execution?: { rowCap?: number }): string {
	const sources = recipe.tableSources
		.map(canonicalSource)
		.sort((a, b) => `${a.kind}:${a.slug}:${a.param ?? ''}`.localeCompare(`${b.kind}:${b.slug}:${b.param ?? ''}`))
	const canonical = JSON.stringify({
		sql: recipe.sql.trim(),
		tableSources: sources,
		...(execution?.rowCap === undefined ? {} : { rowCap: execution.rowCap })
	})
	return createHash('sha256').update(canonical).digest('hex')
}

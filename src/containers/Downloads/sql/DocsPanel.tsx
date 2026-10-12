import { matchSorter } from 'match-sorter'
import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Keycap } from '~/ui/Keycap'
import { SearchField } from '~/ui/SearchField'
import { Tag } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
import { CopyTextButton } from './CopyTextButton'
import {
	COOKBOOK_SNIPPETS,
	COOKBOOK_TAGS,
	DIALECT_TIPS,
	DUCKDB_DOCS_URL,
	SHORTCUTS,
	TECHNIQUE_DOCS,
	type CookbookSnippet,
	type CookbookTag,
	type TechniqueName
} from './dialectDocs'

// ─── Cookbook tab ───────────────────────────────────────────────────────────

interface CookbookProps {
	onApplyAndRun: (sql: string) => void
}

export function CookbookTab({ onApplyAndRun }: CookbookProps) {
	const [search, setSearch] = useState('')
	const deferred = useDeferredValue(search)

	const filtered = useMemo(() => {
		if (!deferred) return COOKBOOK_SNIPPETS
		return matchSorter(COOKBOOK_SNIPPETS, deferred, {
			keys: ['title', 'blurb', 'tag', 'sql', (s: CookbookSnippet) => s.techniques.join(' ')],
			threshold: matchSorter.rankings.CONTAINS
		})
	}, [deferred])

	const grouped = useMemo(() => {
		const by = new Map<CookbookTag, Array<CookbookSnippet>>()
		for (const s of filtered) {
			const arr = by.get(s.tag) ?? []
			arr.push(s)
			by.set(s.tag, arr)
		}
		return COOKBOOK_TAGS.filter((g) => by.has(g)).map((g) => ({ tag: g, items: by.get(g)! }))
	}, [filtered])

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-3">
				<SearchField
					value={search}
					onChange={setSearch}
					label="Search recipes"
					placeholder="Search title, technique, tag, or SQL…"
				/>
				<p className="body-sm text-tertiary">
					{filtered.length === COOKBOOK_SNIPPETS.length
						? `${COOKBOOK_SNIPPETS.length} recipes`
						: `${filtered.length} of ${COOKBOOK_SNIPPETS.length} recipes`}
				</p>
			</div>

			{grouped.length === 0 ? (
				<p className="py-6 text-center body-sm text-tertiary">No recipes match "{deferred}".</p>
			) : (
				<div className="flex flex-col gap-5">
					{grouped.map(({ tag, items }) => (
						<section key={tag} className="flex flex-col">
							<SectionHeading title={tag} count={items.length} />
							<ul className="flex flex-col divide-y divide-(--border-subtle)">
								{items.map((s) => (
									<li key={s.title} className="py-4">
										<Snippet snippet={s} onApplyAndRun={onApplyAndRun} />
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
			)}
		</div>
	)
}

function SectionHeading({ title, count }: { title: string; count: number }) {
	return (
		<h3 className="flex items-center gap-2 border-b border-subtle pb-2 label-md text-primary">
			{title}
			<span className="body-sm text-tertiary">{count}</span>
		</h3>
	)
}

function Snippet({ snippet, onApplyAndRun }: { snippet: CookbookSnippet; onApplyAndRun: (sql: string) => void }) {
	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
				<div className="flex min-w-0 grow basis-48 flex-col gap-1">
					<h4 className="label-md text-primary">{snippet.title}</h4>
					<p className="body-sm text-secondary">{snippet.blurb}</p>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					<CopyTextButton text={snippet.sql} label="Copy SQL" />
					<Button type="button" size="sm" onClick={() => onApplyAndRun(`${snippet.sql}\n`)}>
						Try it
					</Button>
				</div>
			</div>

			<TechniqueChips techniques={snippet.techniques} />

			<CodeBlock sql={snippet.sql} />
		</div>
	)
}

function TechniqueChips({ techniques }: { techniques: Array<TechniqueName> }) {
	if (techniques.length === 0) return null
	return (
		<ul aria-label="Techniques" className="flex flex-wrap gap-1.5">
			{techniques.map((t) => (
				<li key={t}>
					<Tooltip content={TECHNIQUE_DOCS[t]} tabIndex={0} render={<Tag className="cursor-help" />}>
						<span className="mono-sm">{t}</span>
					</Tooltip>
				</li>
			))}
		</ul>
	)
}

// ─── Syntax-highlighted SQL ─────────────────────────────────────────────────

// Matches the Monaco llamaSqlDark/Light theme color families — keeps the drawer
// and editor visually consistent so users don't mentally context-switch.
const KEYWORDS = new Set([
	'ALL',
	'AND',
	'AS',
	'ASC',
	'ASOF',
	'BETWEEN',
	'BY',
	'CASE',
	'CROSS',
	'CURRENT',
	'DELETE',
	'DESC',
	'DISTINCT',
	'ELSE',
	'END',
	'EXCEPT',
	'EXISTS',
	'FALSE',
	'FILTER',
	'FOLLOWING',
	'FROM',
	'FULL',
	'GROUP',
	'HAVING',
	'IN',
	'INNER',
	'INSERT',
	'INTERSECT',
	'INTO',
	'IS',
	'JOIN',
	'LEFT',
	'LIKE',
	'LIMIT',
	'NOT',
	'NULL',
	'OFFSET',
	'ON',
	'OR',
	'ORDER',
	'OUTER',
	'OVER',
	'PARTITION',
	'PIVOT',
	'PRECEDING',
	'QUALIFY',
	'RIGHT',
	'ROW',
	'ROWS',
	'SELECT',
	'SET',
	'THEN',
	'TRUE',
	'UNBOUNDED',
	'UNION',
	'UNPIVOT',
	'UPDATE',
	'USING',
	'VALUES',
	'WHEN',
	'WHERE',
	'WINDOW',
	'WITH',
	'ILIKE',
	'RANGE',
	'TABLE',
	'CAST',
	'TRY_CAST'
])

const TYPES = new Set([
	'BIGINT',
	'BOOLEAN',
	'DATE',
	'DECIMAL',
	'DOUBLE',
	'FLOAT',
	'INT',
	'INTEGER',
	'SMALLINT',
	'TEXT',
	'TIMESTAMP',
	'VARCHAR',
	'REAL',
	'NUMERIC'
])

// Kept manageable: the functions actually seen in our cookbook snippets plus
// a handful of common LlamaSQL analytical helpers.
const FUNCTIONS = new Set([
	'abs',
	'any_value',
	'approx_count_distinct',
	'approx_quantile',
	'arg_max',
	'arg_min',
	'array_agg',
	'avg',
	'coalesce',
	'count',
	'date_diff',
	'date_part',
	'date_trunc',
	'epoch',
	'epoch_ms',
	'first',
	'first_value',
	'greatest',
	'json_extract',
	'json_extract_string',
	'lag',
	'last',
	'last_value',
	'lead',
	'least',
	'length',
	'list_aggregate',
	'lower',
	'max',
	'median',
	'min',
	'nullif',
	'percentile_cont',
	'quantile_cont',
	'rank',
	'regexp_matches',
	'regexp_replace',
	'round',
	'row_number',
	'string_agg',
	'string_split',
	'strftime',
	'strptime',
	'substring',
	'sum',
	'to_timestamp',
	'trim',
	'unnest',
	'upper'
])

type TokenType = 'kw' | 'type' | 'fn' | 'str' | 'num' | 'cmt' | 'punct' | 'plain'

interface Token {
	type: TokenType
	text: string
}

function tokenize(sql: string): Array<Token> {
	const out: Array<Token> = []
	const n = sql.length
	let i = 0
	while (i < n) {
		const c = sql[i]!

		// Line comment.
		if (c === '-' && sql[i + 1] === '-') {
			let j = i + 2
			while (j < n && sql[j] !== '\n') j++
			out.push({ type: 'cmt', text: sql.slice(i, j) })
			i = j
			continue
		}

		// Single-quoted string (no escape handling needed for cookbook content).
		if (c === "'") {
			let j = i + 1
			while (j < n && sql[j] !== "'") j++
			j = Math.min(j + 1, n)
			out.push({ type: 'str', text: sql.slice(i, j) })
			i = j
			continue
		}

		// Double-quoted identifier.
		if (c === '"') {
			let j = i + 1
			while (j < n && sql[j] !== '"') j++
			j = Math.min(j + 1, n)
			out.push({ type: 'plain', text: sql.slice(i, j) })
			i = j
			continue
		}

		// Number.
		if (c >= '0' && c <= '9') {
			let j = i
			while (j < n && /[\d._]/.test(sql[j]!)) j++
			out.push({ type: 'num', text: sql.slice(i, j) })
			i = j
			continue
		}

		// Identifier / keyword / function.
		if (/[A-Za-z_]/.test(c)) {
			let j = i
			while (j < n && /[\w]/.test(sql[j]!)) j++
			const text = sql.slice(i, j)
			const upper = text.toUpperCase()
			const lower = text.toLowerCase()
			let type: TokenType = 'plain'
			if (KEYWORDS.has(upper)) type = 'kw'
			else if (TYPES.has(upper)) type = 'type'
			else if (FUNCTIONS.has(lower) && sql[j] === '(') type = 'fn'
			out.push({ type, text })
			i = j
			continue
		}

		// Whitespace — collect so we emit one text node.
		if (/\s/.test(c)) {
			let j = i
			while (j < n && /\s/.test(sql[j]!)) j++
			out.push({ type: 'plain', text: sql.slice(i, j) })
			i = j
			continue
		}

		// Punctuation / operator.
		out.push({ type: 'punct', text: c })
		i++
	}
	return out
}

const TOKEN_CLASS: Record<TokenType, string> = {
	kw: 'font-semibold text-link',
	type: 'text-pro-ai-text',
	fn: 'text-pro-ai-text',
	str: 'text-warning',
	num: 'text-success',
	cmt: 'italic text-tertiary',
	punct: 'text-tertiary',
	plain: ''
}

function CodeBlock({ sql }: { sql: string }) {
	const tokens = useMemo(() => tokenize(sql), [sql])
	return (
		<pre className="overflow-x-auto rounded-lg border border-subtle bg-page px-3 py-2.5 mono-sm text-primary">
			<code>
				{tokens.map((t, i) => {
					const cls = TOKEN_CLASS[t.type]
					// oxlint-disable-next-line react/no-array-index-key -- Repeated syntax fragments have positional identity and no local state.
					if (!cls) return <Fragment key={i}>{t.text}</Fragment>
					return (
						// oxlint-disable-next-line react/no-array-index-key -- Repeated syntax fragments have positional identity and no local state.
						<span key={i} className={cls}>
							{t.text}
						</span>
					)
				})}
			</code>
		</pre>
	)
}

// ─── Shortcuts tab ──────────────────────────────────────────────────────────

export function ShortcutsTab() {
	return (
		<div className="flex flex-col gap-5">
			<section className="flex flex-col">
				<SectionHeading title="Keyboard" count={SHORTCUTS.length} />
				<ul className="flex flex-col divide-y divide-(--border-subtle)">
					{SHORTCUTS.map((s) => (
						<li key={s.action} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="body-md text-primary">{s.action}</span>
								{s.note ? <span className="body-sm text-tertiary">{s.note}</span> : null}
							</div>
							<div className="flex shrink-0 items-center gap-1">
								{s.keys.map((k, i) => (
									// oxlint-disable-next-line react/no-array-index-key -- Keycaps form a fixed authored chord and may repeat.
									<Keycap key={i}>{k}</Keycap>
								))}
							</div>
						</li>
					))}
				</ul>
			</section>

			<section className="flex flex-col">
				<SectionHeading title="Dialect tips" count={DIALECT_TIPS.length} />
				<ul className="flex flex-col divide-y divide-(--border-subtle)">
					{DIALECT_TIPS.map((t) => (
						<li key={t.title} className="flex flex-col gap-1 py-3">
							<h4 className="label-md text-primary">{t.title}</h4>
							<p className="body-sm text-secondary">{t.body}</p>
						</li>
					))}
				</ul>
			</section>

			<Button
				as={BasicLink}
				href={DUCKDB_DOCS_URL}
				target="_blank"
				rel="noreferrer"
				variant="link"
				className="self-start body-sm"
			>
				Full LlamaSQL reference
				<Icon name="external-link" className="size-3.5" aria-hidden="true" />
			</Button>
		</div>
	)
}

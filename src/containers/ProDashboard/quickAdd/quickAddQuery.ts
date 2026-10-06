import { CHART_TYPES, type DashboardGrouping, isProDashboardChartType, type ProDashboardChartType } from '../types'

export type QuickAddGrouping = Extract<DashboardGrouping, 'day' | 'week' | 'month'>
export type QuickAddForm = 'chart' | 'metric' | 'table'
export type QuickAddCommand = 'text' | 'section' | 'table'

export interface QuickAddQuery {
	entityTerms: Array<string>
	entityGroups: Array<Array<string>>
	metric: ProDashboardChartType | null
	form: QuickAddForm | null
	grouping: QuickAddGrouping | null
	cumulative: boolean
	command: QuickAddCommand | null
}

const STOP_WORDS: ReadonlySet<string> = new Set([
	'of',
	'for',
	'on',
	'the',
	'a',
	'an',
	'add',
	'chain',
	'chains',
	'protocol',
	'protocols',
	'network',
	'token'
])

const GROUP_SEPARATORS: ReadonlySet<string> = new Set(['vs', 'versus', ',', '&', 'and', 'compare'])

const FORM_WORDS: Record<string, QuickAddForm> = {
	metric: 'metric',
	metrics: 'metric',
	number: 'metric',
	kpi: 'metric',
	stat: 'metric',
	chart: 'chart',
	graph: 'chart',
	table: 'table'
}

const COMMAND_WORDS: Record<string, QuickAddCommand> = {
	text: 'text',
	note: 'text',
	notes: 'text',
	section: 'section',
	heading: 'section',
	header: 'section',
	table: 'table'
}

const COMMAND_PHRASES: Record<string, QuickAddCommand> = {
	'text block': 'text',
	'new section': 'section',
	'top protocols': 'table',
	'protocols table': 'table',
	'protocol table': 'table'
}

const TABLE_FILLER_WORDS: ReadonlySet<string> = new Set(['top', 'protocols', 'protocol'])

const GROUPING_WORDS: Record<string, QuickAddGrouping> = {
	daily: 'day',
	day: 'day',
	weekly: 'week',
	week: 'week',
	monthly: 'month',
	month: 'month'
}

const CUMULATIVE_WORDS: ReadonlySet<string> = new Set(['cumulative', 'cum'])

const HAND_WRITTEN_METRIC_SYNONYMS: Record<string, ProDashboardChartType> = {
	fee: 'fees',
	rev: 'revenue',
	vol: 'volume',
	'dex volume': 'volume',
	mcap: 'tokenMcap',
	'market cap': 'tokenMcap',
	marketcap: 'tokenMcap',
	price: 'tokenPrice',
	users: 'activeUsers',
	dau: 'activeUsers',
	'active users': 'activeUsers',
	'new users': 'newUsers',
	tx: 'txs',
	transaction: 'txs',
	oi: 'openInterest',
	perp: 'perps',
	perpetuals: 'perps',
	apy: 'medianApy',
	stables: 'stablecoins',
	stablecoin: 'stablecoins',
	bridged: 'bridgedTvl',
	gas: 'gasUsed',
	pf: 'pfRatio',
	'p/f': 'pfRatio',
	ps: 'psRatio',
	'p/s': 'psRatio',
	holders: 'holdersRevenue',
	emissions: 'incentives',
	unlock: 'unlocks',
	borrow: 'borrowed',
	tvl: 'tvl'
}

function buildMetricSynonyms(): Map<string, ProDashboardChartType> {
	const synonyms = new Map<string, ProDashboardChartType>()
	for (const [type, config] of Object.entries(CHART_TYPES)) {
		if (!isProDashboardChartType(type)) continue
		const title = config.title.toLowerCase()
		const base = title.split(' (')[0] ?? title
		synonyms.set(base, type)
		synonyms.set(base.replaceAll(' ', ''), type)
	}
	for (const [synonym, type] of Object.entries(HAND_WRITTEN_METRIC_SYNONYMS)) synonyms.set(synonym, type)
	return synonyms
}

const METRIC_SYNONYMS = buildMetricSynonyms()

function longestPhraseWordCount(phrases: Iterable<string>): number {
	let longest = 1
	for (const phrase of phrases) {
		const wordCount = phrase.split(' ').length
		if (wordCount > longest) longest = wordCount
	}
	return longest
}

const MAX_PHRASE_WORDS = Math.max(
	longestPhraseWordCount(METRIC_SYNONYMS.keys()),
	longestPhraseWordCount(Object.keys(COMMAND_PHRASES))
)

interface QuickAddQueryDraft {
	metric: ProDashboardChartType | null
	form: QuickAddForm | null
	grouping: QuickAddGrouping | null
	cumulative: boolean
	commandCandidate: QuickAddCommand | null
	sawTableWord: boolean
}

function matchLeadingPhrase(tokens: ReadonlyArray<string>, index: number, draft: QuickAddQueryDraft): number {
	const maxLength = Math.min(MAX_PHRASE_WORDS, tokens.length - index)
	for (let length = maxLength; length >= 1; length--) {
		const phrase = tokens.slice(index, index + length).join(' ')
		const command = COMMAND_PHRASES[phrase]
		if (command) {
			draft.commandCandidate = draft.commandCandidate ?? command
			if (command === 'table') draft.sawTableWord = true
			return length
		}
		const metric = METRIC_SYNONYMS.get(phrase)
		if (metric) {
			draft.metric = draft.metric ?? metric
			return length
		}
	}
	return 0
}

function extractGroupTerms(tokens: ReadonlyArray<string>, draft: QuickAddQueryDraft): Array<string> {
	const terms: Array<string> = []
	let index = 0
	while (index < tokens.length) {
		const phraseLength = matchLeadingPhrase(tokens, index, draft)
		if (phraseLength > 0) {
			index += phraseLength
			continue
		}
		const token = tokens[index]
		index += 1
		if (token === undefined || STOP_WORDS.has(token)) continue
		const grouping = GROUPING_WORDS[token]
		if (grouping) {
			draft.grouping = grouping
			continue
		}
		if (CUMULATIVE_WORDS.has(token)) {
			draft.cumulative = true
			continue
		}
		const form = FORM_WORDS[token]
		if (form) draft.form = draft.form ?? form
		const command = COMMAND_WORDS[token]
		if (command) {
			draft.commandCandidate = draft.commandCandidate ?? command
			if (command === 'table') draft.sawTableWord = true
			continue
		}
		if (form) continue
		terms.push(token)
	}
	return terms
}

function splitQuickAddTokenGroups(raw: string): Array<Array<string>> {
	const tokens = raw
		.toLowerCase()
		.replaceAll(/[$@]/g, ' ')
		.replaceAll(',', ' , ')
		.split(/\s+/)
		.filter((token) => token.length > 0)
	const groups: Array<Array<string>> = [[]]
	for (const token of tokens) {
		if (GROUP_SEPARATORS.has(token)) {
			groups.push([])
			continue
		}
		groups[groups.length - 1]?.push(token)
	}
	return groups
}

export function parseQuickAddQuery(raw: string): QuickAddQuery {
	const draft: QuickAddQueryDraft = {
		metric: null,
		form: null,
		grouping: null,
		cumulative: false,
		commandCandidate: null,
		sawTableWord: false
	}
	const termGroups: Array<Array<string>> = []
	for (const tokens of splitQuickAddTokenGroups(raw)) {
		const terms = extractGroupTerms(tokens, draft)
		if (terms.length > 0) termGroups.push(terms)
	}
	const entityGroups: Array<Array<string>> = []
	for (const terms of termGroups) {
		const kept = draft.sawTableWord ? terms.filter((term) => !TABLE_FILLER_WORDS.has(term)) : terms
		if (kept.length > 0) entityGroups.push(kept)
	}
	const entityTerms: Array<string> = []
	for (const terms of entityGroups) entityTerms.push(...terms)
	const command = entityTerms.length === 0 && draft.metric === null ? draft.commandCandidate : null
	return {
		entityTerms,
		entityGroups,
		metric: draft.metric,
		form: draft.form,
		grouping: draft.grouping,
		cumulative: draft.cumulative,
		command
	}
}

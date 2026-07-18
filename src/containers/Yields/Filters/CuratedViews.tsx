import { useRouter } from 'next/router'
import { Hovercard } from '~/ui/Hovercard'
import { Icon, type IIcon } from '~/ui/Icon'
import { metricOptionChipMdStyles } from '~/ui/MetricChip'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { pushYieldsQuery } from '../queryUpdates.client'

// Curated Views: preset filter chips. Clicking a preset pushes the equivalent URL
// params via shallow routing:
//   • tokens   → `token` / `collateralToken` / `borrowToken` option keys
//   • attrs    → `attribute=<key>`  (the views translate these to route booleans)
//   • category → `category=<name>`  / protocol → `protocol=<name>`
//   • ranges   → `minTvl` / `maxTvl` / `minApy` / `maxApy` / `minAvailable` / `maxAvailable`
// Applying a preset resets the other filters (clearedKeys) then sets the preset's; clicking
// an active preset clears it. Active state is derived purely from the current query params.
//
// Defaults reproduce the /yields earn presets exactly; other pages pass their own preset
// set + vocabulary + cleared/checked keys (see BorrowView).

type PresetParams = {
	token?: string[]
	collateralToken?: string[]
	borrowToken?: string[]
	attribute?: string[]
	category?: string[]
	protocol?: string[]
	minTvl?: number
	maxTvl?: number
	minApy?: number
	maxApy?: number
	minAvailable?: number
	maxAvailable?: number
}

type CriteriaGroup = { label: string; items: string[]; tone: 'neutral' | 'accent' }

export interface Preset {
	id: string
	label: string
	icon: IIcon['name']
	params: PresetParams
	criteria: CriteriaGroup[]
}

const ARRAY_PARAM_KEYS = ['token', 'collateralToken', 'borrowToken', 'attribute', 'category', 'protocol'] as const
const NUMBER_PARAM_KEYS = ['minTvl', 'maxTvl', 'minApy', 'maxApy', 'minAvailable', 'maxAvailable'] as const
type ArrayParamKey = (typeof ARRAY_PARAM_KEYS)[number]
type NumberParamKey = (typeof NUMBER_PARAM_KEYS)[number]

// The earn attributes EarnView can honour (URL `attribute` values).
const EARN_ATTRIBUTE_VOCABULARY = new Set(['stablecoins', 'single_exposure', 'no_il', 'audited'])

const EARN_PRESETS: Preset[] = [
	{
		id: 'stables',
		label: 'Stables',
		icon: 'dollar-sign',
		params: { token: ['family:stablecoins'], minTvl: 1_000_000 },
		criteria: [
			{ label: 'Tokens', tone: 'neutral', items: ['Stablecoins'] },
			{ label: 'Filters', tone: 'accent', items: ['TVL ≥ $1M'] }
		]
	},
	{
		id: 'majors',
		label: 'Majors',
		icon: 'layers',
		params: {
			token: ['family:btc', 'family:eth', 'family:sol', 'family:stablecoins'],
			attribute: ['audited'],
			minTvl: 10_000_000
		},
		criteria: [
			{ label: 'Tokens', tone: 'neutral', items: ['BTC', 'ETH', 'SOL', 'Stablecoins'] },
			{ label: 'Filters', tone: 'accent', items: ['Audited', 'TVL ≥ $10M'] }
		]
	},
	{
		id: 'commodities',
		label: 'Commodities',
		icon: 'banknote',
		params: { token: ['family:tokenized-commodities'], minTvl: 100_000 },
		criteria: [
			{ label: 'Tokens', tone: 'neutral', items: ['Tokenized Commodities'] },
			{ label: 'Filters', tone: 'accent', items: ['TVL ≥ $100K'] }
		]
	},
	{
		id: 'liquid-staking',
		label: 'Liquid Staking',
		icon: 'activity',
		params: { category: ['Liquid Staking'], attribute: ['audited'], minTvl: 1_000_000 },
		criteria: [
			{ label: 'Categories', tone: 'neutral', items: ['Liquid Staking'] },
			{ label: 'Filters', tone: 'accent', items: ['Audited', 'TVL ≥ $1M'] }
		]
	},
	{
		id: 'safe-haven',
		label: 'Safe Haven',
		icon: 'check-circle',
		params: { attribute: ['audited', 'single_exposure', 'no_il'], minTvl: 10_000_000 },
		criteria: [{ label: 'Filters', tone: 'accent', items: ['Audited', 'Single-asset', 'No IL risk', 'TVL ≥ $10M'] }]
	},
	{
		id: 'high-yield',
		label: 'High Yield',
		icon: 'trending-up',
		params: { attribute: ['audited'], minTvl: 1_000_000, minApy: 10 },
		criteria: [{ label: 'Filters', tone: 'accent', items: ['Audited', 'TVL ≥ $1M', 'APY ≥ 10%'] }]
	}
]

// URL params a preset controls; applying resets all of them, then sets the preset's.
const EARN_CLEARED_KEYS = [
	'token',
	'excludeToken',
	'attribute',
	'excludeAttribute',
	'category',
	'excludeCategory',
	'protocol',
	'excludeProtocol',
	'chain',
	'excludeChain',
	'minTvl',
	'maxTvl',
	'minApy',
	'maxApy'
] as const

// Params compared for active-state: token, attribute, category + the TVL/APY ranges.
// (chain/protocol are cleared when a preset applies but are not checked here.)
const EARN_ARRAY_CHECK_KEYS: readonly ArrayParamKey[] = ['token', 'attribute', 'category']
const EARN_NUMBER_CHECK_KEYS: readonly NumberParamKey[] = ['minTvl', 'maxTvl', 'minApy', 'maxApy']

function toArray(value: string | string[] | undefined): string[] {
	if (typeof value === 'string') return [value]
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function sameSet(actual: string[], expected: string[] = []): boolean {
	if (actual.length !== expected.length) return false
	const set = new Set(actual)
	return expected.every((value) => set.has(value))
}

function readNumber(value: string | string[] | undefined): number | null {
	const raw = Array.isArray(value) ? value[0] : value
	if (raw == null || raw.trim() === '') return null
	const parsed = Number(raw)
	return Number.isFinite(parsed) ? parsed : null
}

function isPresetActive(
	preset: Preset,
	query: Record<string, string | string[] | undefined>,
	options: {
		attributeVocabulary: Set<string>
		arrayCheckKeys: readonly ArrayParamKey[]
		numberCheckKeys: readonly NumberParamKey[]
	}
): boolean {
	for (const key of options.arrayCheckKeys) {
		const actual =
			key === 'attribute'
				? toArray(query.attribute).filter((value) => options.attributeVocabulary.has(value))
				: toArray(query[key])
		if (!sameSet(actual, preset.params[key])) return false
	}
	for (const key of options.numberCheckKeys) {
		if (readNumber(query[key]) !== (preset.params[key] ?? null)) return false
	}
	return true
}

export function CuratedViews({
	presets = EARN_PRESETS,
	attributeVocabulary = EARN_ATTRIBUTE_VOCABULARY,
	clearedKeys = EARN_CLEARED_KEYS,
	arrayCheckKeys = EARN_ARRAY_CHECK_KEYS,
	numberCheckKeys = EARN_NUMBER_CHECK_KEYS
}: {
	presets?: Preset[]
	attributeVocabulary?: Set<string>
	clearedKeys?: readonly string[]
	arrayCheckKeys?: readonly ArrayParamKey[]
	numberCheckKeys?: readonly NumberParamKey[]
} = {}) {
	const router = useRouter()
	const query = router.query as Record<string, string | string[] | undefined>
	const activeOptions = { attributeVocabulary, arrayCheckKeys, numberCheckKeys }

	function apply(preset: Preset) {
		const active = isPresetActive(preset, query, activeOptions)
		const updates: Record<string, string | number | string[] | undefined> = {}
		for (const key of clearedKeys) updates[key] = undefined
		if (!active) {
			trackYieldsEvent(YIELDS_EVENTS.FILTER_PRESET, { preset: preset.id })
			for (const key of ARRAY_PARAM_KEYS) {
				const value = preset.params[key]
				if (value) updates[key] = value
			}
			for (const key of NUMBER_PARAM_KEYS) {
				const value = preset.params[key]
				if (value != null) updates[key] = value
			}
		}
		void pushYieldsQuery(router, updates)
	}

	return (
		<div className="flex min-w-0 items-center gap-2">
			<div className="flex items-center gap-1.5 overflow-x-auto" role="group" aria-label="Curated views">
				{presets.map((preset) => {
					const active = isPresetActive(preset, query, activeOptions)
					return (
						<Hovercard
							key={preset.id}
							placement="bottom-start"
							showOnClick={false}
							contentClassName="flex min-w-48 max-w-75 flex-col gap-3 p-3"
							content={preset.criteria.map((group) => (
								<div className="flex flex-col gap-1.5" key={group.label}>
									<span className="label-sm text-secondary uppercase">{group.label}</span>
									<span className="flex flex-wrap gap-1.5">
										{group.items.map((item) => (
											<span
												key={item}
												className={`inline-flex items-center rounded-full border px-2.5 py-0.5 whitespace-nowrap ${
													group.tone === 'accent'
														? 'border-brand bg-brand-muted label-sm text-link-on-tint'
														: 'border-medium bg-surface-elevated-1 label-sm text-secondary'
												}`}
											>
												{item}
											</span>
										))}
									</span>
								</div>
							))}
							render={
								<button
									type="button"
									aria-pressed={active}
									aria-label={`${active ? 'Clear' : 'Apply'} ${preset.label}`}
									onClick={() => apply(preset)}
									className={metricOptionChipMdStyles}
									data-active={active}
								/>
							}
						>
							<Icon name={preset.icon} height={14} width={14} />
							{preset.label}
						</Hovercard>
					)
				})}
			</div>
		</div>
	)
}

import { matchSorter } from 'match-sorter'
import { chainIconUrl } from '~/utils/icons'
import type { Chain, Protocol } from '../types'
import type { QuickAddSubjectType } from './metricDefaults'

export interface QuickAddEntity {
	key: string
	subjectType: QuickAddSubjectType
	id: string
	name: string
	aliases: Array<string>
	logo?: string
	rank: number
	geckoId: string | null
}

export interface BuildQuickAddIndexInput {
	protocols: ReadonlyArray<Protocol>
	chains: ReadonlyArray<Chain>
	parentMapping?: ReadonlyMap<string, ReadonlyArray<string>>
}

export const QUICK_ADD_ENTITIES_PER_GROUP = 6

export function quickAddEntityKey(subjectType: QuickAddSubjectType, id: string): string {
	return `${subjectType}:${id}`
}

function collectAliases(name: string, id: string, symbols: ReadonlyArray<string | null | undefined>): Array<string> {
	const aliases: Array<string> = []
	const seen = new Set<string>([name.toLowerCase()])
	const candidates = [...symbols, name.replaceAll(' ', ''), name.replaceAll('-', ' '), id]
	for (const candidate of candidates) {
		if (!candidate) continue
		const normalized = candidate.toLowerCase()
		if (normalized === '-' || normalized.length === 0 || seen.has(normalized)) continue
		seen.add(normalized)
		aliases.push(candidate)
	}
	return aliases
}

function collectChildSlugs(input: BuildQuickAddIndexInput): Set<string> {
	const childSlugs = new Set<string>()
	if (input.parentMapping) {
		for (const children of input.parentMapping.values()) {
			for (const slug of children) childSlugs.add(slug)
		}
		return childSlugs
	}
	for (const protocol of input.protocols) {
		if (protocol.parentProtocol) childSlugs.add(protocol.slug)
	}
	return childSlugs
}

interface QuickAddIndexDraft {
	entity: Omit<QuickAddEntity, 'rank'>
	tvl: number
	isChild: boolean
}

export function buildQuickAddIndex(input: BuildQuickAddIndexInput): Array<QuickAddEntity> {
	const childSlugs = collectChildSlugs(input)
	const drafts: Array<QuickAddIndexDraft> = []
	for (const chain of input.chains) {
		if (!chain.name) continue
		drafts.push({
			entity: {
				key: quickAddEntityKey('chain', chain.name),
				subjectType: 'chain',
				id: chain.name,
				name: chain.name,
				aliases: collectAliases(chain.name, chain.name, [chain.tokenSymbol]),
				logo: chainIconUrl(chain.name),
				geckoId: chain.gecko_id ?? null
			},
			tvl: Number.isFinite(chain.tvl) ? chain.tvl : 0,
			isChild: false
		})
	}
	for (const protocol of input.protocols) {
		if (!protocol.slug || !protocol.name) continue
		drafts.push({
			entity: {
				key: quickAddEntityKey('protocol', protocol.slug),
				subjectType: 'protocol',
				id: protocol.slug,
				name: protocol.name,
				aliases: collectAliases(protocol.name, protocol.slug, [protocol.symbol]),
				...(protocol.logo === undefined ? {} : { logo: protocol.logo }),
				geckoId: protocol.geckoId ?? null
			},
			tvl: Number.isFinite(protocol.tvl) ? protocol.tvl : 0,
			isChild: childSlugs.has(protocol.slug)
		})
	}
	drafts.sort((first, second) => {
		if (first.isChild !== second.isChild) return first.isChild ? 1 : -1
		if (first.tvl !== second.tvl) return second.tvl - first.tvl
		return first.entity.name.localeCompare(second.entity.name)
	})
	const entities: Array<QuickAddEntity> = []
	for (const [index, draft] of drafts.entries()) {
		entities.push({ ...draft.entity, rank: drafts.length - index })
	}
	return entities
}

export function searchQuickAddEntities(
	entities: ReadonlyArray<QuickAddEntity>,
	terms: ReadonlyArray<string>,
	limit: number = QUICK_ADD_ENTITIES_PER_GROUP
): Array<QuickAddEntity> {
	const term = terms.join(' ').trim()
	if (term.length === 0) return []
	const ranked = matchSorter(entities, term, {
		keys: ['name', 'aliases'],
		baseSort: (first, second) => second.item.rank - first.item.rank
	})
	return ranked.slice(0, limit)
}

export function findQuickAddEntity(
	entities: ReadonlyArray<QuickAddEntity>,
	subjectType: QuickAddSubjectType,
	id: string
): QuickAddEntity | undefined {
	const key = quickAddEntityKey(subjectType, id)
	return entities.find((entity) => entity.key === key)
}

export function topQuickAddEntities(entities: ReadonlyArray<QuickAddEntity>, limit: number): Array<QuickAddEntity> {
	const sorted = [...entities].sort((first, second) => second.rank - first.rank)
	return sorted.slice(0, limit)
}

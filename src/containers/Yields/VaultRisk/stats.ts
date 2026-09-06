// Pure risk statistics over coverage fixtures — one source of truth for coverage dedupe,
// scenario-scoped coverage, and the worst-case tie-break.

import { coverageAppliesToScenario } from './policy'
import type { Coverage, CoverageVM } from './types'

// Vault and protocol coverage often repeat the same entries — dedupe by identity so the
// backstop total isn't double-counted.
export function dedupeCoverage(raw: Array<Coverage>): Array<CoverageVM> {
	const seen = new Set<string>()
	const out: Array<CoverageVM> = []
	for (const c of raw) {
		const key = `${c.kind}:${c.access}:${c.cap_usd}:${c.cap_usd_excl_own_tokens ?? ''}`
		if (seen.has(key)) continue
		seen.add(key)
		out.push({
			kind: c.kind,
			access: c.access,
			capUsd: c.cap_usd_excl_own_tokens ?? c.cap_usd,
			rawCapUsd: c.cap_usd,
			excludesOwnTokens: c.cap_usd_excl_own_tokens != null,
			accessTimeSec: c.access_time_sec ?? null,
			appliesTo: c.applies_to ?? [],
			...(c.description ? { description: c.description } : {}),
			priority: c.priority
		})
	}
	return out.sort((a, b) => a.priority - b.priority)
}

// Committed coverage that backs a given scenario — the policy lives in
// `coverageAppliesToScenario`; idle market liquidity is never coverage.
export function applicableCoverageUsd(coverage: Array<CoverageVM>, scenarioId: string | null): number {
	return coverage.filter((c) => coverageAppliesToScenario(c, scenarioId)).reduce((a, c) => a + (c.capUsd || 0), 0)
}

export interface WorstCandidate {
	scenarioId: string
	lossMaxUsd: number
	noEscape: boolean
}

// Worst = biggest loss; ties break toward no-escape, then toward the least-covered
// scenario, so the headline never borrows a backstop from a luckier sibling.
export function pickWorst<T extends WorstCandidate>(items: Array<T>, coverage: Array<CoverageVM>): T | null {
	let best: T | null = null
	for (const s of items) {
		if (!best || s.lossMaxUsd > best.lossMaxUsd) {
			best = s
			continue
		}
		if (s.lossMaxUsd < best.lossMaxUsd) continue
		if (s.noEscape !== best.noEscape) {
			if (s.noEscape) best = s
			continue
		}
		if (applicableCoverageUsd(coverage, s.scenarioId) < applicableCoverageUsd(coverage, best.scenarioId)) best = s
	}
	return best
}

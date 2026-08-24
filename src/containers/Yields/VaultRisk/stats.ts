// Pure risk statistics over coverage fixtures — one source of truth for coverage dedupe,
// scenario-scoped coverage, and the worst-case tie-break.

import { coverageAppliesToScenario } from './policy'
import type { Coverage, CoverageVM } from './types'

// Vault and protocol coverage often repeat the same entries — dedupe by identity so the
// backstop total isn't double-counted.
export function dedupeCoverage(raw: Coverage[]): CoverageVM[] {
	const seen = new Set<string>()
	const out: CoverageVM[] = []
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
export function applicableCoverageUsd(coverage: CoverageVM[], scenarioId: string | null): number {
	return coverage.filter((c) => coverageAppliesToScenario(c, scenarioId)).reduce((a, c) => a + (c.capUsd || 0), 0)
}

export interface WorstCandidate {
	scenarioId: string
	lossMaxUsd: number
	noEscape: boolean
}

// Worst = biggest loss; ties break toward no-escape, then toward the least-covered
// scenario, so the headline never borrows a backstop from a luckier sibling.
export function pickWorst<T extends WorstCandidate>(items: T[], coverage: CoverageVM[]): T | null {
	return items.reduce<T | null>((best, s) => {
		if (!best || s.lossMaxUsd > best.lossMaxUsd) return s
		if (s.lossMaxUsd < best.lossMaxUsd) return best
		if (s.noEscape !== best.noEscape) return s.noEscape ? s : best
		return applicableCoverageUsd(coverage, s.scenarioId) < applicableCoverageUsd(coverage, best.scenarioId) ? s : best
	}, null)
}

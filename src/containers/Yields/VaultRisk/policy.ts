// Single source of truth for committed-coverage policy — every path that sums coverage MUST
// go through these helpers, or the headline and peer stats drift apart (they have before).

import type { CoverageVM } from './types'

// Committed coverage = money that reaches depositors without someone choosing to pay;
// `discretionary` access is context, never a backstop.
export function isCommittedCoverage(c: CoverageVM): boolean {
	return c.access !== 'discretionary'
}

// A layer counts only when committed AND explicitly naming the scenario. `applies_to: []` is
// deliberately NOT universal coverage — the backend uses `[]` for "backs no specific risk".
export function coverageAppliesToScenario(c: CoverageVM, scenarioId: string | null): boolean {
	return isCommittedCoverage(c) && scenarioId != null && c.appliesTo.includes(scenarioId)
}

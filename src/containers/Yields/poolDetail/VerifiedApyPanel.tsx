// The receipts behind the Verified APY: the method, the confidence and the exact calls.
import { ChartPanel } from '~/ui/ChartPanel'
import { RelativeTime } from '~/ui/RelativeTime'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import type { VerifiedBlock, VerifiedConfidence } from '../data/types'
import { SealGlyph, splitMethod } from '../Tables/Measured'
import { scrollIntoViewIfHashed } from './anchorScroll'

export const HOW_WE_VERIFY_ID = 'how-we-verify'

/** The verified base APY for each window the API serves. */
export interface VerifiedWindowRow {
	label: string
	verified: number | null
}

const CONFIDENCE_HINT: Record<VerifiedConfidence, string> = {
	high: 'Holders agreed closely on the verified rate.',
	medium: 'Some spread between holders on the verified rate.',
	// `low` usually means the rate was NAV-quoted: no executable exit that day.
	low: 'Wide spread between holders, or no executable exit to measure that day.'
}

const STEPS: ReadonlyArray<{ title: string; detail: string | null }> = [
	{ title: 'Find real holders', detail: null },
	{ title: 'Simulate their withdrawal', detail: 'at a fixed daily block' },
	{ title: 'Record what came out', detail: null }
]

const ordinal = (index: number) => String(index + 1).padStart(2, '0')

/**
 * The backend marks state-changing simulations by opening the annotation with "EXECUTED"; the rest
 * are reads. That is a real distinction for the reader, so it becomes a tag and leaves the prose.
 */
export function describeCall(method: string): { signature: string; executed: boolean; note: string | null } {
	const { signature, annotation } = splitMethod(method)
	const executed = /^executed\b/i.test(annotation ?? '')
	const rest = executed ? (annotation ?? '').replace(/^executed\b/i, '').trim() : annotation
	const note = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null
	return { signature, executed, note }
}

export function VerifiedApyPanel({
	verified,
	stepAccrual = false,
	measuredSince = null,
	symbol = 'this pool'
}: {
	verified: VerifiedBlock
	stepAccrual?: boolean
	/** First day the exit ledger holds, when the page has it. */
	measuredSince?: string | null
	/** The pool, so the receipt names what it was run on. */
	symbol?: string
}) {
	const confidence = verified.apy_confidence
	const stamps: Array<[label: string, asOf: string]> = []
	for (const [label, asOf] of [
		[stepAccrual ? 'Rate last changed' : 'APY measured', verified.apy_as_of],
		['Exit measured', verified.exit?.as_of]
	] as const) {
		if (asOf) stamps.push([label, asOf])
	}

	return (
		<ChartPanel id={HOW_WE_VERIFY_ID} ref={scrollIntoViewIfHashed} className="scroll-mt-4">
			<div className="flex flex-col gap-2 border-t border-subtle px-4 py-3">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
					<h3 className="flex items-center gap-1.5 label-lg text-primary">
						<SealGlyph size={15} />
						How we verify
					</h3>
					<span className="body-sm text-secondary">The receipt behind {symbol}'s Verified APY and Exit Status.</span>
				</div>
				<ol className="flex flex-wrap items-center gap-2">
					{STEPS.map((step, index) => (
						<li key={step.title} className="flex items-center gap-2">
							{index > 0 ? (
								<span aria-hidden className="text-tertiary">
									→
								</span>
							) : null}
							<span className="flex items-baseline gap-1 rounded-full border border-subtle px-2.5 py-0.5 label-sm text-primary">
								{step.title}
								{step.detail ? <span className="body-sm text-secondary">{step.detail}</span> : null}
							</span>
						</li>
					))}
				</ol>
			</div>

			<div className="flex flex-col gap-3 px-4 pb-5">
				{verified.apy_note ? <p className="body-sm text-secondary">{verified.apy_note}</p> : null}
				<span className="label-sm text-primary">Calls executed as the holder</span>
				{verified.methods?.length ? (
					<ol className="flex flex-col overflow-hidden rounded-md border border-subtle bg-surface-elevated-1">
						{verified.methods.map((method, index) => {
							const call = describeCall(method)
							return (
								<li
									key={method}
									className="grid grid-cols-[1.75rem_1fr_auto] items-start gap-x-3 gap-y-0.5 border-t border-subtle px-3.5 py-2.5 first:border-t-0"
								>
									<span className="pt-0.5 mono-sm text-secondary">{ordinal(index)}</span>
									<span className="mono-sm break-words text-primary">{call.signature}</span>
									<span
										className={`mt-px rounded-sm border border-medium px-1.5 label-xs tracking-widest uppercase ${
											call.executed ? 'text-link' : 'text-secondary'
										}`}
									>
										{call.executed ? 'executed' : 'read'}
									</span>
									{call.note ? (
										<span className="col-span-2 col-start-2 body-sm text-secondary">{call.note}</span>
									) : null}
								</li>
							)
						})}
					</ol>
				) : (
					<p className="body-sm text-tertiary">The ordered call trace is unavailable for this measurement.</p>
				)}
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 body-sm text-tertiary">
				{stamps.map(([label, asOf]) => (
					<span key={label} className="whitespace-nowrap">
						<span className="font-medium text-secondary">{label}</span> <RelativeTime value={asOf} />
					</span>
				))}
				{measuredSince ? (
					<span className="whitespace-nowrap">
						<span className="font-medium text-secondary">Measured since</span>{' '}
						{formatDate(measuredSince) ?? measuredSince}
					</span>
				) : null}
				{confidence ? (
					<Tooltip content={CONFIDENCE_HINT[confidence]} className="cursor-help" tabIndex={0}>
						<span className="flex items-center gap-1.5 rounded-full border border-medium px-2.5 py-0.5 label-sm text-secondary">
							<span
								aria-hidden
								className={`size-1.5 rounded-full ${confidence === 'high' ? 'text-success' : 'text-warning'}`}
								style={{ backgroundColor: 'currentColor' }}
							/>
							<span className="underline decoration-dotted">
								<span className="capitalize">{confidence}</span> confidence
							</span>
						</span>
					</Tooltip>
				) : null}
				<span className="ml-auto">Reproducible: the same call at the same block returns the same result.</span>
			</div>
		</ChartPanel>
	)
}

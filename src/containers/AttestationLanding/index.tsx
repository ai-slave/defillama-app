import Head from 'next/head'
import Image from 'next/image'
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { BasicLink } from '~/components/Link'
import { ResearchIcon } from '~/components/ResearchIcon'
import { Button } from '~/ui/Button'
import { formatUsd, formatPercent } from '~/utils/numberFormat'

const pageCss = `
.attn-demo{container-type:inline-size;contain:layout paint}
.attn-grid{background-image:linear-gradient(to right,var(--border-very-subtle) 1px,transparent 1px),linear-gradient(to bottom,var(--border-very-subtle) 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(to bottom,transparent,black 18%,black 72%,transparent)}
.attn-stage{opacity:.34;transform:translateY(4px);transition:opacity .35s cubic-bezier(.22,1,.36,1),transform .35s cubic-bezier(.22,1,.36,1)}
.attn-stage[data-active=true]{opacity:1;transform:translateY(0)}
.attn-line{transform:scaleX(0);transform-origin:left;transition:transform .45s cubic-bezier(.22,1,.36,1)}
.attn-line[data-direction=reverse]{transform-origin:right}
.attn-line[data-active=true]{transform:scaleX(1)}
.attn-result{opacity:.24;transform:translateY(6px);transition:opacity .4s cubic-bezier(.16,1,.3,1),transform .4s cubic-bezier(.16,1,.3,1)}
.attn-result[data-active=true]{opacity:1;transform:translateY(0)}
.attn-total-dissolve{display:inline-block;animation:attn-total-dissolve .24s cubic-bezier(.25,1,.5,1) both}
.attn-register-change{animation:attn-register-dissolve .24s cubic-bezier(.25,1,.5,1) both}
.attn-proof-progress{transform:scaleX(0);transform-origin:left;animation-name:attn-proof-progress;animation-timing-function:linear;animation-fill-mode:forwards}
.attn-reconcile-mark{position:relative}
.attn-reconcile-mark::before{content:"";position:absolute;inset:-1px;border:1px solid var(--border-medium);border-radius:999px;transition:border-color .25s cubic-bezier(.25,1,.5,1)}
.attn-reconcile-mark::after{content:"";position:absolute;inset:-6px;border:1px solid var(--border-brand);border-radius:999px;opacity:0;pointer-events:none}
.attn-reconcile-mark[data-state=checking]::before{border-color:var(--border-subtle);border-top-color:var(--border-brand);animation:attn-spin .65s linear infinite}
.attn-reconcile-mark[data-state=matched]::before{border-color:var(--border-brand)}
.attn-reconcile-mark[data-state=matched]::after{animation:attn-confirm .58s cubic-bezier(.16,1,.3,1)}
.attn-equation{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,.8fr)}
.attn-equation-value{font-size:clamp(.65rem,2.35cqi,.82rem)}
.attn-audit-value{display:inline-flex;white-space:nowrap}
.attn-audit-group{position:relative;display:inline-grid;overflow:hidden}
.attn-audit-placeholder,.attn-audit-digits{grid-area:1/1;transition:opacity .14s linear,transform .24s cubic-bezier(.25,1,.5,1)}
.attn-audit-placeholder{opacity:.3}
.attn-audit-digits{opacity:0;transform:translateY(3px)}
.attn-audit-value[data-active=true] .attn-audit-placeholder{opacity:0}
.attn-audit-value[data-active=true] .attn-audit-digits{opacity:1;transform:translateY(0)}
.attn-audit-mask{position:absolute;inset:0;background:var(--bg-surface-elevated-2);opacity:0;transform:translateX(-110%);pointer-events:none}
.attn-audit-value[data-active=true] .attn-audit-mask{animation:attn-mask-pass .32s cubic-bezier(.65,0,.35,1) both}
.attn-equation-op{opacity:0;transform:scale(.72);transition:opacity .24s cubic-bezier(.16,1,.3,1),transform .24s cubic-bezier(.16,1,.3,1)}
.attn-equation-op[data-active=true]{opacity:1;transform:scale(1)}
.attn-equation-op[data-kind=minus][data-active=true]{transition-delay:.18s}
.attn-threshold-fill{transform:scaleX(0);transform-origin:left;transition:transform .7s cubic-bezier(.16,1,.3,1)}
.attn-threshold-fill[data-active=true]{transform:scaleX(1)}
.attn-threshold-marker{opacity:0;transform:translate(-50%,-50%) scale(.72)}
.attn-threshold-marker[data-active=true]{opacity:1;transform:translate(-50%,-50%) scale(1)}
.attn-recheck-spinner{border:1.5px solid var(--border-medium);border-top-color:var(--border-brand);animation:attn-spin .62s linear infinite}
.attn-ledger-columns>section+section{border-top:1px solid var(--border-subtle)}
@container (min-width:460px){.attn-ledger-columns{grid-template-columns:1fr 1fr}.attn-ledger-columns>section+section{border-top:0;border-left:1px solid var(--border-subtle)}}
@keyframes attn-spin{to{transform:rotate(360deg)}}
@keyframes attn-confirm{0%{opacity:0;transform:scale(.78)}38%{opacity:.72}100%{opacity:0;transform:scale(1.55)}}
@keyframes attn-mask-pass{0%{opacity:0;transform:translateX(-110%)}12%,88%{opacity:1}100%{opacity:0;transform:translateX(110%)}}
@keyframes attn-total-dissolve{0%{opacity:.45}100%{opacity:1}}
@keyframes attn-register-dissolve{0%{opacity:.42}100%{opacity:1}}
@keyframes attn-proof-progress{to{transform:scaleX(1)}}
@media(prefers-reduced-motion:reduce){.attn-stage,.attn-line,.attn-result,.attn-audit-placeholder,.attn-audit-digits,.attn-equation-op,.attn-threshold-fill,.attn-threshold-marker{transition:none}.attn-reconcile-mark[data-state=checking]::before,.attn-reconcile-mark[data-state=matched]::after,.attn-recheck-spinner,.attn-audit-mask,.attn-total-dissolve,.attn-register-change,.attn-proof-progress{animation:none}}
`

const personas = {
	issuer: {
		tab: 'I issue a token',
		sub: 'Stablecoins, tokenized funds, treasuries, credit, RWAs',
		punch: 'You already publish the number. Nobody stands behind it.',
		proseLead:
			"The fund admin sends a NAV. The custodian confirms holdings. You put the figure on your transparency page, and that's where independence ends.",
		proseBold:
			'A monthly PDF is a 30-day blind spot, and a self-published daily dashboard is faster and less credible at the same time.',
		proseTail:
			"We take the source document, verify it where it came from, and reconcile it against every token you've minted, on every chain.",
		checklist: [
			'Fund administrator NAV',
			'Custodian & bank balances',
			'Broker-custodied securities',
			'Loan-level private credit',
			'Tokenized or looped collateral',
			'Token supply, every chain'
		]
	},
	strategy: {
		tab: 'I run a strategy',
		sub: 'Vaults, asset managers, curators, yield products',
		punch: "Your NAV lives on six venues and one bank. Reconstructing it shouldn't be the depositor's job.",
		proseLead:
			'Cash at a broker. Options at Deribit. Perps on Hyperliquid. Spot on a CEX. Some of it onchain, most of it not. Depositors are asked to believe a number they cannot reconstruct, and after the last eighteen months they have stopped being willing to.',
		proseBold: "You don't have to expose the positions to prove the total.",
		proseTail:
			"Read-only access, verified continuously, published as a figure that doesn't leak your book to copy traders.",
		checklist: [
			'Exchange spot & balances',
			'Perps & futures positions',
			'Options & derivatives',
			'Brokerage & cash accounts',
			'Bank balances',
			'Onchain holdings, every chain'
		]
	}
} as const

const howSteps = [
	{
		number: '01',
		label: 'Private',
		title: 'Connect read-only',
		desc: 'Grant view-only access to custodians, banks, exchanges, fund administrators, or signed statements. DefiLlama can verify balances, never move them.'
	},
	{
		number: '02',
		label: 'At the source',
		title: 'Verify the evidence',
		desc: 'Check balances, positions, NAV, statements, and source identity at the cadence each counterparty supports—from hourly APIs to monthly reports.'
	},
	{
		number: '03',
		label: 'Both sides',
		title: 'Reconcile coverage',
		desc: 'Aggregate private assets and compare them with token supply or other disclosed liabilities across every supported chain.'
	},
	{
		number: '04',
		label: 'Public record',
		title: 'Publish the verification record',
		desc: 'Publish the verified total, coverage, source scope, freshness, and exceptions without exposing private positions or account details.'
	}
]

const faqs = [
	{
		q: 'Can you move or withdraw our funds?',
		a: "No. Our access is read-only: we see balances and positions, never move them. Where a venue can't give us direct access, we verify the statements it produces instead."
	},
	{
		q: 'Will you expose our positions?',
		a: 'Only what you agree to publish. We verify the total, publish the agreed metrics, and keep the underlying records private.'
	},
	{
		q: "What if part of our backing can't be verified?",
		a: "We list what we can verify, and each figure shows how it was verified and when it was last checked. Metrics that can't be fully verified carry an 'Unverified' warning label."
	},
	{
		q: 'How long does it take?',
		a: 'Usually one to two weeks. The main variable is how quickly your counterparties can provide the documentation we verify against.'
	},
	{
		q: 'Is this a financial audit or guarantee?',
		a: 'No. Verification covers the sources and metrics listed in the public record. It is not a statutory audit or a guarantee of future solvency.'
	}
]

function CheckIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	)
}

function VerifiedByDefiLlamaMark() {
	return (
		<span className="inline-flex items-center gap-1.5 label-xs font-semibold text-link">
			<Image src="/assets/llama.webp" alt="" width={14} height={14} className="rounded-full" />
			Verified by DefiLlama
		</span>
	)
}

const primaryCtaStyles =
	'inline-flex items-center justify-center rounded-lg bg-brand px-7 py-3.5 text-sm font-semibold text-on-brand transition-[filter] hover:brightness-110 focus-visible:brightness-110 focus-visible:focus-ring-on-brand'

const secondaryCtaStyles =
	'inline-flex items-center justify-center gap-2 rounded-lg border border-subtle px-7 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-hover-row focus-visible:focus-ring'

function SiteHeader() {
	return (
		<header className="sticky top-0 z-50 border-b border-subtle bg-surface/80 backdrop-blur-md">
			<div className="mx-auto flex h-16 w-full max-w-[1140px] items-center justify-between gap-4 px-4 sm:px-6 md:px-8">
				<BasicLink
					href="/"
					aria-label="Verified by DefiLlama"
					className="flex min-w-0 items-center gap-2.5 whitespace-nowrap"
				>
					<Image src="/assets/llama.webp" alt="" width={38} height={38} className="rounded-full" />
					<span className="flex min-w-0 items-center gap-2">
						<span className="text-[21px] leading-none font-semibold tracking-[-0.025em] text-primary">Verified</span>
						<span className="hidden items-center gap-1 min-[400px]:inline-flex">
							<span className="text-2xl leading-none font-light text-link" aria-hidden>
								/
							</span>
							<span className="text-lg leading-none font-medium tracking-[-0.02em] text-secondary">DefiLlama</span>
						</span>
					</span>
				</BasicLink>
				<nav className="hidden items-center gap-1 md:flex">
					{[
						['#reconcile', 'Public record'],
						['#who', "Who it's for"],
						['#how', 'How it works'],
						['#faq', 'FAQ']
					].map(([href, label]) => (
						<a
							key={href}
							href={href}
							className="rounded-md px-3.5 py-2 label-md font-medium text-secondary transition-colors hover:bg-hover-row hover:text-primary"
						>
							{label}
						</a>
					))}
				</nav>
				<Button as="a" href="#get" variant="primary" size="md">
					<span className="font-semibold">Get verified</span>
				</Button>
			</div>
		</header>
	)
}

const verificationStages = {
	custodianVerified: 1,
	ethereumIndexed: 2,
	bankVerified: 3,
	baseIndexed: 4,
	fundAdminVerified: 5,
	remainingChainsIndexed: 6,
	reconciling: 7,
	inputsRevealed: 8,
	surplusVerified: 9,
	coveragePublished: 10
} as const

const verificationStageDelays = [800, 1900, 3000, 3900, 5300, 6400, 7600, 8250, 9000, 9900, 10700]

const verificationActivity = [
	'Checking custodian T-bills · read-only',
	'Indexing Ethereum supply · onchain',
	'Checking bank cash · at source',
	'Indexing Base supply · onchain',
	'Verifying fund admin NAV · signed report',
	'Indexing remaining chains · onchain',
	'All sources current · preparing reconciliation',
	'Reconciling verified assets and liabilities',
	'Revealing verified totals',
	'Computing verified surplus',
	'Publishing solvency view'
]

function useVerificationRun() {
	const [stage, setStage] = useState(0)
	const [run, setRun] = useState(0)
	const [started, setStarted] = useState(false)
	const frameRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const frame = frameRef.current
		if (!frame) return

		if (!('IntersectionObserver' in window)) {
			const timer = globalThis.setTimeout(() => setStarted(true), 0)
			return () => globalThis.clearTimeout(timer)
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return
				setStarted(true)
				observer.disconnect()
			},
			{ threshold: 0.25, rootMargin: '0px 0px -8% 0px' }
		)
		observer.observe(frame)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		if (!started) return

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			const timer = window.setTimeout(() => setStage(verificationStageDelays.length), 0)
			return () => window.clearTimeout(timer)
		}

		const timers = verificationStageDelays.map((delay, index) => window.setTimeout(() => setStage(index + 1), delay))
		return () => timers.forEach((timer) => window.clearTimeout(timer))
	}, [run, started])

	return {
		stage,
		run,
		frameRef,
		replay: () => {
			setStage(0)
			setStarted(true)
			setRun((value) => value + 1)
		}
	}
}

type VerificationHeartbeat = 'idle' | 'checking' | 'verified'

function useVerificationHeartbeat(stage: number, run: number) {
	const [heartbeat, setHeartbeat] = useState<{ run: number; value: VerificationHeartbeat }>({ run: -1, value: 'idle' })

	useEffect(() => {
		if (stage < verificationStageDelays.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

		const checkingTimer = window.setTimeout(() => setHeartbeat({ run, value: 'checking' }), 1800)
		const verifiedTimer = window.setTimeout(() => setHeartbeat({ run, value: 'verified' }), 2700)
		return () => {
			window.clearTimeout(checkingTimer)
			window.clearTimeout(verifiedTimer)
		}
	}, [run, stage])

	return heartbeat.run === run ? heartbeat.value : 'idle'
}

function useAnimatedCoverage(active: boolean, run: number) {
	const [coverage, setCoverage] = useState({ run: -1, value: 100 })

	useEffect(() => {
		if (!active) return

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			const timer = window.setTimeout(() => setCoverage({ run, value: 167 }), 0)
			return () => window.clearTimeout(timer)
		}

		let frame = 0
		const start = performance.now()
		const tick = (now: number) => {
			const progress = Math.min((now - start) / 700, 1)
			const eased = 1 - (1 - progress) ** 3
			setCoverage({ run, value: 100 + 67 * eased })
			if (progress < 1) frame = window.requestAnimationFrame(tick)
		}
		frame = window.requestAnimationFrame(tick)
		return () => window.cancelAnimationFrame(frame)
	}, [active, run])

	return active && coverage.run === run ? coverage.value : 100
}

function ReplayIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M20 11a8 8 0 1 0-2.34 5.66" />
			<path d="M20 4v7h-7" />
		</svg>
	)
}

function DemoFrame({
	stage,
	replay,
	children,
	frameRef,
	completionText = 'Complete · checked just now',
	activityText,
	isRechecking = false
}: {
	stage: number
	replay: () => void
	children: ReactNode
	frameRef: RefObject<HTMLDivElement | null>
	completionText?: string
	activityText?: string
	isRechecking?: boolean
}) {
	return (
		<div
			ref={frameRef}
			className="attn-demo overflow-hidden rounded-xl border border-medium bg-surface shadow-[0_18px_38px_-26px_rgba(9,11,12,0.5)] dark:bg-surface-elevated-1"
		>
			<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3 sm:px-5">
				<div className="flex min-w-0 items-center gap-2.5">
					<span
						className={`size-2 shrink-0 rounded-full ${
							isRechecking ? 'bg-brand' : stage >= verificationStageDelays.length ? 'bg-data-up' : 'bg-warning'
						}`}
						aria-hidden
					/>
					<div className="min-w-0">
						<p className="truncate label-md font-semibold text-primary">Live verification run</p>
						<p className="truncate label-xs text-tertiary" aria-live="polite">
							{activityText ?? (stage >= verificationStageDelays.length ? completionText : 'Checking 9 sources')}
						</p>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<span className="hidden label-sm font-semibold text-primary min-[390px]:inline">Acme Protocol</span>
					<span className="flex size-7 items-center justify-center rounded-full bg-brand-muted label-xs font-semibold text-link-on-tint">
						AC
					</span>
					<button
						type="button"
						onClick={replay}
						className="flex size-8 items-center justify-center rounded-lg text-tertiary transition-colors hover:bg-hover-row hover:text-primary focus-visible:focus-ring"
						aria-label="Replay example verification"
					>
						<ReplayIcon className="size-3.5" />
					</button>
				</div>
			</div>
			{children}
			<p className="sr-only">
				Example verification: DefiLlama verifies 412.8 million dollars of assets against 247.2 million dollars of
				liabilities, resulting in 167 percent coverage across all nine sources.
			</p>
		</div>
	)
}

type LedgerSource = {
	label: string
	verifiedStage: number
	value: number
}

const assetSources: LedgerSource[] = [
	{ label: 'Custodian T-bills', verifiedStage: verificationStages.custodianVerified, value: 271_412_008 },
	{ label: 'Bank cash', verifiedStage: verificationStages.bankVerified, value: 118_204_551 },
	{ label: 'Fund admin NAV', verifiedStage: verificationStages.fundAdminVerified, value: 23_227_561 }
]

const liabilitySources: LedgerSource[] = [
	{ label: 'Ethereum supply', verifiedStage: verificationStages.ethereumIndexed, value: 162_410_551 },
	{ label: 'Base supply', verifiedStage: verificationStages.baseIndexed, value: 64_112_090 },
	{ label: '4 more chains', verifiedStage: verificationStages.remainingChainsIndexed, value: 20_689_407 }
]

function AuditValue({
	prefix,
	groups,
	active,
	delay = 0,
	className = ''
}: {
	prefix: string
	groups: string[]
	active: boolean
	delay?: number
	className?: string
}) {
	const value = `${prefix}${groups.join(',')}`
	return (
		<>
			<span className={`attn-audit-value ${className}`} data-active={active} aria-hidden>
				<span>{prefix}</span>
				{groups.map((group, index) => {
					const maskDelay = delay + index * 90
					const revealDelay = maskDelay + 135
					return (
						<span key={`${group}-${index}`} className="inline-flex">
							{index > 0 ? <span>,</span> : null}
							<span className="attn-audit-group">
								<span className="attn-audit-placeholder" style={{ transitionDelay: `${revealDelay}ms` }}>
									•••
								</span>
								<span className="attn-audit-digits" style={{ transitionDelay: `${revealDelay}ms` }}>
									{group}
								</span>
								<span className="attn-audit-mask" style={{ animationDelay: `${maskDelay}ms` }} />
							</span>
						</span>
					)
				})}
			</span>
			<span className="sr-only">{active ? value : 'Pending verification'}</span>
		</>
	)
}

function LedgerColumn({
	label,
	sources,
	stage,
	privateData = false,
	recheckSource,
	recheckState = 'idle'
}: {
	label: string
	sources: LedgerSource[]
	stage: number
	privateData?: boolean
	recheckSource?: string
	recheckState?: VerificationHeartbeat
}) {
	const verifiedTotal = sources.reduce((total, source) => total + (stage >= source.verifiedStage ? source.value : 0), 0)
	const displayValue = verifiedTotal === 0 ? '—' : formatUsd(verifiedTotal, { maximumFractionDigits: 0 })

	return (
		<section className="p-4 sm:p-5">
			<p className="label-xs font-semibold tracking-[0.08em] text-tertiary uppercase">{label}</p>
			<p
				className="mt-2 font-jetbrains text-xl font-extrabold tracking-tight text-primary tabular-nums"
				aria-live="polite"
				aria-atomic="true"
			>
				<span key={displayValue} className="attn-total-dissolve">
					{displayValue}
				</span>
			</p>
			<div className="mt-4 grid gap-2.5">
				{sources.map((source) => {
					const isVerified = stage >= source.verifiedStage
					const isChecking = stage === source.verifiedStage - 1
					const isRechecking = source.label === recheckSource && recheckState === 'checking'
					const isFresh = source.label === recheckSource && recheckState === 'verified'
					return (
						<div
							key={source.label}
							className="attn-stage flex items-center justify-between gap-3 border-t border-very-subtle pt-2.5"
							data-active={isVerified || isChecking || isRechecking}
						>
							<span className="body-sm text-secondary">{source.label}</span>
							<span className="flex shrink-0 items-center gap-1 label-xs text-secondary">
								{isRechecking || isChecking ? (
									<span className="attn-recheck-spinner size-3 rounded-full" aria-hidden />
								) : isVerified ? (
									<CheckIcon className="size-3 text-data-up" />
								) : (
									<span className="bg-border-strong size-1.5 rounded-full" aria-hidden />
								)}
								{isRechecking
									? 'Read-only · checking'
									: isFresh
										? 'Current · just now'
										: isChecking
											? privateData
												? 'Read-only · checking'
												: 'Indexing'
											: !isVerified
												? 'Waiting'
												: privateData
													? 'Private · verified'
													: 'Indexed'}
							</span>
						</div>
					)
				})}
			</div>
		</section>
	)
}

function ReconciliationLedger() {
	const { stage, run, replay, frameRef } = useVerificationRun()
	const heartbeat = useVerificationHeartbeat(stage, run)
	const coverage = useAnimatedCoverage(stage >= verificationStages.coveragePublished, run)
	const coverageLabel = `${formatPercent(coverage, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
	const thresholdMarkerRef = useRef<HTMLSpanElement>(null)
	const reconciliationState =
		heartbeat === 'checking'
			? 'checking'
			: stage >= verificationStages.surplusVerified
				? 'matched'
				: stage >= verificationStages.reconciling
					? 'checking'
					: 'waiting'
	const activityText =
		heartbeat === 'checking'
			? 'Rechecking custodian · read-only'
			: heartbeat === 'verified'
				? 'Current · custodian checked just now'
				: verificationActivity[stage]

	useEffect(() => {
		if (stage !== verificationStages.coveragePublished || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
			return
		const marker = thresholdMarkerRef.current
		const track = marker?.parentElement
		if (!marker || !track) return
		const travel = track.getBoundingClientRect().width * 0.48
		const animation = marker.animate(
			[
				{ opacity: 0.24, transform: `translate3d(calc(-50% - ${travel}px),-50%,0) scale(.72)` },
				{ opacity: 1, transform: 'translate3d(-50%,-50%,0) scale(1)' }
			],
			{ duration: 700, easing: 'cubic-bezier(.25,1,.5,1)', fill: 'forwards' }
		)
		return () => animation.cancel()
	}, [run, stage])

	return (
		<DemoFrame
			stage={stage}
			replay={replay}
			frameRef={frameRef}
			completionText="Complete · public record updated"
			activityText={activityText}
			isRechecking={heartbeat === 'checking'}
		>
			<div className="attn-ledger-columns grid">
				<LedgerColumn
					label="Verified assets"
					sources={assetSources}
					stage={stage}
					privateData
					recheckSource="Custodian T-bills"
					recheckState={heartbeat}
				/>
				<LedgerColumn label="Public liabilities" sources={liabilitySources} stage={stage} />
			</div>
			<div className="relative border-t border-subtle px-4 py-5 sm:px-5">
				<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
					<div className="grid gap-2">
						<p className="label-xs text-secondary">3 private sources</p>
						<div className="flex items-center gap-2" aria-hidden>
							<span
								className={`size-2 shrink-0 rounded-full ${stage >= verificationStages.fundAdminVerified ? 'bg-data-up' : 'bg-border-strong'}`}
							/>
							<span className="relative h-px grow overflow-hidden bg-border-medium">
								<span
									className="attn-line absolute inset-0 bg-brand"
									data-active={stage >= verificationStages.reconciling}
								/>
							</span>
						</div>
					</div>
					<div className="flex flex-col items-center gap-1.5">
						<span
							className="attn-reconcile-mark flex size-7 items-center justify-center rounded-full bg-brand-faint"
							data-state={reconciliationState}
							aria-hidden
						>
							{reconciliationState === 'matched' ? (
								<CheckIcon className="size-3.5 text-data-up" />
							) : (
								<span
									className={`size-1.5 rounded-full ${reconciliationState === 'checking' ? 'bg-brand' : 'bg-border-strong'}`}
								/>
							)}
						</span>
						<span className="label-xs font-semibold text-primary" aria-live="polite">
							{reconciliationState === 'matched'
								? 'Matched'
								: reconciliationState === 'checking'
									? 'Reconciling'
									: 'Waiting'}
						</span>
					</div>
					<div className="grid gap-2 text-right">
						<p className="label-xs text-secondary">6 chains indexed</p>
						<div className="flex items-center gap-2" aria-hidden>
							<span className="relative h-px grow overflow-hidden bg-border-medium">
								<span
									className="attn-line absolute inset-0 bg-brand"
									data-active={stage >= verificationStages.reconciling}
									data-direction="reverse"
								/>
							</span>
							<span
								className={`size-2 shrink-0 rounded-full ${stage >= verificationStages.remainingChainsIndexed ? 'bg-data-up' : 'bg-border-strong'}`}
							/>
						</div>
					</div>
				</div>
				<div
					className="attn-equation attn-result mt-4 grid items-end gap-2 border-t border-very-subtle pt-4 text-center"
					data-active={stage >= verificationStages.reconciling}
				>
					<div className="min-w-0 text-left">
						<p className="label-xs text-tertiary">Assets</p>
						<p className="attn-equation-value mt-1 truncate font-jetbrains font-bold text-primary tabular-nums">
							<AuditValue
								key={`assets-${run}`}
								prefix="$"
								groups={['412', '844', '120']}
								active={stage >= verificationStages.inputsRevealed}
							/>
						</p>
					</div>
					<span
						className="attn-equation-op pb-0.5 text-tertiary"
						data-active={stage >= verificationStages.reconciling}
						data-kind="minus"
						aria-hidden
					>
						−
					</span>
					<div className="min-w-0">
						<p className="label-xs text-tertiary">Liabilities</p>
						<p className="attn-equation-value mt-1 truncate font-jetbrains font-bold text-primary tabular-nums">
							<AuditValue
								key={`liabilities-${run}`}
								prefix="$"
								groups={['247', '212', '048']}
								active={stage >= verificationStages.inputsRevealed}
								delay={220}
							/>
						</p>
					</div>
					<span
						className="attn-equation-op pb-0.5 text-tertiary"
						data-active={stage >= verificationStages.surplusVerified}
						aria-hidden
					>
						=
					</span>
					<div className="min-w-0 text-right">
						<p className="label-xs text-tertiary">Verified surplus</p>
						<p className="attn-equation-value mt-1 truncate font-jetbrains font-extrabold text-data-up tabular-nums">
							<AuditValue
								key={`surplus-${run}`}
								prefix="+$"
								groups={['165', '632', '072']}
								active={stage >= verificationStages.surplusVerified}
							/>
						</p>
					</div>
				</div>
			</div>
			<div className="border-t border-subtle px-4 py-4 sm:px-5">
				<div
					className="attn-result flex flex-wrap items-end justify-between gap-3"
					data-active={stage >= verificationStages.coveragePublished}
				>
					<div>
						<p className="label-xs font-semibold tracking-[0.08em] text-tertiary uppercase">Coverage</p>
						<p className="mt-1 font-jetbrains text-3xl font-extrabold text-primary tabular-nums" aria-hidden>
							{coverageLabel}
						</p>
						<span className="sr-only">167 percent coverage</span>
					</div>
					<p className="flex items-center gap-1.5 label-sm font-semibold text-data-up">
						<CheckIcon className="size-3.5" /> 9 of 9 sources verified
					</p>
				</div>
				<div className="attn-result mt-3" data-active={stage >= verificationStages.coveragePublished}>
					<div className="flex items-center justify-between gap-3 label-xs">
						<span className="text-tertiary">Minimum solvency 100.00%</span>
						<span className="font-semibold text-data-up" aria-hidden>
							Current {coverageLabel}
						</span>
					</div>
					<div className="relative mt-2 h-3" aria-hidden>
						<span className="absolute top-1/2 right-0 left-0 h-px bg-border-medium" />
						<span className="bg-border-strong absolute top-0 left-[34%] h-3 w-px" />
						<span
							className="attn-threshold-fill absolute top-1/2 left-[34%] h-px w-[48%] bg-data-up"
							data-active={stage >= verificationStages.coveragePublished}
						/>
						<span
							ref={thresholdMarkerRef}
							className="attn-threshold-marker absolute top-1/2 left-[82%] size-2 rounded-full bg-data-up"
							data-active={stage >= verificationStages.coveragePublished}
						/>
					</div>
				</div>
			</div>
		</DemoFrame>
	)
}

function CadenceCompare() {
	const days = Array.from({ length: 30 }, (_, i) => i)
	return (
		<div className="mt-8 rounded-lg border border-subtle bg-surface-elevated-1/50 p-6 dark:bg-surface/50">
			<div className="grid items-center gap-x-5 gap-y-4 sm:grid-cols-[170px_1fr_auto]">
				<span className="label-md font-semibold text-secondary">Monthly PDF</span>
				<span className="flex items-center gap-1">
					{days.map((d) => (
						<span
							key={d}
							className={`w-full max-w-2 rounded-full ${d === 0 ? 'h-5 bg-warning/80' : 'h-1 bg-border-medium'}`}
						/>
					))}
				</span>
				<span className="label-md text-warning">29-day blind spot</span>
				<span className="label-md font-semibold text-secondary">Verified by DefiLlama</span>
				<span className="flex items-center gap-1">
					{days.map((d) => (
						<span key={d} className="h-5 w-full max-w-2 rounded-full bg-data-up/70" />
					))}
				</span>
				<span className="label-md text-data-up">checked hourly</span>
			</div>
		</div>
	)
}

function VenueFlow() {
	const venues = ['Deribit', 'Hyperliquid', 'CEX spot', 'Broker', 'Bank', 'Onchain']
	return (
		<div className="mt-8 rounded-lg border border-subtle bg-surface-elevated-1/50 p-6 dark:bg-surface/50">
			<div className="flex flex-wrap items-center justify-center gap-2.5">
				{venues.map((v) => (
					<span
						key={v}
						className="rounded-md border border-subtle bg-surface px-3.5 py-1.5 label-md text-secondary dark:bg-surface-elevated-1"
					>
						{v}
					</span>
				))}
			</div>
			<div className="my-3 text-center text-lg text-tertiary">↓</div>
			<p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-center">
				<span className="flex items-center gap-2.5 font-jetbrains text-2xl font-extrabold text-primary tabular-nums">
					<CheckIcon className="size-5 text-data-up" />
					NAV $86,412,904
				</span>
				<span className="body-sm text-tertiary">one verified figure, positions stay private</span>
			</p>
		</div>
	)
}

function PersonaDossier() {
	const [tab, setTab] = useState<keyof typeof personas>('issuer')
	const p = personas[tab]
	return (
		<div className="overflow-hidden rounded-xl border border-medium bg-surface shadow-[0_16px_32px_-20px_rgba(9,11,12,0.45)] dark:bg-surface-elevated-1">
			<div
				className="grid border-b border-subtle sm:grid-cols-2 sm:divide-x sm:divide-(--border-subtle)"
				role="tablist"
				aria-label="Who it's for"
			>
				{(Object.keys(personas) as Array<keyof typeof personas>).map((key) => (
					<button
						key={key}
						type="button"
						role="tab"
						aria-selected={tab === key}
						onClick={() => setTab(key)}
						className={`px-5 py-4 text-left transition-colors sm:px-6 ${
							tab === key ? 'bg-brand-faint shadow-[inset_0_-2px_0_var(--bg-brand)]' : 'hover:bg-hover-row'
						}`}
					>
						<span className="block label-lg font-semibold text-primary">{personas[key].tab}</span>
						<span className="mt-0.5 block body-sm text-tertiary">{personas[key].sub}</span>
					</button>
				))}
			</div>
			<div className="p-6 sm:p-8">
				<h3 className="max-w-2xl text-[clamp(1.3rem,2.2vw,1.65rem)] leading-snug font-bold text-primary">{p.punch}</h3>
				<p className="mt-4 max-w-[64ch] body-md leading-relaxed text-secondary">
					{p.proseLead} <b className="font-medium text-primary">{p.proseBold}</b> {p.proseTail}
				</p>
				<ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
					{p.checklist.map((item) => (
						<li key={item} className="flex items-start gap-2.5 body-md text-secondary">
							<CheckIcon className="mt-1 size-3.5 shrink-0 text-data-up" />
							{item}
						</li>
					))}
				</ul>
				{tab === 'issuer' ? <CadenceCompare /> : <VenueFlow />}
			</div>
		</div>
	)
}

type ProofState = 'verified' | 'partial' | 'stale' | 'unverified'
type RegisterSourceId = 'custodian' | 'bank' | 'fund-admin' | 'liabilities'

const registerSources: Array<{
	id: RegisterSourceId
	name: string
	kind: string
	method: string
	access: string
	freshness: string
	cadence: string
}> = [
	{
		id: 'custodian',
		name: 'Custodian T-bills',
		kind: 'Private asset source',
		method: 'Read-only account',
		access: 'Direct balance check',
		freshness: '12s ago',
		cadence: 'Hourly'
	},
	{
		id: 'bank',
		name: 'Bank cash',
		kind: 'Private asset source',
		method: 'Statement at source',
		access: 'Origin confirmed',
		freshness: '2h ago',
		cadence: 'Daily'
	},
	{
		id: 'fund-admin',
		name: 'Fund admin NAV',
		kind: 'Private asset source',
		method: 'Signed NAV report',
		access: 'Administrator confirmed',
		freshness: '6h ago',
		cadence: 'Daily'
	},
	{
		id: 'liabilities',
		name: 'Token liabilities',
		kind: 'Public liability source',
		method: 'Onchain index',
		access: '6 chains monitored',
		freshness: '9s ago',
		cadence: 'Continuous'
	}
]

type ProofStateConfig = {
	label: string
	detail: string
	headline: string
	dotTone: string
	textTone: string
	scope: string
	exception: string
	nextCheck: string
	affectedSource?: RegisterSourceId
	affectedStatus?: string
	affectedFreshness?: string
}

const proofStates: Record<ProofState, ProofStateConfig> = {
	verified: {
		label: 'Current',
		detail: 'All disclosed sources are current',
		headline: 'Current · checked 12s ago',
		dotTone: 'bg-data-up',
		textTone: 'text-data-up',
		scope: '9 / 9 in scope',
		exception: 'No exceptions',
		nextCheck: 'Next check in 48m'
	},
	partial: {
		label: 'Partial',
		detail: 'Some sources are outside the verification scope',
		headline: 'Partial · 8 of 9 sources covered',
		dotTone: 'bg-(--bg-brand)',
		textTone: 'text-link',
		scope: '8 / 9 in scope',
		exception: '1 source excluded',
		nextCheck: 'Scope review open',
		affectedSource: 'fund-admin',
		affectedStatus: 'Partial',
		affectedFreshness: 'Outside scope'
	},
	stale: {
		label: 'Stale',
		detail: 'A source missed its expected update',
		headline: 'Stale · custodian update overdue',
		dotTone: 'bg-warning',
		textTone: 'text-warning',
		scope: '9 / 9 in scope',
		exception: '1 source overdue',
		nextCheck: 'Retrying now',
		affectedSource: 'custodian',
		affectedStatus: 'Stale',
		affectedFreshness: '7h overdue'
	},
	unverified: {
		label: 'Unverified',
		detail: 'A metric could not be independently checked',
		headline: 'Unverified · bank cash not confirmed',
		dotTone: 'bg-data-down',
		textTone: 'text-data-down',
		scope: '8 / 9 in scope',
		exception: '1 failed check',
		nextCheck: 'Manual review required',
		affectedSource: 'bank',
		affectedStatus: 'Unverified',
		affectedFreshness: 'Could not confirm'
	}
}

const proofStateOrder: ProofState[] = ['verified', 'partial', 'stale', 'unverified']

const proofStateDurations: Record<ProofState, number> = {
	verified: 5_000,
	partial: 5_000,
	stale: 6_000,
	unverified: 6_000
}

function PlaybackIcon({ isPlaying }: { isPlaying: boolean }) {
	return (
		<svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
			{isPlaying ? (
				<>
					<path d="M8 5v14" />
					<path d="M16 5v14" />
				</>
			) : (
				<path d="m8 5 11 7-11 7V5Z" />
			)}
		</svg>
	)
}

function RegisterStatus({ state, label }: { state: ProofStateConfig; label: string }) {
	return (
		<span className={`flex min-w-0 items-center gap-2 label-sm font-semibold whitespace-nowrap ${state.textTone}`}>
			<span className={`size-2 shrink-0 rounded-full ${state.dotTone}`} aria-hidden />
			<span className="min-w-0">{label}</span>
		</span>
	)
}

function SourceRegister({
	proofState,
	isPlaying,
	autoplayDisabled,
	onTogglePlayback
}: {
	proofState: ProofState
	isPlaying: boolean
	autoplayDisabled: boolean
	onTogglePlayback: () => void
}) {
	const state = proofStates[proofState]
	const playbackLabel = autoplayDisabled
		? 'Autoplay disabled by reduced motion preference'
		: isPlaying
			? 'Pause verification record slideshow'
			: 'Play verification record slideshow'
	return (
		<div className="overflow-hidden rounded-xl border border-medium bg-surface dark:bg-surface-elevated-1">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-5 py-4 sm:px-6">
				<div className="flex items-center gap-3">
					<span className="flex size-8 items-center justify-center rounded-full bg-brand-muted label-sm font-semibold text-link-on-tint">
						AC
					</span>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
							<p className="label-md font-semibold text-primary">Acme Protocol</p>
							<VerifiedByDefiLlamaMark />
						</div>
						<p className="label-xs text-tertiary">Public verification record · Example data</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<p
						key={state.headline}
						className={`attn-register-change flex items-center gap-2 label-sm font-semibold ${state.textTone}`}
					>
						<span className={`size-2 rounded-full ${state.dotTone}`} aria-hidden /> {state.headline}
					</p>
					<button
						type="button"
						onClick={onTogglePlayback}
						disabled={autoplayDisabled}
						className="flex size-7 shrink-0 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-hover-row hover:text-primary focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-40"
						aria-label={playbackLabel}
						title={playbackLabel}
					>
						<PlaybackIcon isPlaying={isPlaying && !autoplayDisabled} />
					</button>
				</div>
			</div>

			<div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(7rem,.72fr)_minmax(6rem,.55fr)] gap-4 border-b border-very-subtle px-6 py-2.5 label-xs font-semibold tracking-[0.08em] text-tertiary uppercase sm:grid">
				<span>Source</span>
				<span>Verification method</span>
				<span>Freshness</span>
				<span className="pl-4">Status</span>
			</div>

			<ul className="divide-y divide-(--border-very-subtle)">
				{registerSources.map((source) => {
					const isAffected = state.affectedSource === source.id
					const statusLabel = isAffected ? (state.affectedStatus ?? state.label) : 'Current'
					const freshness = isAffected ? (state.affectedFreshness ?? source.freshness) : source.freshness
					const statusState = isAffected ? state : proofStates.verified

					return (
						<li
							key={source.id}
							className={`grid gap-3 px-5 py-4 transition-colors sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)_minmax(7rem,.72fr)_minmax(6rem,.55fr)] sm:items-center sm:gap-4 sm:px-6 ${
								isAffected ? 'bg-surface-elevated-1/60' : ''
							}`}
						>
							<div className="flex min-w-0 items-start justify-between gap-4 sm:block">
								<div className="min-w-0">
									<p className="label-sm font-semibold text-primary">{source.name}</p>
									<p className="mt-0.5 label-xs text-tertiary">{source.kind}</p>
								</div>
								<span key={statusLabel} className="attn-register-change sm:hidden">
									<RegisterStatus state={statusState} label={statusLabel} />
								</span>
							</div>
							<div className="min-w-0">
								<p className="label-sm text-secondary">{source.method}</p>
								<p className="mt-0.5 label-xs text-tertiary">{source.access}</p>
							</div>
							<div className="min-w-0">
								<p
									key={freshness}
									className={`attn-register-change label-sm font-medium whitespace-nowrap ${isAffected ? statusState.textTone : 'text-secondary'}`}
								>
									{freshness}
								</p>
								<p className="mt-0.5 label-xs text-tertiary">{source.cadence}</p>
							</div>
							<span key={statusLabel} className="attn-register-change hidden min-w-0 sm:block">
								<RegisterStatus state={statusState} label={statusLabel} />
							</span>
						</li>
					)
				})}
			</ul>

			<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-subtle bg-surface-elevated-1/40 px-5 py-3 label-xs text-secondary sm:px-6">
				<p className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span key={state.scope} className="attn-register-change font-semibold text-primary">
						{state.scope}
					</span>
					<span aria-hidden>·</span>
					<span key={state.exception} className="attn-register-change">
						{state.exception}
					</span>
					<span aria-hidden>·</span>
					<span key={state.nextCheck} className="attn-register-change">
						{state.nextCheck}
					</span>
				</p>
				<span className="text-tertiary">Only agreed aggregates are public</span>
			</div>
		</div>
	)
}

function PublicProofSection() {
	const [proofState, setProofState] = useState<ProofState>('verified')
	const [isPlaying, setIsPlaying] = useState(true)
	const [isInView, setIsInView] = useState(false)
	const [isDocumentVisible, setIsDocumentVisible] = useState(true)
	const [isHoverPaused, setIsHoverPaused] = useState(false)
	const [isKeyboardPaused, setIsKeyboardPaused] = useState(false)
	const [isManualPaused, setIsManualPaused] = useState(false)
	const [manualPauseVersion, setManualPauseVersion] = useState(0)
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
	const [manualAnnouncement, setManualAnnouncement] = useState('')
	const sectionRef = useRef<HTMLElement>(null)
	const keyboardNavigationRef = useRef(false)
	const isAutoAdvancing =
		isPlaying &&
		isInView &&
		isDocumentVisible &&
		!isHoverPaused &&
		!isKeyboardPaused &&
		!isManualPaused &&
		!prefersReducedMotion

	useEffect(() => {
		const section = sectionRef.current
		if (!section || !('IntersectionObserver' in window)) {
			const timer = window.setTimeout(() => setIsInView(true), 0)
			return () => window.clearTimeout(timer)
		}

		const observer = new IntersectionObserver((entries) => setIsInView(entries.some((entry) => entry.isIntersecting)), {
			threshold: 0.25,
			rootMargin: '0px 0px -8% 0px'
		})
		observer.observe(section)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)')
		const updatePreference = () => setPrefersReducedMotion(media.matches)
		updatePreference()
		media.addEventListener('change', updatePreference)
		return () => media.removeEventListener('change', updatePreference)
	}, [])

	useEffect(() => {
		const updateVisibility = () => setIsDocumentVisible(document.visibilityState === 'visible')
		updateVisibility()
		document.addEventListener('visibilitychange', updateVisibility)
		return () => document.removeEventListener('visibilitychange', updateVisibility)
	}, [])

	useEffect(() => {
		const markKeyboardNavigation = (event: KeyboardEvent) => {
			if (event.key === 'Tab') keyboardNavigationRef.current = true
		}
		const markPointerNavigation = () => {
			keyboardNavigationRef.current = false
		}
		document.addEventListener('keydown', markKeyboardNavigation, true)
		document.addEventListener('pointerdown', markPointerNavigation, true)
		return () => {
			document.removeEventListener('keydown', markKeyboardNavigation, true)
			document.removeEventListener('pointerdown', markPointerNavigation, true)
		}
	}, [])

	useEffect(() => {
		if (!isManualPaused) return
		const timer = window.setTimeout(() => setIsManualPaused(false), 10_000)
		return () => window.clearTimeout(timer)
	}, [isManualPaused, manualPauseVersion])

	useEffect(() => {
		if (!isAutoAdvancing) return
		const timer = window.setTimeout(() => {
			setProofState((current) => {
				const currentIndex = proofStateOrder.indexOf(current)
				return proofStateOrder[(currentIndex + 1) % proofStateOrder.length]
			})
		}, proofStateDurations[proofState])
		return () => window.clearTimeout(timer)
	}, [isAutoAdvancing, proofState])

	const selectProofState = (nextState: ProofState) => {
		setProofState(nextState)
		setManualAnnouncement(`Showing ${proofStates[nextState].headline}`)
		if (isPlaying && !prefersReducedMotion) {
			setIsManualPaused(true)
			setManualPauseVersion((version) => version + 1)
		}
	}

	const togglePlayback = () => {
		const nextIsPlaying = !isPlaying
		setIsPlaying(nextIsPlaying)
		setIsManualPaused(false)
		setManualAnnouncement(
			nextIsPlaying ? 'Verification record slideshow playing' : 'Verification record slideshow paused'
		)
	}

	return (
		<section
			ref={sectionRef}
			id="reconcile"
			className="scroll-mt-24"
			onMouseEnter={() => setIsHoverPaused(true)}
			onMouseLeave={() => setIsHoverPaused(false)}
			onFocusCapture={() => {
				if (keyboardNavigationRef.current) setIsKeyboardPaused(true)
			}}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsKeyboardPaused(false)
			}}
		>
			<div className="mx-auto max-w-[1140px] px-4 py-24 sm:px-6 md:px-8 lg:py-32">
				<div className="grid gap-8 lg:grid-cols-[minmax(0,330px)_1fr] lg:items-start lg:gap-16">
					<div>
						<p className="label-sm font-semibold tracking-[0.08em] text-link uppercase">The public record</p>
						<h2 className="mt-4 text-[clamp(1.95rem,3.8vw,2.9rem)] leading-[1.07] font-bold tracking-tight">
							Every published metric shows its source, method, and freshness
						</h2>
						<p className="mt-5 body-lg leading-relaxed text-secondary">
							Investors see how each source was checked, when it was last confirmed, what cadence to expect, and whether
							anything sits outside the verification scope. Private records and positions stay private. Verification
							covers only the sources and metrics listed in the record; it is not a financial audit or guarantee.
						</p>
					</div>
					<SourceRegister
						proofState={proofState}
						isPlaying={isPlaying}
						autoplayDisabled={prefersReducedMotion}
						onTogglePlayback={togglePlayback}
					/>
				</div>

				<div
					className="mt-10 grid gap-x-8 gap-y-4 border-t border-subtle sm:grid-cols-2 lg:grid-cols-4"
					role="group"
					aria-label="Public verification record state slideshow"
				>
					{proofStateOrder.map((key) => {
						const state = proofStates[key]
						const isActive = proofState === key
						return (
							<button
								key={key}
								type="button"
								onClick={() => selectProofState(key)}
								aria-pressed={isActive}
								className={`group relative -mt-px grid grid-cols-[auto_1fr] gap-x-2.5 border-t border-transparent py-5 text-left transition-colors focus-visible:focus-ring ${
									isActive ? 'text-primary' : 'text-tertiary hover:text-primary'
								}`}
							>
								{isActive ? (
									<span
										key={`${key}-${isAutoAdvancing ? 'playing' : 'paused'}`}
										className="pointer-events-none absolute -top-px right-0 left-0 h-px overflow-hidden bg-border-subtle"
										aria-hidden
									>
										<span
											className={`block h-full bg-brand ${isAutoAdvancing ? 'attn-proof-progress' : 'scale-x-100'}`}
											style={isAutoAdvancing ? { animationDuration: `${proofStateDurations[key]}ms` } : undefined}
										/>
									</span>
								) : null}
								<span className={`mt-1 size-2 rounded-full ${state.dotTone}`} aria-hidden />
								<span>
									<span className="block label-sm font-semibold">{state.label}</span>
									<span className="mt-1 block body-sm text-tertiary">{state.detail}</span>
								</span>
							</button>
						)
					})}
				</div>
				<span className="sr-only" aria-live="polite">
					{manualAnnouncement}
				</span>
			</div>
		</section>
	)
}

export default function VerifiedLanding() {
	return (
		<>
			<Head>
				<title>Verified by DefiLlama | Independent Offchain Verification</title>
				<meta
					name="description"
					content="DefiLlama independently verifies private offchain assets through read-only access, reconciles them with public liabilities, and publishes a current verification record."
				/>
				<link rel="icon" type="image/png" href="/icons/favicon-32x32.png" />
			</Head>
			<style dangerouslySetInnerHTML={{ __html: pageCss }} />
			<div className="col-span-full flex min-h-screen w-full flex-col bg-surface font-inter text-primary">
				<div className="relative flex grow flex-col">
					<SiteHeader />

					<main className="grow">
						<section className="relative -mt-16 overflow-hidden border-b border-subtle">
							<div className="attn-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
							<div className="relative mx-auto flex min-h-[94svh] max-w-[1140px] flex-col justify-center px-4 pt-32 pb-20 sm:px-6 md:px-8 lg:pt-36">
								<div className="grid items-center gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
									<div className="max-w-[560px]">
										<p className="label-sm font-semibold tracking-[0.08em] text-link uppercase">
											Verified by DefiLlama
										</p>
										<h1 className="mt-4 max-w-[17ch] text-[clamp(2.45rem,5vw,4.15rem)] leading-[1.02] font-extrabold tracking-[-0.035em]">
											Your offchain metrics, <span className="text-link">verified</span> and published by DefiLlama
										</h1>
										<p className="mt-7 max-w-[52ch] body-xl leading-relaxed text-secondary">
											DefiLlama verifies private reserves and financial statements through read-only access, reconciles
											them with public liabilities, and publishes a current verification record.
										</p>
										<div className="mt-8 flex flex-wrap items-center gap-5">
											<a href="#get" className={primaryCtaStyles}>
												Get verified
											</a>
											<a href="#reconcile" className="label-sm font-semibold text-link hover:underline">
												See the public record ↓
											</a>
										</div>
										<ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 body-sm text-secondary">
											{['Read-only access', 'Private by default', 'Public on DefiLlama'].map((promise) => (
												<li key={promise} className="flex items-center gap-2">
													<CheckIcon className="size-3.5 text-data-up" /> {promise}
												</li>
											))}
										</ul>
									</div>
									<ReconciliationLedger />
								</div>
							</div>
						</section>

						<PublicProofSection />

						<section className="mx-auto max-w-[1140px] px-4 py-24 sm:px-6 md:px-8">
							<h2
								id="who"
								className="max-w-[24ch] scroll-mt-20 text-[clamp(1.9rem,3.6vw,2.75rem)] leading-[1.08] font-bold tracking-tight"
							>
								Built for the teams investors ask the hardest questions
							</h2>
							<div className="mt-10">
								<PersonaDossier />
							</div>
						</section>

						<section id="how" className="scroll-mt-24 border-t border-subtle">
							<div className="mx-auto max-w-[1140px] px-4 py-24 sm:px-6 md:px-8">
								<p className="label-sm font-semibold tracking-[0.08em] text-link uppercase">How it works</p>
								<h2 className="mt-4 max-w-xl text-[clamp(1.9rem,3.6vw,2.75rem)] leading-[1.08] font-bold tracking-tight">
									From private source to public verification record
								</h2>
								<div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
									{howSteps.map((step) => (
										<div key={step.number} className="border-t border-subtle pt-5">
											<div className="flex items-baseline justify-between gap-3">
												<span className="font-jetbrains label-sm font-bold text-tertiary">{step.number}</span>
												<span className="label-xs font-semibold tracking-[0.08em] text-link uppercase">
													{step.label}
												</span>
											</div>
											<h3 className="mt-6 label-lg font-semibold text-primary">{step.title}</h3>
											<p className="mt-2 body-md leading-relaxed text-secondary">{step.desc}</p>
										</div>
									))}
								</div>
							</div>
						</section>

						<section id="faq" className="scroll-mt-24 border-t border-subtle">
							<div className="mx-auto max-w-[1140px] px-4 py-24 sm:px-6 md:px-8">
								<div className="grid gap-12 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-20">
									<h2 className="text-[clamp(1.9rem,3.6vw,2.75rem)] leading-[1.08] font-bold tracking-tight">
										Questions teams ask us first
									</h2>
									<div className="grid gap-x-16 gap-y-9 sm:grid-cols-2">
										{faqs.map((f) => (
											<div key={f.q}>
												<h3 className="label-lg font-semibold text-primary">{f.q}</h3>
												<p className="mt-2 body-md leading-relaxed text-secondary">{f.a}</p>
											</div>
										))}
									</div>
								</div>
							</div>
						</section>

						<section id="get" className="scroll-mt-24 border-t border-subtle">
							<div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-x-12 gap-y-8 px-4 py-24 sm:px-6 md:px-8 xl:flex-nowrap">
								<div>
									<h2 className="max-w-[22ch] text-[clamp(2rem,4.2vw,3rem)] leading-[1.06] font-extrabold tracking-tight">
										Get your offchain metrics verified by DefiLlama.
									</h2>
									<p className="mt-4 max-w-xl body-lg text-secondary">
										Tell us where your assets and liabilities live. We'll map the sources, verification scope, and
										update cadence before you commit.
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-3 xl:shrink-0 xl:flex-nowrap">
									<a href="mailto:patrick@defillama.com" className={primaryCtaStyles}>
										Get verified
									</a>
									<a
										href="https://calendly.com/patrick-defillama"
										target="_blank"
										rel="noopener noreferrer"
										className={secondaryCtaStyles}
									>
										<span>Book a call</span>
										<ResearchIcon name="calendly-mark" className="size-5 shrink-0" aria-hidden />
									</a>
								</div>
							</div>
						</section>
					</main>

					<footer className="relative overflow-hidden border-t border-subtle">
						<div className="relative z-10 mx-auto flex max-w-[1140px] flex-wrap items-center justify-center gap-4 px-4 pt-6 pb-20 body-sm text-secondary sm:px-6 md:justify-between md:px-8 lg:pb-28">
							<span>&copy; {new Date().getFullYear()} DefiLlama</span>
							<div className="flex gap-5">
								<BasicLink href="/" className="transition-colors hover:text-primary">
									Back to DefiLlama
								</BasicLink>
								<BasicLink href="/terms" className="transition-colors hover:text-primary">
									Terms of Service
								</BasicLink>
							</div>
						</div>
						<p
							className="pointer-events-none absolute inset-x-0 -bottom-[0.16em] text-center text-[clamp(3.5rem,15vw,12.5rem)] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap text-primary/6 select-none"
							aria-hidden
						>
							DEFILLAMA
						</p>
					</footer>
				</div>
			</div>
		</>
	)
}

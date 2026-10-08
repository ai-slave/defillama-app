import type { ReactNode } from 'react'
import type { FineKind } from './columnKind'

type StatusTone = 'ready' | 'busy' | 'error' | 'muted'

const TONE_CLASS: Record<StatusTone, string> = {
	ready: 'bg-pro-success-300',
	busy: 'bg-pro-premium-300',
	error: 'bg-error',
	muted: 'bg-pro-text-tertiary/60'
}

export function StatusDot({ tone, blink = false }: { tone: StatusTone; blink?: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={`relative inline-flex size-1.5 shrink-0 rounded-full ${TONE_CLASS[tone]} ${
				blink ? 'animate-pulse' : ''
			}`}
		/>
	)
}

export function Keycap({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
	return (
		<kbd
			className={`inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-[3px] border px-0.75 font-mono text-[10px] leading-none tabular-nums ${
				muted
					? 'border-white/20 bg-white/10 text-on-brand/85'
					: 'border-subtle bg-pro-app-bg text-pro-text-secondary shadow-inset-divider'
			}`}
		>
			{children}
		</kbd>
	)
}

export function SectionLabel({ label, count, action }: { label: string; count?: string | number; action?: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-2">
			<div className="flex items-baseline gap-2">
				<h3 className="title-sm tracking-tight text-pro-text-primary">{label}</h3>
				{count !== undefined ? <span className="text-[11px] text-pro-text-tertiary tabular-nums">{count}</span> : null}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	)
}

const KIND_LABEL: Record<FineKind, string> = {
	date: 'date',
	int: 'int',
	float: 'num',
	text: 'text',
	bool: 'bool',
	list: 'list',
	other: '—'
}

const KIND_TONE: Record<FineKind, string> = {
	date: 'text-pro-premium-300',
	int: 'text-brand',
	float: 'text-brand',
	text: 'text-pro-success-300',
	bool: 'text-pro-ai-300',
	list: 'text-pro-ai-300',
	other: 'text-pro-text-tertiary'
}

export function TypeBadge({ kind }: { kind: FineKind }) {
	return (
		<span
			aria-label={`${kind} column`}
			className={`inline-flex h-[14px] shrink-0 items-center rounded-[3px] bg-pro-app-bg/60 px-1 font-mono text-[9px] leading-none tracking-tight ${KIND_TONE[kind]}`}
		>
			{KIND_LABEL[kind]}
		</span>
	)
}

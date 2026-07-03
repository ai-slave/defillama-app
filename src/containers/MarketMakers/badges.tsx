import type { ReactNode } from 'react'

const ACCENT = 'border-[#1A54C4]/30 bg-[#1A54C4]/10 text-[#1A54C4]'
const SECONDARY = 'border-[#3F4D62]/30 bg-[#3F4D62]/10 text-(--text-secondary)'

const STATUS_STYLES: Record<'full' | 'partial' | 'none', string> = {
	full: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
	partial: 'border-amber-500 bg-amber-500/10 text-amber-500',
	none: 'border-red-500 bg-red-500/10 text-red-500'
}

export function AccentBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-medium ${ACCENT} ${className}`}
		>
			{children}
		</span>
	)
}

export function TimeframeBadge({ label }: { label: string }) {
	return <AccentBadge className="h-6">{label}</AccentBadge>
}

export function SecondaryBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${SECONDARY} ${className}`}
		>
			{children}
		</span>
	)
}

export function StatusBadge({ status, label, className = '' }: { status: string; label: string; className?: string }) {
	const style = STATUS_STYLES[status as 'full' | 'partial' | 'none'] ?? 'border-(--cards-border) text-(--text-tertiary)'
	return (
		<span
			className={`inline-flex items-center justify-center rounded-full border text-xs font-medium ${style} ${className}`}
		>
			{label}
		</span>
	)
}

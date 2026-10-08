import type { ReactNode } from 'react'
import type { CompositeGrade } from './format'

const STATUS_STYLES: Record<'full' | 'partial' | 'none', string> = {
	full: 'border-success bg-success-tint text-success',
	partial: 'border-warning bg-warning-tint text-warning',
	none: 'border-error bg-error-tint text-error'
}

export function AccentBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-muted bg-brand-muted px-2.5 label-sm text-link ${className}`}
		>
			{children}
		</span>
	)
}

export function SecondaryBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-medium bg-surface-elevated-1 px-2.5 py-0.5 label-sm text-secondary ${className}`}
		>
			{children}
		</span>
	)
}

export function GradeBadge({ grade, className = '' }: { grade: CompositeGrade | null; className?: string }) {
	if (grade == null) return <span className="text-tertiary">N/A</span>
	return <span className={`font-medium ${grade.colorClassName} ${className}`}>{grade.label}</span>
}

export function StatusBadge({
	status,
	label,
	className = ''
}: {
	status: string
	label: ReactNode
	className?: string
}) {
	const style = STATUS_STYLES[status as 'full' | 'partial' | 'none'] ?? 'border-subtle text-tertiary'
	return (
		<span className={`inline-flex items-center justify-center rounded-full border label-sm ${style} ${className}`}>
			{label}
		</span>
	)
}

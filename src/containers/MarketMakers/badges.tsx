import type { ReactNode } from 'react'
import type { Status } from '~/ui/StatusBadge'
import type { CompositeGrade } from './format'

const INTEGRATION_STATUS: Record<string, Status> = {
	full: 'good',
	partial: 'caution',
	none: 'bad'
}

/** The integration level as a badge status; a level outside full, partial and none reads as neutral. */
export function integrationStatus(level: string): Status {
	return INTEGRATION_STATUS[level] ?? 'neutral'
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

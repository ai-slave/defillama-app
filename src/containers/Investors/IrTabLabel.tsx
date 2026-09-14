import type { ReactNode } from 'react'

/**
 * Shared inner content for the "Investor Relations" / "Enterprise Dashboard" tab, used by both
 * the protocol tab bar and the chain tab bar so they stay identical. The parent element (button/link)
 * supplies the tab chrome (`relative flex items-center gap-1.5 shrink-0 border-b-2 ... px-4 py-1`).
 * At rest the tab matches its siblings, with a small brand-gradient dot; the gradient surfaces in
 * the underline only when the tab is active.
 */
export function IrTabLabel({
	label,
	gradient,
	active,
	trailing
}: {
	label: string
	gradient: string
	active: boolean
	trailing?: ReactNode
}) {
	return (
		<>
			<span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundImage: gradient }} />
			{label}
			{trailing}
			<span
				aria-hidden
				className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full"
				style={{ backgroundImage: gradient, opacity: active ? 1 : 0 }}
			/>
		</>
	)
}

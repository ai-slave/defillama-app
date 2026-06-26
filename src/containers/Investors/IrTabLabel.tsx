import { QuestionHelper } from '~/components/QuestionHelper'

/**
 * Shared inner content for the gradient "Investor Relations" / "Enterprise Dashboard" tab, used by both
 * the protocol tab bar and the chain tab bar so they stay identical. The parent element (button/link)
 * supplies the tab chrome (`relative flex items-center gap-1 shrink-0 border-b-2 ... px-4 py-1`).
 */
export function IrTabLabel({
	label,
	tooltip,
	gradient,
	active
}: {
	label: string
	tooltip?: string
	gradient: string
	active: boolean
}) {
	return (
		<>
			<span
				className="flex items-center gap-1.5"
				style={{
					backgroundImage: gradient,
					WebkitBackgroundClip: 'text',
					backgroundClip: 'text',
					color: 'transparent'
				}}
			>
				<span aria-hidden>✦</span>
				{label}
			</span>
			{tooltip ? <QuestionHelper text={tooltip} className="text-(--text-tertiary)" /> : null}
			<span
				aria-hidden
				className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full"
				style={{ backgroundImage: gradient, opacity: active ? 1 : 0 }}
			/>
		</>
	)
}

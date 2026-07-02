import { Icon } from '~/components/Icon'
import { kindMeta } from '../kindMeta'
import type { RiskKind } from '../types'

// Icon + accessible label for a risk kind; generic fallback for unknown kinds.
export function KindIcon({ kind, className }: { kind: RiskKind; className?: string }) {
	const meta = kindMeta(kind)
	return (
		<Icon
			name={meta.icon}
			aria-label={meta.label}
			className={`${className ?? 'size-4'}${meta.flipY ? ' -scale-y-100' : ''}`}
		/>
	)
}

import type { ReactNode } from 'react'
import { Icon } from '~/components/Icon'

// The section's one external-link grammar: dotted underline + trailing ↗, new tab.
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="inline-flex shrink-0 items-center gap-0.5 text-xs text-(--text-secondary) underline decoration-dotted hover:text-(--text-primary)"
		>
			{children} <Icon name="external-link" className="size-3" />
		</a>
	)
}

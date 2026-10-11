import type { ReactNode } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { TextLink } from '~/ui/TextLink'
import { slug } from '~/utils'
import { geckoTokenIconUrl } from '~/utils/icons'

interface TopThreeRowProps {
	name: string
	symbol: string | null
	geckoId?: string | null
	value: ReactNode
	trailingIcon?: ReactNode
}

export function TopThreeRow({ name, symbol, geckoId, value, trailingIcon = null }: TopThreeRowProps) {
	const hasTrailingIcon = trailingIcon != null

	return (
		<div
			className={`grid ${
				hasTrailingIcon ? 'grid-cols-[minmax(0,1fr)_auto_1.25rem]' : 'grid-cols-[minmax(0,1fr)_auto]'
			} items-center gap-2`}
		>
			<div className="flex min-w-0 items-center gap-2">
				<TokenLogo
					name={name}
					kind="token"
					fallbackSrc={geckoId ? geckoTokenIconUrl(geckoId) : null}
					alt={`Logo of ${name}`}
				/>
				<TextLink href={`/unlocks/${slug(name)}`} size="inherit" truncate>
					{name}
					{symbol ? ` (${symbol})` : null}
				</TextLink>
			</div>
			<span className="justify-self-end text-right">{value}</span>
			{hasTrailingIcon ? (
				<span className="flex size-5 items-center justify-center justify-self-end">{trailingIcon}</span>
			) : null}
		</div>
	)
}

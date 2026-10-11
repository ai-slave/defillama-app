import { FallbackLogo, TokenLogo } from '~/components/TokenLogo'
import { Icon, ICON_GROUPS, ICON_NAMES } from '~/ui/Icon'
import { letterLogoDataUri } from '~/utils/icons'
import { DEMO_LOGO } from '../demoAssets'
import { Example, type Foundation, Row } from '../shared'

function IconsOverview() {
	return (
		<>
			<Example
				wide
				name="Icon"
				prop={`${ICON_NAMES.length} icons`}
				note="16px for an icon-only control, 14px (size-3.5) beside a label. A new icon is a symbol in the sprite (public/icons) plus its name in a group of ICON_GROUPS (src/ui/Icon.tsx); src/ui/__tests__/Icon.test.tsx fails when the two disagree."
			>
				<div className="flex flex-col gap-6">
					{ICON_GROUPS.map(([label, names]) => (
						<section key={label} className="flex flex-col gap-2">
							<h4 className="heading-xs text-primary">{label}</h4>
							<div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
								{names.map((name) => (
									<div key={name} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-secondary">
										<Icon name={name} className="size-4 shrink-0 text-primary" aria-hidden />
										<span className="truncate mono-sm">{name}</span>
									</div>
								))}
							</div>
						</section>
					))}
				</div>
			</Example>
			<Example
				name="TokenLogo"
				prop="src / size"
				note="Static sources: a bundled asset, an inline letter logo, and a missing source that falls through to the placeholder. Named kinds (token, chain, exchange, pegged, equities) load their artwork from the icon CDN."
			>
				<Row>
					<TokenLogo src={DEMO_LOGO} size={14} alt="" />
					<TokenLogo src={DEMO_LOGO} size={24} alt="" />
					<TokenLogo src={DEMO_LOGO} size={32} alt="" />
					<TokenLogo src={letterLogoDataUri('Ethereum')} size={24} alt="" />
					<TokenLogo src={null} size={24} alt="" />
					<FallbackLogo size={24} />
				</Row>
			</Example>
		</>
	)
}

export const icons: Foundation = {
	id: 'icons',
	name: 'Icons',
	source: 'src/ui/Icon.tsx',
	overview: IconsOverview
}

import { Icon, ICON_GROUPS, ICON_NAMES } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { letterLogoDataUri } from '~/utils/icons'
import { DEMO_LOGO, DEMO_LOGO_ALT } from '../demoAssets'
import { Example, type Foundation, StateGrid } from '../shared'

// Not an image, so the browser fails to decode it at once, with no request: the logo falls through to its next source.
const BROKEN_IMAGE = 'data:image/png;base64,AAAA'

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
				name="Logo"
				prop="src / fallbackSrc / size / variant"
				note="Static sources only: a bundled asset, an inline letter logo, and broken images that fall through. TokenLogo draws the same part for a named token, chain, exchange, pegged asset or equity, loading the artwork from the icon CDN."
			>
				<StateGrid
					columns={['14px', '24px', '32px']}
					rows={[
						[
							'fill',
							<>
								<Logo src={DEMO_LOGO} size={14} />
								<Logo src={DEMO_LOGO} size={24} />
								<Logo src={DEMO_LOGO} size={32} />
							</>
						],
						[
							'company',
							<>
								<Logo src={DEMO_LOGO} size={14} variant="company" />
								<Logo src={DEMO_LOGO} size={24} variant="company" />
								<Logo src={DEMO_LOGO} size={32} variant="company" />
							</>
						],
						[
							'letter logo',
							<>
								<Logo src={letterLogoDataUri('Ethereum')} size={14} />
								<Logo src={letterLogoDataUri('Ethereum')} size={24} />
								<Logo src={letterLogoDataUri('Ethereum')} size={32} />
							</>
						]
					]}
				/>
			</Example>
			<Example
				name="Logo fallback"
				prop="fallbackSrc"
				note="A broken src falls through fallbackSrc, then the placeholder; a missing src starts at the next source."
			>
				<StateGrid
					columns={['broken src, fallbackSrc', 'broken src', 'src null']}
					rows={[
						[
							'32px',
							<>
								<Logo src={BROKEN_IMAGE} fallbackSrc={DEMO_LOGO_ALT} size={32} />
								<Logo src={BROKEN_IMAGE} size={32} />
								<Logo src={null} size={32} />
							</>
						]
					]}
				/>
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

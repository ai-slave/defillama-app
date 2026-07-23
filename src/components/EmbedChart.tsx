import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import * as React from 'react'
import { useDarkModeManager, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { buttonStyles } from '~/ui/Button'
import { CopyHelper } from '~/ui/Copy'
import { Icon } from '~/ui/Icon'
import { popoverMobileDismissStyles, popoverMobileWrapperClassName, popoverSurfaceStyles } from '~/ui/Popover'

export function EmbedChart() {
	const router = useRouter()

	const [tvlSettings] = useLocalStorageSettingsManager('tvl')
	const [isDarkTheme] = useDarkModeManager()

	const url = React.useMemo(() => {
		let path = router.asPath === '/' ? '/chain/All' : router.asPath.split('#')[0].split('?')[0]

		if (typeof document !== 'undefined') {
			path += window.location.search
		}

		if (!path.includes('?')) {
			path += '?'
		} else {
			path += '&'
		}

		const extras = []
		for (const option in tvlSettings) {
			if (!Object.prototype.hasOwnProperty.call(tvlSettings, option)) continue
			if (tvlSettings[option]) {
				extras.push(`include_${option}_in_tvl=true`)
			}
		}

		extras.push(isDarkTheme ? 'theme=dark' : 'theme=light')

		return `<iframe width="640px" height="360px" src="https://defillama.com/chart${path}${extras.join(
			'&'
		)}" title="DefiLlama" frameborder="0"></iframe>`
	}, [router.asPath, tvlSettings, isDarkTheme])

	return (
		<Ariakit.PopoverProvider>
			<Ariakit.PopoverDisclosure className={buttonStyles({ square: true, size: 'md' })}>
				<Icon name="code" height={16} width={16} />
				<span className="sr-only">Embed Chart</span>
			</Ariakit.PopoverDisclosure>

			<Ariakit.Popover
				unmountOnHide
				hideOnInteractOutside
				gutter={6}
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={`${popoverSurfaceStyles} mr-1 w-[min(calc(100vw-16px),320px)] lg:mr-4`}
				portal
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>
				<span className="flex flex-col items-end gap-2 p-3">
					<code className="block rounded-lg bg-page p-2 text-xs break-all">{url}</code>
					<CopyHelper toCopy={url} />
				</span>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}

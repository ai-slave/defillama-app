import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import * as React from 'react'
import { useDarkModeManager, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { useCopy } from '~/ui/Copy'
import { Icon } from '~/ui/Icon'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'

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
			if (!Object.hasOwn(tvlSettings, option)) continue
			if (tvlSettings[option]) {
				extras.push(`include_${option}_in_tvl=true`)
			}
		}

		extras.push(isDarkTheme ? 'theme=dark' : 'theme=light')

		return `<iframe width="640px" height="360px" src="https://defillama.com/chart${path}${extras.join(
			'&'
		)}" title="DefiLlama" frameborder="0"></iframe>`
	}, [router.asPath, tvlSettings, isDarkTheme])

	const popover = Ariakit.usePopoverStore()
	const { copied, copy } = useCopy()

	return (
		<Ariakit.PopoverProvider store={popover}>
			{/* The disclosure names its store: inside the tooltip, context would bind it to the tooltip store. */}
			<Tooltip
				content="Embed chart"
				render={<Ariakit.PopoverDisclosure store={popover} render={<Button size="md" square />} />}
			>
				<Icon name="code" className="size-4" />
				<span className="sr-only">Embed chart</span>
			</Tooltip>

			<PopoverSurface variant="panel" heading="Embed chart" width="lg">
				<span className="flex flex-col items-end gap-2 p-3">
					<code className="block rounded-lg bg-page p-2 body-sm break-all">{url}</code>
					<Button size="md" onClick={() => void copy(url)} doneLabel="Copied" done={copied}>
						<Icon name="copy" className="size-3.5" />
						Copy code
					</Button>
				</span>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

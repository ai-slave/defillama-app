import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { TabLink, TabNav } from '~/ui/Tabs'

// The current APY view (window + components) is
// carried across tabs so the selection persists on navigation.
const TABS = [
	{ id: 'earn', href: '/yields', label: 'Earn' },
	{ id: 'borrow', href: '/yields/borrow', label: 'Borrow' },
	{ id: 'looping', href: '/yields/loop', label: 'Loop' },
	{ id: 'rates', href: '/yields/rates', label: 'Reference Rates' }
] as const

type YieldsTabId = (typeof TABS)[number]['id']

function readSingle(value: string | Array<string> | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

export function YieldsTabs({
	active,
	rightSlot,
	heading,
	lead
}: {
	active: YieldsTabId
	rightSlot?: ReactNode
	heading?: string
	lead?: ReactNode
}) {
	const router = useRouter()
	const apyWindow = readSingle(router.query.apyWindow)
	const apyComponents = readSingle(router.query.apyComponents)

	const apyParams = new URLSearchParams()
	if (apyWindow) apyParams.set('apyWindow', apyWindow)
	if (apyComponents) apyParams.set('apyComponents', apyComponents)
	const apyQuery = apyParams.toString()

	return (
		<div className="flex flex-col gap-2 px-2">
			{heading ? (
				<div className="flex flex-col gap-1">
					<h1 className="heading-sm">{heading}</h1>
					{lead}
				</div>
			) : (
				<h1 className="sr-only">Yields</h1>
			)}
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end">
				<TabNav label="Yields views">
					{TABS.map((tab) => {
						const href = apyQuery ? `${tab.href}?${apyQuery}` : tab.href
						return (
							<TabLink as={BasicLink} key={tab.id} href={href} aria-current={tab.id === active ? 'page' : undefined}>
								{tab.label}
							</TabLink>
						)
					})}
				</TabNav>
				{rightSlot ? (
					<div className="hidden self-stretch border-b border-subtle pb-2 pl-4 sm:flex sm:items-end">{rightSlot}</div>
				) : null}
			</div>
		</div>
	)
}

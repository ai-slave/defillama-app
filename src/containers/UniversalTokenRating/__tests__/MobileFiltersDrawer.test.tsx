// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { UtrSort } from '../Leaderboard'
import { MobileFiltersDrawer } from '../MobileFiltersDrawer'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function Drawer() {
	const [sectors, setSectors] = useState(['defi'])
	const [sort, setSort] = useState<UtrSort>({ key: 'rank', desc: false })
	return (
		<MobileFiltersDrawer
			open
			onClose={() => {}}
			fdvOptions={[]}
			fdvRanges={[]}
			setFdvRanges={() => {}}
			sectorOptions={[{ key: 'defi', name: 'DeFi' }]}
			sectors={sectors}
			setSectors={setSectors}
			statusOptions={[]}
			listingStatuses={[]}
			setListingStatuses={() => {}}
			sort={sort}
			setSort={setSort}
			canReset={sectors.length > 0}
			onReset={() => setSectors([])}
		/>
	)
}

test('Reset keeps focus once pressing it disables it', async () => {
	await act(async () => root.render(<Drawer />))
	const reset = [...document.querySelectorAll('button')].find((el) => el.textContent === 'Reset')!
	await act(async () => {
		reset.focus()
		reset.click()
	})
	expect(reset.getAttribute('aria-disabled')).toBe('true')
	expect(reset.disabled).toBe(false)
	expect(document.activeElement).toBe(reset)
})

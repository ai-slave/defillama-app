import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { BridgesTable } from '../BridgesTable'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/bridges', query: {} }) }))

const bridge = (displayName: string, lastDailyVolume: number) => ({ displayName, chains: [], lastDailyVolume })
const DATA = [bridge('Stargate', 3), bridge('Wormhole', 2), bridge('Starport', 1)]

const listedBridges = (html: string) => DATA.map((row) => row.displayName).filter((name) => html.includes(`>${name}<`))

test('the first render of a searched table lists only the bridges whose name matches', () => {
	expect(listedBridges(renderToStaticMarkup(<BridgesTable data={DATA} searchValue="star" />))).toEqual([
		'Stargate',
		'Starport'
	])
	expect(listedBridges(renderToStaticMarkup(<BridgesTable data={DATA} />))).toEqual([
		'Stargate',
		'Wormhole',
		'Starport'
	])
})

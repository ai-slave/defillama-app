import { RecentProtocols } from '~/components/RecentProtocols'
import { maxAgeForNext } from '~/api'
import { getSimpleProtocolsPageData } from '~/api/categories/protocols'
import { basicPropertiesToKeep } from '~/api/categories/protocols/utils'
import { FORK_API, RAISES_API } from '~/constants'

const exclude = [
	'DeerFi',
	'FireDAO',
	'Robo-Advisor for Yield',
	'SenpaiSwap',
	'Zunami Protocol',
	'NowSwap',
	'NeoBurger',
	'MochiFi',
	'StakeHound',
	'Mento',
	'Lightning Network',
	'Secret Bridge',
	'Karura Swap',
	'Karura Liquid-Staking',
	'Karura Dollar (kUSD)',
	'Tezos Liquidity Baking',
	'Notional',
	'Tinlake',
	'Kuu Finance',
	'COTI Treasury',
	'Terra Bridge',
	'Parallel Liquid Crowdloan',
	'Parallel Liquid Staking',
	'Parallel Lending',
	'Parallel AMM',
	'Parallel DAOfi',
	'Algofi Lend',
	'Algofi Swap',
	'BNBMiner Finance',
	'Gnosis Protocol v1',
	'Multi-Chain Miner',
	'Swap Cat',
	'FLRLoans',
	'Pando Leaf',
	'Pando Rings',
	'4Swap',
	'REX Staking',
	'Sapphire Mine',
	'MM Stableswap',
	'MM Stableswap Polygon',
	'Sushi Furo',
	'Sushi Trident',
	'Poly Network',
	'Frax Swap',
	'Kava Mint',
	'Quarry',
	'Canto Dex',
	'Katana DEX',
	'Canto Lending',
	'OKCSwap',
	'Fraxlend',
	'Tesseract',
	'Spartacus Exchange'
]

export async function getStaticProps() {
	const [protocolsRaw, { forks }, { raises }] = await Promise.all([
		getSimpleProtocolsPageData([...basicPropertiesToKeep, 'extraTvl', 'listedAt', 'chainTvls', 'defillamaId']),
		fetch(FORK_API).then((r) => r.json()),
		fetch(RAISES_API).then((r) => r.json())
	])

	const protocols = protocolsRaw.protocols
		.filter((token) => (token.symbol === null || token.symbol === '-') && !exclude.includes(token.name))
		.map((p) => ({
			listedAt: 1624728920,
			totalRaised: raises
				.filter((r) => (r.defillamaId && p.defillamaId ? r.defillamaId.toString() === p.defillamaId.toString() : false))
				.reduce((acc, curr) => {
					const amount = curr.amount || 0

					if (!Number.isNaN(amount)) {
						acc += amount * 1e6
					}
					return acc
				}, 0),
			...p
		}))
		.sort((a, b) => a.listedAt - b.listedAt)

	const forkedList: { [name: string]: boolean } = {}

	Object.values(forks).map((list: string[]) => {
		list.map((f) => {
			forkedList[f] = true
		})
	})

	return {
		props: {
			protocols,
			chainList: protocolsRaw.chains,
			forkedList
		},
		revalidate: maxAgeForNext([22])
	}
}

export default function Protocols(props) {
	return (
		<RecentProtocols
			title="Airdroppable protocols - Defi Llama"
			name="Airdrops"
			header="Tokenless protocols that may airdrop 🧑‍🌾"
			{...props}
		/>
	)
}

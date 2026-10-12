import { BasicLink } from '~/components/Link'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { EntityTitleStrip } from '~/ui/EntityTitleStrip'
import { Icon } from '~/ui/Icon'

function Definition({ header, id, children }: { header: string; id: string; children: React.ReactNode }) {
	return (
		<Card as="section" aria-labelledby={`${id}-title`} id={id} padding="sm" className="flex flex-col gap-4">
			<h2 className="group relative flex items-center gap-1 heading-xs" id={`${id}-title`}>
				{header}
				<a
					aria-hidden="true"
					tabIndex={-1}
					href={`#${id}`}
					className="absolute top-0 right-0 z-10 flex size-full items-center"
				/>
				<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
			</h2>
			<hr className="border-subtle" />
			{children}
		</Card>
	)
}

export default function DataDefinitions() {
	return (
		<Layout
			title="DeFi Data Definitions & Metrics Glossary - DefiLlama"
			description="Glossary of DeFi metrics including TVL, Fees, Revenue, FDV, DEX Volume, Holders Revenue, App Fees, and REV."
			canonicalUrl="/data-definitions"
		>
			<EntityTitleStrip title="Data definitions" />

			<Definition header="TVL" id="tvl">
				<p>For protocols: Value of all coins held in smart contracts of the protocol</p>
				<p>For chains: Sum of TVL of the protocols in that chain</p>
				<p>
					In traditional finance terms, TVL is similar to Assets Under Management (AUM). It represents the total value
					of assets that users deposit into a protocol. This is similar to how a fund or bank might report the total
					value of client deposits or managed assets.
				</p>
			</Definition>

			<Definition header="Fees" id="fees">
				<p>Total fees paid by users when using the protocol.</p>
				<p>
					<Button as={BasicLink} href="/fees" variant="inlineLink">
						Fees
					</Button>{' '}
					are equivalent to what would traditionally be considered Revenue in most offchain businesses. They reflect the
					total amount paid by users for using the service, regardless of where those fees end up. This is the top-line
					number that shows how much the protocol is facilitating in economic activity.
				</p>
			</Definition>

			<Definition header="Revenue" id="revenue">
				<p>
					Subset of fees that the protocol collects for itself, usually going to the protocol treasury, the team or
					distributed among token holders. This doesn't include any fees distributed to Liquidity Providers.
				</p>
				<p>
					<Button as={BasicLink} href="/revenue" variant="inlineLink">
						Revenue
					</Button>{' '}
					, in the way defined here, is closer to Gross Income in traditional accounting. It's the portion of fees that
					the protocol keeps for itself after paying out costs to actors like liquidity providers. This is what goes to
					the team, the treasury, or tokenholders.
				</p>
			</Definition>

			<Definition header="Holders Revenue" id="holders-revenue">
				<p>
					Subset of revenue that is distributed to tokenholders by means of buyback and burn, burning fees or direct
					distribution to stakers. Holders Revenue can also be called Tokenholder Revenue.
				</p>
				<p>
					<Button as={BasicLink} href="/holders-revenue" variant="inlineLink">
						Holders Revenue
					</Button>{' '}
					is similar to Dividends and Buybacks in traditional finance terms. It's the part of protocol revenue that is
					returned to tokenholders through staking rewards, fee burns, or direct payouts. Like dividends, this shows how
					much value the protocol is distributing back to its investors.
				</p>
			</Definition>

			<Definition header="USD Inflows" id="usd-inflows">
				<p>
					A protocol's TVL might go down even if more assets are deposited in the scenario where the prices of assets
					comprising TVL go down, so just looking at the TVL chart is not the best way to see if a protocol is receiving
					deposits or money is exiting, as that info gets mixed with price movements.
				</p>
				<p>USD Inflows is a metric that fixes that by representing the net asset inflows into a protocol's TVL.</p>
				<p>
					It's calculated by taking the balance difference for each asset between two consecutive days, multiplying that
					difference by asset price and then summing that for all assets.
				</p>
				<p>
					If a protocol has all of its TVL in ETH and one day ETH price drops 20% while there are no new deposits or
					withdrawals, TVL will drop by 20% while USD inflows will be $0.
				</p>
			</Definition>

			<Definition header="Total Staked (Staked)" id="total-staked">
				<p>
					<Button as={BasicLink} href="/total-staked" variant="inlineLink">
						Staked
					</Button>{' '}
					represents the value of governance coins that are staked in the protocol's staking system.
				</p>
			</Definition>

			<Definition header="Expenses" id="expenses">
				<p>
					<Button as={BasicLink} href="/expenses" variant="inlineLink">
						Expenses
					</Button>{' '}
					here represent operational costs for salaries, audits, etc. throughout the year. We collect this data mainly
					from annual protocol reports on their forums, so it's always referencing old data and will not be up-to-date
					in realtime like other DefiLlama data.
				</p>
			</Definition>

			<Definition header="Total Raised" id="total-raised">
				<p>
					<Button as={BasicLink} href="/raises" variant="inlineLink">
						Total Raised
					</Button>{' '}
					includes the sum of all money raised by the protocol, including VC funding rounds, public sales and ICOs.
				</p>
			</Definition>

			<Definition header="Active Addresses" id="active-addresses">
				<p>
					Number of unique addresses that have interacted with the protocol directly. Interactions are counted as
					transactions sent directly against the protocol, thus transactions that go through an aggregator or some other
					middleman contract are not counted here.
				</p>
				<p>
					The reasoning for this is that this is meant to help measure stickiness/loyalty of users, and users that are
					interacting with the protocol through another product aren't likely to be sticky.
				</p>
			</Definition>

			<Definition header="Treasury" id="treasury">
				<p>
					<Button as={BasicLink} href="/treasuries" variant="inlineLink">
						Treasury
					</Button>{' '}
					represents the value of coins held in ownership by the protocol. By default this excludes coins created by the
					protocol itself.
				</p>
				<p>
					In traditional finance, terms, the Treasury is the protocol's Total Assets. This is what the protocol controls
					directly, and is often used to fund operations, growth initiatives, or serve as a reserve.
				</p>
			</Definition>

			<Definition header="Token Volume" id="token-volume">
				<p>Sum of value in all swaps to or from that token across all Centralized and Decentralized exchanges.</p>
				<p>Data for this metric is imported directly from CoinGecko.</p>
			</Definition>

			<Definition header="Fully Diluted Valuation (FDV)" id="fully-diluted-valuation">
				<p>
					<Button as={BasicLink} href="/fdv" variant="inlineLink">
						Fully Diluted Valuation
					</Button>{' '}
					is calculated by taking the expected maximum supply of the token and multiplying it by the price. It's mainly
					used to calculate the hypothetical market cap of the token if all the tokens were unlocked and circulating.
				</p>
				<p>Data for this metric is imported directly from CoinGecko.</p>
			</Definition>

			<Definition header="Outstanding Fully Diluted Valuation (oFDV)" id="outstanding-fdv">
				<p>
					<Button as={BasicLink} href="/outstanding-fdv" variant="inlineLink">
						Outstanding Fully Diluted Valuation
					</Button>{' '}
					is calculated by multiplying the outstanding supply by the price. Outstanding supply is the total supply minus
					the supply that is not yet allocated to anything (e.g. coins in treasury or reserve). Outstanding FDV is
					intended to be a more accurate measurement of the market cap of coins that are already allocated.
				</p>
			</Definition>

			<Definition header="DEX Volume" id="dex-volume">
				<p>
					<Button as={BasicLink} href="/dexs" variant="inlineLink">
						Volume
					</Button>{' '}
					traded on the DEX. This metric is only applicable to protocols that are exchanges, and it's just the sum of
					value of all trades that went through the DEX on a given day.
				</p>
			</Definition>

			<Definition header="Events" id="events">
				<p>
					This is a manually curated list of events that impacted the protocol. The reason why we display this is just
					to help the user understand the reason behind changes in the protocol metrics.
				</p>
				<p>
					Example: When there's a hack that causes a sudden drop in TVL we add an event at that date explaining that a
					hack was the reason why TVL dropped.
				</p>
			</Definition>

			<Definition header="Median APY" id="median-apy">
				<p>
					Median APY across DeFi pools tracked by DefiLlama on a given protocol. This is calculated by finding all pools
					for that protocol, then sorting them by APY and finding the median weighted by TVL.
				</p>
			</Definition>

			<div className="contents">
				<span id="total-borrowed" aria-hidden="true" className="block h-0 overflow-hidden" />
				<Definition header="Active Loans" id="active-loans">
					<p>
						<Button as={BasicLink} href="/active-loans" variant="inlineLink">
							Active loans
						</Button>{' '}
						from DeFi lending protocols. Active loans can also be thought of as total loans issued by a lending
						protocol. Active loans are excluded from TVL by default to account for looping strategies which can
						artificially inflate TVL.
					</p>
				</Definition>
			</div>

			<Definition header="Stablecoins Market Cap" id="stablecoins-market-cap">
				<p>The total market cap of all stablecoins on a chain.</p>
				<p>
					<Button as={BasicLink} href="/stablecoins/chains" variant="inlineLink">
						Stablecoin market cap
					</Button>{' '}
					represents the total value of stablecoins on a chain, a proxy measure for liquidity and trust, as well as a
					measure of stablecoin adoption. This metric is only available for chains.
				</p>
			</Definition>

			<Definition header="App Fees" id="app-fees">
				<p>
					<Button as={BasicLink} href="/app-fees/chains" variant="inlineLink">
						App Fees
					</Button>{' '}
					represents the sum of Fees on all protocols on a chain (excluding stablecoins, liquid staking apps and gas
					fees). App Fees is a measure of economic activity on a chain and can be used to evaluate how active an
					ecosystem is.
				</p>
			</Definition>

			<Definition header="App Revenue" id="app-revenue">
				<p>
					<Button as={BasicLink} href="/app-revenue/chains" variant="inlineLink">
						App Revenue
					</Button>{' '}
					represents the sum of Revenue on all protocols on a chain (excluding stablecoins, liquid staking apps and gas
					fees). App Revenue is a measure of economic activity on a chain and can be used to evaluate how active an
					ecosystem is.
				</p>
			</Definition>

			<Definition header="REV" id="rev">
				<p>
					<Button as={BasicLink} href="/rev/chains" variant="inlineLink">
						REV
					</Button>{' '}
					(Real Economic Value) is the sum of chain fees and MEV tips.
				</p>
			</Definition>

			<Definition header="Token Incentives" id="token-incentives">
				<p>
					Tokens allocated to users through liquidity mining or incentive schemes, typically as part of governance or
					reward mechanisms.
				</p>
			</Definition>
		</Layout>
	)
}

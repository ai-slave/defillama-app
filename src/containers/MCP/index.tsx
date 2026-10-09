import * as Ariakit from '@ariakit/react'
import { useState, type ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { SubscribeAPICard } from '~/containers/Subscription/shared/SubscribeCards/SubscribeAPICard'
import { ClientOnly } from '~/layout/ClientOnly'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Dialog, DialogBody, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TabPanel, Tabs } from '~/ui/Tabs'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const toolCategories = [
	{
		label: 'Protocol & Chain',
		tools: [
			{ name: 'resolve_entity', desc: 'Fuzzy-match protocol, chain, or token names to exact slugs' },
			{ name: 'get_protocol_metrics', desc: 'Protocol TVL, fees, revenue, mcap, ratios, trends' },
			{ name: 'get_protocol_info', desc: 'Protocol metadata, URLs, audit info, tags' },
			{ name: 'get_chain_metrics', desc: 'Chain TVL, gas fees, revenue, DEX volume' },
			{ name: 'get_chain_info', desc: 'Chain metadata, type, L2 parent' },
			{ name: 'get_category_metrics', desc: 'Category rankings by TVL, fees, protocol count' },
			{ name: 'list_categories', desc: 'List all valid protocol/token/chain categories' }
		]
	},
	{
		label: 'Tokens & Yield',
		tools: [
			{ name: 'get_token_prices', desc: 'Token price, mcap, volume, ATH, growth rankings' },
			{ name: 'get_token_tvl', desc: 'Token deposits across DeFi protocols' },
			{ name: 'get_token_unlocks', desc: 'Vesting schedules and upcoming unlocks' },
			{ name: 'get_yield_pools', desc: 'Pool APY, TVL, lending/borrowing rates' }
		]
	},
	{
		label: 'Markets & Trading',
		tools: [
			{ name: 'get_market_totals', desc: 'Global DeFi TVL, DEX volume, derivatives volume' },
			{ name: 'get_cex_volumes', desc: 'Centralized exchange trading volume' },
			{ name: 'get_open_interest', desc: 'Derivatives open interest' }
		]
	},
	{
		label: 'Flows & Events',
		tools: [
			{ name: 'get_stablecoin_supply', desc: 'Stablecoin issuance by chain and peg type' },
			{ name: 'get_bridge_flows', desc: 'Bridge volume and net flows by chain' },
			{ name: 'get_etf_flows', desc: 'Bitcoin and Ethereum ETF inflows/outflows' },
			{ name: 'get_events', desc: 'Hacks, fundraises, protocol events' }
		]
	},
	{
		label: 'Deep Dive',
		tools: [
			{ name: 'get_dat_holdings', desc: 'Institutional crypto holdings and mNAV' },
			{ name: 'get_oracle_metrics', desc: 'Oracle TVS and protocol coverage' },
			{ name: 'get_treasury', desc: 'Protocol treasury holdings' },
			{ name: 'get_user_activity', desc: 'Daily active users and transactions' },
			{ name: 'get_income_statement', desc: 'Protocol revenue breakdown' }
		]
	}
]

const clients = [
	{ name: 'Claude', icon: '/assets/mcp-clients/claude.svg' },
	{ name: 'OpenClaw', icon: '/assets/mcp-clients/openclaw.svg' },
	{ name: 'Claude Code', icon: '/assets/mcp-clients/claudecode.svg' },
	{ name: 'Cursor', icon: '/assets/mcp-clients/cursor.svg' },
	{ name: 'Windsurf', icon: '/assets/mcp-clients/windsurf.svg' },
	{ name: 'Codex', icon: '/assets/mcp-clients/codex.svg' },
	{ name: 'Gemini CLI', icon: '/assets/mcp-clients/gemini.svg' },
	{ name: 'OpenCode', icon: '/assets/mcp-clients/opencode.svg' },
	{ name: 'Cline', icon: '/assets/mcp-clients/cline.svg' }
]

function ClientMarquee() {
	const items = [...clients, ...clients]
	return (
		<div
			className="relative mt-8 marquee-container"
			style={{
				maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
			}}
		>
			<div className="marquee flex items-center">
				{items.map((c, i) => (
					<div
						// oxlint-disable-next-line react/no-array-index-key -- The marquee intentionally repeats each client in two fixed copies.
						key={`${c.name}-${i}`}
						className="flex shrink-0 items-center gap-2.5 opacity-50 transition-opacity hover:opacity-100"
					>
						<img src={c.icon} alt={c.name} width={20} height={20} className="dark:invert" />
						<span className="label-md whitespace-nowrap text-tertiary">{c.name}</span>
					</div>
				))}
			</div>
		</div>
	)
}

const skills = [
	{ name: 'defi-data', desc: 'Core reference: maps any DeFi question to the right tool' },
	{ name: 'protocol-deep-dive', desc: 'Complete protocol report: TVL, fees, yields, income, users, token' },
	{ name: 'token-research', desc: 'Token analysis: price, unlocks, DeFi deposits, yield opportunities' },
	{ name: 'chain-ecosystem', desc: 'Blockchain overview: TVL, top protocols, bridges, stablecoins' },
	{ name: 'defi-market-overview', desc: 'Full market snapshot: TVL, categories, chains, events' },
	{ name: 'yield-strategies', desc: 'Yield hunting: pool filtering, APY conventions, capacity' },
	{ name: 'risk-assessment', desc: 'Risk evaluation: hacks, oracles, treasury, fundamentals' },
	{ name: 'flows-and-events', desc: 'Capital flows: bridges, ETFs, stablecoins, hacks, raises' },
	{ name: 'market-analysis', desc: 'Screening and comparison: valuation ratios, growth' },
	{ name: 'institutional-crypto', desc: 'Corporate holdings, ETF flows, mNAV ratios' }
]

function TerminalMock() {
	return (
		<Card padding="none" className="overflow-hidden">
			<div className="mono-md">
				<div className="flex items-center gap-2 border-b border-subtle px-4 py-2.5">
					<span className="size-3 rounded-full bg-[#ff5f57]" />
					<span className="size-3 rounded-full bg-[#febc2e]" />
					<span className="size-3 rounded-full bg-[#28c840]" />
					<span className="ml-2 body-xs text-tertiary">claude</span>
				</div>
				<div className="space-y-3 p-4">
					<div>
						<span className="text-tertiary">→ </span>
						<span className="text-secondary">What are the top 5 protocols by TVL?</span>
					</div>
					<div className="rounded-md border border-brand-muted bg-brand-faint px-3 py-2">
						<span className="text-link">⚡ get_protocol_metrics</span>
						<span className="text-tertiary"> sort_by: &quot;tvl_base desc&quot;, limit: 5</span>
					</div>
					<div className="text-success">
						<div>1. Aave · $25.7B</div>
						<div>2. Lido · $20.0B</div>
						<div>3. SSV Network · $15.5B</div>
						<div>4. EigenCloud · $9.2B</div>
						<div>5. Binance Staked ETH · $8.0B</div>
					</div>
				</div>
			</div>
		</Card>
	)
}

/** Copies `text`, says "Copied!" for two seconds, and names what it copies for screen readers. */
function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
	const [copied, setCopied] = useState(false)
	return (
		<Button
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(text)
					trackUmamiEvent('mcp-copy', { label })
					setCopied(true)
					setTimeout(() => setCopied(false), 2000)
				} catch {
					// Clipboard access can be denied; the copy control just does nothing.
				}
			}}
			aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
			variant="ghost"
			size="sm"
			doneLabel="Copied"
			done={copied}
			className={className}
		>
			Copy
		</Button>
	)
}

function CopyBox({ text, label }: { text: string; label: string }) {
	return (
		<div className="mx-auto max-w-3xl">
			<Card padding="none" className="overflow-hidden">
				<div className="flex items-center justify-between border-b border-subtle px-4 py-2.5">
					<span className="label-sm text-link">{label}</span>
					<CopyButton text={text} label={label} />
				</div>
				<div className="p-4">
					<p className="mono-md text-primary">{text}</p>
				</div>
			</Card>
		</div>
	)
}

function CodeBlock({ children, label }: { children: string; label: string }) {
	return (
		<Card padding="none" className="overflow-hidden">
			<div className="flex items-center justify-between border-b border-subtle px-4 py-2">
				<span className="label-sm text-tertiary">{label}</span>
				<CopyButton text={children} label={label} />
			</div>
			<pre className="overflow-x-auto p-4 mono-md text-secondary">{children}</pre>
		</Card>
	)
}

const clientConfigs = [
	{
		name: 'Claude Code',
		code: `claude mcp add defillama --transport http https://mcp.defillama.com/mcp`
	},
	{
		name: 'OpenClaw',
		code: `{
  "mcp": {
    "servers": {
      "defillama": {
        "command": "npx",
        "args": ["-y", "mcp-remote", "https://mcp.defillama.com/mcp"]
      }
    }
  }
}`
	},
	{
		name: 'Codex',
		code: `codex mcp add defillama --url https://mcp.defillama.com/mcp`
	},
	{
		name: 'Cursor / Windsurf',
		code: `{
  "mcpServers": {
    "defillama": {
      "url": "https://mcp.defillama.com/mcp"
    }
  }
}`
	},
	{
		name: 'Gemini CLI',
		code: `{
  "mcpServers": {
    "defillama": {
      "httpUrl": "https://mcp.defillama.com/mcp"
    }
  }
}`
	},
	{
		name: 'OpenCode',
		code: `{
  "mcp": {
    "defillama": {
      "type": "remote",
      "url": "https://mcp.defillama.com/mcp"
    }
  }
}`
	}
]

const clientNames = clientConfigs.map((c) => c.name)

function ManualSetup() {
	const [active, setActive] = useState(clientNames[0])
	return (
		<div className="mt-10">
			<h3 className="mb-4 text-center label-sm text-tertiary">Or add manually to your client config</h3>
			<Card padding="none" className="mx-auto max-w-2xl overflow-hidden">
				<Tabs value={active} onValueChange={setActive} values={clientNames}>
					<div className="border-b border-subtle p-2">
						<SegmentedControl
							semantics="tabs"
							label="MCP client"
							variant="default"
							size="md"
							options={clientNames.map((name) => ({ value: name, label: name }))}
						/>
					</div>
					{clientConfigs.map((c) => (
						<TabPanel key={c.name} value={c.name} unmountOnHide className="flex items-start gap-2 pr-3">
							<pre className="min-w-0 flex-1 overflow-x-auto p-4 mono-md text-secondary">{c.code}</pre>
							<CopyButton text={c.code} label={c.name} className="mt-2 shrink-0" />
						</TabPanel>
					))}
				</Tabs>
			</Card>
		</div>
	)
}

function FeatureCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
	return (
		<Card padding="md">
			<div className="mb-3 flex size-9 items-center justify-center rounded-md bg-brand-faint text-lg">{icon}</div>
			<h3 className="mb-1.5 font-semibold text-primary">{title}</h3>
			<p className="body-md text-secondary">{children}</p>
		</Card>
	)
}

function StepCard({ step, title, children }: { step: number; title: string; children: ReactNode }) {
	return (
		<Card padding="md">
			<div className="mb-3 flex size-8 items-center justify-center rounded-md bg-brand-faint title-md text-link">
				{step}
			</div>
			<h3 className="mb-1.5 font-semibold text-primary">{title}</h3>
			<p className="body-sm text-secondary">{children}</p>
		</Card>
	)
}

function SectionHeader({ overline, title, description }: { overline: string; title: string; description?: string }) {
	return (
		<div className="mb-8">
			<p className="mb-2 label-sm tracking-widest text-link uppercase">{overline}</p>
			<h2 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
			{description && <p className="max-w-2xl body-md text-secondary">{description}</p>}
		</div>
	)
}

function ToolCategoryGroup({
	label,
	tools,
	defaultOpen
}: {
	label: string
	tools: Array<{ name: string; desc: string }>
	defaultOpen?: boolean
}) {
	const [open, setOpen] = useState(defaultOpen ?? true)
	const panelId = `tools-${label
		.toLowerCase()
		.replace(/\s+&\s+/g, '-')
		.replace(/\s+/g, '-')}`
	return (
		<div>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-controls={panelId}
				className="mb-2 flex w-full items-center gap-2 text-left label-sm tracking-widest text-secondary uppercase transition-colors hover:text-primary"
			>
				<svg
					viewBox="0 0 24 24"
					className={`size-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<polyline points="9 18 15 12 9 6" />
				</svg>
				{label}
				<span className="font-normal tracking-normal text-tertiary normal-case">({tools.length})</span>
			</button>
			{open && (
				<div id={panelId} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{tools.map((t) => (
						<Card key={t.name} padding="sm">
							<code className="mono-md text-link">{t.name}</code>
							<p className="mt-0.5 body-sm text-secondary">{t.desc}</p>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}

export default function MCPContainer() {
	const dialog = Ariakit.useDialogStore()
	const { isAuthenticated, hasActiveSubscription } = useAuthContext()

	const handleGetStarted = () => {
		trackUmamiEvent('mcp-get-started', { authenticated: isAuthenticated, subscribed: hasActiveSubscription })
		if (!isAuthenticated || !hasActiveSubscription) {
			dialog.show()
			return
		}
		document.getElementById('setup')?.scrollIntoView({ behavior: 'smooth' })
	}

	return (
		<>
			{/* Hero */}
			<section className="mx-auto max-w-[1100px] px-4 pt-14 pb-10 sm:px-6 md:px-8">
				<div className="grid items-center gap-10 md:grid-cols-[1fr_1fr] md:gap-12">
					<div>
						<p className="mb-3 label-sm tracking-widest text-link uppercase">DefiLlama MCP Server</p>
						<h1 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.75rem]">
							DeFi Data for <span className="text-link">AI Agents</span>
						</h1>
						<p className="mb-2 max-w-lg body-md text-secondary">
							Connect your AI agent to DefiLlama data. Ask questions about TVL, yields, token prices, protocol metrics,
							stablecoins, bridges, ETFs, and more. Your agent gets the answers directly.
						</p>
						<p className="mb-6 body-sm text-tertiary">
							Requires an API plan. Uses the same credits as your DefiLlama API key.
						</p>
						<div className="flex flex-wrap gap-3">
							<Button onClick={handleGetStarted} variant="primary" size="md">
								Get Started
							</Button>
							<Button
								as="a"
								href="https://github.com/DefiLlama/defillama-skills"
								target="_blank"
								rel="noreferrer"
								onClick={() => trackUmamiEvent('mcp-github-click')}
								variant="secondary"
								size="md"
							>
								<svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
									<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
								</svg>
								Skills Repo
							</Button>
						</div>
					</div>
					<TerminalMock />
				</div>
				<ClientMarquee />
			</section>

			{/* Features */}
			<section className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6 md:px-8">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<FeatureCard icon={<span>🔌</span>} title="23 DeFi Tools">
						TVL, fees, revenue, token prices, yields, stablecoins, bridges, ETFs, hacks, treasuries, and more, all
						accessible through natural language.
					</FeatureCard>
					<FeatureCard icon={<span>🔑</span>} title="Easy Setup">
						Paste the quick start prompt, your agent handles the rest. Works with Claude Code, OpenClaw, Cursor, Codex,
						Gemini CLI, and more.
					</FeatureCard>
					<FeatureCard icon={<span>💳</span>} title="Uses Your API Credits">
						Same credit pool as your DefiLlama API key. One credit per query. No separate billing. If you have an API
						plan, you're already set.
					</FeatureCard>
				</div>
			</section>

			{/* Quick Start */}
			<section id="setup" className="mx-auto max-w-[1100px] scroll-mt-20 px-4 py-12 sm:px-6 md:px-8">
				<SectionHeader
					overline="Quick Start"
					title="Paste This Into Your Agent"
					description="Copy this prompt and send it to your AI agent. It handles the rest."
				/>

				<CopyBox
					label="Paste into Claude, OpenClaw, or any AI agent"
					text="Read https://raw.githubusercontent.com/DefiLlama/defillama-skills/refs/heads/master/defillama-setup/SKILL.md and follow the instructions to connect to DefiLlama MCP"
				/>

				<ManualSetup />

				<div className="mt-10 grid gap-4 md:grid-cols-3">
					<StepCard step={1} title="Paste the URL">
						Add the URL above to your MCP client. That's the only config needed.
					</StepCard>
					<StepCard step={2} title="Authenticate">
						Your agent will prompt you to log in via browser on first use. Sign in with your DefiLlama account. API plan
						required.
					</StepCard>
					<StepCard step={3} title="Start querying">
						Ask your agent anything about DeFi. It calls the right tool automatically.
					</StepCard>
				</div>

				<Card padding="sm" className="mt-4">
					<p className="body-sm text-secondary">
						Note: each DefiLlama account can only be connected to one MCP client at a time. Connecting a new client will
						disconnect the previous one.
					</p>
				</Card>

				{/* LlamaAI Upsell */}
				<Card
					as="a"
					href="/ai"
					tone="warning"
					padding="md"
					onClick={() => trackUmamiEvent('mcp-llamaai-upsell-click')}
					className="hover-wash-card mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
				>
					<div className="flex items-start gap-4">
						<img
							src="/assets/llamaai/llamaai_animation.webp"
							alt="LlamaAI"
							width={56}
							height={56}
							className="shrink-0"
						/>
						<div>
							<h3 className="font-semibold text-primary">
								Need more than raw data? <span className="text-warning">Try LlamaAI</span>
							</h3>
							<p className="mt-1 max-w-lg body-md text-secondary">
								Charts, onchain analysis, price forecasts, web search, and more. All in one AI chat. Available with the
								Pro plan at a lower price point.
							</p>
						</div>
					</div>
					<span className="flex shrink-0 items-center gap-1 self-start label-md text-link sm:self-center">
						Explore LlamaAI
						<Icon name="arrow-right" className="size-3.5" />
					</span>
				</Card>
			</section>

			{/* Tools */}
			<section id="tools" className="mx-auto max-w-[1100px] scroll-mt-20 px-4 py-12 sm:px-6 md:px-8">
				<SectionHeader overline="23 Tools" title="Everything DeFi, One Connection" />

				<div className="space-y-6">
					{toolCategories.map((cat, i) => (
						<ToolCategoryGroup key={cat.label} label={cat.label} tools={cat.tools} defaultOpen={i < 3} />
					))}
				</div>
			</section>

			{/* Skills */}
			<section className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6 md:px-8">
				<SectionHeader
					overline="Workflow Skills"
					title="Guided Research Workflows"
					description="Optional skills that teach your agent structured analysis patterns, turning raw tools into expert-level DeFi research. Installed automatically by the quick start prompt unless you opted to skip them."
				/>

				<div className="grid gap-2 sm:grid-cols-2">
					{skills.map((s) => (
						<Card key={s.name} padding="sm" className="flex items-start gap-3">
							<span className="flex h-lh shrink-0 items-center mono-md">
								<span className="flex size-5 items-center justify-center rounded-full bg-brand-faint">
									<svg
										viewBox="0 0 24 24"
										className="size-3"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								</span>
							</span>
							<div>
								<code className="mono-md text-primary">{s.name}</code>
								<p className="mt-0.5 body-sm text-secondary">{s.desc}</p>
							</div>
						</Card>
					))}
				</div>

				<div className="mt-8">
					<h3 className="mb-3 label-md text-secondary">Install skills manually</h3>
					<p className="mb-4 body-sm text-secondary">
						The quick start prompt installs these automatically. To install manually, run:
					</p>
					<div className="mx-auto max-w-2xl">
						<CodeBlock label="Works with any agent">npx skills add DefiLlama/defillama-skills --yes</CodeBlock>
					</div>
				</div>
			</section>

			{/* CTA */}
			<section className="mx-auto max-w-[1100px] px-4 py-16 text-center sm:px-6 md:px-8">
				<h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">Ready to get started?</h2>
				<p className="mb-6 text-secondary">Requires an API plan. Uses the same credits as your API key.</p>
				<Button onClick={handleGetStarted} variant="primary" size="md" className="mx-auto">
					Get Started
				</Button>
			</section>

			{/* API Subscribe Modal */}
			<ClientOnly>
				<Dialog size="sm" store={dialog} portal unmountOnHide>
					<DialogHeader title="Get an API plan" subtitle="MCP uses the same credits as your API key." />
					<DialogBody>
						<SubscribeAPICard />
					</DialogBody>
				</Dialog>
			</ClientOnly>
		</>
	)
}

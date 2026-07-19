import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { readInvestorApiJson, type ApiNumericString, type ApiUnixSecondsString } from '../../api.types'

// Maple GraphQL serializes token amounts/rates as decimal strings and timestamps as Unix-second strings.

export interface MapleAsset {
	symbol: string
	decimals: number
}

export interface MapleLoanManager {
	principalOut: ApiNumericString
	accountedInterest: ApiNumericString
}

export interface MaplePoolMeta {
	_id: string
	poolName: string
	strategy: string | null
	cardDescription: string | null
	poolCategory: { _id: string; name: string } | null
	collateralType: { _id: string; name: string } | null
}

export interface MapleWithdrawalManager {
	id: string
	cycleDuration: ApiNumericString
	windowDuration: ApiNumericString
}

export interface MaplePool {
	id: string
	name: string
	asset: MapleAsset
	tvlUsd: ApiNumericString
	spotApy: ApiNumericString
	numOpenTermLoans: ApiNumericString
	unrealizedLosses: ApiNumericString
	liquidityCap: ApiNumericString
	loanManager: MapleLoanManager
	totalAssets: ApiNumericString
	principalOut: ApiNumericString
	numPositions: ApiNumericString
	numActiveLoans: ApiNumericString
	numDefaultedLoans: number
	depositedAssets: ApiNumericString
	withdrawnAssets: ApiNumericString
	coverLiquidated: ApiNumericString
	delegateManagementFeeRate: ApiNumericString
	platformManagementFeeRate: ApiNumericString
	openToPublic: boolean
	symbol: string
	poolMeta: MaplePoolMeta | null
	withdrawalManager: MapleWithdrawalManager | null
}

export interface MapleOpenTermLoan {
	id: string
	borrower: { id: string }
	principalOwed: ApiNumericString
	interestRate: ApiNumericString
	isCalled: boolean
	isImpaired: boolean
	interestPaid: ApiNumericString
	// Maple GraphQL timestamps are Unix seconds encoded as strings.
	fundingDate: ApiUnixSecondsString
	startDate: ApiUnixSecondsString
	state: string
	paymentIntervalDays: ApiNumericString
	gracePeriodSeconds: ApiNumericString
	delegateServiceFeeRate: ApiNumericString
	platformServiceFeeRate: ApiNumericString
	lateInterestPremium: ApiNumericString
	lateFeeRate: ApiNumericString
}

export interface MaplePoolWithLoans {
	id: string
	name: string
	asset: MapleAsset
	tvlUsd: ApiNumericString
	spotApy: ApiNumericString
	numOpenTermLoans: ApiNumericString
	openTermLoans: MapleOpenTermLoan[]
}

export interface StSyrupTx {
	id: string
	timestamp: ApiUnixSecondsString
	type: 'deposit' | 'withdraw'
	sharesAmount: ApiNumericString
	assetsAmount: ApiNumericString
	account: { id: string }
}

export interface SyrupTx {
	id: string
	timestamp: ApiUnixSecondsString
	tokensMigrated: ApiNumericString
	account: { id: string }
}

export interface SyrupGlobals {
	apy: ApiNumericString
	tvl: ApiNumericString
}

export interface StSyrup {
	id: string
	totalSupply: ApiNumericString
	freeAssets: ApiNumericString
	issuanceRate: ApiNumericString
	vestingPeriodFinish: ApiUnixSecondsString
	lastUpdated: ApiUnixSecondsString
	precision: number
	asset: { id: string }
}

export interface SyrupDripTx {
	id: string
	timestamp: ApiUnixSecondsString
	type: string
	amount: ApiNumericString
	account: { id: string }
}

const STALE_TIME = 10 * 60 * 1000

async function fetchMapleQuery<T>(queryName: string): Promise<T> {
	const response = await fetch('/api/dynamic/maple/graphql', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ queryName })
	})
	if (!response.ok) throw new Error(`Maple API error: ${response.status}`)
	return readInvestorApiJson<T>(response)
}

export function parseWad(value: string, decimals = 27): number {
	if (value === '0') return 0
	const n = Number(value)
	return n / Math.pow(10, decimals)
}

export function parseTokenAmount(value: string, decimals: number): number {
	if (value === '0') return 0
	return Number(value) / Math.pow(10, decimals)
}

export function parseInterestRate(value: string): number {
	return Number(value) / 10000
}

export function parseFeeRate(value: string): number {
	return Number(value) / 10000
}

export function useMapleActivePools() {
	const query = useQuery({
		queryKey: ['maple-active-pools'],
		queryFn: () => fetchMapleQuery<{ data: { poolV2S: MaplePool[] } }>('activePools'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const pools = query.data?.data?.poolV2S ?? []
		const significant = pools.filter((p) => parseFloat(p.tvlUsd) >= 1000)
		return { pools: significant, isLoading: query.isLoading }
	}, [query.data, query.isLoading])
}

export function useMaplePoolsWithLoans() {
	const query = useQuery({
		queryKey: ['maple-pools-with-loans'],
		queryFn: () => fetchMapleQuery<{ data: { poolV2S: MaplePoolWithLoans[] } }>('poolsWithLoans'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const pools = query.data?.data?.poolV2S ?? []
		const withActiveLoans = pools.filter((p) => p.openTermLoans.length > 0)
		return { pools: withActiveLoans, isLoading: query.isLoading }
	}, [query.data, query.isLoading])
}

export function useStSyrupTxes() {
	const query = useQuery({
		queryKey: ['maple-st-syrup-txes'],
		queryFn: () => fetchMapleQuery<{ data: { stSyrupTxes: StSyrupTx[] } }>('stSyrupTxes'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const txes = query.data?.data?.stSyrupTxes ?? []
		return { txes, isLoading: query.isLoading }
	}, [query.data, query.isLoading])
}

export function useSyrupTxes() {
	const query = useQuery({
		queryKey: ['maple-syrup-txes'],
		queryFn: () => fetchMapleQuery<{ data: { syrupTxes: SyrupTx[] } }>('syrupTxes'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const txes = query.data?.data?.syrupTxes ?? []
		return { txes, isLoading: query.isLoading }
	}, [query.data, query.isLoading])
}

export function useSyrupGlobals() {
	const query = useQuery({
		queryKey: ['maple-syrup-globals'],
		queryFn: () => fetchMapleQuery<{ data: { syrupGlobals: SyrupGlobals } }>('syrupGlobals'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const globals = query.data?.data?.syrupGlobals ?? null
		return { globals, isLoading: query.isLoading }
	}, [query.data, query.isLoading])
}

export function useStSyrupState() {
	const query = useQuery({
		queryKey: ['maple-st-syrup-state'],
		queryFn: () => fetchMapleQuery<{ data: { stSyrups: StSyrup[] } }>('stSyrupState'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const state = query.data?.data?.stSyrups?.[0] ?? null
		return { state, isLoading: query.isLoading }
	}, [query.data, query.isLoading])
}

export function useSyrupDripTxes() {
	const query = useQuery({
		queryKey: ['maple-syrup-drip-txes'],
		queryFn: () => fetchMapleQuery<{ data: { syrupDripTxes: SyrupDripTx[] } }>('syrupDripTxes'),
		staleTime: STALE_TIME,
		refetchOnWindowFocus: false
	})

	return useMemo(() => {
		const txes = query.data?.data?.syrupDripTxes ?? []
		return { txes, isLoading: query.isLoading }
	}, [query.data, query.isLoading])
}

import { TVL_SETTINGS, type TvlSettingsKey } from '~/contexts/LocalStorage'
import type { ToggleOption } from './types'

export const tvlOptions: Array<ToggleOption<TvlSettingsKey>> = [
	{
		name: 'Staking',
		key: TVL_SETTINGS.STAKING,
		help: 'Include governance tokens staked in the protocol'
	},
	{
		name: 'Pool2',
		key: TVL_SETTINGS.POOL2,
		help: 'Include staked lp tokens where one of the coins in the pair is the governance token'
	},
	{
		name: 'Gov Tokens',
		key: TVL_SETTINGS.GOV_TOKENS,
		help: 'Include governance tokens'
	},
	{
		name: 'Active Loans',
		key: TVL_SETTINGS.BORROWED,
		help: 'Include active loans in lending protocols'
	},
	{
		name: 'Double Count',
		key: TVL_SETTINGS.DOUBLE_COUNT,
		help: 'Include TVL of protocols which TVL feeds into another protocol'
	},
	{
		name: 'Liquid Staking',
		key: TVL_SETTINGS.LIQUID_STAKING,
		help: 'Include Rewards/Liquidity for staked assets'
	},
	{
		name: 'Vesting',
		key: TVL_SETTINGS.VESTING,
		help: 'Include tokens that are not circulating or not issued yet'
	}
]

export const tvlOptionsMap = new Map(tvlOptions.map((option) => [option.key, option]))

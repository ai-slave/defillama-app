import { masterExchangeExecutionSlippage } from '~/containers/Exchanges/server/master.api'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(masterExchangeExecutionSlippage)

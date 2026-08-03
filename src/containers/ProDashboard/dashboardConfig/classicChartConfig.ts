import {
	isChainDashboardChartType,
	isProtocolDashboardChartType,
	type ChartConfig,
	type MetricConfig,
	type MetricSubject
} from '../types'

type WidenChartType<Config> = Config extends { type: string } ? Omit<Config, 'type'> & { type: string } : never

export type ChartConfigInput = WidenChartType<ChartConfig>
export type MetricConfigInput = Omit<MetricConfig, 'subject' | 'type'> & {
	subject: MetricSubject
	type: string
}

export function createChartConfig(config: ChartConfigInput): ChartConfig | null {
	const type = config.type
	if (config.subjectType === 'protocol') {
		return isProtocolDashboardChartType(type) ? { ...config, type } : null
	}
	return isChainDashboardChartType(type) ? { ...config, type } : null
}

export function createMetricConfig(config: MetricConfigInput): MetricConfig | null {
	const { subject, type, ...metric } = config
	if (subject.itemType === 'protocol') {
		return isProtocolDashboardChartType(type) ? { ...metric, subject, type } : null
	}
	return isChainDashboardChartType(type) ? { ...metric, subject, type } : null
}

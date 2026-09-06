export interface PriceTrigger {
	type: 'price'
	token_nk: string
	op: 'above' | 'below'
	value: number
	recurring?: boolean
}

export interface Alert {
	id: string
	title: string
	original_query: string
	schedule_expression: string
	next_run_at: string
	last_run_at: string | null
	last_run_status: 'success' | 'error' | null
	last_error?: string | null
	enabled: boolean
	run_count: number
	created_at: string
	delivery_channel?: DeliveryChannel
	condition?: string | null
	slack_team_id?: string | null
	slack_channel_id?: string | null
	slack_channel_name?: string | null
	test_sent?: boolean
	trigger?: PriceTrigger | null
	armed?: boolean
}

export interface AlertsUsage {
	count: number
	cap: number | null
	allowed: boolean
}

export type DeliveryChannel = 'email' | 'telegram' | 'slack'

export interface AlertExecution {
	id: string
	executed_at: string
	status: string
	duration_ms: number
	chart_count: number
	error_message?: string | null
}

export interface AlertExecutionDetail extends AlertExecution {
	alertTitle: string
	generated_summary: string | null
	generated_charts: Array<{ id: string; type: string; title: string; url: string }> | null
	citations: Array<string> | null
}

export interface AlertConfig {
	frequency: 'daily' | 'weekly'
	hour: number
	dayOfWeek: number
	timezone: string
}

export interface UpdateAlertInput {
	alertId: string
	title: string
	alertConfig?: AlertConfig
	delivery_channel: DeliveryChannel
	condition: string
	trigger?: PriceTrigger
	slack_team_id?: string | null
	slack_channel_id?: string | null
	slack_channel_name?: string | null
}

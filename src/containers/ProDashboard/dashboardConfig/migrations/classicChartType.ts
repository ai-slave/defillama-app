/** Historical aliases are normalized once before a chart or metric enters the current runtime union. */
export function migrateClassicChartType(type: string): string {
	switch (type) {
		case 'users':
			return 'activeUsers'
		case 'options':
			return 'optionsPremium'
		default:
			return type
	}
}

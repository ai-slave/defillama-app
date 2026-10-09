/** On a phone a horizontal Sankey stacks its nodes in a column, so it grows with them. Its own module, so a page that
    loads the chart lazily can reserve the same height without importing the chart. */
export function sankeyMobileMinHeight(nodeCount: number): string {
	return `${Math.max(450, nodeCount * 64)}px`
}

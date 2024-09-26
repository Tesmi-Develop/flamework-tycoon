import { BaseTycoonItem, TycoonItem } from "./BaseTycoonItem";

@TycoonItem({
	tag: "TycoonItem",
})
export class DefaultTycoonItem extends BaseTycoonItem<{}, Instance> {
	protected generateData() {
		return {};
	}
}

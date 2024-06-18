import { BaseTycoonItem, TycoonItem } from "./BaseTycoonItem";

@TycoonItem({
	tag: "TycoonItem",
})
export class DefaultTycoonItem extends BaseTycoonItem<{}, Model> {
	protected generateData() {
		return {};
	}
}

import { BaseTycoonItem, TycoonItem } from "./BaseTycoonItem";
import { Flamework } from "@flamework/core";

@TycoonItem({
	tag: "TycoonItem",
})
export class DefaultTycoonItem extends BaseTycoonItem {
	protected dataGuard = Flamework.createGuard<{}>();
	protected generateData() {
		return {};
	}
}

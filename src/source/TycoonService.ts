import { Components } from "@flamework/components";
import { Constructor, ConstructorRef } from "@flamework/components/out/utility";
import { Modding, OnInit, Service } from "@flamework/core";
import { BaseTycoonComponent } from "./BaseTycoonComponent";
import { TycoonComponent } from "./TycoonComponent";
import { BaseTycoonItem, TycoonItem } from "./item/BaseTycoonItem";
import { TycoonLogger } from "./TycoonLogger";
import { IsExtended } from "../utility";

@Service({})
export class TycoonService implements OnInit {
	private LOCK_ITEM_TAG = "LockedItem";
	private items = new Map<string, Constructor<BaseTycoonItem>>();

	constructor(
		private components: Components,
		private logger: TycoonLogger,
	) {}

	public onInit() {
		const itemConfigs = Modding.getDecorators<typeof TycoonItem>();

		itemConfigs.forEach((data) => {
			if (!data.constructor) return;
			if (!IsExtended(data.constructor, BaseTycoonItem)) return;
			if (data.arguments[0]?.tag === undefined) return;

			this.items.set(data.arguments[0]?.tag, data.constructor as Constructor<BaseTycoonItem>);
			this.logger.Info(`Registered item: ${data.arguments[0]?.tag}`);
		});
	}

	/**
	 * @internal
	 */
	public GetConstructorItems() {
		return this.items;
	}

	public GetLockItemTag() {
		return this.LOCK_ITEM_TAG;
	}

	public SetLockItemTag(lockItemTag: string) {
		this.LOCK_ITEM_TAG = lockItemTag;
	}

	/** @metadata macro */
	public Create<T extends BaseTycoonComponent = TycoonComponent>(
		model: Model,
		componentSpecifier?: ConstructorRef<T>,
	) {
		return this.components.addComponent(model, componentSpecifier);
	}
}

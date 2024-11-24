/* eslint-disable @typescript-eslint/no-explicit-any */
import { Components } from "@flamework/components";
import { Constructor, ConstructorRef } from "@flamework/components/out/utility";
import { OnInit, Reflect, Service } from "@flamework/core";
import { BaseTycoonComponent } from "./BaseTycoonComponent";
import { TycoonComponent } from "./TycoonComponent";
import { BaseTycoonItem, DecoratedTycoonItems, TycoonItemConfig } from "./item/BaseTycoonItem";
import { TycoonLogger } from "./TycoonLogger";
import { IsExtended } from "../utility";

@Service({})
export class TycoonService implements OnInit {
	private UNLOCKED_ITEM_TAG = "UnlockedItem";
	private items = new Map<string, Constructor<BaseTycoonItem<any, any, any>>>();

	constructor(
		private components: Components,
		private logger: TycoonLogger,
	) {}

	public onInit() {
		DecoratedTycoonItems.forEach((ctor) => {
			const config = Reflect.getMetadata<TycoonItemConfig>(ctor, "config")!;

			if (!ctor || !IsExtended(ctor, BaseTycoonItem)) return;
			if (config.tag === undefined) return;

			this.items.set(config.tag, ctor);
			this.logger.Info(`Registered item: ${config.tag}`);
		});
	}

	/** @internal */
	public GetConstructorItems() {
		return this.items;
	}

	public GetUnlockedItemTag() {
		return this.UNLOCKED_ITEM_TAG;
	}

	public SetUnlockedItemTag(tag: string) {
		this.UNLOCKED_ITEM_TAG = tag;
	}

	/** @metadata macro */
	public Create<T extends BaseTycoonComponent = TycoonComponent>(
		model: Instance,
		componentSpecifier?: ConstructorRef<T>,
	) {
		return this.components.addComponent(model, componentSpecifier);
	}
}

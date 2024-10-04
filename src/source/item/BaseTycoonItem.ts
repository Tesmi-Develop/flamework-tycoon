/* eslint-disable @typescript-eslint/no-explicit-any */
import { Modding, OnStart, Reflect } from "@flamework/core";
import { Component, BaseComponent, Components } from "@flamework/components";
import { ReconcileTable } from "../../utility";
import { Janitor } from "@rbxts/janitor";
import { TycoonService } from "../TycoonService";
import { BaseTycoonComponent } from "../BaseTycoonComponent";
import { TycoonLogger } from "../TycoonLogger";
import { InjectTycoon } from "../decorators/Inject-tycoon";
import { Constructor, getIdFromSpecifier } from "@flamework/components/out/utility";
import { AbstractConstructor, isConstructor } from "@flamework/core/out/utility";
import { t } from "@rbxts/t";
import { Signal } from "@rbxts/signals-tooling";

type InferBaseTycoonGenerics<T extends BaseTycoonItem<any, any, any>> =
	T extends BaseTycoonItem<infer A, infer I, infer D> ? [A, I, D] : never;

type AttrubutesGuard<T extends BaseTycoonItem<any, any, any>> = Required<{
	[K in keyof InferBaseTycoonGenerics<T>[0]]: Modding.Generic<InferBaseTycoonGenerics<T>[0][K], "guard">;
}>;

export interface TycoonItemConfig {
	tag?: string;
	defaults?: Record<string, unknown>;
}

export interface TycoonItemMetadata<T extends BaseTycoonItem = BaseTycoonItem> {
	AttributesGuard: AttrubutesGuard<T>;
	InstanceGuard: Modding.Generic<InferBaseTycoonGenerics<T>[1], "guard">;
	DataGuard: Modding.Generic<InferBaseTycoonGenerics<T>[2], "guard">;
}

export const DecoratedTycoonItems = new Set<Constructor<BaseTycoonItem<any, any, any>>>();

/**
 * Register a class as a tycoon item.
 *
 * @metadata reflect identifier flamework:implements flamework:parameters injectable macro
 */
export const TycoonItem = <T extends BaseTycoonItem>(
	config?: TycoonItemConfig,
	metadata?: Modding.Many<TycoonItemMetadata<T>>,
) => {
	assert(metadata, "metadata is required");

	return (ctor: AbstractConstructor<T>) => {
		isConstructor(ctor) && DecoratedTycoonItems.add(ctor as never);
		Reflect.defineMetadata(ctor, "config", config);
		Reflect.defineMetadata(ctor, "metadata", metadata);
		Reflect.decorate(ctor, "$c:components@Component", Component, [
			{
				instanceGuard: metadata.InstanceGuard,
				attributes: metadata.AttributesGuard,
				defaults: config?.defaults,
			},
		]);
	};
};

interface Attributes {
	Id?: string;
}

@Component()
export abstract class BaseTycoonItem<A extends object = {}, I extends Instance = Instance, D extends {} = {}>
	extends BaseComponent<A & Attributes, I>
	implements OnStart
{
	@InjectTycoon
	private _tycoon!: BaseTycoonComponent;
	private __janitor = new Janitor();
	private isLocked = false;
	private baseParent!: Instance;
	private id!: string;
	private isDestroyed = false;
	private dataGuard = Reflect.getMetadata<TycoonItemMetadata>(getmetatable(this) as never, "metadata")!
		.DataGuard as never as t.check<D>;

	public readonly LockChanged = new Signal<(isLocked: boolean) => void>();

	constructor(
		public readonly TycoonService: TycoonService,
		private logger: TycoonLogger,
		private components: Components,
	) {
		super();
	}

	public onStart() {
		this.initId();
		this.baseParent = this.instance.Parent!;
	}

	public onSetup() {
		this.logger.Info(`${this.GetId()} is starting`);

		this.initLockState();
		this.initEvents();
		this.validateData();

		this.logger.Info(`${this.instance.Name} is created`);
	}

	protected GetTycoon() {
		return this._tycoon;
	}

	private initEvents() {
		this.__janitor.Add(
			this._tycoon.DataResetted.Connect(() => this.initLockState()),
			"Disconnect",
		);
	}

	private validateData() {
		const data = this.TryGetData();
		if (!data || this.dataGuard(data)) return;

		const template = this.generateData();
		const newData = ReconcileTable(data as {}, template);

		this.mutateData(newData);
	}

	private initLockState() {
		if (this.hasUnlockedTag() || this.TryGetData()) {
			this.isLocked = true;
			this.Appear();
			return;
		}

		this.isLocked = false;
		this.Disappear();
	}

	private hasUnlockedTag() {
		return this.instance.HasTag(this.TycoonService.GetUnlockedItemTag());
	}

	private initId() {
		this.id = this.attributes.Id ?? this.buildId();
		this.logger.Info(`ID: ${this.id} for ${this.instance.Name}`);
	}

	private fallbackPath() {
		this.logger.Warn(`Advanced path build failure for object ${this.instance.Name}, defaulting to name`);
		return this.instance.Name;
	}

	private buildId() {
		const tycoonInstance = this.GetTycoon().instance;
		let path: Instance[] = [];

		let currentParent: Instance = this.instance;
		while (currentParent !== tycoonInstance) {
			path = [currentParent, ...path];
			if (!currentParent.Parent) return this.fallbackPath();

			currentParent = currentParent.Parent;
		}

		path = [tycoonInstance, ...path];
		let stringPath = "";
		path.forEach((part, index) => {
			stringPath += part.Name;
			if (index !== path.size()) stringPath += "/";
		});

		return stringPath;
	}

	protected mutateData(newData: D) {
		this.logger.Assert(!this.isLocked, "Item is locked");
		this._tycoon.MutateItemData(this.id, newData);
	}

	private clearData() {
		this._tycoon.ClearItemData(this.id);
	}

	protected abstract generateData(): D;

	public GetId() {
		return this.id;
	}

	public GetData() {
		this.logger.Assert(!this.isLocked, "Item is locked");
		return this._tycoon.GetData().Items.get(this.id) as D;
	}

	public TryGetData() {
		return this._tycoon.GetData().Items.get(this.id) as D | undefined;
	}

	public IsLocked() {
		return this.isLocked;
	}

	protected async onAppear() {}
	protected async onDisappear() {}
	protected onDestroyed() {}

	public Disappear() {
		if (this.isLocked || this.isDestroyed) return;
		this.isLocked = true;
		this.setParentWhenLocked();

		this.clearData();
		this.LockChanged.fire(true);
		this.onDisappear();
	}

	public Appear() {
		if (!this.isLocked || this.isDestroyed) return;
		this.isLocked = false;
		this.setParentWhenUnlocked();

		this.mutateData(this.generateData());
		this.LockChanged.fire(false);
		this.onAppear();
	}

	protected setParentWhenUnlocked() {
		this.instance.Parent = this.baseParent;
	}

	protected setParentWhenLocked() {
		this.instance.Parent = this._tycoon.GetContainer();
	}

	/** @internal */
	public Destroy() {
		this.components.removeComponent(this.instance, getIdFromSpecifier(getmetatable(this) as Constructor));
	}

	/** @hidden */
	public destroy() {
		this.isDestroyed = true;

		this.__janitor.Destroy();
		this.onDestroyed();
		setmetatable(this, {
			__index: (t, index) => {
				error(`Item destroyed.`);
			},
		});
	}
}

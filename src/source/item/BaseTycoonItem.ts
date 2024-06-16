import { Flamework, Modding, OnStart, Reflect } from "@flamework/core";
import { Component, BaseComponent, Components } from "@flamework/components";
import { ReconcileTable, TycoonItemConfig } from "../../utility";
import { Janitor } from "@rbxts/janitor";
import { TycoonService } from "../TycoonService";
import { BaseTycoonComponent } from "../BaseTycoonComponent";
import { TycoonLogger } from "../TycoonLogger";
import { InjectTycoon } from "../decorators/Inject-tycoon";
import { t } from "@rbxts/t";
import { Constructor, getIdFromSpecifier } from "@flamework/components/out/utility";

/**
 * Register a class as a tycoon item.
 *
 * @metadata flamework:implements flamework:parameters injectable intrinsic-component-decorator
 */
export const TycoonItem = Modding.createDecorator<[config?: TycoonItemConfig]>("Class", (descriptor, [config]) => {
	Reflect.decorate(descriptor.object, "$c:components@Component", Component, config as never);
});

interface Attributes {
	Id?: string;
}

@Component()
export abstract class BaseTycoonItem<A extends Attributes = {}, I extends Instance = Instance, D extends {} = {}>
	extends BaseComponent<A, I>
	implements OnStart
{
	@InjectTycoon
	private _tycoon!: BaseTycoonComponent;
	private __janitor = new Janitor();
	private isLocked = false;
	private baseParent!: Instance;
	private id!: string;
	private isDestroyed = false;
	protected abstract dataGuard: t.check<D>;

	constructor(
		public readonly TycoonService: TycoonService,
		private logger: TycoonLogger,
		private components: Components,
	) {
		super();
	}

	public onStart() {
		this.initId();
		this.logger.Info(`${this.GetId()} is starting`);
		this.baseParent = this.instance.Parent!;

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
			this._tycoon.OnResetData.Connect(() => this.initLockState()),
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
		if (this.TryGetData()) {
			this.isLocked = true;
			this.Unlock();
			return;
		}

		if (this.haveLockTag()) {
			this.isLocked = false;
			this.Lock();
			return;
		}

		this.isLocked = true;
		this.Unlock();
	}

	private haveLockTag() {
		return this.instance.HasTag(this.TycoonService.GetLockItemTag());
	}

	private initId() {
		this.id = this.attributes.Id ?? this.instance.Name;
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

	protected async onUnlocked() {}
	protected async onLocked() {}
	protected onDestroyed() {}

	public Lock() {
		if (this.isLocked || this.isDestroyed) return;
		this.isLocked = true;
		this.instance.Parent = this._tycoon.GetContainer();

		this.clearData();
		this.onLocked();
	}

	public Unlock() {
		if (!this.isLocked || this.isDestroyed) return;
		this.isLocked = false;
		this.instance.Parent = this.baseParent;

		this.mutateData(this.generateData());
		this.onUnlocked();
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

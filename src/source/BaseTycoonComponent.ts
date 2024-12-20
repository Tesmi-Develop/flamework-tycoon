import { Component, BaseComponent, Components } from "@flamework/components";
import { Players, RunService, ServerStorage } from "@rbxts/services";
import { atom, subscribe } from "@rbxts/charm";
import { OwnerProfileData, IsExtended, TycoonData } from "../utility";
import { Flamework, Modding, OnStart } from "@flamework/core";
import { Janitor } from "@rbxts/janitor";
import { OwnerProfile } from "./OwnerProfile";
import { TycoonLogger } from "./TycoonLogger";
import { TycoonService } from "./TycoonService";
import { getIdFromSpecifier } from "@flamework/components/out/utility";
import { produce } from "@rbxts/immut";
import { BaseTycoonItem } from "./item/BaseTycoonItem";
import { DefineContext } from "./decorators/Inject-tycoon";
import { Constructor } from "@flamework/core/out/utility";
import { Signal } from "@rbxts/signals-tooling";

const TycoonStorage = (RunService.IsServer() ? new Instance("Folder", ServerStorage) : undefined) as Folder;

@Component({})
export abstract class BaseTycoonComponent<
		A extends object = {},
		I extends Instance = Instance,
		D extends TycoonData = TycoonData,
	>
	extends BaseComponent<A, I>
	implements OnStart
{
	public readonly DataChanged = new Signal<(newData: Readonly<D>, prevData: Readonly<D>) => void>();
	public readonly Claimed = new Signal<(newOwner: Player) => void>();
	public readonly Unclaimed = new Signal<() => void>();
	public readonly OwnerChanged = new Signal<(newOwner?: Player) => void>();
	public readonly DataResetted = new Signal<() => void>();

	private container!: Folder;
	private owner?: OwnerProfile;
	private dataContrainter = atom<D>(undefined!);
	private items = new Map<string, BaseTycoonItem>();
	private itemsByInstance = new Map<Instance, BaseTycoonItem>();
	protected readonly janitor = new Janitor();

	protected abstract generateData(): D;

	constructor(
		private logger: TycoonLogger,
		private components: Components,
		private tycoonService: TycoonService,
	) {
		super();
	}

	public onStart() {
		this.container = new Instance("Folder");
		this.janitor.Add(this.container);

		this.container.Name = this.instance.Name;
		this.container.Parent = TycoonStorage;

		this.dataContrainter(this.generateData());
		this.initEvents();
		this.initItems();
	}

	public GetItemsOfType<T extends object>(ctor: Constructor<T>, excludeLocked: boolean = false): T[] {
		const items: T[] = [];
		this.items.forEach((item) => {
			if (excludeLocked && item.IsLocked()) return;
			if (item instanceof ctor) items.push(item);
		});

		return items;
	}

	public GetItems() {
		return [...this.items].map(([_, T]) => T);
	}

	private initEvents() {
		this.janitor.Add(
			subscribe(this.dataContrainter, (newData, prevData) => {
				this.DataChanged.fire(newData, prevData);
			}),
		);

		this.janitor.Add(this.DataChanged, "destroy");
		this.janitor.Add(this.Claimed, "destroy");
		this.janitor.Add(this.Unclaimed, "destroy");
		this.janitor.Add(this.OwnerChanged, "destroy");
		this.janitor.Add(this.DataResetted, "destroy");

		this.logger.Info(`Initialized events`);
	}

	private findAllItemTags(instance: Instance) {
		const taggedItems = this.tycoonService.GetConstructorItems();
		return instance.GetTags().filter((tag) => taggedItems.has(tag));
	}

	private initItems() {
		const taggedItems = this.tycoonService.GetConstructorItems();

		this.instance.GetDescendants().forEach((instance) => {
			const foundTags = this.findAllItemTags(instance);
			if (foundTags.isEmpty()) return;

			if (foundTags.size() > 1) {
				this.logger.Warn(`Instance has more than one item tag: ${foundTags.join(", ")}`);
				return;
			}

			this.setupItem(instance, getIdFromSpecifier(taggedItems.get(foundTags[0])!)!);
		});

		this.items.forEach((item) => {
			item.onSetup();
		});

		this.logger.Info(`Initialized items`);
	}

	private setupItem(instance: Instance, specific: string) {
		DefineContext(this);
		const component = this.components.addComponent<BaseTycoonItem>(instance, specific);

		this.logger.Assert(!this.items.has(component.GetId()), `This item id "${component.GetId()}" is already in use`);
		this.items.set(component.GetId(), component);
		this.itemsByInstance.set(component.instance, component);
	}

	private resetData(data?: D) {
		this.dataContrainter(data ?? this.generateData());
		this.DataResetted.fire();

		this.logger.Info(`Reset data to`, this.GetData());
	}

	private destroyItems() {
		this.items.forEach((item) => item.Destroy());
		this.items.clear();
		this.itemsByInstance.clear();
	}

	private createOwnerProfile(instance: Player) {
		return new OwnerProfile(instance, this);
	}

	/** @internal */
	public MutateItemData(id: string, newData: object) {
		this.dataContrainter(
			produce(this.dataContrainter(), (draft) => {
				draft.Items.set(id, newData);
			}),
		);

		this.logger.Info(`Mutated item data`, this.dataContrainter().Items);
	}

	/** @internal */
	public ClearItemData(id: string) {
		this.dataContrainter(
			produce(this.dataContrainter(), (draft) => {
				draft.Items.delete(id);
			}),
		);

		this.logger.Info(`Clear item data ${id}`);
	}

	/** @metadata macro */
	public GetItem<T extends BaseTycoonItem = BaseTycoonItem>(
		qualifier: Instance | string,
		itemType?: Modding.Generic<T, "id">,
	) {
		assert(itemType, "itemType is required");

		const component = typeIs(qualifier, "string") ? this.items.get(qualifier) : this.itemsByInstance.get(qualifier);
		if (!component) return;

		if (itemType === Flamework.id<BaseTycoonItem>()) {
			return component as T;
		}

		const requiredConstructor = Modding.getObjectFromId(itemType);
		if (!IsExtended(getmetatable(component) as Constructor, requiredConstructor as Constructor)) return;

		return component as T;
	}

	public GetContainer() {
		return this.container;
	}

	public GetOwner(): OwnerProfileData | undefined {
		return this.owner;
	}

	public VerifyOwner(player?: Player) {
		return this.owner?.Instance === player;
	}

	public VerifyOwnerByCharacter(model?: Instance) {
		return this.VerifyOwner(Players.GetPlayerFromCharacter(model));
	}

	public HasOwner() {
		return this.owner !== undefined;
	}

	public GetData(): Readonly<D> {
		return this.dataContrainter();
	}

	public Claim(owner: Player, data?: D) {
		assert(!this.owner, "Already owned!");

		this.owner = this.createOwnerProfile(owner);

		this.resetData(data);
		this.OwnerChanged.fire(owner);
		this.Claimed.fire(owner);

		this.logger.Info(`Claimed`, owner);
		return this.owner as OwnerProfileData;
	}

	public Unclaim() {
		assert(this.owner, "Not owned!");

		this.owner.Destroy();
		this.owner = undefined;

		this.OwnerChanged.fire(undefined);
		this.Unclaimed.fire();

		this.logger.Info(`Disowned`);
	}

	public ResetData() {
		this.resetData();
	}

	public Destroy() {
		this.destroyItems();
		this.components.removeComponent(this.instance, getIdFromSpecifier(getmetatable(this) as Constructor));
	}

	/** @hidden */
	public destroy() {
		super.destroy();
		this.janitor.Destroy();
		setmetatable(this, {
			__index: (t, index) => {
				error(`Tycoon destroyed.`);
			},
		});

		this.logger.Info(`Destroyed`);
	}
}

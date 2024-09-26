import { OwnerProfileData, TycoonData } from "../utility";
import { Janitor } from "@rbxts/janitor";
import { BaseTycoonComponent } from "./BaseTycoonComponent";
import { Signal } from "@rbxts/signals-tooling";

export class OwnerProfile<D extends TycoonData = TycoonData> implements OwnerProfileData<D> {
	public readonly Instance: Player;
	public DataChanged = new Signal<(newData: Readonly<D>, prevData: Readonly<D>) => void>();
	private janitor = new Janitor();

	constructor(instance: Player, tycoon: BaseTycoonComponent<{}, Instance, D>) {
		this.Instance = instance;
		this.DataChanged = new Signal();

		this.janitor.Add(this.DataChanged, "destroy");
		this.janitor.Add(
			tycoon.OnChangedData.Connect((...args) => this.DataChanged.fire(...args)),
			"Disconnect",
		);
	}

	public Destroy() {
		this.janitor.Destroy();
	}
}

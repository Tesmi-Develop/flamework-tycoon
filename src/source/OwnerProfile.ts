import { IOwnerProfile, ITycoonData } from "../utility";
import { Janitor } from "@rbxts/janitor";
import { BaseTycoonComponent } from "./BaseTycoonComponent";
import { Signal } from "@rbxts/signals-tooling";

export class OwnerProfile<D extends ITycoonData = ITycoonData> implements IOwnerProfile<D> {
	public readonly Instance: Player;
	public OnMutateData = new Signal<(newData: Readonly<D>, prevData: Readonly<D>) => void>();
	private janitor = new Janitor();

	constructor(instance: Player, tycoon: BaseTycoonComponent<{}, Model, D>) {
		this.Instance = instance;
		this.OnMutateData = new Signal();

		this.janitor.Add(this.OnMutateData, "destroy");
		this.janitor.Add(
			tycoon.OnChangedData.Connect((...args) => this.OnMutateData.fire(...args)),
			"Disconnect",
		);
	}

	public Destroy() {
		this.janitor.Destroy();
	}
}

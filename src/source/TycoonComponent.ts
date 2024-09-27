import { Component } from "@flamework/components";
import { BaseTycoonComponent } from "./BaseTycoonComponent";
import { CreateTycoonData, TycoonData } from "../utility";

@Component({})
export class TycoonComponent extends BaseTycoonComponent<{}, Instance, TycoonData> {
	protected generateData(): TycoonData {
		return CreateTycoonData();
	}
}

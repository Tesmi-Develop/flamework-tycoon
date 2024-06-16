import { Component } from "@flamework/components";
import { BaseTycoonComponent } from "./BaseTycoonComponent";
import { CreateTycoonData, ITycoonData } from "../utility";

@Component({})
export class TycoonComponent extends BaseTycoonComponent<{}, Model, ITycoonData> {
	protected generateData(): ITycoonData {
		return CreateTycoonData();
	}
}

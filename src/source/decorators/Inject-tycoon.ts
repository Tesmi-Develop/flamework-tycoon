import { Dependency, Modding, Reflect } from "@flamework/core";
import { Constructor } from "@flamework/core/out/utility";
import { IsExtended, ModifyConstructorMethod } from "../../utility";
import { BaseTycoonComponent } from "../BaseTycoonComponent";
import { getIdFromSpecifier } from "@flamework/components/out/utility";

const INJECT_KEY = "Inject-tycoon";
let context: BaseTycoonComponent | undefined = undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DefineContext = (component: BaseTycoonComponent<any, any, any>) => {
	context = component;
};

export const ClearContext = () => (context = undefined);

/** @metadata flamework:type */
export const InjectTycoon = (ctor: object, property: string) => {
	const injectedType = Reflect.getMetadata<string>(ctor, "flamework:type", property);
	assert(injectedType, "Injected type not found");

	let injected = Reflect.getMetadata<Map<string, string>>(ctor, INJECT_KEY);

	if (injected) {
		injected.set(property, injectedType);
		return;
	}

	injected = new Map();
	injected.set(property, injectedType);
	Reflect.defineMetadata(ctor, INJECT_KEY, injected);

	ModifyConstructorMethod(
		ctor as Constructor,
		"constructor",
		(originalConstructor) =>
			function (this, ...args: unknown[]) {
				if (context === undefined) return;
				const injectTypes = Reflect.getMetadata<Map<string, string>>(ctor, INJECT_KEY)!;
				const myContructor = getmetatable(context) as Constructor;

				injectTypes.forEach((injectedType, property) => {
					const injectingConstructor = Modding.getObjectFromId(injectedType) as Constructor;
					assert(
						IsExtended(myContructor, injectingConstructor),
						`The injected type "${injectedType}" does not extend the current tycoon "${getIdFromSpecifier(myContructor)}" type`,
					);
					this[property as never] = context as never;
				});

				ClearContext();
				return originalConstructor(this, ...args);
			},
	);
};

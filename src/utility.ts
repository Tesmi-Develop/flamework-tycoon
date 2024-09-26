import { getParentConstructor } from "@flamework/components/out/utility";
import { Constructor, AbstractConstructor } from "@flamework/core/out/utility";
import { IReadOnlySignal } from "@rbxts/signals-tooling";

export interface ITycoonData {
	Items: Map<string, object>;
}

export interface IOwnerProfile<D extends ITycoonData = ITycoonData> {
	readonly Instance: Player;
	readonly OnMutateData: IReadOnlySignal<(newData: Readonly<D>, prevData: Readonly<D>) => void>;
}

export const CreateTycoonData = (): ITycoonData => ({
	Items: new Map<string, object>(),
});

export function IsExtended(ctor: AbstractConstructor, extended: AbstractConstructor) {
	if (ctor === extended) return true;
	let nextParent: AbstractConstructor | undefined = ctor;

	while ((nextParent = getParentConstructor(nextParent)) !== undefined) {
		if (nextParent === extended) return true;
	}

	return false;
}

type ReturnMethods<T extends object> = ExtractKeys<T, Callback>;
type TMethod<T> = (self: InferThis<T>, ...parameters: Parameters<T>) => ReturnType<T>;

type GetContextFromConstructors<T> =
	T extends Constructor<infer C> ? C : T extends AbstractConstructor<infer C> ? C : never;

export const ModifyConstructorMethod = <T extends Constructor | AbstractConstructor, C extends Callback = Callback>(
	_constructor: T,
	methodName: ReturnMethods<GetContextFromConstructors<T>> | "constructor",
	visitor: (originalMethod: TMethod<C>) => (this: GetContextFromConstructors<T>, ...args: unknown[]) => unknown,
): T => {
	const modifiedMethod = visitor(_constructor[methodName as never]);
	_constructor[methodName as never] = modifiedMethod as never;
	return _constructor;
};

export function ReconcileTable<C extends object, T extends object>(originalObject: C, template: T): T & C {
	const newData = {};

	for (const [key, value] of pairs(template)) {
		if (originalObject[key as never] === undefined) {
			newData[key as never] = value as never;
			continue;
		}
		newData[key as never] = originalObject[key as never];
	}

	return newData as T & C;
}

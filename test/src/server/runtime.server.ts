import { Flamework } from "@flamework/core";
import("@rbxts/flamework-tycoon");
import("./test-service");

(_G as { __DEV__: boolean }).__DEV__ = true;
Flamework.ignite();

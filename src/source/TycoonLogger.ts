import { Service } from "@flamework/core";

const consolePrefix = `Tycoon-flamework`;
const consoleTag = `[${consolePrefix}]:`;
const errorString = `--// [${consolePrefix}]: Caught an error in your code //--\n`;

@Service({})
export class TycoonLogger {
	private isDevMode() {
		return (_G as { __DEV__: boolean }).__DEV__;
	}
	public Info(...args: defined[]) {
		if (!this.isDevMode()) return;
		print(`${consoleTag} ${args[0]}`, ...args.filter((_, index) => index !== 0));
	}

	public Warn(message: string) {
		if (!this.isDevMode()) return;
		warn(`${consoleTag} ${message}`);
	}

	public Error(message: string) {
		if (!this.isDevMode()) return;
		error(`${errorString} ${message}`);
	}

	public Assert(condition: boolean, message: string) {
		if (!this.isDevMode()) return;
		assert(condition, `${errorString} ${message}`);
	}
}

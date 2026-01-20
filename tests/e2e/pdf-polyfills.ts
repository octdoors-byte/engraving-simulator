import { createRequire } from "module";

type ProcessWithBuiltinModule = typeof process & {
  getBuiltinModule?: (name: string) => { createRequire: typeof createRequire };
};

const nativeProcess = process as ProcessWithBuiltinModule;

if (!nativeProcess.getBuiltinModule) {
  nativeProcess.getBuiltinModule = (name: string) => {
    if (name === "module") {
      return { createRequire };
    }
    throw new Error(`Unsupported builtin module request: ${name}`);
  };
}

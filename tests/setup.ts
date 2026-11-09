import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: () => "00000000-0000-4000-8000-000000000000",
    configurable: true,
  });
}

if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => "blob:fixture";
  globalThis.URL.revokeObjectURL = () => undefined;
}

import { describe, expect, it } from "vitest";

describe("native merge protection probe", () => {
  it("stays red so a failed required check cannot merge", () => {
    expect(false).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { parsePptx } from "../../src/reader/presentation/pptx";
import { createMinimalPptx } from "../fixtures/pptx";

describe("PPTX subset parser", () => {
  it("extracts ordered slides and text boxes", () => {
    const document = parsePptx(createMinimalPptx());
    expect(document.width).toBe(960);
    expect(document.height).toBe(540);
    expect(document.slides).toHaveLength(2);
    expect(document.slides[0]?.elements[0]).toMatchObject({
      kind: "text",
      text: "Petite Grace PPTX",
      bold: true,
    });
    expect(document.slides[1]?.elements[0]).toMatchObject({ text: "Second slide" });
  });

  it("reports unsupported chart and table objects instead of claiming fidelity", () => {
    const document = parsePptx(createMinimalPptx());
    expect(document.warnings.join("\n")).toContain("第 2 页有 1 个图表、表格或复杂对象未完整渲染");
  });
});

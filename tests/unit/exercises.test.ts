import { describe, expect, it } from "vitest";
import { parseExercisesFromHtml } from "../../src/exercises/parser";
import { exerciseHtml } from "../fixtures/exercises";

describe("exercise parser", () => {
  it("parses questions, options and verified answers", () => {
    const set = parseExercisesFromHtml(exerciseHtml, "resource-1");
    expect(set.questions).toHaveLength(2);
    expect(set.questions[0]).toMatchObject({
      id: "q1",
      verifiedAnswer: "B",
      verifiedSource: "platform-verified",
    });
    expect(set.questions[0]?.options.map((option) => option.label)).toEqual(["A", "B"]);
    expect(set.questions[1]?.verifiedAnswer).toBeNull();
  });
});

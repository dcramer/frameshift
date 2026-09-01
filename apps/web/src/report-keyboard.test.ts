import { describe, expect, it } from "vitest";

import { adjacentScreenshot, reportArrowAction } from "./report-keyboard";

describe("reportArrowAction", () => {
  it("maps horizontal arrows to before and after for changed screenshots", () => {
    expect(reportArrowAction("ArrowLeft", "changed")).toEqual({
      kind: "quick-view",
      view: "before",
    });
    expect(reportArrowAction("ArrowRight", "changed")).toEqual({
      kind: "quick-view",
      view: "after",
    });
  });

  it("does not claim horizontal arrows when there is no comparison", () => {
    expect(reportArrowAction("ArrowLeft", "added")).toBeNull();
    expect(reportArrowAction("ArrowRight", "removed")).toBeNull();
    expect(reportArrowAction("ArrowRight", "unchanged")).toBeNull();
  });

  it("maps vertical arrows for every screenshot status", () => {
    expect(reportArrowAction("ArrowUp", "unchanged")).toEqual({
      direction: "up",
      kind: "screenshot",
      offset: -1,
    });
    expect(reportArrowAction("ArrowDown", "added")).toEqual({
      direction: "down",
      kind: "screenshot",
      offset: 1,
    });
  });
});

describe("adjacentScreenshot", () => {
  const files = ["first.png", "second.png", "third.png"];

  it("moves within the ordered screenshot list", () => {
    expect(adjacentScreenshot(files, "second.png", -1)).toBe("first.png");
    expect(adjacentScreenshot(files, "second.png", 1)).toBe("third.png");
  });

  it("stops at the ends instead of wrapping", () => {
    expect(adjacentScreenshot(files, "first.png", -1)).toBeNull();
    expect(adjacentScreenshot(files, "third.png", 1)).toBeNull();
  });
});

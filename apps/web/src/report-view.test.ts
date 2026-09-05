import { describe, expect, test } from "vitest";

import { readReportView, writeReportView } from "./report-view";

describe("report view", () => {
  test("reads a linked report view", () => {
    expect(
      readReportView(
        new URLSearchParams({
          file: "account/settings__mobile.png",
          mode: "side-by-side",
        }),
      ),
    ).toEqual({
      file: "account/settings__mobile.png",
      mode: "side-by-side",
    });
  });

  test("ignores invalid view values", () => {
    expect(
      readReportView(
        new URLSearchParams({ file: "", mode: "wrong", scale: "large" }),
      ),
    ).toEqual({ file: undefined, mode: undefined });
  });

  test("updates the view without removing the report source", () => {
    const search = writeReportView("?fixture=mixed", {
      file: "account/settings__mobile.png",
      mode: "split",
    });

    expect(Object.fromEntries(new URLSearchParams(search))).toEqual({
      file: "account/settings__mobile.png",
      fixture: "mixed",
      mode: "split",
    });
  });

  test("removes the retired image scale from old links", () => {
    const search = writeReportView("?fixture=mixed&scale=actual", {
      file: "account.png",
      mode: "difference",
    });

    expect(new URLSearchParams(search).has("scale")).toBe(false);
  });
});

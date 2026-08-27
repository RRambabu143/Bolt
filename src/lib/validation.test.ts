import { describe, expect, it } from "vitest";
import { normalizeSettings, validatePrompt } from "./validation";
describe("prompt validation", () => {
  it("rejects short prompts", () => expect(validatePrompt("x")).toContain("3"));
  it("accepts a useful prompt", () =>
    expect(validatePrompt("A cinematic mountain scene")).toBeNull());
});
describe("settings normalization", () => {
  it("clamps creativity", () =>
    expect(normalizeSettings("text", { creativity: 400 }).creativity).toBe(
      100,
    ));
  it("rejects unsupported video ratio", () =>
    expect(
      normalizeSettings("video", { aspect_ratio: "1:1" }).aspect_ratio,
    ).toBe("16:9"));
});

import { validatePrompt, normalizeSettings } from "./validation";

describe("validatePrompt", () => {
  it("rejects short prompts", () => {
    expect(validatePrompt("hi")).toBe("Prompt must contain at least 3 characters.");
  });
  it("accepts valid prompts", () => {
    expect(validatePrompt("A cinematic landscape")).toBeNull();
  });
});

describe("normalizeSettings", () => {
  it("normalizes text settings", () => {
    const result = normalizeSettings("text", { creativity: 50 });
    expect(result).toEqual({ tone: "Professional", format: "Article", creativity: 50 });
  });
  it("normalizes image settings", () => {
    const result = normalizeSettings("image", { aspect_ratio: "1:1" });
    expect(result).toEqual({
      provider: "cloudflare",
      model: "@cf/black-forest-labs/flux-1-schnell",
      aspect_ratio: "1:1",
      n: 1,
      quality: "standard",
    });
  });
});

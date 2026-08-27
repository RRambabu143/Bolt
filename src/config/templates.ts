import type { PromptTemplate } from "../types";
export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "launch-post",
    kind: "text",
    name: "Product launch",
    description: "A polished social launch announcement",
    tags: ["marketing", "social"],
    prompt:
      "Write a compelling product launch announcement for [PRODUCT]. Explain the problem, the breakthrough, three benefits, and end with a strong call to action.",
    settings: { tone: "Persuasive", format: "Social post", creativity: 65 },
  },
  {
    id: "youtube-script",
    kind: "text",
    name: "YouTube script",
    description: "Hook, value, story and CTA",
    tags: ["video", "creator"],
    prompt:
      "Create a YouTube video script about [TOPIC]. Begin with a curiosity-driven hook, deliver five practical insights with examples, add pattern interrupts, and finish with a memorable call to action.",
    settings: { tone: "Educational", format: "Video script", creativity: 70 },
  },
  {
    id: "cinematic-portrait",
    kind: "image",
    name: "Cinematic portrait",
    description: "Editorial portrait with dramatic lighting",
    tags: ["portrait", "cinematic"],
    prompt:
      "A cinematic editorial portrait of [SUBJECT], confident expression, dramatic rim lighting, soft atmospheric haze, premium color grading, realistic skin texture, shallow depth of field, photographed on an 85mm lens.",
    settings: { aspect_ratio: "3:4" },
  },
  {
    id: "product-hero",
    kind: "image",
    name: "Product hero",
    description: "Premium advertising key visual",
    tags: ["product", "advertising"],
    prompt:
      "Premium advertising hero shot of [PRODUCT] on a sculptural pedestal, sophisticated studio lighting, subtle reflections, luxury commercial art direction, clean negative space for headline, photorealistic.",
    settings: { aspect_ratio: "4:3" },
  },
  {
    id: "miniature-world",
    kind: "image",
    name: "Miniature world",
    description: "Viral tiny-world visual",
    tags: ["miniature", "viral"],
    prompt:
      "An intricate miniature world where tiny artisans are creating [SUBJECT], macro photography, tilt-shift depth of field, handcrafted details, cinematic warm lighting, whimsical but photorealistic.",
    settings: { aspect_ratio: "9:16" },
  },
  {
    id: "cinematic-reveal",
    kind: "video",
    name: "Cinematic reveal",
    description: "Eight-second product reveal with sound",
    tags: ["product", "cinematic"],
    prompt:
      "A cinematic reveal of [SUBJECT]. Start in extreme close-up, slowly dolly backward as practical lights activate in sequence, reveal the complete scene on the final beat. Rich atmospheric sound design, no text.",
    settings: {
      aspect_ratio: "16:9",
      resolution: "1080p",
      duration_seconds: 8,
      include_audio: true,
    },
  },
  {
    id: "vertical-reel",
    kind: "video",
    name: "Vertical reel",
    description: "Fast, energetic social video",
    tags: ["reel", "vertical"],
    prompt:
      "Vertical social video featuring [SUBJECT], immediate visual hook, three smooth match-cut transitions, dynamic camera movement, high-energy lighting, satisfying final hero frame, synchronized sound effects.",
    settings: {
      aspect_ratio: "9:16",
      resolution: "1080p",
      duration_seconds: 8,
      include_audio: true,
    },
  },
  {
    id: "nature-orbit",
    kind: "video",
    name: "Epic environment",
    description: "Slow cinematic environment shot",
    tags: ["nature", "atmosphere"],
    prompt:
      "A slow cinematic orbit through [ENVIRONMENT], volumetric sunrise, wind interacting naturally with the scene, rich environmental ambience, realistic scale, seamless motion, premium documentary color grade.",
    settings: {
      aspect_ratio: "16:9",
      resolution: "1080p",
      duration_seconds: 8,
      include_audio: true,
    },
  },
];

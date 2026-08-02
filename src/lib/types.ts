export type Shot = {
  id: string;
  /** Data URL of the AI-developed photo (film emulation only, no frame). */
  imageUrl: string;
  createdAt: number;
};

export type Screen = "camera" | "processing" | "result" | "gallery";

export type Shot = {
  id: string;
  /** Data URL of the AI-developed photo. */
  imageUrl: string;
  createdAt: number;
};

export type Screen = "camera" | "processing" | "result" | "gallery";

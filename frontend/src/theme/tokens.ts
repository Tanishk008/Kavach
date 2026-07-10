export const colors = {
  navy: "#673818",
  navyDark: "#4B260F",
  saffron: "#DD792C",
  cream: "#F8ECDD",
  india: "#138808",
  canvas: "#FFF8F1",
  surface: "#FFFFFF",
  hairline: "#EAD6C2",
  ink: "#2B190F",
  muted: "#755846",
} as const;

export type Tier = "safe" | "caution" | "high_risk";

export const tierStyles: Record<Tier, { label: string; text: string; bg: string; border: string }> = {
  safe: { label: "Safe", text: "text-safe", bg: "bg-safe-bg", border: "border-safe" },
  caution: { label: "Caution", text: "text-caution", bg: "bg-caution-bg", border: "border-caution" },
  high_risk: { label: "High risk", text: "text-highrisk", bg: "bg-highrisk-bg", border: "border-highrisk" },
};

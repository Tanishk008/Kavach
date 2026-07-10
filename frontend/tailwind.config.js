/** @type {import('tailwindcss').Config} */
// Kavach design tokens — matched to the shield logo palette.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#673818",
          dark: "#4B260F",
        },
        saffron: "#DD792C",
        cream: "#F8ECDD",
        india: "#138808",
        // Neutrals
        canvas: "#FFF8F1",
        surface: "#FFFFFF",
        hairline: "#EAD6C2",
        ink: "#2B190F",
        muted: "#755846",
        // Risk status — used ONLY on verdict cards/badges
        safe: { DEFAULT: "#138808", bg: "#E9F5E5" },
        caution: { DEFAULT: "#C9820A", bg: "#FDF1DC" },
        highrisk: { DEFAULT: "#B3261E", bg: "#FBE9E7" },
      },
      borderRadius: {
        card: "12px",
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

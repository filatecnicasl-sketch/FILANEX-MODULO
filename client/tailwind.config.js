/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          800: "#131B30",
          850: "#0F1626",
          900: "#0B1120",
          950: "#060B16",
        },
        panel: "#0D1526",
        accent: {
          DEFAULT: "#22D3EE",
          dark: "#0E7490",
        },
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 12px 32px -12px rgba(0, 0, 0, 0.55)",
        glow: "0 0 24px -6px rgba(34, 211, 238, 0.35)",
      },
    },
  },
  plugins: [],
};

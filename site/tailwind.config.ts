import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        green: { DEFAULT: "#2D4A3E", deep: "#1A3028", light: "#3D6B56" },
        orange: { DEFAULT: "#D4663A", light: "#E8845A", glow: "rgba(212,102,58,0.12)" },
        black: { DEFAULT: "#1A1A18", charcoal: "#2A2A26" },
        cream: { DEFAULT: "#F2EDE4", dark: "#E4DDD2" },
        "warm-gray": "#9A9488",
        "text-light": "#6E6A62",
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        body: ["Outfit", "sans-serif"],
      },
      animation: {
        "fade-up": "fadeUp 1s ease-out",
        "fade-in": "fadeIn 0.6s ease",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;

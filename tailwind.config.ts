import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#141210",
          soft: "#403c38",
          mute: "#6f6a64",
          faint: "#a09a92",
        },
        paper: {
          DEFAULT: "#fcfbfa",
          raise: "#ffffff",
          sunken: "#f4f2f0",
          line: "#e8e5e1",
        },
        accent: {
          DEFAULT: "#1a56db",
          soft: "#eef4fe",
        },
        good: { DEFAULT: "#0f7b4f", soft: "#eaf6ef" },
        warn: { DEFAULT: "#9a6700", soft: "#fdf3dd" },
        bad: { DEFAULT: "#c03434", soft: "#fdeeee" },
        urgent: { DEFAULT: "#b42318", soft: "#fdecea" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,18,16,0.05), 0 0 0 1px rgba(20,18,16,0.045)",
        raise: "0 4px 16px rgba(20,18,16,0.08), 0 0 0 1px rgba(20,18,16,0.05)",
        popover: "0 8px 32px rgba(20,18,16,0.14), 0 0 0 1px rgba(20,18,16,0.06)",
      },
      animation: {
        "fade-up": "fadeUp .35s ease both",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
        marquee: "marquee 42s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

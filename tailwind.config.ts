import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // AB&BCRE brand (from abbcre-new-zilla reference)
        abbcre: {
          primary: "#0d4477",
          secondary: "#5289BC",
        },
      },
    },
  },
  plugins: [],
};

export default config;

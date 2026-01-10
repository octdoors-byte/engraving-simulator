import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: ["index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans]
      }
    }
  },
  plugins: []
};

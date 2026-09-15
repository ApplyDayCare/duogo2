import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: {
          DEFAULT: "#F6F1E6",
          dim: "#EFE6D2",
        },
        coral: {
          DEFAULT: "#FF6F5E",
          1: "#FFB79E",
          2: "#FF6F5E",
          light: "#FF7861",
          dark: "#E43F22",
          soft: "#FFF2EE",
          surface: "#FFEBE5",
        },
        oat: {
          DEFAULT: "#FAF7F2",
          light: "#FDFBF8",
          dark: "#EFE8DC",
          border: "#E8E0D2",
        },
        ink: {
          DEFAULT: "#181513",
          muted: "#666059",
          subtle: "#918B82",
        },
        mint: {
          DEFAULT: "#1B825B",
          light: "#34B37D",
          surface: "#EAF8F1",
        },
        forest: {
          DEFAULT: "#1F4D43",
          light: "#2A685B",
          dark: "#14362F",
          surface: "#F0F5F3",
        },
        cream: {
          DEFAULT: "#F8F6F2",
          paper: "#FAF9F6",
          dark: "#EFECE6",
        },
        stone: {
          DEFAULT: "#E8E4DE",
          light: "#F2EFEB",
          dark: "#D1CBC2",
        },
        ochre: {
          DEFAULT: "#C9A227",
          light: "#DFB83B",
          muted: "#F7F2E2",
        },
        sage: {
          DEFAULT: "#B8C7B3",
          light: "#D8E2D4",
          surface: "#EFF4EE",
        },
        dusty: {
          blue: "#7D99B5",
          light: "#EBF1F6",
        },
        terracotta: {
          DEFAULT: "#C77A5C",
          light: "#F9ECE7",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

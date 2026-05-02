const semanticColor = (name: string) => `var(--${name})`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: semanticColor("background"),
        foreground: semanticColor("foreground"),
        surface: {
          DEFAULT: semanticColor("surface"),
          muted: semanticColor("surface-muted"),
          elevated: semanticColor("surface-elevated")
        },
        card: {
          DEFAULT: semanticColor("card"),
          foreground: semanticColor("card-foreground")
        },
        border: {
          DEFAULT: semanticColor("border"),
          subtle: semanticColor("border-subtle")
        },
        input: semanticColor("input"),
        ring: semanticColor("ring"),
        primary: {
          DEFAULT: semanticColor("primary"),
          hover: semanticColor("primary-hover"),
          muted: semanticColor("primary-muted"),
          foreground: semanticColor("primary-foreground")
        },
        accent: {
          DEFAULT: semanticColor("accent"),
          muted: semanticColor("accent-muted")
        },
        success: semanticColor("success"),
        warning: semanticColor("warning"),
        danger: semanticColor("danger"),
        info: semanticColor("info"),
        muted: {
          DEFAULT: semanticColor("muted"),
          foreground: semanticColor("muted-foreground")
        }
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        elevated: "var(--shadow-3)"
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)"
      },
      fontFamily: {
        body: "var(--font-family-body)",
        heading: "var(--font-family-heading)"
      }
    }
  }
};

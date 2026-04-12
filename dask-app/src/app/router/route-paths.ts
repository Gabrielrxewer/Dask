export const routePaths = {
  home: "/",
  login: "/login",
  board: "/board",
  list: "/list",
  timeline: "/timeline",
  automations: "/automations",
  settings: "/settings"
} as const;

export type AppRoutePath = (typeof routePaths)[keyof typeof routePaths];

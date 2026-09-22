import { defineConfig } from "blume";

export default defineConfig({
  title: "InfraKitchen",
  logo: {
    image: "/icon.png",
    text: "InfraKitchen",
  },
  description:
    "Self-service infrastructure provisioning platform built for platform engineering. Reusable templates, blueprints, and AI-agent-ready infrastructure.",
  feedback: false,
  github: {
    owner: "electrolux-oss",
    repo: "infrakitchen",
  },
  content: {
    pages: "docs/pages",
  },
  navigation: {
    sidebar: {
      display: "flat", // "flat" | "group" | "page"
    },
  },
  deployment: {
    site: "https://opensource.electrolux.one/infrakitchen/",
    // GitHub Pages serves the site from the /infrakitchen/ subpath.
    base: "/infrakitchen",
  },
  theme: {
    fonts: {
      display: "geist",
      body: "geist",
      mono: "geist-mono",
    },
  },
});

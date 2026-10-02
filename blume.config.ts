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
  footer: {
    links: [
      {
        href: "https://github.com/electrolux-oss/infrakitchen/releases",
        label: "Changelog",
      },
      {
        href: "https://github.com/electrolux-oss/infrakitchen/issues/new",
        label: "Report an issue",
      },
      {
        href: "https://github.com/electrolux-oss/infrakitchen/blob/main/LICENSE",
        label: "Apache License 2.0",
      },
    ],
    socials: {
      linkedin: "https://www.linkedin.com/company/infrakitchen",
      discord: "https://discord.gg/HAk7caCMf9",
    },
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
    accent: "blue",
    fonts: {
      display: "geist",
      body: "geist",
      mono: "geist-mono",
    },
  },
});

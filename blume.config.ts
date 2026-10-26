import { defineConfig } from "blume";
import { filesystem, githubReleases } from "blume/sources";

export default defineConfig({
  title: "InfraKitchen",
  logo: {
    image: "/icon.png",
    text: "InfraKitchen",
  },
  description:
    "The Open-Source Developer Platform for Humans and Agents.",
  feedback: false,
  github: {
    owner: "electrolux-oss",
    repo: "infrakitchen",
  },
  footer: {
    links: [
      {
        href: "/changelog",
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
    },
    copyright: "© 2026 Electrolux Group",
  },
  content: {
    pages: "docs/pages",
    sources: [
      filesystem({ root: "docs" }),
      githubReleases({
        prefix: "changelog",
        owner: "electrolux-oss",
        repo: "infrakitchen",
      }),
    ],
  },
  lastModified: "git",
  redirects: [{ from: "/infrakitchen", to: "/", status: 301 }],
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

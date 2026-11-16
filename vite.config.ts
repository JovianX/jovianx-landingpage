import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function pagesBase() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) return "/";
  const name = repo.split("/")[1] ?? "";
  if (name.endsWith(".github.io")) return "/";
  return `/${name}/`;
}

export default defineConfig({
  base: pagesBase(),
  plugins: [react()],
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O "base" precisa ter exatamente o nome do repositório no GitHub.
export default defineConfig({
  plugins: [react()],
  base: "/PMC-projeto-merito-coletivo/",
});

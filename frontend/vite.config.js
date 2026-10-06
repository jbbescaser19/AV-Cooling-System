import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],

  /*
    npm run dev:
    http://localhost:5173/

    npm run build:
    /AV-Cooling-System/
  */
  base: command === "serve" ? "/" : "/AV-Cooling-System/",
}));

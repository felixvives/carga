import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Ajustá esto al nombre exacto de tu repo de GitHub si no se llama "carga"
  // (ej: si el repo es "gym-app", esto debe ser "/gym-app/").
  base: "/carga/",
});

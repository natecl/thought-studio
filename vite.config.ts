import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { boardApiPlugin } from "./server/boardApiPlugin";

export default defineConfig({
  plugins: [boardApiPlugin(), react()],
});

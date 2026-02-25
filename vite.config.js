import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/badminton-lineup-react/", // ← 換成你的 repo 名稱，前後要有 /
});
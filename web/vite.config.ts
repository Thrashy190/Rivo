/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = import.meta.dirname;

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig(({ mode }) => {
  // In development the app calls /api, and Vite forwards it to your deployed
  // API, read from RIVO_API_URL in .env.local or the shell. Same-origin
  // requests need no CORS.
  const apiUrl = loadEnv(mode, dirname, "RIVO_").RIVO_API_URL;

  return {
  server: {
    proxy: apiUrl
      ? { "/api": { target: apiUrl, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") } }
      : undefined,
  },
  plugins: [react(), babel({
    presets: [reactCompilerPreset()]
  }), tailwindcss()],
  test: {
    projects: [{
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
};
});

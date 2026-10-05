import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { defineConfig } from "vite"

// https://vite.dev/config/

export default defineConfig(({ mode }) => ({

  // In production, Django serves assets from /static/

  base: mode === 'production' ? '/static/' : '/',

  plugins: [

    react(),

    tailwindcss(),

    tanstackRouter({

      target: 'react',

      autoCodeSplitting: true,

    }),

  ],

  server: {

    port: 5173,

    // Extra Host headers to accept, e.g. when served through the dev gateway
    // behind a public hostname (docker-compose.dev.remote.yml).
    allowedHosts: process.env.DEV_ALLOWED_HOSTS?.split(',').filter(Boolean),

    proxy: {

      '/api': {

        target: 'http://localhost:8000',

        changeOrigin: true,

        secure: false,

      },

    },

  },

  resolve: {

    alias: {

      "@": path.resolve(__dirname, "./src"),

    },

  },

}))
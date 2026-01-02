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
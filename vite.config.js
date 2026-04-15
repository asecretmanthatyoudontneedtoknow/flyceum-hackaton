import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // Главная страница
        main: resolve(__dirname, 'index.html'),
        // Ваша новая страница админки
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})

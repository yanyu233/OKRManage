import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/antd/es/') || id.includes('node_modules/antd/lib/')) {
            const [, rest = 'core'] = id.split(/node_modules\/antd\/(?:es|lib)\//);
            return `antd-${rest.split('/')[0]}`;
          }

          if (id.includes('node_modules/@ant-design/icons')) {
            return 'antd-icons';
          }

          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query';
          }

          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react';
          }

          if (id.includes('node_modules/rc-')) {
            const [, rest = 'rc'] = id.split('node_modules/');
            return rest.split('/')[0];
          }

          return undefined;
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})

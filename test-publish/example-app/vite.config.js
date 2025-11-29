import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // 로컬 패키지를 사용하도록 설정
      'tab-chief': path.resolve(__dirname, '../../dist/index.mjs')
    }
  },
  server: {
    port: 3000,
    open: true
  }
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm', 'iife'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  globalName: 'TabChief',
  outExtension({ format }) {
    switch (format) {
      case 'cjs':
        return { js: '.js', dts: '.d.ts' };
      case 'esm':
        return { js: '.mjs', dts: '.d.mts' };
      case 'iife':
        return { js: '.iife.js' };
      default:
        return { js: '.js' };
    }
  },
});

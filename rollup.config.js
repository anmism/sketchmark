// rollup.config.js — build ESM + CJS bundles
import { defineConfig }  from 'rollup';
import typescript        from '@rollup/plugin-typescript';
import { nodeResolve }   from '@rollup/plugin-node-resolve';

export default defineConfig([
  // ESM
  {
    input:  'src/index.ts',
    output: {
      file:      'dist/index.js',
      format:    'esm',
      sourcemap: true,
    },
    external: ['roughjs'],
    plugins: [
      nodeResolve(),
      typescript({ tsconfig: './tsconfig.json', declaration: true, declarationDir: 'dist' }),
    ],
  },
  // CJS
  {
    input:  'src/index.ts',
    output: {
      file:      'dist/index.cjs',
      format:    'cjs',
      sourcemap: true,
      exports:   'named',
    },
    external: ['roughjs'],
    plugins: [
      nodeResolve(),
      typescript({ tsconfig: './tsconfig.json', declaration: false }),
    ],
  },
  // IIFE (browser CDN build, bundles roughjs)
  {
    input:  'src/index.ts',
    output: {
      file:      'dist/sketchmark.iife.js',
      format:    'iife',
      name:      'AIDiagram',
      sourcemap: false,
      globals:   { roughjs: 'rough' },
    },
    external: ['roughjs'],
    plugins: [
      nodeResolve(),
      typescript({ tsconfig: './tsconfig.json', declaration: false }),
    ],
  },
]);

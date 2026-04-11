import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/setupTests.ts'],
        globals: true,
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        reporters: ['default'],
        outputFile: undefined,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'cobertura'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/**/*.{test,spec}.{ts,tsx}',
                'src/**/*.d.ts',
                'src/**/*.svg',
                'src/**/*.png',
                'src/**/*.jpg',
                'src/**/*.jpeg',
                'src/**/*.gif',
                'src/**/*.webp',
            ],
        },
    },
});

import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import { env } from 'process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baseFolder =
    env.APPDATA !== undefined && env.APPDATA !== ''
        ? `${env.APPDATA}/ASP.NET/https`
        : `${env.HOME}/.aspnet/https`;

const useHttps = !(env.VITE_HTTPS?.toLowerCase() === 'false' || env.VITE_HTTPS === '0');

const certificateName = "analogy.logviewer.client";
const certFilePath = path.join(baseFolder, `${certificateName}.pem`);
const keyFilePath = path.join(baseFolder, `${certificateName}.key`);

if (useHttps) {
    if (!fs.existsSync(baseFolder)) {
        fs.mkdirSync(baseFolder, { recursive: true });
    }

    if (!fs.existsSync(certFilePath) || !fs.existsSync(keyFilePath)) {
        if (0 !== child_process.spawnSync('dotnet', [
            'dev-certs',
            'https',
            '--export-path',
            certFilePath,
            '--format',
            'Pem',
            '--no-password',
        ], { stdio: 'inherit', }).status) {
            throw new Error("Could not create certificate.");
        }
    }
}

const selectLaunchUrl = (urlList, preferHttps) => {
    const candidates = urlList.split(';').map(url => url.trim()).filter(Boolean);
    if (preferHttps) {
        const httpsUrl = candidates.find(url => url.startsWith('https://'));
        if (httpsUrl) return httpsUrl;
    }
    const httpUrl = candidates.find(url => url.startsWith('http://'));
    if (httpUrl) return httpUrl;
    return candidates[0];
};

const getLaunchSettingsTarget = () => {
    const launchSettingsPath = path.join(__dirname, '..', 'Analogy.LogViewer.Server', 'Properties', 'launchSettings.json');
    if (!fs.existsSync(launchSettingsPath)) {
        return undefined;
    }
    try {
        const settings = JSON.parse(fs.readFileSync(launchSettingsPath, 'utf-8'));
        const profiles = settings?.profiles ? Object.values(settings.profiles) : [];
        for (const profile of profiles) {
            if (!profile?.applicationUrl) continue;
            const selected = selectLaunchUrl(profile.applicationUrl, useHttps);
            if (selected) return selected;
        }
    } catch (error) {
        console.warn('Failed to read launchSettings.json for proxy target.', error);
    }
    return undefined;
};

const target = env.ASPNETCORE_HTTPS_PORT
    ? `https://localhost:${env.ASPNETCORE_HTTPS_PORT}`
    : env.ASPNETCORE_URLS
        ? env.ASPNETCORE_URLS.split(';')[0]
        : (getLaunchSettingsTarget() ?? (useHttps ? 'https://localhost:7267' : 'http://localhost:5280'));

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [plugin()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        proxy: {
            '^/api': {
                target,
                secure: false
            },
            '^/providersHub': {
                target,
                secure: false,
                ws: true
            },
            '^/MediaManagerRealtimeData': {
                target,
                secure: false,
                ws: true
            }
        },
        port: parseInt(env.DEV_SERVER_PORT || '49738'),
        https: useHttps ? {
            key: fs.readFileSync(keyFilePath),
            cert: fs.readFileSync(certFilePath),
        } : false
    }
})

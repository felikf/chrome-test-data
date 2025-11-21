#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const distDir = path.join(rootDir, 'dist');
const buildDir = path.join(rootDir, 'build');
const releaseDir = path.join(buildDir, 'chrome-extension');
const zipPath = path.join(buildDir, 'loan-debug-form-helper.zip');

if (!existsSync(distDir)) {
  console.error('dist directory not found. Run "npm run build" first.');
  process.exit(1);
}

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

const copyList = ['manifest.json', 'popup.html', 'styles.css'];
copyList.forEach((file) => {
  copyFileSync(path.join(rootDir, file), path.join(releaseDir, file));
});

cpSync(distDir, path.join(releaseDir, 'dist'), { recursive: true });

const zipCommand = `cd "${releaseDir}" && zip -r "${zipPath}" .`;
execSync(zipCommand, { stdio: 'inherit' });

console.log(`\nPackaged extension ready at ${zipPath}`);

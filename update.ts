#!/usr/bin/env bun
/* eslint-disable no-console */
import fs from 'fs';
import { Logger } from '@paperdave/logger';

Logger.info('Checking updates.');

const meta = 'https://www.blackmagicdesign.com/api/support/us/downloads.json';
const { downloads } = await fetch(meta).then(res => res.json());

const pkgbuildLines = fs.readFileSync('PKGBUILD', 'utf8').split('\n');

function setVar(name: string, value: string) {
  for (let i = 0; i < pkgbuildLines.length; i++) {
    if (pkgbuildLines[i].startsWith(name + '=')) {
      pkgbuildLines[i] = `${name}=${value}`;
      return;
    }
  }
  throw new Error(`Cannot find var ${name} in PKGBUILD`);
}

const pkgver = pkgbuildLines
  .find(line => line.startsWith('pkgver='))
  ?.split('=')[1]
  .trim();

const latest = downloads.find((d: any) => d.releaseNotesTitle.startsWith('Fusion Studio'));

const r = latest.urls.Linux[0];
const newVersion = `${r.major}.${r.minor}.${r.releaseNum}`.replace(/\.0\b/g, '');
if (newVersion !== pkgver) {
  setVar('_downloadid', r.downloadId);
  setVar('pkgver', newVersion);
  setVar('pkgrel', '1');

  fs.writeFileSync('PKGBUILD', pkgbuildLines.join('\n'));

  const downloadPath = `fusion-studio-${newVersion}.tar.gz`;

  Logger.info(`Downloading Fusion Studio v${newVersion}`);
  const proc = Bun.spawn({
    cmd: ['bash', 'PKGBUILD', '-d', downloadPath],
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  if ((await proc.exited) === 0) {
    Logger.success(`Downloaded Fusion Studio v${newVersion}`);
  } else {
    Logger.error(`Failed to download Fusion Studio v${newVersion}`);
    process.exit(1);
  }

  const sha256sum = new TextDecoder().decode(
    Bun.spawnSync({
      cmd: ['sha256sum', downloadPath],
      stdio: ['inherit', 'pipe', 'inherit'],
    }).stdout
  );

  setVar('sha256sums', `(${sha256sum.split(' ')[0]})`);

  fs.writeFileSync('PKGBUILD', pkgbuildLines.join('\n'));

  console.info(`Updated PKGBUILD to ${newVersion}`);

  const { exitCode } = Bun.spawnSync({
    cmd: ['makepkg', '-i'],
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  if (exitCode === 0) {
    Logger.success(`Installed Fusion Studio v${newVersion}`);
  } else {
    Logger.error(`Failed to install Fusion Studio v${newVersion}`);
    process.exit(1);
  }

  Logger.info('Deploying to AUR');

  Bun.spawnSync({
    cmd: ['makepkg', '--printsrcinfo'],
    stdio: ['inherit', Bun.file('.SRCINFO'), 'inherit'],
  });
  Bun.spawnSync({
    cmd: ['bash', 'push-update.sh', newVersion],
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  Bun.spawnSync({
    cmd: ['bash', 'clean.sh'],
    stdio: ['inherit', 'inherit', 'inherit'],
  });
} else {
  Logger.info('Already up to date');
}

import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

type SharedConfig = {
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: string | false;
};

function readDepVersion(pkg: string): string {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
  );
  const version =
    pkgJson.dependencies?.[pkg] ?? pkgJson.devDependencies?.[pkg];
  if (!version) {
    throw new Error(`Missing dependency ${pkg} in mds-ui/package.json`);
  }
  return version;
}

const SHARED_PACKAGES = [
  '@angular/core',
  '@angular/common',
  '@angular/common/http',
  '@angular/animations',
  '@angular/platform-browser',
  '@angular/platform-browser-dynamic',
  '@angular/router',
  '@angular/forms',
  '@angular/cdk',
  '@angular/material',
  'rxjs',
  'rxjs/operators',
  '@ngrx/store',
  '@ngx-translate/core',
] as const;

function buildShared(): Record<string, SharedConfig> {
  const shared: Record<string, SharedConfig> = {};
  for (const name of SHARED_PACKAGES) {
    const root = name.startsWith('rxjs/')
      ? 'rxjs'
      : name.startsWith('@angular/common/')
        ? '@angular/common'
        : name;
    shared[name] = {
      singleton: true,
      strictVersion: true,
      requiredVersion: readDepVersion(root),
    };
  }
  return shared;
}

export const mfShared = buildShared();

export const MF_REMOTE_PORTS: Record<string, number> = {
  'remote-auth': 4201,
  'remote-projects': 4202,
  'remote-warehouses': 4203,
  'remote-tables': 4204,
  'remote-explorer': 4205,
  'remote-charts': 4206,
  'remote-dashboards': 4207,
  'remote-lineage': 4208,
  'remote-ai': 4209,
  'remote-export': 4210,
};

export type ClassicMfOptions = {
  name: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
};

/** Classic webpack MF plugin. Remote exposes use `./apps/<app>/src/app/remote-entry/entry.routes.ts`. */
export function createMfPlugin(options: ClassicMfOptions) {
  return new ModuleFederationPlugin({
    name: options.name,
    filename: 'remoteEntry.js',
    exposes: options.exposes,
    remotes: options.remotes,
    shared: mfShared,
    library: { type: 'module' },
  });
}

export function withClassicModuleFederation(options: ClassicMfOptions) {
  return (config: Record<string, any>) => {
    config.output = {
      ...(config.output ?? {}),
      uniqueName: options.name,
      publicPath: 'auto',
    };
    config.experiments = {
      ...(config.experiments ?? {}),
      outputModule: true,
    };
    config.optimization = {
      ...(config.optimization ?? {}),
      runtimeChunk: false,
    };
    config.plugins = [...(config.plugins ?? []), createMfPlugin(options)];
    return config;
  };
}

/** Shell host remotes map: bare `http://localhost:PORT/remoteEntry.js` (see MF_REMOTE_PORTS). */
export function shellDevRemotes(): Record<string, string> {
  const remotes: Record<string, string> = {};
  for (const [name, port] of Object.entries(MF_REMOTE_PORTS)) {
    remotes[name] = `http://localhost:${port}/remoteEntry.js`;
  }
  return remotes;
}

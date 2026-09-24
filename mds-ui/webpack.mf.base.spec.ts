import {
  mfShared,
  createMfPlugin,
  MF_REMOTE_PORTS,
} from './webpack.mf.base';

describe('webpack.mf.base', () => {
  it('shares Angular Material and CDK as singletons', () => {
    expect(mfShared['@angular/material']).toEqual(
      expect.objectContaining({ singleton: true, strictVersion: true }),
    );
    expect(mfShared['@angular/cdk']).toEqual(
      expect.objectContaining({ singleton: true, strictVersion: true }),
    );
    expect(mfShared['@angular/core']).toEqual(
      expect.objectContaining({ singleton: true, strictVersion: true }),
    );
  });

  it('maps remote-auth to port 4201', () => {
    expect(MF_REMOTE_PORTS['remote-auth']).toBe(4201);
  });

  it('createMfPlugin uses classic container plugin and remoteEntry.js', () => {
    const plugin = createMfPlugin({
      name: 'remote-auth',
      exposes: {
        './Routes': 'apps/remote-auth/src/app/remote-entry/entry.routes.ts',
      },
    });
    expect(plugin.constructor.name).toMatch(/ModuleFederationPlugin/);
    const opts = (plugin as { _options?: Record<string, unknown> })._options
      ?? (plugin as { options?: Record<string, unknown> }).options;
    // Prefer reading via plugin options field webpack exposes; if internal, assert filename via JSON.stringify(plugin)
    const serialized = JSON.stringify(plugin);
    expect(serialized).toContain('remoteEntry.js');
    expect(serialized).toContain('remote-auth');
  });
});

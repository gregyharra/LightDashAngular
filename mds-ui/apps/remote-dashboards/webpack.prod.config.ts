import { withClassicModuleFederation } from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-dashboards',
  exposes: {
    './Routes':
      './apps/remote-dashboards/src/app/remote-entry/entry.routes.ts',
  },
});

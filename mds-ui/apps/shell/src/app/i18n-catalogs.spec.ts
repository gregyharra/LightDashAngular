import en from '../assets/i18n/en.json';
import fr from '../assets/i18n/fr.json';
import aiEn from '../assets/i18n/ai/en.json';
import aiFr from '../assets/i18n/ai/fr.json';
import authEn from '../assets/i18n/auth/en.json';
import authFr from '../assets/i18n/auth/fr.json';
import chartsEn from '../assets/i18n/charts/en.json';
import chartsFr from '../assets/i18n/charts/fr.json';
import dashboardsEn from '../assets/i18n/dashboards/en.json';
import dashboardsFr from '../assets/i18n/dashboards/fr.json';
import lineageEn from '../assets/i18n/lineage/en.json';
import lineageFr from '../assets/i18n/lineage/fr.json';
import projectsEn from '../assets/i18n/projects/en.json';
import projectsFr from '../assets/i18n/projects/fr.json';
import tablesEn from '../assets/i18n/tables/en.json';
import tablesFr from '../assets/i18n/tables/fr.json';
import warehousesEn from '../assets/i18n/warehouses/en.json';
import warehousesFr from '../assets/i18n/warehouses/fr.json';

function keys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

const catalogs: Record<string, { en: unknown; fr: unknown }> = {
  root: { en, fr },
  ai: { en: aiEn, fr: aiFr },
  auth: { en: authEn, fr: authFr },
  charts: { en: chartsEn, fr: chartsFr },
  dashboards: { en: dashboardsEn, fr: dashboardsFr },
  lineage: { en: lineageEn, fr: lineageFr },
  projects: { en: projectsEn, fr: projectsFr },
  tables: { en: tablesEn, fr: tablesFr },
  warehouses: { en: warehousesEn, fr: warehousesFr },
};

describe('i18n catalogs', () => {
  for (const [name, { en: e, fr: f }] of Object.entries(catalogs)) {
    describe(name, () => {
      it('en and fr share the same key tree', () => {
        expect(keys(f).sort()).toEqual(keys(e).sort());
      });

      it('has no empty string leaves in en or fr', () => {
        for (const catalog of [e, f]) {
          for (const path of keys(catalog)) {
            const parts = path.split('.');
            let cur: unknown = catalog;
            for (const p of parts) cur = (cur as Record<string, unknown>)[p];
            expect(typeof cur).withContext(path).toBe('string');
            expect(cur as string).withContext(path).not.toBe('');
          }
        }
      });
    });
  }

  it('does not define the same key in more than one catalog', () => {
    const seen = new Map<string, string>();
    for (const [name, { en: e }] of Object.entries(catalogs)) {
      for (const key of keys(e)) {
        expect(seen.get(key))
          .withContext(`${key} in ${name} and ${seen.get(key)}`)
          .toBeUndefined();
        seen.set(key, name);
      }
    }
  });
});

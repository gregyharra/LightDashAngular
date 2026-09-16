import en from '../../../assets/i18n/en.json';
import fr from '../../../assets/i18n/fr.json';

function keys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('i18n catalogs', () => {
  it('en and fr share the same key tree', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it('has no empty string leaves in en or fr', () => {
    for (const catalog of [en, fr]) {
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

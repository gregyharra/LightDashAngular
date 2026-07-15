import { expect, test, type Page } from '@playwright/test';

const PROJECT_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const DASHBOARD_UUID = 'd4e5f6a7-b8c9-0123-def0-234567890123';

type TilePosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function tilesCollide(a: TilePosition, b: TilePosition): boolean {
  return !(
    a.x + a.w <= b.x ||
    a.x >= b.x + b.w ||
    a.y + a.h <= b.y ||
    a.y >= b.y + b.h
  );
}

async function readTilePositions(page: Page): Promise<TilePosition[]> {
  return page.evaluate(() => {
    return [...document.querySelectorAll('.dashboard-edit__tile-wrap')].map((element) => {
      const style = getComputedStyle(element);
      return {
        x: Number.parseInt(style.getPropertyValue('--tile-x'), 10),
        y: Number.parseInt(style.getPropertyValue('--tile-y'), 10),
        w: Number.parseInt(style.getPropertyValue('--tile-w'), 10),
        h: Number.parseInt(style.getPropertyValue('--tile-h'), 10),
      };
    });
  });
}

function layoutHasOverlaps(tiles: TilePosition[]): boolean {
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tilesCollide(tiles[i], tiles[j])) {
        return true;
      }
    }
  }
  return false;
}

async function dragTileHandle(
  page: Page,
  handleIndex: number,
  deltaX: number,
  deltaY: number,
): Promise<void> {
  await page.evaluate(
    ({ index, deltaX, deltaY }) => {
      const handles = [
        ...document.querySelectorAll<HTMLElement>('.dashboard-edit__tile-drag-handle'),
      ];
      const handle = handles[index];
      const wrap = handle?.closest<HTMLElement>('.dashboard-edit__tile-wrap');
      if (!handle || !wrap) {
        throw new Error('Tile drag handle not found');
      }

      const rect = handle.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const endX = startX + deltaX;
      const endY = startY + deltaY;
      const pointerId = 42;

      const dispatch = (
        type: 'pointerdown' | 'pointermove' | 'pointerup',
        clientX: number,
        clientY: number,
        buttons: number,
      ) => {
        const event = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          pointerId,
          pointerType: 'mouse',
          button: 0,
          buttons,
        });
        handle.dispatchEvent(event);
      };

      dispatch('pointerdown', startX, startY, 1);
      dispatch('pointermove', startX + deltaX * 0.25, startY + deltaY * 0.25, 1);
      dispatch('pointermove', startX + deltaX * 0.5, startY + deltaY * 0.5, 1);
      dispatch('pointermove', endX, endY, 1);
      dispatch('pointerup', endX, endY, 0);
    },
    { index: handleIndex, deltaX, deltaY },
  );

  await page.waitForTimeout(100);
}

test('dragging a tile over another rearranges without overlap and persists on save', async ({
  page,
}) => {
  await page.goto(
    `/projects/${PROJECT_UUID}/dashboards/${DASHBOARD_UUID}/edit`,
  );

  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

  const before = await readTilePositions(page);
  expect(before.length).toBeGreaterThan(1);
  expect(layoutHasOverlaps(before)).toBe(false);

  await dragTileHandle(page, 2, -320, 0);

  const afterDrag = await readTilePositions(page);
  expect(layoutHasOverlaps(afterDrag)).toBe(false);
  expect(afterDrag).not.toEqual(before);

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/projects/${PROJECT_UUID}/dashboards/${DASHBOARD_UUID}$`),
  );
  await expect(page.locator('.dashboard-view__grid .dashboard-tile')).toHaveCount(
    afterDrag.length,
  );

  const afterSave = await page.evaluate(() => {
    return [...document.querySelectorAll('.dashboard-view__grid .dashboard-tile')].map(
      (element) => {
      const style = getComputedStyle(element);
      return {
        x: Number.parseInt(style.getPropertyValue('--tile-x'), 10),
        y: Number.parseInt(style.getPropertyValue('--tile-y'), 10),
        w: Number.parseInt(style.getPropertyValue('--tile-w'), 10),
        h: Number.parseInt(style.getPropertyValue('--tile-h'), 10),
      };
    },
    );
  });

  expect(afterSave.length).toBe(afterDrag.length);
  expect(layoutHasOverlaps(afterSave)).toBe(false);
  expect(afterSave).toEqual(afterDrag);
});

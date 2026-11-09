import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

test('face reacts to poke, tickle, keyboard, and recovers', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  const face = page.locator('#face');
  await face.click({ position: { x: 120, y: 120 } });
  await expect(face).toHaveAttribute('data-expression', 'ouch');
  await expect(face).toHaveAttribute('data-expression', 'idle', { timeout: 2000 });
  const box = (await face.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  for (const x of [140, 80, 140, 80]) await page.mouse.move(box.x + x, box.y + 100);
  await expect(face).toHaveAttribute('data-expression', 'laugh');
  await page.mouse.up();
  await face.focus();
  await page.keyboard.press('s');
  await page.waitForTimeout(1450);
  await page.keyboard.press('s');
  await expect(face).toHaveAttribute('data-expression', 'shake');
  expect(errors).toEqual([]);
});

test('red button shows heart eyes and the exact love bubble, then returns to a smile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const face = page.locator('#face');
  const button = page.getByRole('button', { name: 'Pause game, or send love', exact: true });
  const bubble = page.locator('.speech-bubble');
  await button.click();
  await expect(face).toHaveAttribute('data-expression', 'love');
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveText('I love you Azalea');
  await expect(page.locator('#reaction-status')).toHaveText('I love you Azalea');
  const hearts = page.locator('.heart-eye');
  await expect(hearts).toHaveCount(2);
  for (const heart of await hearts.all()) await expect(heart).toHaveCSS('opacity', '1');
  await expect(page.locator('.face-hint')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('beemo-love.png') });
  await expect(face).toHaveAttribute('data-expression', 'idle', { timeout: 5000 });
  await expect(bubble).toBeHidden();
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(bubble).toBeVisible();
  await face.click();
  await expect(face).toHaveAttribute('data-expression', 'ouch');
  await expect(bubble).toBeHidden();
});

test('love bubble fits short landscape screens with reduced motion and clears when leaving home', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: 'Pause game, or send love', exact: true }).click();
  const bubble = page.locator('.speech-bubble');
  await expect(bubble).toBeVisible();
  const box = (await bubble.boundingBox())!;
  const screen = (await page.locator('.screen').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(screen.x);
  expect(box.y).toBeGreaterThanOrEqual(screen.y);
  expect(box.x + box.width).toBeLessThanOrEqual(screen.x + screen.width);
  expect(box.y + box.height).toBeLessThanOrEqual(screen.y + screen.height);
  await page.getByRole('button', { name: 'Open game', exact: true }).click();
  await expect(bubble).toBeHidden();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  await page.getByRole('button', { name: 'Pause game, or send love', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Take a breath.' })).toBeVisible();
  await expect(bubble).toBeHidden();
  await page.getByRole('button', { name: 'Pause game, or send love', exact: true }).click();
  await expect(page.locator('.game-overlay')).toBeHidden();
});

test('game starts, responds to controls, pauses, and survives home navigation', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open game', exact: true }).click();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  await expect(page.locator('.game-overlay')).toBeHidden();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('x');
  await page.keyboard.press('Space');
  await expect(page.locator('#score')).not.toHaveText('0');
  await page.getByRole('button', { name: 'Pause game, or send love', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Take a breath.' })).toBeVisible();
  const score = await page.locator('#score').textContent();
  await page.getByRole('button', { name: 'Return to face', exact: true }).click();
  await expect(page.locator('#face')).toBeVisible();
  await page.getByRole('button', { name: 'Open game', exact: true }).click();
  await expect(page.locator('#score')).toHaveText(score!);
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await page.setViewportSize({ width: 900, height: 600 });
  await expect(page.locator('.game-overlay')).toBeVisible();
});

test('menu controls save volume and mute, provide shake fallback, and respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await page.getByRole('button', { name: 'Open settings and help', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('#volume').fill('0.2');
  await page.getByRole('button', { name: 'Try a shake reaction', exact: true }).click();
  await expect(page.locator('#face')).toHaveAttribute('data-expression', 'shake');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open settings and help', exact: true }).click();
  await expect(page.locator('#volume')).toHaveValue('0.2');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('console fits phone, short landscape, tablet, and desktop with usable controls', async ({ page }) => {
  await page.goto('./');
  for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width: width!, height: height! });
    const layout = await page.evaluate(() => {
      const controls = [...document.querySelectorAll<HTMLElement>('.physical')].map(button => {
        const { x, y, width, height } = button.getBoundingClientRect();
        return { label: button.getAttribute('aria-label'), x, y, width, height };
      });
      return {
        viewport: { width: innerWidth, height: innerHeight },
        scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        controls,
      };
    });
    expect(layout.scroll.width).toBeLessThanOrEqual(width!);
    expect(layout.scroll.height).toBeLessThanOrEqual(height!);
    for (const control of layout.controls) {
      expect(control.width, `${width}x${height}: ${control.label} width`).toBeGreaterThanOrEqual(43.5);
      expect(control.height, `${width}x${height}: ${control.label} height`).toBeGreaterThanOrEqual(43.5);
      expect(control.x).toBeGreaterThanOrEqual(0);
      expect(control.y).toBeGreaterThanOrEqual(0);
      expect(control.x + control.width).toBeLessThanOrEqual(width! + 1);
      expect(control.y + control.height).toBeLessThanOrEqual(height! + 1);
    }
    for (let a = 0; a < layout.controls.length; a++) {
      for (let b = a + 1; b < layout.controls.length; b++) {
        const one = layout.controls[a]!, two = layout.controls[b]!;
        const overlapX = Math.min(one.x + one.width, two.x + two.width) - Math.max(one.x, two.x);
        const overlapY = Math.min(one.y + one.height, two.y + two.height) - Math.max(one.y, two.y);
        expect(overlapX > 1 && overlapY > 1, `${width}x${height}: ${one.label} overlaps ${two.label}`).toBe(false);
      }
    }
  }
});

test('caches the full app and voices for an offline reload under the Pages path', async ({ page, context }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open settings and help', exact: true }).click();
  await expect(page.locator('#offline-status')).toHaveText('Ready for offline play', { timeout: 20000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#face')).toBeVisible();
  const clips = await page.evaluate(async () => {
    const audio = new AudioContext();
    const lengths = await Promise.all(['ouch', 'hey', 'giggle'].map(async name => {
      const response = await fetch(`/beemo/audio/${name}.wav`);
      const decoded = await audio.decodeAudioData(await response.arrayBuffer());
      return decoded.duration;
    }));
    await audio.close();
    return lengths;
  });
  expect(clips.every(length => length > 0.3)).toBe(true);
  await page.getByRole('button', { name: 'Open game', exact: true }).click();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  await page.keyboard.press('Space');
  await expect(page.locator('#score')).not.toHaveText('0');
  await context.setOffline(false);
});

test('offers a real service-worker update without interrupting play', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.getByRole('button', { name: 'Open game', exact: true }).click();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  const original = await readFile('dist/sw.js', 'utf8');
  try {
    await writeFile('dist/sw.js', `${original}\n// update integration check ${Date.now()}\n`);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration('/beemo/');
      if (!registration) throw new Error('Missing worker registration');
      await registration.update();
    });
    await expect(page.locator('#update')).not.toHaveAttribute('hidden', { timeout: 15000 });
    await expect(page.locator('.game-overlay')).toBeHidden();
    await page.getByRole('button', { name: 'Open settings and help', exact: true }).click();
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Update available · restart app', exact: true }).click(),
    ]);
    await expect(page.locator('#face')).toBeVisible();
  } finally {
    await writeFile('dist/sw.js', original);
  }
});

test.describe('touch play', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('uses real touch input and leaves no stuck control on cancellation', async ({ page }) => {
    await page.goto('./');
    await page.locator('#face').tap();
    await expect(page.locator('#face')).toHaveAttribute('data-expression', 'ouch');
    await page.getByRole('button', { name: 'Open game', exact: true }).tap();
    await page.getByRole('button', { name: "Let's play", exact: true }).tap();
    await page.locator('[data-control="drop"]').tap();
    await expect(page.locator('#score')).not.toHaveText('0');
    await page.locator('[data-control="left"]').dispatchEvent('pointercancel', { pointerId: 99 });
    expect(await page.locator('.pressed').count()).toBe(0);
    await page.locator('[data-control="pause"]').tap();
    await expect(page.getByRole('button', { name: 'Keep playing', exact: true })).toBeVisible();
  });
});

test('captures face design and measures next-frame feedback on the test host', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.screenshot({ path: testInfo.outputPath('beemo-home.png') });
  const timing = await page.locator('#face').evaluate(async element => {
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) {
      const start = performance.now();
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise<void>(resolve => requestAnimationFrame(() => { samples.push(performance.now() - start); resolve(); }));
    }
    return samples.sort((a, b) => a - b)[Math.floor(samples.length * 0.95)]!;
  });
  expect(timing).toBeLessThan(50);
  await testInfo.attach('next-frame-feedback.json', { body: JSON.stringify({ host: 'Automated desktop browser, 390x844 viewport', p95Milliseconds: timing }), contentType: 'application/json' });
  await page.waitForTimeout(170);
  await page.screenshot({ path: testInfo.outputPath('beemo-ouch.png') });
  await page.getByRole('button', { name: 'Open game', exact: true }).click();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  await page.keyboard.press('Space');
  await page.screenshot({ path: testInfo.outputPath('beemo-game.png') });
});

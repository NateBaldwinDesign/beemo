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
  await expect(face).toHaveAttribute('data-expression', 'dizzy');
  expect(errors).toEqual([]);
});

for (const [width, height] of [[390, 844], [844, 390], [1440, 900]] as const) {
  test.describe(`eye targets at ${width}x${height}`, () => {
    test.use({ viewport: { width, height } });
    test('eye taps follow each rendered eye with exact 32px touch targets', async ({ page }, testInfo) => {
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto('./');
      const face = page.locator('#face');
      for (const index of [0, 1]) {
        const eye = page.locator('.eye').nth(index);
        const center = await eye.evaluate(element => {
          const matrix = (element as SVGGraphicsElement).getScreenCTM()!;
          return { x: matrix.e, y: matrix.f };
        });
        await page.mouse.click(center.x, center.y);
        await expect(face).toHaveAttribute('data-expression', 'wink');
        await page.clock.runFor(160);
        await expect(eye).toHaveAttribute('data-closed', 'true');
        await expect(page.locator('.eye').nth(index === 0 ? 1 : 0)).toHaveAttribute('data-closed', 'false');
        if (width === 390 && index === 1) {
          await page.screenshot({ path: testInfo.outputPath('eye-wince.png') });
        }
        const currentCenter = await eye.evaluate(element => {
          const matrix = (element as SVGGraphicsElement).getScreenCTM()!;
          return { x: matrix.e, y: matrix.f };
        });
        await page.mouse.click(currentCenter.x + 17, currentCenter.y);
        await expect(face).toHaveAttribute('data-expression', 'ouch');
        await page.clock.runFor(650);
        await expect(face).toHaveAttribute('data-expression', 'idle');
        await page.clock.runFor(260);
      }
      await face.focus();
      await page.keyboard.press('1');
      await page.clock.runFor(160);
      await expect(page.locator('.eye').nth(0)).toHaveAttribute('data-closed', 'true');
      await page.keyboard.press('2');
      await page.clock.runFor(160);
      await expect(page.locator('.eye').nth(1)).toHaveAttribute('data-closed', 'true');
    });
  });
}

test('quiet-time blinks and yawns do not erase or interrupt user reactions', async ({ page }, testInfo) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('./');
  const face = page.locator('#face');
  await page.clock.runFor(4999);
  await expect(face).toHaveAttribute('data-expression', 'idle');
  await page.clock.runFor(5000);
  // Every permitted blink has started by now; it may already have recovered.
  await page.clock.runFor(20001);
  await expect(face).toHaveAttribute('data-expression', 'yawn');
  await page.clock.runFor(350);
  await expect(page.locator('.eye').nth(0)).toHaveAttribute('data-closed', 'true');
  await page.screenshot({ path: testInfo.outputPath('yawn.png') });
  await face.focus();
  await page.keyboard.press('Enter');
  await expect(face).toHaveAttribute('data-expression', 'ouch');
  await page.clock.runFor(29999);
  await expect(face).not.toHaveAttribute('data-expression', 'yawn');
  await page.clock.runFor(1);
  await expect(face).toHaveAttribute('data-expression', 'yawn');
});

test('additional expressions follow existing reactions and yield to new input', async ({ page }, testInfo) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('./');
  const face = page.locator('#face');
  await face.focus();
  for (let count = 0; count < 3; count++) {
    await page.keyboard.press('Enter');
    await expect(face).toHaveAttribute('data-expression', 'ouch');
    await page.clock.runFor(100);
  }
  await page.clock.runFor(750);
  await expect(face).toHaveAttribute('data-expression', 'grimace');
  await page.screenshot({ path: testInfo.outputPath('grimace.png') });
  await page.keyboard.press('t');
  await expect(face).toHaveAttribute('data-expression', 'laugh');
  await page.clock.runFor(1050);
  await expect(face).toHaveAttribute('data-expression', 'delighted');
  await page.screenshot({ path: testInfo.outputPath('delighted.png') });
  await page.keyboard.press('s');
  await expect(face).toHaveAttribute('data-expression', 'shake');
  await page.clock.runFor(1600);
  await page.keyboard.press('s');
  await expect(face).toHaveAttribute('data-expression', 'dizzy');
  await page.clock.runFor(200);
  await page.screenshot({ path: testInfo.outputPath('dizzy.png') });
  await page.clock.runFor(1400);
  await expect(face).toHaveAttribute('data-expression', 'frown');
  await page.screenshot({ path: testInfo.outputPath('frown.png') });
  await page.locator('[data-control="drop"]').click();
  await expect(face).toHaveAttribute('data-expression', 'hello');
  await page.clock.runFor(850);
  await expect(face).toHaveAttribute('data-expression', 'content');
  await page.screenshot({ path: testInfo.outputPath('content.png') });
  await page.locator('[data-control="pause"]').click();
  await expect(face).toHaveAttribute('data-expression', 'love');
  await expect(page.locator('.speech-bubble')).toBeVisible();
  await page.clock.runFor(3200);
  await expect(face).toHaveAttribute('data-expression', 'happy');
  await expect(page.locator('.speech-bubble')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('happy.png') });
  await face.focus();
  await page.keyboard.press('Enter');
  await expect(face).toHaveAttribute('data-expression', 'ouch');
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
  await page.locator('[data-game="blocks"]').click();
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
  await page.locator('[data-game="blocks"]').click();
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
  await page.locator('[data-game="blocks"]').click();
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
  await page.locator('[data-game="blocks"]').click();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  await page.keyboard.press('Space');
  await expect(page.locator('#score')).not.toHaveText('0');
  for (const id of ['stars', 'crossing']) {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Choose game', exact: true }).click();
    await page.locator(`[data-game="${id}"]`).click();
    await page.getByRole('button', { name: "Let's play", exact: true }).click();
    await expect(page.locator('.game-overlay')).toBeHidden();
    await page.keyboard.press('Space');
    if (id === 'crossing') await expect(page.locator('#score')).toHaveText('1');
  }
  await context.setOffline(false);
});

test('offers a real service-worker update without interrupting play', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.getByRole('button', { name: 'Open game', exact: true }).click();
  await page.locator('[data-game="blocks"]').click();
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
    await page.locator('[data-game="blocks"]').tap();
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
  await page.locator('[data-game="blocks"]').click();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  await page.keyboard.press('Space');
  await page.screenshot({ path: testInfo.outputPath('beemo-game.png') });
});

test('arcade choices fit small screens with at least 44px touch targets', async ({ page }, testInfo) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open game', exact: true }).click();
  for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width: width!, height: height! });
    const screen = (await page.locator('.screen').boundingBox())!;
    for (const choice of await page.locator('.game-choice').all()) {
      const box = (await choice.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.y).toBeGreaterThanOrEqual(screen.y);
      expect(box.y + box.height).toBeLessThanOrEqual(screen.y + screen.height);
    }
    if (width === 568) await page.screenshot({ path: testInfo.outputPath('arcade-short-landscape.png') });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('arcade-picker.png') });
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-game="stars"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#game-title')).toHaveText('Star Patrol');
});

test('Star Patrol supports held keyboard fire, movement, and a safe pause', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Open game', exact: true }).click();
  await page.locator('[data-game="stars"]').click();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  await expect(page.locator('#detail-label')).toHaveText('LIVES');
  const before = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
  await page.keyboard.press('ArrowLeft');
  expect(await page.locator('canvas').evaluate(canvas => canvas.toDataURL())).not.toBe(before);
  await page.keyboard.down('Space');
  await page.clock.runFor(420);
  const yellowPixels = await page.locator('canvas').evaluate(canvas => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let yellow = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 255 && data[i + 1] === 225 && data[i + 2] === 83) yellow++;
    }
    return yellow / (canvas.width / 360) ** 2;
  });
  expect(yellowPixels).toBeGreaterThanOrEqual(30);
  await page.keyboard.up('Space');
  await page.screenshot({ path: testInfo.outputPath('star-patrol.png') });
  await page.keyboard.press('Escape');
  const paused = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
  await page.clock.runFor(3000);
  expect(await page.locator('canvas').evaluate(canvas => canvas.toDataURL())).toBe(paused);
  await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
  await page.clock.runFor(1400);
  const released = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
  expect(released).not.toBe(paused);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('heading', { name: 'Take a breath.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('games keep separate paused sessions and best scores without losing face reactions', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('./');
  await page.getByRole('button', { name: 'Open game', exact: true }).click();
  await page.locator('[data-game="blocks"]').click();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  await page.keyboard.press('Space');
  const blocksScore = await page.locator('#score').textContent();
  const blocksBoard = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Choose game', exact: true }).click();
  await page.locator('[data-game="crossing"]').click();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#score')).toHaveText('1');
  await page.clock.runFor(200);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  const crossingBoard = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
  await page.getByRole('button', { name: 'Choose game', exact: true }).click();
  await expect(page.locator('[data-best="crossing"]')).toHaveText('BEST 1');
  await expect(page.locator('[data-best="stars"]')).toHaveText('BEST 0');
  await page.locator('[data-game="blocks"]').click();
  await expect(page.locator('#score')).toHaveText(blocksScore!);
  expect(await page.locator('canvas').evaluate(canvas => canvas.toDataURL())).toBe(blocksBoard);
  await page.getByRole('button', { name: 'Choose game', exact: true }).click();
  await page.locator('[data-game="crossing"]').click();
  expect(await page.locator('canvas').evaluate(canvas => canvas.toDataURL())).toBe(crossingBoard);
  await expect(page.getByRole('button', { name: 'Keep playing', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Return to face', exact: true }).click();
  await page.locator('[data-control="pause"]').click();
  await expect(page.locator('.speech-bubble')).toHaveText('I love you Azalea');
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('beemo-pocket:v1')!));
  expect(saved.best).toBe(Number(blocksScore));
  expect(saved.bestCrossing).toBe(1);
  expect(saved.bestStars).toBe(0);
});

test.describe('new arcade touch controls', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('fires with both buttons and hops with the pad and action buttons', async ({ page }, testInfo) => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto('./');
    await page.getByRole('button', { name: 'Open game', exact: true }).tap();
    await page.locator('[data-game="stars"]').tap();
    await page.getByRole('button', { name: "Let's play", exact: true }).tap();
    const idle = await page.locator('canvas').evaluate(canvas => canvas.toDataURL());
    await page.locator('[data-control="rotate"]').tap();
    expect(await page.locator('canvas').evaluate(canvas => canvas.toDataURL())).not.toBe(idle);
    await page.clock.runFor(200);
    await page.locator('[data-control="drop"]').tap();
    await page.locator('[data-control="pause"]').tap();
    await page.getByRole('button', { name: 'Choose game', exact: true }).tap();
    await page.locator('[data-game="crossing"]').tap();
    await page.getByRole('button', { name: "Let's play", exact: true }).tap();
    await page.locator('[data-control="rotate"]').tap();
    await expect(page.locator('#score')).toHaveText('1');
    await page.clock.runFor(200);
    await page.locator('[data-control="right"]').tap();
    await page.clock.runFor(200);
    await page.screenshot({ path: testInfo.outputPath('pixel-crossing.png') });
    await page.locator('[data-control="down"]').tap();
    await expect(page.locator('#score')).toHaveText('1');
    await page.clock.runFor(200);
    await page.locator('[data-control="drop"]').tap();
    await expect(page.locator('#score')).toHaveText('1');
    await page.setViewportSize({ width: 568, height: 320 });
    await expect(page.getByRole('heading', { name: 'Take a breath.' })).toBeVisible();
    await expect(page.locator('.pressed')).toHaveCount(0);
    for (const selector of ['#game-action', '#restart', '#choose-game']) {
      const button = page.locator(selector);
      await button.scrollIntoViewIfNeeded();
      const box = (await button.boundingBox())!;
      const screen = (await page.locator('.screen').boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y).toBeGreaterThanOrEqual(screen.y);
      expect(box.y + box.height).toBeLessThanOrEqual(screen.y + screen.height);
    }
  });
});

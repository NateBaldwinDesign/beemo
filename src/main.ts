import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';
import { RobotAudio } from './audio/audio';
import { Face, type Reaction } from './face/face';
import { TickleGesture, type HeldDirection } from './input/gestures';
import { MotionInput } from './input/motion';
import { GameView } from './game/view';
import type { Game } from './game/rules';
import { DEFAULTS, loadPreferences, savePreferences } from './storage';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="console" aria-label="Beemo pocket console">
    <section class="display-unit" aria-label="Console display">
      <div class="screen" data-mode="home">
        <div class="screen-caption" aria-hidden="true"><span>HELLO, FRIEND</span><span class="signal">• • •</span></div>
        <div id="face" class="face" role="button" tabindex="0" aria-label="Beemo's face. Tap to poke, rub side to side to tickle."></div>
        <div class="face-hint" aria-hidden="true">a little company. a little play.</div>
        <section id="game" class="game" hidden tabindex="-1" aria-label="Pocket Blocks falling-block game">
          <canvas aria-label="Falling-block game board"></canvas>
          <div class="game-hud"><h1>POCKET<br>BLOCKS</h1><span>SCORE</span><strong id="score">0</strong><span>LEVEL <b id="level">1</b></span><span class="lines">LINES <b id="lines">0</b></span></div>
          <div class="game-overlay">
            <p class="eyebrow">A TINY ARCADE</p><h2 id="game-title">Pocket Blocks</h2>
            <p id="game-message">Find a little order in the falling pieces.</p>
            <button id="game-action" class="text-button primary">Let's play</button>
            <button id="restart" class="text-button" hidden>Start a new game</button>
          </div>
        </section>
      </div>
      <div class="under-screen">
        <div class="slot" aria-hidden="true"></div>
        <button id="sound" class="sound-button physical" aria-label="Mute sound" aria-pressed="false"><span class="sr-only">Sound</span></button>
      </div>
    </section>
    <section class="control-unit" aria-label="Console controls">
      <div class="control-deck">
        <div class="dpad" role="group" aria-label="Directional pad">
          <div class="dpad-shape" aria-hidden="true"></div>
          <button class="direction physical" data-control="up" aria-label="Up"><span aria-hidden="true">↑</span></button>
          <button class="direction physical" data-control="left" aria-label="Move left"><span aria-hidden="true">←</span></button>
          <button class="direction physical" data-control="right" aria-label="Move right"><span aria-hidden="true">→</span></button>
          <button class="direction physical" data-control="down" aria-label="Move down"><span aria-hidden="true">↓</span></button>
        </div>
        <button class="triangle-button physical" data-control="rotate" aria-label="Rotate piece, or say hello"><span></span></button>
        <button class="green-button physical" data-control="drop" aria-label="Drop piece, or make a happy face"></button>
        <button class="pink-button physical" data-control="pause" aria-label="Pause game, or send love"></button>
        <div class="pill-group">
          <div><button id="home-game" class="pill physical" aria-label="Open game"></button><span id="home-label">PLAY</span></div>
          <div><button id="menu" class="pill physical" aria-label="Open settings and help"></button><span>MENU</span></div>
        </div>
      </div>
      <div class="signature" aria-hidden="true"><span>BMO</span><span>YOUR POCKET PAL</span></div>
    </section>
  </main>
  <p id="notice" class="notice" role="status" hidden></p>
  <p id="reaction-status" class="sr-only" aria-live="polite"></p>
  <dialog id="settings" aria-labelledby="settings-title">
    <div class="dialog-heading"><div><p class="eyebrow">A LITTLE CONTROL ROOM</p><h2 id="settings-title">Hello in there.</h2></div><button id="close-settings" class="close-button" aria-label="Close settings">×</button></div>
    <div class="settings-row"><label for="volume">Sound volume</label><input id="volume" type="range" min="0" max="1" step="0.05"></div>
    <div class="settings-row"><span>Shake to surprise</span><button id="motion" class="text-button">Enable motion</button></div>
    <button id="shake" class="text-button full">Try a shake reaction</button>
    <p id="motion-status" class="small">Optional. Your motion data stays on this device.</p>
    <div class="instructions"><h3>A friendly little guide</h3><p>Tap the face to poke. Rub side to side to tickle. Press <strong>PLAY</strong> for Pocket Blocks.</p>
      <p>Press the pink/red button on the face screen for heart eyes and a love note. In the game: yellow pad moves, cyan triangle rotates, green drops, pink pauses. The first blue pill takes you home.</p>
      <p>Keyboard: arrows move, <kbd>X</kbd> rotates, <kbd>Space</kbd> drops, <kbd>Esc</kbd> pauses. On the face, <kbd>Enter</kbd> pokes, <kbd>T</kbd> tickles, <kbd>S</kbd> surprises.</p>
    </div>
    <div class="settings-footer"><span>BEST <strong id="best">0</strong></span><span id="offline-status">Preparing offline play…</span></div>
    <button id="update" class="text-button full" hidden>Update available · restart app</button>
    <p class="small install-hint">Keep your pal close: use your browser's Install app or Add to Home Screen option. After offline play is ready, no connection is needed.</p>
    <p class="small provenance">An unofficial fan-made experiment. Not affiliated with Cartoon Network. Original synthetic voice and game sounds.</p>
  </dialog>`;

function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing application element: ${selector}`);
  return found;
}

const notice = element('#notice');
let noticeTimer: ReturnType<typeof setTimeout>;
function report(message: string) {
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 6500);
}

let preferences = { ...DEFAULTS };
let storage: Storage | undefined;
try {
  storage = window.localStorage;
  preferences = loadPreferences(storage, report);
} catch (error) {
  console.warn('Local storage is unavailable', error);
  report('This browser does not allow saved settings. You can still play.');
}
function save() { if (storage) savePreferences(storage, preferences, report); }

const audio = new RobotAudio(report);
audio.setMuted(preferences.muted);
audio.volume = preferences.volume;
const faceElement = element('#face');
const screen = element('.screen');
const settings = element<HTMLDialogElement>('#settings');
const gameElement = element('#game');
const overlay = element('.game-overlay');
const action = element<HTMLButtonElement>('#game-action');
let mode: 'home' | 'game' = 'home';
let lastAnnouncement = -Infinity;
const face = new Face(faceElement, reaction => audio.react(reaction), message => {
  if (performance.now() - lastAnnouncement > 500) {
    element('#reaction-status').textContent = message;
    lastAnnouncement = performance.now();
  }
});
let gameView: GameView | undefined;
try {
  gameView = new GameView(element<HTMLCanvasElement>('canvas'), updateGame, event => {
    audio.effect(event);
    if (event === 'clear') element('#reaction-status').textContent = 'Nice! Lines cleared.';
  });
} catch (error) {
  console.error('Game display unavailable', error);
  report('The game display could not start in this browser. You can still play with the face.');
}

function updateGame(game: Game) {
  element('#score').textContent = String(game.score);
  element('#level').textContent = String(game.level);
  element('#lines').textContent = String(game.lines);
  if (game.score > preferences.best) preferences.best = game.score;
  if (game.phase === 'paused' || game.phase === 'over') save();
  element('#best').textContent = String(preferences.best);
  overlay.hidden = game.phase === 'playing';
  element('#game-title').textContent = game.phase === 'over' ? 'Nice stacking.' : game.phase === 'paused' ? 'Take a breath.' : 'Pocket Blocks';
  element('#game-message').textContent = game.phase === 'over'
    ? `You scored ${game.score}. There's always another little game.`
    : game.phase === 'paused' ? 'Your blocks are right where you left them.' : 'Find a little order in the falling pieces.';
  action.textContent = game.phase === 'paused' ? 'Keep playing' : game.phase === 'over' ? 'Play again' : "Let's play";
  element('#restart').hidden = game.phase !== 'paused';
}

function clearInputs() {
  gameView?.input.clear();
  gestures.clear();
  document.querySelectorAll('.pressed').forEach(button => button.classList.remove('pressed'));
}

function showMode(next: 'home' | 'game') {
  if (next === 'game' && !gameView) {
    report('The game needs a browser with Canvas 2D support.');
    return;
  }
  clearInputs();
  gameView?.pause();
  mode = next;
  screen.dataset.mode = mode;
  faceElement.hidden = mode !== 'home';
  gameElement.hidden = mode !== 'game';
  element('.screen-caption').hidden = mode !== 'home';
  element('.face-hint').hidden = mode !== 'home';
  element('#home-game').setAttribute('aria-label', mode === 'home' ? 'Open game' : 'Return to face');
  element('#home-label').textContent = mode === 'home' ? 'PLAY' : 'HOME';
  if (mode === 'home') { face.resume(); faceElement.focus({ preventScroll: true }); }
  else { face.suspend(); action.focus({ preventScroll: true }); }
}

const gestures = new TickleGesture();
faceElement.addEventListener('pointerdown', event => {
  if (mode !== 'home') return;
  const rect = faceElement.getBoundingClientRect();
  gestures.start(event.pointerId, event.clientX, event.timeStamp);
  faceElement.setPointerCapture(event.pointerId);
  const side = (event.clientX - rect.left) / rect.width < 0.4 ? -1 : (event.clientX - rect.left) / rect.width > 0.6 ? 1 : 0;
  face.react('ouch', side);
});
faceElement.addEventListener('pointermove', event => {
  if (gestures.move(event.pointerId, event.clientX, event.timeStamp)) face.react('laugh');
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
  faceElement.addEventListener(name, event => gestures.end(event.pointerId));
}
faceElement.addEventListener('keydown', event => {
  const reaction: Reaction | undefined = event.key === 'Enter' || event.key === ' ' ? 'ouch' : event.key.toLowerCase() === 't' ? 'laugh' : event.key.toLowerCase() === 's' ? 'shake' : undefined;
  if (reaction) { event.preventDefault(); face.react(reaction); }
});

function perform(control: string) {
  if (mode === 'home') {
    face.react(control === 'drop' ? 'hello' : control === 'pause' ? 'love' : control === 'rotate' ? 'laugh' : 'hello');
    return;
  }
  void audio.unlock();
  if (control === 'rotate') gameView?.rotate();
  if (control === 'drop') gameView?.drop();
  if (control === 'pause') togglePause();
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-control]')) {
  const control = button.dataset.control!;
  const direction = control === 'left' || control === 'right' || control === 'down' ? control : undefined;
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    button.classList.add('pressed');
    if (mode === 'game' && direction) gameView?.input.press(`pointer:${event.pointerId}`, direction);
    else perform(control);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    button.addEventListener(name, event => {
      button.classList.remove('pressed');
      gameView?.input.release(`pointer:${event.pointerId}`);
    });
  }
  // Keyboard and assistive-technology activation has no pointer-down event.
  button.addEventListener('click', event => {
    if (event.detail === 0) {
      if (mode === 'game' && direction) {
        gameView?.input.press('activation', direction);
        gameView?.input.release('activation');
      } else perform(control);
    }
  });
}

const KEY_DIRECTIONS: Record<string, HeldDirection> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down' };
window.addEventListener('keydown', event => {
  if (settings.open || mode !== 'game') return;
  const direction = KEY_DIRECTIONS[event.key];
  if (direction) {
    event.preventDefault();
    gameView?.input.press(`key:${event.key}`, direction);
  } else if (['x', 'X', 'ArrowUp', ' ', 'Escape'].includes(event.key)) {
    if (event.key === ' ' && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    if (!event.repeat) perform(event.key === 'Escape' ? 'pause' : event.key === ' ' ? 'drop' : 'rotate');
  }
});
window.addEventListener('keyup', event => gameView?.input.release(`key:${event.key}`));

function togglePause() {
  clearInputs();
  if (gameView?.game.phase === 'playing') {
    gameView.pause();
    action.focus({ preventScroll: true });
  } else if (gameView?.game.phase === 'paused') {
    gameView.resume();
    gameElement.focus({ preventScroll: true });
  }
}

action.addEventListener('click', () => {
  void audio.unlock();
  if (gameView?.game.phase === 'paused') gameView.resume();
  else gameView?.start();
  gameElement.focus({ preventScroll: true });
});
element('#restart').addEventListener('click', () => {
  gameView?.start();
  gameElement.focus({ preventScroll: true });
});
element('#home-game').addEventListener('click', () => { showMode(mode === 'home' ? 'game' : 'home'); });

function updateSound() {
  const button = element('#sound');
  button.classList.toggle('muted', preferences.muted);
  button.setAttribute('aria-pressed', String(preferences.muted));
  button.setAttribute('aria-label', preferences.muted ? 'Enable sound' : 'Mute sound');
}
updateSound();
element('#sound').addEventListener('click', () => {
  preferences.muted = !preferences.muted;
  audio.setMuted(preferences.muted);
  updateSound();
  save();
  if (!preferences.muted) void audio.unlock().then(ready => { if (ready) audio.effect('tap'); });
  report(preferences.muted ? 'Sound off. Still happy to see you.' : 'Sound on.');
});
const volume = element<HTMLInputElement>('#volume');
volume.value = String(preferences.volume);
volume.addEventListener('input', () => {
  audio.volume = preferences.volume = volume.valueAsNumber;
  save();
});
element('#best').textContent = String(preferences.best);

let motionEnabled = false;
const motion = new MotionInput(() => {
  if (mode === 'home' && !settings.open) face.react('shake', 0, 'motion');
}, message => {
  element('#motion-status').textContent = message;
  report(message);
});
element('#motion').addEventListener('click', async () => {
  const button = element<HTMLButtonElement>('#motion');
  if (motionEnabled) { motion.disable(); motionEnabled = false; }
  else {
    button.disabled = true;
    motionEnabled = await motion.enable();
    if (settings.open) motion.suspend();
    button.disabled = false;
  }
  button.textContent = motionEnabled ? 'Disable motion' : 'Enable motion';
  if (motionEnabled) element('#motion-status').textContent = 'Motion enabled for this visit. Shake gently to surprise your pal.';
});
element('#shake').addEventListener('click', () => {
  settings.close();
  showMode('home');
  face.react('shake');
});
element('#menu').addEventListener('click', () => {
  clearInputs();
  gameView?.pause();
  face.suspend();
  motion.suspend();
  settings.showModal();
});
element('#close-settings').addEventListener('click', () => settings.close());
settings.addEventListener('close', () => {
  if (mode === 'home') face.resume();
  motion.resume();
});

function suspend() {
  clearInputs();
  gameView?.pause();
  face.suspend();
  motion.suspend();
  audio.suspend();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspend();
  else {
    if (mode === 'home' && !settings.open) face.resume();
    if (!settings.open) motion.resume();
  }
});
window.addEventListener('blur', suspend);
window.addEventListener('focus', () => {
  if (!document.hidden && !settings.open) {
    if (mode === 'home') face.resume();
    motion.resume();
  }
});
window.addEventListener('pagehide', suspend);
window.addEventListener('resize', () => { clearInputs(); gameView?.pause(); });

const offlineStatus = element('#offline-status');
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
async function checkOfflineCache() {
  try {
    const urls = ['index.html', 'audio/ouch.wav', 'audio/hey.wav', 'audio/giggle.wav'];
    const cached = await Promise.all(urls.map(url => caches.match(`${import.meta.env.BASE_URL}${url}`, { ignoreSearch: true })));
    offlineStatus.textContent = cached.every(Boolean) ? 'Ready for offline play' : 'Offline cache incomplete · reconnect and reload';
  } catch (error) {
    console.warn('Could not inspect offline cache', error);
    offlineStatus.textContent = 'Offline play unavailable';
    report('Offline storage could not be checked. Reconnect and reload to try again.');
  }
}
if ('serviceWorker' in navigator) {
  updateSW = registerSW({
    onOfflineReady() { offlineStatus.textContent = 'Ready for offline play'; },
    onNeedRefresh() { element('#update').hidden = false; },
    onRegisteredSW(_url, registration) {
      if (registration?.active && navigator.serviceWorker.controller) {
        void checkOfflineCache();
      }
      const monitor = () => {
        const worker = registration?.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'redundant') {
            offlineStatus.textContent = 'Offline setup or update failed';
            report('Offline setup or an update failed. Reconnect and reload to try again.');
          }
        });
      };
      registration?.addEventListener('updatefound', monitor);
      monitor();
    },
    onRegisterError(error: unknown) {
      console.warn('Offline preparation failed', error);
      offlineStatus.textContent = 'Offline play unavailable';
      report('Offline setup failed. Reconnect and reload to try again.');
    },
  });
} else {
  offlineStatus.textContent = 'Offline play not supported';
}
element('#update').addEventListener('click', () => {
  suspend();
  void updateSW?.(true).catch((error: unknown) => {
    console.warn('Update failed', error);
    report('The update could not be applied. Reconnect and try again.');
  });
});

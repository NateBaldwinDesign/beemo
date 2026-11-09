# Beemo Pocket

A touch-first pocket robot: poke its face, rub side to side to tickle it, or play **Pocket Blocks**, an original falling-block puzzle. The console is drawn with CSS, the face is a few animated SVG shapes, and the game uses a small Canvas 2D display. No UI framework, backend, runtime AI, tracking, camera, or microphone.

An unofficial fan-made experiment inspired by the old Beemo iOS app. Not affiliated with or endorsed by Cartoon Network. Character branding belongs to its respective owners; review rights before public distribution.

## Run locally

Use Node.js 22.12+ (or a supported newer LTS) and npm.

```sh
npm ci
npm run dev
```

Open the printed URL at **`/beemo/`**. For the production app, including offline installation:

```sh
npm run build
npm run preview
```

The app fills the available viewport, with the face above the controls in portrait and beside them on wide screens. Mobile browser bars are controlled by the browser; installing to the home screen gives a standalone experience.

## Controls

| Control | Face | Pocket Blocks |
|---|---|---|
| Touch face | Poke; rub back and forth to tickle | Not used |
| Yellow pad | Friendly reaction | Left/right move; down soft-drops |
| Cyan triangle | Laugh | Rotate clockwise |
| Green circle | Smile | Hard drop |
| Pink circle | Surprise | Pause/resume |
| First blue pill | Open game | Return home, keeping game paused |
| Second blue pill | Settings/help | Settings/help, pausing game |
| Small blue button | Mute/unmute | Mute/unmute |

Keyboard: focus the face and use Enter/Space to poke, T to tickle, S to surprise. In the game use left/right/down arrows, X or Up to rotate, Space to hard-drop, and Escape to pause. Tab navigation and standard button activation are supported.

Optional shake input is enabled explicitly in settings, with a permission request where necessary. There is always a **Try a shake reaction** button. Sensor readings stay on the device. Motion permission is session-only. Reduced-motion mode avoids idle blinking and uses short face transitions.

The game uses a seven-bag generator, clockwise SRS wall kicks (separate straight-piece table), a 500 ms lock delay with at most 15 movement/rotation resets, a next preview, and ghost placement. Clears score 100/300/500/800 times the current level; every ten lines increases the level. Soft drops score one point per cell, hard drops two. Holding a direction repeats after 180 ms at 70 ms intervals (down repeats at 65 ms).

Game sessions pause when leaving the game, opening settings, hiding/unfocusing the page, or resizing. Resume deliberately. Best score, mute, and volume are saved locally; the active board is retained only while this page remains open.

## Offline and installation

The settings panel says **Ready for offline play** once the service worker has cached the app and all three voice clips. After that, the face, game, and audio work without a connection. Initial installation needs internet access and successful cache preparation.

Use your browser's Install app or Add to Home Screen option. iOS installation, motion permissions, and actual speaker behavior should be checked on a physical device; desktop WebKit is not a substitute for an iPhone.

Updates are offered in settings and do not interrupt a game. Applying one pauses play and reloads the app (the active board is not saved across reloads). Cache names are scoped to this app so unrelated GitHub Pages apps are not cleared.

## GitHub Pages

In this repository's **Settings > Pages > Build and deployment**, choose **GitHub Actions**. The workflow checks changes and publishes `dist/` on pushes to `main` or manual runs. Pull requests are checked without deployment. A successful deployment job supplies the actual site URL.

All assets, manifest URLs, and service-worker routing use `/beemo/`. No server-side routing is needed. A custom domain or repository rename requires updating the base/scope/start URL in `vite.config.ts` and the base-path checks/tests.

## Checks

```sh
npm test
npm run build
npx playwright install chromium webkit
npm run test:browser
```

Unit tests cover game rules, gesture recognition and repeats, expression lifecycle, motion permissions, audio limits, and storage failures. Browser tests run only after the major features are built and use the production `/beemo/` path. They cover layout/touch-target bounds, real touch input, face gestures, keyboard/game navigation, settings, offline voice decoding, and a real service-worker update that waits for user acceptance.

The build checks a 60 KB gzip core JavaScript budget and 1 MB compressed total distribution budget. Real-device frame rate and perceived audio quality require separate measurement/listening; passing automated tests does not establish those.

## Original assets and audio

`npm run assets` reproducibly generates the icons and mono PCM voice files using `scripts/generate-assets.mjs` and Sharp. Generated files are included in the source so normal builds do not need image generation or speech software.

The short "ouch," "hey," and giggle sounds are original mathematical formant synthesis with simple phoneme transitions and deterministic noise. They are intentionally electronic, not copied from the original app, sampled from the show, trained on a performer, or an imitation of the actor. Game effects use Web Audio oscillators. There are no external speech services, downloaded voice models, or browser text-to-speech dependencies. The voice design remains open to listening feedback.

Icons and synthetic sound assets were generated for this project. The display uses system fonts; there are no external font or asset requests.

## Historical references

The original programmer confirms poke/tickle/shake reactions, JavaScript implementation, the three old mini-games, and the other app modes in [this account](https://www.zachstronaut.com/posts/2013/07/24/beemo-ios-app.html). The [app wiki](https://adventuretime.fandom.com/wiki/Beemo_-_Adventure_Time_(Cartoon_Network_App)) provides screenshots and additional context. This project reconstructs selected behavior from those descriptions and supplied visual references, not from original binaries or source.

Camera/stickers, original soundboards, alarms, circuit music, ringtones, wallpapers, and the original games are deliberately outside this version.

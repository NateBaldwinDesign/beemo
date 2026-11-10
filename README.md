# Beemo Pocket

A touch-first pocket robot: poke its face, rub side to side to tickle it, or choose from three tiny games: **Pocket Blocks**, **Star Patrol**, and **Pixel Crossing**. The console is drawn with CSS, the face is a few animated SVG shapes, and the games share a small Canvas 2D display with original pixel graphics. No UI framework, backend, runtime AI, tracking, camera, or microphone.

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

| Control | Face | Pocket Blocks | Star Patrol | Pixel Crossing |
|---|---|---|---|---|
| Touch face | Poke; rub back and forth to tickle | - | - | - |
| Yellow pad | Friendly reaction | Left/right move; down soft-drops | Left/right move | Hop in four directions |
| Cyan triangle | Laugh | Rotate clockwise | Hold to fire | Hop forward |
| Green circle | Smile | Hard drop | Hold to fire | Hop forward |
| Pink/red circle | Heart eyes and an "I love you Azalea" speech bubble | Pause/resume | Pause/resume | Pause/resume |
| First blue pill | Open game picker | Return home, keeping game paused | Same | Same |
| Second blue pill | Settings/help | Settings/help, pausing game | Same | Same |
| Small blue button | Mute/unmute | Mute/unmute | Same | Same |

Keyboard: focus the face and use Enter/Space to poke, T to tickle, S to surprise. In Pocket Blocks use left/right/down arrows, X or Up to rotate, and Space to hard-drop. In Star Patrol, use left/right arrows to move and hold X or Space to fire. In Pixel Crossing, all four arrows hop; X or Space hops forward. Escape pauses/resumes every game. Tab navigation and standard button activation are supported.

Press PLAY to choose a game. The picker also supports the yellow pad or arrow keys, with triangle/green or Enter to select. Pause a game to use **Choose game** and switch games without losing your place. Each game keeps its own paused session until the page closes or reloads.

The love note stays visible for three seconds, followed by a brief closed-eye happy smile before returning to idle. Another face interaction replaces it immediately. This reaction is visual only, with no spoken audio.

### More expressive company

- Tap within a 32 by 32 CSS-pixel square centered on an eye to wince with **that eye** closed. Other face taps still trigger the original ouch. Eye targets follow the rendered eyes, including in landscape. Focus the face and press **1** (left eye) or **2** (right eye) for keyboard equivalents.
- The first shake keeps the original surprised face. Another accepted shake within **five seconds**, including continued sensor movement after its existing cooldown, adds a dizzy face with trembling cheeks. Touch reactions take priority over device motion. Keyboard **S** and the settings shake alternative follow the same progression.
- After **5-10 seconds without interaction**, Beemo blinks. After **30 seconds**, he yawns briefly; blinking does not reset that quiet-time clock. Continued inactivity can produce another yawn every 30 seconds. Leaving the face pauses idle reactions; returning starts a fresh quiet period. Reduced motion keeps short expression changes and yawns, but disables automatic blinking.
- The extra reference variations are brief follow-ups, not replacement triggers: three quick general pokes add a toothy grimace after ouch; tickling still laughs, then grins with teeth; greetings end with a subtle contented smile; dizziness settles into a short frown; the love note ends with a closed-eye happy smile. Follow-ups last 800 ms and yield immediately to interaction.

New expressions reuse the existing short reaction sounds where appropriate. Idle expressions and follow-up variations are silent.

The love note stays visible for three seconds, then the face returns to its usual smile. Another face interaction replaces it immediately. This reaction is visual only, with no spoken audio.

Optional shake input is enabled explicitly in settings, with a permission request where necessary. There is always a **Try a shake reaction** button. Sensor readings stay on the device. Motion permission is session-only. Reduced-motion mode avoids idle blinking and uses short face transitions.

### Three tiny games

**Pocket Blocks** uses a seven-bag generator, clockwise SRS wall kicks (separate straight-piece table), a 500 ms lock delay with at most 15 movement/rotation resets, a next preview, and ghost placement. Clears score 100/300/500/800 times the current level; every ten lines increases the level. Soft drops score one point per cell, hard drops two. Holding a direction repeats after 180 ms at 70 ms intervals (down repeats at 65 ms).

**Star Patrol** is an original fixed-screen space shooter inspired by the Space Invaders genre. Move beneath a formation of 21 enemies and fire upward while dodging enemy shots. Each hit scores 10 times the wave number. Clearing a wave starts a faster formation after a short break. Three lives, brief protection after a hit, and a loss when enemies reach the ship keep the rules compact. Holding either action button fires continuously; projectiles and enemies have bounded storage.

**Pixel Crossing** is an original endless 8-bit crossing game inspired by Crossy Road. Hop across safe grass, moving traffic, and rivers on floating logs. Logs carry the character; stepping into water, being hit, or drifting off-screen ends the run. Only the farthest row reached scores; backtracking cannot farm points. Traffic speeds increase gradually, and the scrolling world retains only a small window of lanes. Holding a direction repeats hops; the camera limits backward travel to two rows behind the farthest row.

Game sessions pause when leaving the game, opening settings, hiding/unfocusing the page, or resizing. Resume deliberately. Separate best scores, mute, and volume are saved locally; active games are retained only while this page remains open. Existing saved Pocket Blocks scores and audio settings are preserved when upgrading.

## Offline and installation

The settings panel says **Ready for offline play** once the service worker has cached the app and all three voice clips. After that, the face, all three games, and audio work without a connection. Initial installation needs internet access and successful cache preparation.

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

Unit tests cover all three games' rules, bounded game state, display lifecycle, gesture recognition and repeats, expression lifecycle, motion permissions, audio limits, score migration, and storage failures. Browser tests run only after the major features are built and use the production `/beemo/` path. They cover layout/touch-target bounds, real touch input, held firing, face gestures, game selection and retained sessions, separate best scores, settings, offline play for every game, offline voice decoding, and a real service-worker update that waits for user acceptance.

The build checks a 60 KB gzip core JavaScript budget and 1 MB compressed total distribution budget. Real-device frame rate and perceived audio quality require separate measurement/listening; passing automated tests does not establish those.

## Original assets and audio

`npm run assets` reproducibly generates the icons and mono PCM voice files using `scripts/generate-assets.mjs` and Sharp. Generated files are included in the source so normal builds do not need image generation or speech software.

The short "ouch," "hey," and giggle sounds are original mathematical formant synthesis with simple phoneme transitions and deterministic noise. They are intentionally electronic, not copied from the original app, sampled from the show, trained on a performer, or an imitation of the actor. Game effects use Web Audio oscillators. There are no external speech services, downloaded voice models, or browser text-to-speech dependencies. The voice design remains open to listening feedback.

Icons, pixel sprites, and synthetic sound assets were generated for this project. The games do not use artwork, audio, code, or branding from Space Invaders or Crossy Road. The display uses system fonts; there are no external font or asset requests.

## Historical references

The original programmer confirms poke/tickle/shake reactions, JavaScript implementation, the three old mini-games, and the other app modes in [this account](https://www.zachstronaut.com/posts/2013/07/24/beemo-ios-app.html). The [app wiki](https://adventuretime.fandom.com/wiki/Beemo_-_Adventure_Time_(Cartoon_Network_App)) provides screenshots and additional context. This project reconstructs selected behavior from those descriptions and supplied visual references, not from original binaries or source.

Camera/stickers, original soundboards, alarms, circuit music, ringtones, wallpapers, and the original games are deliberately outside this version.

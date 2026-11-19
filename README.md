# Cadence Studio — Offline Local Music Player

Cadence Studio is a Capacitor + React + Android Media3 offline music player built to scan, organize, and play real local audio files (`MP3`, `FLAC`, `WAV`, `M4A`, `AAC`, `OGG`, `OPUS`) with background playback, lock-screen media controls, synced `.lrc` lyrics, and hardware audio effects.

## Features

- **Real Local Music Discovery (Android & Web)**
  - **Android (`CadenceAudioPlugin.java`)**: Queries `MediaStore.Audio.Media` on a background executor thread, extracts title, artist, album, track number, duration, MIME type/format, file size, folder path, and cached album/embedded artwork (`320x320` JPEG cache in app `cacheDir`), and deduplicates tracks by URI and file path.
  - **Scoped Android Permissions**: Requests `READ_MEDIA_AUDIO` + `POST_NOTIFICATIONS` on Android 13+ (API 33+) and `READ_EXTERNAL_STORAGE` on Android 8–12 (API 26–32), with graceful denied/revoked states and a direct shortcut to Android App Settings.
  - **Web / Desktop Offline Mode (`webFileStore.ts`)**: Lets you import local audio files, music folders, and `.lrc` sidecar files directly from your computer into browser `IndexedDB` for genuine offline `HTMLAudioElement` playback.

- **Native Android Background Playback (`CadencePlaybackService.java`)**
  - Powered by **AndroidX Media3 `ExoPlayer`** inside a `MediaSessionService` (`foregroundServiceType="mediaPlayback"`).
  - Handles audio focus, headphone unplug (`setHandleAudioBecomingNoisy(true)`), local wake lock (`C.WAKE_MODE_LOCAL`), lock-screen/Bluetooth media controls, and system media notifications.

- **Complete Library & Organization**
  - **Home Dashboard**: Library stats, Play Library / Shuffle All, Recently Played, Most Played, and Albums shelf.
  - **Tracks**: Live search, sorting (`Title`, `Artist`, `Album`, `Duration`, `Date Added`), pagination, multi-select batch Queue/Playlist actions, and per-track context menus (`Play Next`, `Add to Queue`, `Add to Playlist`, `Go to Album`, `Go to Artist`, `Track Details`, `Share Audio File`).
  - **Albums, Artists & Folders**: Full grid/list views and dedicated detail screens.
  - **Playlists & Favorites**: Offline persistence in `localStorage` with playlist creation, inline rename, deletion, track reordering, shuffle/play, and missing-file handling.

- **Now Playing, Lyrics & Audio Effects**
  - **Now Playing Modal**: Full-size original-color artwork, scrub bar, shuffle/repeat (`off` / `all` / `one`), playback speed (`0.75x`–`2x`), sleep timer, Queue tab, and timestamped `.lrc` **Lyrics** tab with tap-to-seek.
  - **Audio Effects & Equalizer**: Binds native Android `Equalizer`, `BassBoost`, and `Virtualizer` to the active `ExoPlayer` audio session (with graceful hardware fallback), and uses a real-time 5-band Web Audio `BiquadFilterNode` + `AnalyserNode` spectrum visualizer in browser mode.
  - **Light & Dark Themes**: Persisted studio dark and crisp light themes.

## Project Structure

- `src/` — React 19 + TypeScript + Tailwind CSS v4 frontend (`App.tsx`, `components/`, `services/playbackBridge.ts`, `utils/musicLogic.ts`, `utils/webFileStore.ts`)
- `android/` — Capacitor 8 Android native project (`CadenceAudioPlugin.java`, `CadencePlaybackService.java`, `MainActivity.java`, `AndroidManifest.xml`, Gradle build scripts)
- `.github/workflows/android-apk.yml` — GitHub Actions CI pipeline to build and upload the Debug APK

## Development & Build Commands

### 1. Install Dependencies & Run Web Dev Server
```bash
npm install
npm run dev
```

### 2. Run Unit Tests, Type-Check & Production Build
```bash
npx tsx --test src/utils/musicLogic.test.ts
npm run lint
npm run build
```

### 3. Sync Capacitor & Build Android Debug APK Locally
Requires **JDK 17/21** and **Android SDK** (`ANDROID_HOME` configured):
```bash
npm run cap:sync
cd android
chmod +x gradlew
./gradlew assembleDebug
```
The compiled APK will be generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

### 4. GitHub Actions APK Build
Push the repository to GitHub (`main` or `master` branch) or trigger the **Build Android Debug APK** workflow manually via `workflow_dispatch`. Once finished, download the `cadence-studio-debug-apk` artifact from the workflow summary.

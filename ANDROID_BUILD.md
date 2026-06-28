# WordSprint Android Build

Current Android internal test build uses a native Android WebView wrapper. It is not a TWA runtime for the debug APK, because TWA depends on Chrome or a TWA-capable browser and can be unstable on some domestic Android phones.

## App Info

- App name: WordSprint
- Package name: `com.plshealme.wordsprint`
- Version name: `1.2.0`
- Version code: `12`
- Orientation: portrait
- Permission: `INTERNET` only

## Fast-Start WebView Shell

The APK bundles the WordSprint web shell for faster startup:

- WebView launch URL: `https://appassets.androidplatform.net/`
- Remote server origin: `https://43.128.23.159.sslip.io`
- Local shell output: `android/app/build/generated/assets/web/`
- Word JSON source: `public/data/words/*.json`
- Gradle assets source: `android/app/build/generated/assets/`

Bundled local assets include:

- Static HTML pages
- Next.js RSC route payloads
- `/_next/static/*`
- icons, manifest, favicon
- `/data/words/index.json`
- `/data/words/u01.json` through `/data/words/u30.json`

Remote server is still used for:

- `/api/auth/*`
- `/api/admin/*`
- Supabase requests
- future cloud/server features

Do not cache Auth/Admin API responses. Do not copy word JSON into `android/app/src/main/assets/words/`; that directory is ignored to avoid duplicate APK assets.

## Local Build

Requirements:

- JDK 21
- Android SDK Platform 35
- Android Build Tools
- pnpm

Build web shell:

```bash
pnpm install
pnpm run build:android-web
```

Build debug APK:

```bash
cd android
./gradlew assembleDebug
```

Windows PowerShell:

```powershell
cd android
.\gradlew.bat assembleDebug
```

Debug APK output:

```text
android/app/build/outputs/apk/debug/*.apk
```

## GitHub Actions

Workflow:

```text
.github/workflows/android-build.yml
```

Manual trigger:

1. Open GitHub Actions.
2. Select `Android Debug APK`.
3. Click `Run workflow`.
4. Download artifact `WordSprint-debug-apk`.

The workflow runs:

```bash
pnpm install --frozen-lockfile
pnpm run build:android-web
cd android
./gradlew assembleDebug
```

## Release Signing

Do not commit keystores or passwords.

Generate a release keystore only when needed:

```bash
keytool -genkeypair \
  -v \
  -keystore android/wordsprint-release.jks \
  -alias wordsprint \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Create `android/key.properties` locally:

```properties
storeFile=wordsprint-release.jks
storePassword=your_store_password
keyAlias=wordsprint
keyPassword=your_key_password
```

These files must stay out of Git.

## TWA Notes

The project may still keep TWA/Digital Asset Links references for future evaluation, but the current internal debug APK prioritizes WebView stability and speed.

If TWA is revisited later:

- configure `public/.well-known/assetlinks.json`
- include debug/release SHA-256 fingerprints
- redeploy the web site after asset links change

## Domain Migration

When switching from `43.128.23.159.sslip.io` to a formal domain, update:

- `DEFAULT_REMOTE_API_ORIGIN` in `src/lib/apiClient.ts`
- `TRUSTED_HOST` in `android/app/src/main/java/com/plshealme/wordsprint/MainActivity.java`
- Android intent-filter host in `android/app/src/main/AndroidManifest.xml`
- Supabase Redirect URLs
- Digital Asset Links if TWA is used later

Then rebuild the Android web shell and APK.

## Debug Markers

Useful Android logcat markers:

```text
[perf] WebView app start
[perf] local shell loaded
```

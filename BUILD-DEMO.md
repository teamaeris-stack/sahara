# Sahara Family Rescue MVP

## Latest update: editable family and usable settings

The earlier three-role restriction has been removed. Open **Family → Add / manage members**, or the header settings button → **Family members**. Type any name to add a member, use the pencil to rename, and use the bin then confirm to remove. Your own phone cannot be removed from this editor. Existing names and device identities are preserved.

The settings sheet now has a fixed visible X button, a viewport-height limit and a separately scrolling body. Test controls are grouped into expandable sections. Family itself has an X to return Home.

For a local family, enter your name and choose **Start on this device**. These records work without the backend, but do not synchronize. New records have no invented location. For shared setup on a new device, expand **Connect with other phones**, enter your name and choose Create or Join. To claim a member already added by the family, enter that exact name and the family code. Names must be distinct within a shared family. Run the updated server as well as the updated frontend: the old server does not support roster edits. Any authenticated family member can manage the roster in this MVP. Removal revokes the removed member's server token; it cannot remotely erase already cached information on their offline phone.

Additional regression tests cover five custom members, rename preservation after GPS/status updates, joining an added member, idempotent offline add/remove retries, revoked access and server restart persistence. Browser visual testing remains unavailable in this workspace; check scrolling and closing on your device.

This updates the existing application. No Android folder was supplied. The mobile web bundle and Capacitor configuration are included; an APK has NOT been compiled in this workspace.

## Run in VS Code on Windows

Open this folder (the one containing package.json). Use Node.js 24 and run in PowerShell:

```powershell
npm.cmd ci
npm.cmd run family:server
```

Keep that terminal open. In a second terminal:

```powershell
npm.cmd run dev
```

Open the localhost address printed by Vite. For local browser testing leave the Family server field blank. The Vite proxy forwards /api/family to the local server.

## Shared server for three phones

The included Node server uses a persistent JSON file, not localStorage, for shared data. Run `node scripts/family-server.mjs` on a server with a persistent writable disk. Put an HTTPS reverse proxy in front of port 8787 and forward `/api/family` to it. Enter that HTTPS server address in Family setup on each phone. This hosting is not provisioned by the ZIP.

Environment variables: `SAHARA_FAMILY_PORT` (8787), `SAHARA_FAMILY_HOST` (127.0.0.1), `SAHARA_FAMILY_DB` (family-demo-data.json), and `SAHARA_ALLOWED_ORIGINS` (comma-separated allowed frontend origins). Include `https://localhost` for the Capacitor Android app and your HTTPS web origin for browser testing. Keep the JSON database outside publicly served folders. Use one server process. Family codes permit claiming unclaimed roles; keep the code private. Device tokens persist locally. Clearing app data loses that device's claim; there is no account recovery UI.

The APK's localhost is the phone itself: it is NOT your computer's server. All three phones must use the same reachable HTTPS backend. Offline mode reads cached records and queues own updates/check-ins; it cannot obtain new information from another disconnected phone. Demo Mode is local simulation, not cross-phone synchronization.

## Generate Android folder and debug APK

Install Android Studio and its requested SDK/build tools first. These commands use Capacitor 8; native tooling and plugins were not installed or tested in this workspace. See https://capacitorjs.com/docs/android for platform requirements.

Run from the project folder:

```powershell
npm.cmd ci
npm.cmd install @capacitor/core@8 @capacitor/android@8 @capacitor/geolocation@8
npm.cmd install -D @capacitor/cli@8
npm.cmd run build:mobile
npx.cmd cap add android
node scripts/prepare-mobile.mjs
npx.cmd cap sync android
npx.cmd cap open android
```

The preparation step adds foreground coarse/fine location permissions to the generated manifest. Let Android Studio finish SDK/Gradle setup, then build a debug APK, or run:

```powershell
cd android
.\gradlew.bat assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. Install the same APK on all three phones using Android Studio or `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` from the project root with one phone connected at a time. The bundled map does not require an online tile server. Rebuild and run `npx.cmd cap sync android` after changing web code.

## Three-phone test

1. Phone 1: open Family, enter your name, expand Connect with other phones, enter backend URL and Create Family. Note the code.
2. Phone 1 can add the other members by any distinct names. Phone 2 uses the same backend/code and enters its member's exact name to Join Family.
3. Phone 3 joins in the same way. There is no three-member restriction; Me/Dad/Mom are only the optional sample demo.
4. On each phone allow foreground location and update its location. Confirm timestamps and markers on Phone 1. Real locations outside Aluva remain recorded but cannot route on the Aluva-only graph.
5. Dad uses the existing SOS/status flow. Check his shared SOS summary and priority on Phone 1. Request a check-in; Dad responds Safe and Phone 1 should show the response.
6. Open Dad's detail. Route to his last confirmed location or route from his location to the nearest available demo shelter.
7. For deterministic Aluva presentation use clearly labelled local Demo Mode, which seeds Dad Needs Help/high demo risk, Mom No Response/moderate demo risk, Me Safe. Do not present this as live data.
8. On a shelter route choose a hazard, then confirm an actual road via the orange segment or road list. The confirmed blocked way is red/dashed and labelled; the valid route is blue. Unaffected portions can remain shared. No connection means an explicit route error.
9. After successful sync, turn off both Wi-Fi and mobile data. Reopen Family and map. Cached timestamps remain visible; changes queue. Restore connectivity and verify pending count clears and another phone receives updates.
10. Close/reopen all apps: identities should persist. Test GPS denial, stale data, and unavailable backend as well.

## Validation performed

TypeScript checking and web/mobile production builds passed. Node tests passed for three independent shared-server clients, duplicate identity rejection, token isolation, SOS/location updates, replay ordering, check-in responses, persistence across server restart, actual OSM road exclusions, closer shelter routing, and HTTP responses for major app routes/map assets. Tests: `node --test scripts/family-server.test.mjs scripts/routing.test.mjs scripts/routes-smoke.test.mjs`.

Browser access to the local app was blocked in this workspace, so visual interaction, service-worker offline reload, Android GPS and three physical phones have NOT been verified. No compiled APK is included. Native setup still needs validation on your machine. Existing dependencies were available; a clean dependency installation was not completed here.

## Honest demonstration limits

- Shelter points are explicitly demo locations, not verified operational relief facilities or flood-safe buildings. Available demo road distances from the default location are approximately 1.46, 2.40, 1.72 and 1.53 km; minimum point spacing is about 1.45 km.
- Routing follows local OSM roads and excludes reported blocked ways. It does not certify the safest route or know unreported floods. Risk is proximity to locally recorded hazards, or labelled demo risk; no nearby report does not prove safety. Hazard reports are currently local to a phone.
- GPS is foreground, timestamped confirmation, not background/live tracking. Family history retains up to eight confirmations. Coalesced offline updates send the latest own record.
- Shared SOS is a family summary of the existing flow, not proof of delivery to emergency services.
- New Family text is primarily English; existing application language support elsewhere is retained. Legacy Family components remain in source but the main Family screens use the new three-role workflow.
- No new npm dependency is required for the web/sync changes. Capacitor packages listed above are additional dependencies for Android only.

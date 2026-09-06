# Sahara updated app + working 3-phone relay

This folder is the uploaded updated Sahara app with the already-proven Sahara Relay web integration added.

## Important
Do NOT regenerate the Android folder for the hackathon build. Reuse the Android folder from the working relay project:
`C:\sahara\resilient-connection-hub\android`

That folder already contains the working `SaharaRelayPlugin.java`, plugin registration, Nearby dependency, and corrected runtime/manifest permissions.

## Fast merge on Windows
1. Back up `C:\sahara\resilient-connection-hub`.
2. Copy/extract the contents of this merged folder into `C:\sahara\resilient-connection-hub` and replace matching files.
3. Do NOT delete the existing `android` folder.
4. From the project root run:
   `npm install`
5. Build the mobile web bundle:
   `npm run build:mobile`
6. Sync it into the preserved Android project:
   `npx cap sync android`
7. Build APK:
   `cd android`
   set Java in PowerShell if needed:
   `$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"`
   `$env:Path="$env:JAVA_HOME\bin;$env:Path"`
   `.\gradlew.bat assembleDebug`
8. Install the resulting `android\app\build\outputs\apk\debug\app-debug.apk` on all three phones.

## What was integrated
- `src/lib/sahara-relay.ts`: Capacitor bridge to the native SaharaRelay plugin.
- `src/components/resq/RelayPanel.tsx`: Gateway/offline-relay controls + incoming emergency display.
- `HomeScreen.tsx`: shows the relay panel in the updated app.
- `resq-store.tsx`: both one-tap SOS and documented SOS attempt real relay delivery after saving locally.
- Capacitor config aligned to the already-working Android package `com.sahara.disaster` and `mobile-dist`.
- Capacitor 8 dependencies declared in `package.json`.

## Demo
- Phone C: internet on, Bluetooth/location on -> GATEWAY.
- Phone A/B: mobile data off, Wi-Fi radio on but not internet-connected, Bluetooth/location on -> OFFLINE RELAY.
- Phone A: use the updated app's SOS NOW. The real SOS packet should appear on Phone C.
- Phone B: use the updated documented emergency flow. Its actual SOS packet should appear on Phone C.

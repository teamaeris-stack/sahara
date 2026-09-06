SAHARA — Offline-First Disaster Resilience Platform
> **People. Families. Safer Together.**  
> A mobile-first disaster-management platform designed to remain useful when internet and cellular connectivity become unreliable.
SAHARA helps people check in, request help, find shelters, navigate around reported hazards, coordinate with family members, access emergency guidance, and relay SOS packets between nearby devices during natural disasters.
The project was built as a hackathon prototype with a strong focus on offline resilience, simple emergency UX, local-first operation, and community coordination.
---
Why SAHARA?
During floods, landslides, earthquakes, storms, and other disasters, communication infrastructure can fail exactly when people need it most. Many emergency applications depend heavily on a continuous internet connection.
SAHARA takes a different approach:
essential actions remain available locally;
emergency information is cached on-device;
SOS requests can be queued when internet is unavailable;
maps and emergency guidance can work from packaged local data;
nearby devices can act as a bridge toward a connected gateway;
family status and last-confirmed information remain visible during outages.
---
Core Features
1. Disaster Check-In
SAHARA presents a clear emergency status flow with large, accessible actions:
I'M SAFE
I NEED HELP
automatic No Response handling when a user does not check in
periodic safety re-checks during an active disaster
The interface is intentionally simple for stressed users, elderly users, and people with low digital literacy.
2. One-Tap and Documented SOS
Two emergency-reporting paths are available:
SOS NOW — immediate one-tap emergency packet
Documented SOS — structured information about the type of emergency, affected people, and additional details
SOS information is stored locally first so the app does not depend on a successful network request before recording an emergency.
3. Sahara Emergency Relay
The Android prototype includes a nearby-device relay architecture built around Google Nearby Connections.
A disconnected phone can operate as an Offline Relay Node, while another nearby phone with connectivity can operate as a Gateway.
Conceptual flow:
```text
Offline Phone A ─┐
                 ├── Nearby Device-to-Device Relay ──> Gateway Phone ──> Online services
Offline Phone B ─┘
```
Emergency packets can contain information such as:
packet ID
emergency type
number of affected people
description
timestamp
This allows emergency information to move locally even when the originating phone has no direct internet connection.
> **Prototype note:** the Nearby relay is an Android-native hackathon feature. Native relay behavior has been validated separately and the merged application integration should be treated as experimental rather than production infrastructure.
4. Family Rescue and Last Confirmed Status
The Family module supports editable family groups instead of fixed roles.
Users can:
add family members with custom names;
rename or remove members;
maintain separate device identities;
share safety status, SOS summaries, and last-confirmed locations when a shared backend is available;
keep cached family information visible while offline;
request family check-ins;
view member details and route toward their last confirmed location.
Local-only family records can also be used without a backend.
5. Offline Shelters and Safe Zones
SAHARA provides locally packaged shelter data with information such as:
availability status;
capacity and available spaces;
food and water;
first aid / medical support;
accessibility;
toilets and other facilities;
last verification time.
The current prototype uses demo shelter locations around Aluva, Kerala for deterministic testing.
6. Hazard-Aware Offline Routing
The routing system uses locally packaged road/map data and can react to reported hazards such as:
flooding;
landslides;
blocked roads;
inaccessible bridges;
debris;
structural damage.
When a road is confirmed as blocked, the route engine can exclude the affected road and calculate an alternate path where one exists.
The map visually distinguishes the blocked segment from the new valid route.
7. Offline Emergency Guide
Emergency guidance is available directly inside the app for multiple disaster and assistance scenarios.
The guide is designed as a step-by-step interface with:
large icons and text;
simple navigation;
offline-accessible instructions;
English / Hindi support in the wider application;
optional device speech support where available.
8. Community Assistance
SAHARA also includes a local community-assistance concept where eligible nearby safe users can see assistance requests and respond until professional help arrives.
This feature is designed to complement — not replace — official emergency services.
---
Offline-First Architecture
SAHARA follows a local-first design:
```text
                        ┌──────────────────────┐
                        │   Shared Backend     │
                        │  (when reachable)    │
                        └──────────▲───────────┘
                                   │ sync
                                   │
┌────────────────┐       ┌─────────┴─────────┐       ┌────────────────┐
│ Offline Phone  │ <---> │  Gateway / Phone │ <---> │ Offline Phone  │
│ Local Storage  │ relay │  Local Storage   │ relay │ Local Storage  │
└────────────────┘       └───────────────────┘       └────────────────┘
        │                         │                         │
        ├─ SOS queue              ├─ cached state           ├─ SOS queue
        ├─ emergency guide        ├─ offline maps           ├─ family cache
        ├─ family cache           └─ sync when online       └─ guidance
        └─ shelter/map data
```
An internet connection improves synchronization, but essential information is designed to remain available locally.
---
Tech Stack
Layer	Technology
Frontend	React 19 + TypeScript
Build Tool	Vite
Routing	TanStack Router / TanStack Start
Styling	Tailwind CSS
Icons	Lucide React
Mobile Runtime	Capacitor 8
Android Native	Java
Device Relay	Google Nearby Connections
Maps	Leaflet + packaged local map/road data
Offline Routing	Local graph / A* based routing
Local Persistence	Browser/device local storage and cached application state
Shared Family Demo	Node.js HTTP server + persistent JSON storage
Validation	Node test runner + route/routing smoke tests
---
Project Structure
```text
SAHARA/
├── android/                     # Capacitor Android project + native relay plugin
├── public/                      # Public/static assets
├── scripts/
│   ├── family-server.mjs        # Shared family demo backend
│   ├── prepare-mobile.mjs       # Mobile build preparation
│   └── *.test.mjs               # Backend/routing validation
├── src/
│   ├── components/resq/         # Main mobile UI components
│   │   ├── HomeScreen.tsx
│   │   ├── RelayPanel.tsx
│   │   ├── FamilyScreen.tsx
│   │   ├── FamilyMembersEditor.tsx
│   │   ├── SheltersScreen.tsx
│   │   ├── OfflineMap.tsx
│   │   ├── GuideScreen.tsx
│   │   └── SosFlow.tsx
│   ├── lib/
│   │   ├── sahara-relay.ts      # Capacitor bridge for native relay
│   │   ├── family-sync.tsx
│   │   ├── offline-routing.ts
│   │   ├── shelters.ts
│   │   ├── sos.ts
│   │   └── resq-store.tsx
│   └── routes/                  # Application routes
├── capacitor.config.ts
├── vite.mobile.config.ts
└── package.json
```
---
Run the Web App Locally
Prerequisites
Node.js
npm
Clone the repository and install dependencies:
```bash
git clone <your-repository-url>
cd <repository-folder>
npm install
```
Start the development server:
```bash
npm run dev
```
Open the local address printed by Vite.
---
Run the Shared Family Demo Server
Start the included local family server:
```bash
npm run family:server
```
By default the demo server listens on port `8787`.
Useful environment variables:
```text
SAHARA_FAMILY_PORT
SAHARA_FAMILY_HOST
SAHARA_FAMILY_DB
SAHARA_ALLOWED_ORIGINS
```
For multiple physical phones, all devices must use the same backend that is reachable from those phones. A production deployment should place this service behind HTTPS and use a proper persistent database and authentication system.
---
Build the Android App
Build the mobile web bundle:
```bash
npm run build:mobile
```
Sync it into the Capacitor Android project:
```bash
npx cap sync android
```
Build a debug APK on Windows:
```powershell
cd android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat assembleDebug
```
The APK is generated at:
```text
android/app/build/outputs/apk/debug/app-debug.apk
```
Install it with ADB:
```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
---
Three-Phone Relay Demonstration
A useful prototype demonstration uses three Android phones:
Phone C — Gateway
Internet: ON
Bluetooth: ON
Location / Nearby permission: ON
Open SAHARA and select GATEWAY
Phone A and Phone B — Offline Nodes
Mobile data: OFF
no active internet connection
Bluetooth: ON
Wi-Fi radio may remain enabled for local Nearby transport
Location / Nearby permission: ON
select OFFLINE RELAY
Then:
Confirm the gateway reports connected devices.
Send SOS NOW from Phone A.
Confirm the emergency packet appears on Phone C.
Send a documented emergency from Phone B.
Confirm the second packet reaches the gateway.
Nearby Connections may use Bluetooth, BLE, and local Wi-Fi transports depending on the devices; the phones do not need to be manually paired in Android Bluetooth settings.
---
Key Design Principles
Emergency-first UX
Important actions use large touch targets, readable text, clear icons, and minimal navigation depth.
Local-first operation
Emergency information is recorded locally before depending on network delivery.
Honest status visibility
The interface distinguishes locally saved, queued, relayed, and synchronized information rather than pretending connectivity exists.
Accessibility
Important states are communicated using icon + text + color, rather than color alone.
Natural-disaster focus
The prototype prioritizes scenarios such as floods, landslides, blocked roads, shelter access, evacuation, missing people, and family coordination.
---
Current Prototype Limitations
SAHARA is a hackathon/research prototype, not a certified emergency-service product.
Shelter locations and capacities in the current Aluva demo are demonstration data and must not be treated as verified operational shelters.
Hazard-aware routing only knows hazards that are packaged or reported to the application; it cannot guarantee that a route is safe.
GPS updates are foreground confirmations, not continuous professional tracking.
A locally stored or family-shared SOS is not proof that official emergency services received it.
The shared family backend is a lightweight prototype server, not a production emergency backend.
The Nearby relay is an experimental Android prototype and requires compatible permissions/radios/devices.
Production deployment would require stronger authentication, encryption, backend redundancy, verified shelter feeds, official responder integration, privacy controls, and extensive field testing.
---
Future Scope
verified government/NGO shelter feeds;
responder and control-room dashboard;
stronger end-to-end relay security;
multi-hop store-and-forward mesh networking;
automatic gateway discovery and prioritization;
authenticated family accounts and recovery;
live disaster alerts from verified sources;
responder acknowledgement and incident lifecycle tracking;
stronger multilingual and accessibility support;
background-safe location sharing with explicit user consent;
production-grade encrypted cloud synchronization.
---
Team / Hackathon
Built as SAHARA, an offline-first disaster resilience and emergency coordination prototype.
Mission: keep essential emergency coordination useful even when normal connectivity becomes unreliable.
---
Disclaimer
SAHARA is an experimental prototype for demonstration, research, and hackathon purposes. It is not a replacement for official emergency services, verified evacuation instructions, or professional medical/rescue guidance.

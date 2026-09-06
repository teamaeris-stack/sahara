# SAHARA

We are building a disaster-resilience application called ResQ.

For this step, build ONLY PHASE 1.

Do NOT build SOS forms, shelters, maps, responder dashboards, community alerts, relay networking, emergency guidance, family tracking, authentication, backend integrations, Supabase, Firebase, or APIs yet.

The goal of Phase 1 is to create an extremely stable foundation and the main Citizen Disaster Mode home screen.

==================================================

PRODUCT

==================================================

Name:

ResQ

Tagline:

People. Families. Safer Together.

Core principle:

“When the network disappears, ResQ doesn’t.”

ResQ is an offline-first emergency application intended to remain useful when internet and cellular infrastructure fail.

For now we are creating only the app shell, citizen home screen, offline-state simulation, and local persistence.

==================================================

TECHNICAL CONSTRAINTS

==================================================

Use the existing Lovable React + TypeScript environment.

Use:

- React

- TypeScript

- Tailwind

- Lucide icons if already available

- localStorage

- simple application state

DO NOT use:

- Supabase

- Firebase

- external APIs

- authentication

- Google Maps

- API keys

- additional heavy dependencies

- external data services

The project must run immediately after generation.

Do not change package configuration unless absolutely necessary.

Do not install unnecessary libraries.

==================================================

MOBILE-FIRST REQUIREMENT

==================================================

Design primarily for a smartphone.

The UI should look like a real mobile emergency application, not a desktop website squeezed onto a phone.

It must still respond properly on desktop.

Target users include:

- elderly users

- users with low digital literacy

- frightened or stressed users

- people using older phones

- users who may operate the phone one-handed

Therefore:

- extremely clear hierarchy

- large touch targets

- large readable text

- large icons

- minimal text

- no complicated menus

- no tiny controls

- no excessive animation

- no visual clutter

Never communicate an important state through color alone.

Use:

ICON + TEXT + COLOR.

==================================================

VISUAL IDENTITY

==================================================

Create a professional emergency-response visual identity.

Primary:

Deep navy / dark blue

Safe:

Green

Emergency:

Red

Warning / offline:

Amber

Background:

Very light gray / off-white

Cards:

White with subtle borders/shadows

Use rounded corners but do not make the application look playful.

The product should feel:

- trustworthy

- serious

- modern

- calm

- accessible

Avoid:

- gradients everywhere

- glassmorphism

- cyberpunk styling

- unnecessary animations

- generic SaaS appearance

- cartoon emergency graphics

==================================================

APP SHELL

==================================================

Create a reusable mobile application shell.

Top header:

ResQ

Under or beside it:

small network status indicator.

Possible states:

ONLINE

OFFLINE

When online:

green indicator

“Connected”

When offline:

amber/red offline icon

“Offline Resilience Mode”

At the bottom create a mobile navigation bar with:

HOME

FAMILY

SHELTERS

GUIDE

MORE

For Phase 1:

HOME is active.

The other tabs should exist visually because they establish the final product navigation.

If selected during Phase 1, they should NOT open broken or empty pages.

Instead display a clean temporary informational panel:

“Coming in the next build phase.”

and provide a clear button:

BACK TO HOME

Do not create fake unfinished content.

==================================================

CITIZEN HOME SCREEN

==================================================

The default screen must be the Citizen Home screen.

At the top of the content:

A prominent banner:

⚠ DISASTER MODE ACTIVE

Below it show network state.

When ONLINE:

CONNECTED

Emergency services can synchronize normally.

When OFFLINE:

OFFLINE RESILIENCE MODE

Large supporting text:

“ResQ is still working.”

And smaller text:

“Critical actions and information remain available on this device.”

The offline state must feel reassuring and deliberate, NOT like an application error.

==================================================

PRIMARY EMERGENCY ACTIONS

==================================================

Create THREE very large stacked buttons.

1.

GREEN

check-circle icon

I’M SAFE

2.

RED

SOS / alert icon

I NEED HELP

3.

NEUTRAL / AMBER

message / status icon

CAN’T RESPOND

These should dominate the page.

They must be easy to hit with one hand.

==================================================

I’M SAFE — IMPLEMENT THIS NOW

==================================================

The I’M SAFE button must already be functional in Phase 1.

When pressed:

change the user's local safety status to SAFE.

Show a confirmation panel:

✓ YOU ARE MARKED SAFE

Include:

Status:

SAFE

Last updated:

current local time

Storage:

Saved on this device

If OFFLINE also display:

“Your status is stored locally and will synchronize when connectivity becomes available.”

Persist this information using localStorage.

If the page is refreshed, the SAFE status must remain.

The home screen should then show a small persistent status card:

YOUR STATUS

✓ SAFE

Updated:

[time]

Include:

UPDATE STATUS

This can reopen the status choice.

==================================================

I NEED HELP — PHASE 1 BEHAVIOUR

==================================================

Do NOT build the actual SOS form yet.

When I NEED HELP is pressed, open a clean modal or panel saying:

I NEED HELP

“Emergency reporting will open here.”

Below:

“Phase 2 will add offline SOS creation, location, people count, medical needs and delivery status.”

Button:

RETURN HOME

This is temporary and must look deliberate rather than broken.

Do NOT fabricate a working SOS system yet.

==================================================

CAN’T RESPOND — PHASE 1 BEHAVIOUR

==================================================

When pressed:

display:

CAN’T RESPOND STATUS

“ResQ can preserve your last known status when you cannot provide a full update.”

For now provide:

SAVE STATUS

When clicked:

store locally:

status = CANNOT_RESPOND

timestamp = current local time

Then show:

STATUS STORED ON DEVICE

Persist using localStorage.

==================================================

SECONDARY ACTIONS

==================================================

Below the three main emergency controls create a clean 2 × 2 grid.

Cards:

🏠

FIND SHELTER

🧭

GUIDE ME

👨‍👩‍👧

FAMILY

🤝

HELP NEARBY

These are navigation previews only during Phase 1.

When tapped, show a clean message indicating that the feature belongs to a later build phase.

Do NOT generate those systems yet.

==================================================

OFFLINE INFORMATION CARD

==================================================

At the bottom of the home screen create a subtle information card.

When ONLINE:

“ResQ is connected.”

When OFFLINE:

📵 OFFLINE-FIRST

“Emergency information remains stored on this device.”

“Actions will be queued until a delivery path becomes available.”

Do not imply that Bluetooth relay is already implemented.

==================================================

DEMO CONTROL

==================================================

We need one extremely simple developer/demo control for testing.

Place a small unobtrusive button in the header or More area:

DEMO

When opened, show:

NETWORK SIMULATION

ONLINE

OFFLINE

Use a segmented toggle.

Changing it must instantly change the global network state.

Persist the selected network state in localStorage.

If I switch to OFFLINE and refresh the browser, the application must still show OFFLINE.

Also include:

RESET LOCAL DEMO DATA

When pressed, request confirmation.

If confirmed:

clear ResQ localStorage data

restore network = ONLINE

restore user status = UNKNOWN

Return to Home.

==================================================

APPLICATION STATE

==================================================

Use clean centralized state where practical.

For Phase 1 maintain:

networkStatus:

ONLINE | OFFLINE

disasterMode:

true

userStatus:

UNKNOWN | SAFE | CANNOT_RESPOND

statusUpdatedAt:

timestamp or null

Persist the important values in localStorage.

Use a clear ResQ-specific key namespace so unrelated browser storage is not deleted.

Example:

resq_network_status

resq_user_status

resq_status_updated_at

==================================================

RESPONSIVENESS

==================================================

Test layout conceptually at:

360px width

390px width

430px width

desktop

There must be:

- no horizontal scrolling

- no clipped text

- no overlapping buttons

- no tiny controls

- no strange excessive whitespace

On desktop:

center the citizen interface in a sensible application-width container instead of stretching emergency buttons across the entire monitor.

==================================================

ACCESSIBILITY

==================================================

Use semantic buttons.

Add aria-labels where appropriate.

Provide visible keyboard focus.

Ensure strong contrast.

Use meaningful icons.

Emergency labels must remain text-based even when icons are present.

Do not rely on red/green alone.

==================================================

PHASE 1 ACCEPTANCE REQUIREMENTS

==================================================

Before considering Phase 1 complete, verify that:

1. App loads without errors.

2. Citizen Home is the default screen.

3. Mobile design is polished.

4. Disaster Mode banner is visible.

5. ONLINE/OFFLINE demo toggle works.

6. Network state survives refresh.

7. OFFLINE mode clearly says “ResQ is still working.”

8. I’M SAFE works.

9. SAFE status survives refresh.

10. CAN’T RESPOND status works and survives refresh.

11. I NEED HELP does not crash and opens its temporary Phase 2 panel.

12. Secondary feature cards do not lead to empty/broken pages.

13. Bottom navigation works safely.

14. Reset Demo Data works.

15. There are no external API/backend requirements.

16. There are no console-breaking errors.

17. There is no horizontal overflow on mobile.

18. No advanced feature from later phases has been unnecessarily implemented.

==================================================

IMPORTANT

==================================================

Do not attempt to impress me by building later features.

A clean and flawless Phase 1 is more important than building more.

Do not refactor unrelated project configuration.

Do not introduce backend architecture.

Do not ask questions.

Implement Phase 1 now and stop after Phase 1 is complete.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/71dccfd9-2c25-4a20-8311-f2f2322f171a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

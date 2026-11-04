# KisanVriddhi — Farm Market, Finance & Knowledge Platform

A cross-platform mobile application (Android, built with Expo / React Native) that
gives a farmer a single platform for the business and knowledge side of farming —
in nine Indian languages, with a built-in AI text assistant and an always-on
conversational voice agent.

KisanVriddhi brings the market, money, inputs, information and entitlements that
surround cultivation into one hub, matched to the farmer's own location and context,
so better-informed decisions grow the farmer's prosperity.

## Features

- **Market** — live mandi (wholesale) crop prices with real road distances and a
  transport planner, plus an AI sell / hold advisor.
- **Expenses** — an income-and-expense ledger with charts.
- **Input Prices** — live price lookups for seeds, fertilisers and pesticides.
- **Shops** — a locator for nearby agri-input stores, with directions.
- **News** — a farmer-tuned agricultural news feed.
- **Library** — an in-app e-library with a book reader.
- **Govt Schemes** — a desk of matched government schemes and their benefits.
- **AI assistant** — a text chat assistant grounded in the farmer's own context.
- **Voice agent** — an always-on conversational agent (speech-to-text, tool calling,
  text-to-speech) that can navigate, read screens aloud, log an expense, check a
  price and answer questions hands-free, in nine languages.

The home is a circular hub that opens each service; registration captures the
farmer's profile and location (so prices, news and schemes match their area) and
a membership plan.

## Technology

- Expo SDK 57, React Native 0.86, React 19, expo-router, TypeScript (strict).
- Supabase for authentication and per-farmer data (row-level security).
- Server-mediated AI (Groq) via a web API; speech via on-device, self-hosted and
  cloud (NVIDIA) tiers.
- Maps via MapLibre; charts via react-native-svg.

## Build & run

Requires Node 20+ and the Android SDK (a custom dev build — Expo Go cannot run the
native modules this app uses).

```bash
npm install
# configure .env.local (the EXPO_PUBLIC_* variables)
npx expo run:android      # build and launch on an emulator or device
```

Type-checking: `npx tsc --noEmit`. Lint: `npx expo lint`.

## Backend

The app connects to a hosted Supabase project and a web API (`EXPO_PUBLIC_API_BASE_URL`)
for AI features. These backend services are shared infrastructure and are not part of
this work.

## Copyright

Copyright (c) 2026 Anoopkumar V, Barsha Sharma, Sahajta Singh. All rights reserved.
See `LICENSE`.

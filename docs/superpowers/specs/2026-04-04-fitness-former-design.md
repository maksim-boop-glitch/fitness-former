# Fitness Former — Design Spec

**Date:** 2026-04-04  
**Status:** Approved

---

## Overview

Fitness Former is a web-based fitness app that lets users upload a short video of themselves performing an exercise. The app uses AI (MediaPipe Pose, running entirely in the browser) to detect joint positions, identify the exercise, and flag form errors — then overlays annotated feedback directly on the video playback.

Works on any device with a camera and a modern browser (iPhone Safari, Android Chrome, desktop). No app store install required.

---

## Target Users

Gym-goers of all levels — beginners to advanced — performing weighted barbell/dumbbell/machine movements or bodyweight exercises.

---

## Architecture

**Pure frontend (Option A).** All AI processing runs in the browser using [MediaPipe Pose](https://google.github.io/mediapipe/). No video is ever sent to a server. A lightweight JavaScript rule engine evaluates joint angles and positions against per-exercise form standards to detect errors.

A minimal optional backend handles user accounts and history storage only. Users who do not sign in get full analysis functionality with no data persisted.

**Tech stack:**
- Frontend: HTML/CSS/JS (PWA)
- Pose estimation: MediaPipe Pose (WebAssembly, runs in-browser)
- Form rules: JS rule engine, one rule set per exercise
- Optional backend: Node.js or similar, REST API for account + history
- Storage: LocalStorage for anonymous session, backend DB for accounts

---

## Exercise Library

Four categories, all supported:

| Category | Examples |
|---|---|
| Big compound lifts | Squat, deadlift, bench press, overhead press, barbell row |
| Bodyweight | Push-up, pull-up, dip, lunge, plank, burpee |
| Machine / cable | Lat pulldown, cable row, leg press, chest fly |
| Olympic / athletic | Clean & jerk, snatch, box jump, kettlebell swing |

Each exercise has a defined set of form rules (joint angle thresholds, alignment checks) and a list of common errors with correction cues.

---

## Screens & Navigation

Four tabs in a bottom navigation bar:

### 1. Analyze Tab (home)
- Large video upload/record area (drag-and-drop or tap, max 60 seconds, MP4/MOV)
- Weight input field with lbs/kg toggle and up/down stepper
- "Analyze My Form" CTA button
- Sign in / Sign up link (non-blocking — app works without account)

### 2. Results Screen (shown after analysis)
- Exercise name auto-detected and displayed
- Weight used displayed alongside exercise name
- Color gradient bar (red → yellow → green) with marker showing form score (0–100)
- Video playback with joint dot overlay:
  - Green dots = correct joints
  - Red dots = problem joints
  - Error callout labels on the video at the problem joint
- Scrollable list of issues below the video:
  - Red (✗) = critical errors with fix cue
  - Yellow (~) = warnings with fix cue
  - Green (✓) = things done correctly
- "Analyze Another Video" button

### 3. History Tab
- Requires account (prompt to sign in if anonymous)
- Chronological list of past sessions
- Each entry shows: exercise name, weight used, date, issue count, form score
- Score badge color: red (0–50), yellow (51–74), green (75–100)
- Tap any entry to replay the annotated video and re-read feedback

### 4. Exercises Tab
- Search bar for exercise or muscle name
- Muscle group filter pills: Chest, Back, Legs, Shoulders, Arms, Core
- Exercise list filtered by selected muscle group
- Each exercise card shows: name, equipment type, primary muscles, "Form guide →" link
- Tapping an exercise opens a detail view:
  - Form guide video/animation
  - Key coaching cues (bullet list)
  - "Record & Analyze This Exercise" button that deep-links to the Analyze tab

### Profile Tab (4th tab icon)
- Sign in / Sign up / Log out
- Unit preference (lbs vs kg)
- Account deletion

---

## Form Score

Score 0–100 calculated from the ratio of passing to failing form checks for the detected exercise. Color mapping:

| Range | Color | Label |
|---|---|---|
| 0–50 | Red | Poor |
| 51–74 | Yellow/Amber | Fair |
| 75–89 | Light green | Good |
| 90–100 | Green | Excellent |

---

## Visual Style

- **Background:** Near-black (`#0d0d0d`, `#111`)
- **Accent:** Orange fire gradient (`#ff6b00` → `#ff9500`)
- **Typography:** Bold, uppercase labels for section headers; clean sans-serif for body
- **Tone:** High-energy, gym-culture, performance-focused

---

## Key Constraints

- Video never leaves the device (privacy by design)
- Full functionality without an account
- Must work on iPhone Safari and Android Chrome
- No app store distribution — pure web PWA
- Max video length: 60 seconds (keeps processing fast on mobile)

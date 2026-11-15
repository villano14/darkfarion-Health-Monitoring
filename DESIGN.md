---
name: Qhalikay
description: An astronaut's daily health check, read like a star atlas plate on a night-sky ground.
colors:
  night-sky: "#0a1021"
  night-well: "#070c19"
  plate: "#0f182d"
  plate-float: "#0f182deb"
  deep-indigo: "#16233d"
  stardust: "#f2f2e9"
  stardust-dim: "#c8ccd6"
  fog: "#8f99ad"
  chart-blue: "#24374f"
  chart-blue-strong: "#3a4c68"
  nasa-blue: "#0b3d91"
  nasa-blue-lit: "#1250b8"
  pale-chart-blue: "#8fb3f2"
  star-red: "#fc3d21"
  star-red-ink: "#ff8069"
  glow-amber: "#ffb36b"
  glow-amber-ink: "#ffc48f"
  in-range-blue: "#9db8ea"
  in-range-ink: "#bcd0f3"
typography:
  display:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "40px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.2
  title:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  body:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-read:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.14em"
  status-word:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.1em"
rounded:
  sm: "2px"
  md: "3px"
  point: "50%"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.nasa-blue}"
    textColor: "{colors.stardust}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.nasa-blue-lit}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.stardust}"
    rounded: "{rounded.sm}"
    padding: "0 24px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.deep-indigo}"
  button-small:
    padding: "0 16px"
    height: "36px"
  plate:
    backgroundColor: "{colors.plate}"
    rounded: "0"
    padding: "24px"
  plate-float:
    backgroundColor: "{colors.plate-float}"
    rounded: "{rounded.sm}"
    padding: "16px"
  input:
    backgroundColor: "{colors.night-well}"
    textColor: "{colors.stardust}"
    typography: "{typography.body-read}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  chip-alert:
    backgroundColor: "#fc3d211f"
    textColor: "{colors.star-red-ink}"
    rounded: "{rounded.sm}"
    padding: "0 8px 0 6px"
    height: "22px"
  chip-watch:
    backgroundColor: "#ffb36b1c"
    textColor: "{colors.glow-amber-ink}"
    rounded: "{rounded.sm}"
    padding: "0 8px 0 6px"
    height: "22px"
  chip-normal:
    backgroundColor: "#9db8ea1a"
    textColor: "{colors.in-range-ink}"
    rounded: "{rounded.sm}"
    padding: "0 8px 0 6px"
    height: "22px"
  nav-link:
    textColor: "{colors.fog}"
    padding: "0 12px"
    height: "60px"
  nav-link-active:
    textColor: "{colors.stardust}"
  object-index-row:
    backgroundColor: "transparent"
    padding: "0 16px"
    height: "42px"
  object-index-row-active:
    backgroundColor: "{colors.deep-indigo}"
---

# Design System: Qhalikay

## Overview

**Creative North Star: "The Star Atlas Plate"**

Qhalikay reads like a plate from a celestial atlas. The astronaut's body is the chart; the seven body systems are objects on it, ranked by magnitude, and the one that needs care sits under a night-vision red reticle with its name written beside it in italic, the way a constellation is named on a printed chart. Everything else on screen serves as the plate's apparatus: an object index, a key, a scale along the bottom edge, a title strip on top. The ground is the night sky made from NASA Blue darkened almost to black, because the user checks in under the dimmed light cycle of a module, often on a phone, one-handed.

The density is that of a working chart: hairline frames, tabular figures, small tracked capitals for region names, generous empty sky around the body. Color is scarce and semantic. NASA Red is the star red and means alert, selection, or "you are here"; glow amber means watch; a pale chart blue means in range and also carries links and focus. Severity is never color alone: it is drawn as dot diameter on a fixed ramp and always paired with a word.

This world replaced an earlier light look of rounded white wellness cards with blue accents. It rejects that light wellness dashboard, and it equally rejects the neon sci-fi HUD (glows, scanlines, cyan on black, angular clipped frames).

**Key Characteristics:**
- Night-sky ground (deep NASA-Blue navy), stardust text, chart-blue hairlines.
- Severity as magnitude: dot diameter 14 / 10 / 5px for alert / watch / in range, always with a status word.
- Square-cut plates with corner registration ticks; circles only for point-like objects.
- Source Serif 4 italic names objects (systems, people, missions, page titles); Public Sans with tabular figures does all the work.
- Tracked uppercase red labels name regions of the plate.
- One red reticle with an italic annotation marks the focused alert system on the 3D stage.

## Colors

A night-sky palette built from NASA Blue darkened, with NASA Red as the only hot color and amber as its quieter partner.

### Primary
- **NASA Blue** (`nasa-blue`): the fill of every primary action (buttons, the timeline play control, Orbi chat's user bubbles, send button) and the text-selection highlight. A brand commitment; it lives as a fill, never as text on the night ground, where it would not read.
- **NASA Blue Lit** (`nasa-blue-lit`): hover state of NASA Blue fills.
- **Pale Chart Blue** (`pale-chart-blue`): NASA Blue lifted for legibility on the dark ground. Links, link buttons, focus outlines (2px, 2px offset), the selected mood, "due" task state, chart lines, the in-range confirmation banner. Its translucent forms (`#8fb3f21a` soft fill, `#8fb3f24d` line) mark the active object-index row and Orbi suggestion chips.

### Secondary
- **Star Red** (`star-red`): NASA Red, the brand commitment, used as the chart's star red. Alert status dots and fills, the reticle and its leader line on the 3D stage, the active nav underline (2px), the segmented-control and language-switch indicator bar, the timeline's day thumb, the caret in inputs, the brand mark, the "today" ring in the week strip, the solar-storm switch.
- **Star Red Ink** (`star-red-ink`): Star Red lightened for text: region labels, alert status words and chips, the reading in the stage annotation, numbered-step counters, table headers in Mission Control. Soft fill `#fc3d211f` backs alert chips, findings and escalation blocks.

### Tertiary
- **Glow Amber** (`glow-amber`): watch status. Watch dots (10px), overdue task rings, the "viewing another crew member" banner, earned achievements, points icon, the space-weather icon. Soft fill `#ffb36b1c`.
- **Glow Amber Ink** (`glow-amber-ink`): watch text: status words, chips, overdue labels.
- **In-Range Blue** (`in-range-blue`) and **In-Range Ink** (`in-range-ink`): the in-range status. The smallest dot (5px), completed task checks, progress bars, the live-feed pulse. Deliberately cool and quiet so normal never competes with alert.

### Neutral
- **Night Sky** (`night-sky`): the page ground, the navbar and timeline strips, and the ISS stage background so the 3D scene and the page are one surface.
- **Night Well** (`night-well`): sunken surfaces: inputs, segmented tracks, empty chart wells, numbered-step boxes.
- **Plate** (`plate`): panels and cards. **Plate Float** (`plate-float`, 92% opaque) is the same plate over the 3D stage, so the starfield shows faintly through.
- **Deep Indigo** (`deep-indigo`): raised rows, hover fills, the active segment, toast and dialog headers.
- **Stardust** (`stardust`): primary text, warm off-white. **Stardust Dim** (`stardust-dim`): secondary body text, descriptions, legend.
- **Fog** (`fog`): muted text, inactive nav, hints, units. Readable on every panel (the direction contract named a darker fog for rules; the build moved rules to chart blue and lifted fog for legibility).
- **Chart Blue** (`chart-blue`): every hairline: plate frames, row dividers, navbar and timeline rules, chart gridlines. **Chart Blue Strong** (`chart-blue-strong`): corner registration ticks, input and secondary-button borders, the region-label rule, scrollbar thumb, minor timeline ticks.

### Named Rules
**The Star Red Rule.** Star Red means alert, selection, or the focused position (reticle, active tab, day thumb, caret). It is never decoration, never a background wash, and never a second brand accent on a calm screen.

**The Magnitude Rule.** Status is drawn as dot diameter on the fixed ramp (alert 14px with a 1px red ring offset by 3px of night; watch 10px; in range 5px), always next to a status word or icon. The same ramp is used in the object index, legend, crew cards and alerts.

**The Fill-Not-Text Rule.** NASA Blue is a fill. When blue must be read as text on the night ground, use Pale Chart Blue.

## Typography

**Display Font:** Source Serif 4 (variable, italic only, with Georgia fallback)
**Body Font:** Public Sans (variable, with system-ui fallback)

**Character:** Public Sans is the plain, governmental working face of the chart, set with tabular figures everywhere so readings, MET clocks and mission days align. Source Serif 4 italic is the atlas's hand: it names objects, never explains them.

### Hierarchy
- **Display** (Source Serif 4 italic 500, 40px, 1.1, -0.01em): page titles (Rutina, Tripulación, sign-in heading). 24px on phones.
- **Headline / Object name** (Source Serif 4 italic 500, 17 to 24px, 1.1 to 1.2): names of body systems in the object index (17px) and detail header (24px), crew members (20px), missions (26px), the brand wordmark (21px), user name, alert subjects, dialog titles, admin section titles.
- **Title** (Public Sans 600, 20px, 1.3, -0.01em): section headings inside plates.
- **Figure** (Public Sans 600, 28px, 1.1, -0.02em, tabular): metric readings; routine stats go up to 40px at -0.03em. 22px on phones.
- **Body** (Public Sans 400, 15px, 1.5, tabular): default interface text. **Body Read** (16px) for explanations, inputs and emphasized lines.
- **Label** (Public Sans 600, 11px, 0.14em, uppercase, Star Red Ink): region names of the plate (object-index title, environment key, "do now", hazards, MET, timeline day, stat captions), followed by a hairline running to the frame edge.
- **Status word** (Public Sans 700, 10px, 0.1em, uppercase): the word beside a magnitude dot (ALERTA, VIGILAR, NORMAL), role lines, table headers. Chips and tags use 11px 700 at 0.08em.

### Named Rules
**The Italic Names Objects Rule.** Source Serif 4 italic is used only for names of things: systems, people, missions, achievements, page titles, the brand. Never for body copy, numbers, buttons or explanation.

**The Tabular Figures Rule.** All numbers are tabular (`font-variant-numeric: tabular-nums` on the root). Readings, clocks and counts must never jitter.

## Layout

The app is a fixed-height shell (100dvh, no page scroll): a 60px title strip on top, the page below. The body route is the chart: a full-bleed 3D stage with a 60px timeline strip under it. Overlays sit on the stage at 16px insets: the object index and space weather at top-left (260px), the environment key at top-right, legend and view controls on the bottom edge. A selected system opens floating plates in two side columns (300px left, 320px right, starting 88px down) around a centered header plate, so the body stays visible in the middle.

Content routes (vitals, routine, crew, mission control) scroll inside a centered column of 1120px max (760px for routine), padded 32px top, 24px sides, 48px bottom. Vitals pairs a form with a sticky assessment plate (1.5fr / 1fr, min 320px). Crew and achievements use auto-fill grids (min 330px and 300px).

Spacing runs on a 4 to 48px scale (4, 8, 12, 16, 24, 32, 48). Rows inside plates are divided by hairlines rather than gaps.

Breakpoints: at 1180px the MET clock and user name collapse; at 1100px vitals stacks to one column and the side columns narrow; at 760px the nav moves to a 64px bottom tab bar (red tick on top of the active tab), the object index becomes a horizontal strip of names, the legend and weather hide (storms still show), and the floating plates stack in a bottom sheet capped at 62% height.

## Elevation & Depth

The system is flat. Depth comes from tone (night well below, plate, deep indigo above) and from hairlines, not from shadows. The one exception is anything that floats over other content: plates over the 3D stage, the detail sheet, toasts, the pulse dialog, the Orbi button and chat panel. Those carry dark, soft shadows that read as separation from the stage, never as lift on hover.

The 3D stage is its own depth: per-environment background, an unlit floor that holds the exact night tone of the environment (it does not catch the room light), a platform with rings, a starfield, and hemisphere, key and rim lights tuned per environment (station, deep space, Moon, Mars).

### Shadow Vocabulary
- **Float** (`box-shadow: 0 6px 18px #00000059`): floating plates over the stage, the viewing banner.
- **Float deep** (`box-shadow: 0 18px 48px #00000080`): detail panel, toasts, dialog, Orbi button and panel, always combined with a 1px chart-blue ring.
- **Sheet** (`box-shadow: 0 -8px 32px #00000080`): the phone bottom sheet of detail plates.
- **Hairline ring** (`box-shadow: 0 0 0 1px #24374f`): the edge of floating surfaces drawn as a shadow so it stays crisp over the stage.

### Named Rules
**The Only-Floating-Casts Rule.** A surface casts a shadow only if it floats over the stage or over other content. Plates on the night ground are flat and framed.

## Shapes

Plates are cut square, like printed chart plates: a 1px chart-blue frame with 9px registration ticks at each corner in chart blue strong. Controls inside them take a barely-there 2px corner (3px for metric and escalation blocks) that keeps them crisp without reading as rounded cards. Region labels end in a hairline that fades out toward the frame edge.

Circles are reserved for point-like objects: magnitude dots, avatars, task checks, numbered step counters, mood choices, achievement marks, icon buttons, the reticle, the Orbi button. The timeline is drawn as a chart scale: a tick per day, a long tick every ten, a 3px red thumb.

**The Square Plate Rule.** Containers are never rounded beyond 3px. Round shapes mean "a point on the chart" or "a person", nothing else.

## Components

### Buttons
Quiet, rectangular, decisive.
- **Shape:** 2px corners, 44px tall (36px small).
- **Primary:** NASA Blue fill, stardust text, 1px `#3d6bc4` edge, 15px 600, 24px side padding.
- **Secondary:** transparent with a chart-blue-strong hairline, stardust text.
- **Hover / Focus:** primary lightens to NASA Blue Lit; secondary fills deep indigo and its border goes to fog. Hover only on fine pointers. Press nudges 1px down and scales to 0.985 in 90ms. Focus is a 2px pale chart blue outline at 2px offset.
- **Link button:** pale chart blue text with an arrow that slides 3px on hover.
- **Icon button:** 40px circle, fog icon, deep indigo on hover.

### Chips
- **Style:** 22px tall, 2px corners, 11px 700 uppercase at 0.08em, a 13px icon, translucent status fill with the status ink color (alert, watch, in range).
- **Role and tier chips:** 20px, 10px uppercase; roles are outlined in their color, tiers filled (surgeon tier is solid Star Red).

### Cards / Containers (Plates)
- **Corner Style:** square, with corner registration ticks.
- **Background:** plate on the night ground; plate float over the stage.
- **Shadow Strategy:** none on the ground; Float over the stage (see Elevation & Depth).
- **Border:** 1px chart blue; alert plates tint the border 50% Star Red, watch plates 45% amber.
- **Internal Padding:** 24px (16px on phones and for floating plates).

### Inputs / Fields
- **Style:** 44px, night well background, 1px chart-blue-strong border, 2px corners, 16px text, red caret. Placeholders are italic fog range hints.
- **Focus:** border turns pale chart blue with a 3px soft blue halo.
- **Error / Watch:** the field cell tints with the status soft fill and its border mixes in the status color. Vitals fields form a hairline grid (two columns, one on phones).
- **Sign-in and admin labels:** 11px tracked uppercase fog above the input.

### Navigation
- **Title strip:** 60px, night sky with a chart-blue rule underneath. Italic wordmark beside a red orbit mark; tabs in fog, active tab in stardust 600 with a 2px Star Red underline that scales in over 240ms. Counts sit in small square badges (amber when tasks are overdue). The right end holds the EN/ES switch (red indicator bar), MET in tabular figures with a red label, the streak, and the user.
- **Phones:** tabs move to a 64px bottom bar, icon over label, with the red tick on top.

### Segmented controls
A night-well track with a hairline; the selected option is a deep indigo block with a 2px Star Red bar along its bottom that slides between options (240ms). Used for detail tabs, front/side/back view, and language.

### Object Index (signature)
The left plate on the body route: a red region label ("2 at risk"), then one 42px row per body system, divided by hairlines: magnitude dot, italic system name, and on the right the latest reading over its status word. The active row fills deep indigo with a pale-blue inner ring. On phones it becomes a horizontal strip of dot and name.

### Reticle and Annotation (signature)
On the 3D stage, the first on-screen alert system sits under a Star Red reticle: a 5px ring, a faint outer ring at 45% opacity, four ticks and a center point, scaled to the organ. Beside it a red leader line breaks upward into the system's name in Source Serif 4 italic (stardust) over its reading in Public Sans 600 (Star Red Ink). The annotation is hidden on phones, where the object index already carries the reading.

### Environment Key
A plate at the stage's top-right with a red region label and one button per environment, each with its own tint dot (station in-range blue, deep space `#a4aefc`, Moon `#d3d8e0`, Mars `#ff9466`). The pressed one gets a 16% tint wash and a 2px tint bar at its bottom.

### Orbi
The mascot artwork and its floating button are a brand commitment and stay exactly as drawn: a 76px circle (62px on phones) with a light sky backdrop (`#dbe8fb`), a float animation, and a status ring (red or amber) when there is something to say. The chat panel follows the system: square plate, deep indigo header with the italic name, night-sky message well.

## Do's and Don'ts

### Do:
- **Do** draw every status as a magnitude dot on the 14 / 10 / 5px ramp with its status word or icon next to it.
- **Do** keep Star Red for alert, selection and the focused position: the reticle, active tab underline, segment bar, day thumb, caret.
- **Do** frame plates with a 1px chart-blue hairline and corner registration ticks, square-cut.
- **Do** name objects (systems, people, missions, page titles) in Source Serif 4 italic 500, and set everything else in Public Sans with tabular figures.
- **Do** name regions of a plate with 11px tracked uppercase Star Red Ink labels followed by a hairline.
- **Do** use NASA Blue as a fill for primary actions and Pale Chart Blue when blue must be read as text.
- **Do** give shadows only to surfaces floating over the stage or over other content.
- **Do** keep the 3D body as the center of the body route; overlays sit at the edges at 16px insets and leave the figure clear.
- **Do** keep touch targets at 44px and honor reduced motion (all transitions and animations stop).

### Don't:
- **Don't** return to the light wellness dashboard: rounded white cards, soft drop shadows on every card, blue-on-white.
- **Don't** drift into a neon sci-fi HUD: glows, scanlines, cyan on black, clipped angular frames.
- **Don't** round containers beyond 3px; circles are for points and people only.
- **Don't** convey status by color alone.
- **Don't** change the Orbi artwork or its floating button.
- **Don't** use the NASA insignia ("meatball") or the NASA logotype anywhere; only the two NASA colors are used.
- **Don't** set body copy, numbers or buttons in the italic serif.

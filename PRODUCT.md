# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: an astronaut on a long-duration mission (space station, deep-space craft, lunar or Mars base) who checks their own health every day, alone or between tasks, inside a closed cabin, often on a phone. They log readings, see which body system needs attention and decide what to do next.

Secondary: the crew medical officer (an astronaut with medical training who watches the whole crew and answers crew-level alerts) and the flight surgeon on the ground (reviews surgeon-level alerts across the communication delay, leaves guidance). Mission control manages people and missions.

The product is a NASA Space Apps Challenge entry; judges see it through a short demo of the astronaut's daily use.

## Product Purpose
Help astronauts assess their own health during a mission and act on it: gather health indicators (keyboard, taps, phone camera), show each body system's status at a glance, explain each measurement and risk in plain words, and say who should act. Success: an astronaut understands their state in seconds and knows the next step without already knowing medicine.

## Positioning
- The 3D body is the interface: tap an organ to see its function, status and actions, instead of reading tables.
- A clear escalation ladder: self-care, tell the crew, or call the flight surgeon (alert two days in a row), computed on the server so everyone sees the same thing.
- Real NASA data: live space weather (NASA DONKI), the Inspiration4 crew blood panel (NASA OSDR OSD-575), NASA-STD-3001 radiation limits.
- Adapts to the mission environment: station, deep space, Moon, Mars change gravity, radiation dose, signal delay and whether the crew must act autonomously.

## Operating Context
- Daily routine with scheduled measurements and exercise (resistance device, cycle ergometer); overdue tasks are flagged.
- Readings: blood pressure, resting heart rate (typed or measured with the phone camera), blood sugar, temperature, sleep, mood, fluid intake; onboard scans for calcium, creatinine, radiation dose, bone density, muscle mass; solar particle events from the live feed.
- Timeline across mission days; trend charts; a text report for the flight surgeon.
- Orbi, an AI health companion that answers with the astronaut's own readings.
- Spanish and English.

## Capabilities and Constraints
- Frontend: Vite + React + Three.js, deployed on Vercel. Backend: Go + PostgreSQL on Railway; the frontend consumes everything from the API (no simulated data in the browser).
- Roles: astronaut, crew medical officer, flight surgeon, mission control; permissions enforced on the server.
- Gamification: streak, points per measurement and workout, levels, achievements.
- 3D anatomy from BodyParts3D 4.0 (CC BY 4.0); attribution must stay.
- Not a medical device; thresholds are educational reference values.

## Brand Commitments
- Orbi, the mascot: its artwork and floating button stay exactly as they are.
- NASA colors: NASA Blue #0B3D91 and NASA Red #FC3D21. The official NASA insignia ("meatball") and logotype are trademarks and must not be used.
- The product name is "Qhalikay" (binding, set by the user). Internal identifiers (storage keys, token issuer, demo email domain) still say crewhealth.

## Evidence on Hand
- NASA OSDR OSD-575 Inspiration4 comprehensive metabolic panel: `backend/scripts/inspiration4-cmp.json` (also in the database).
- Live NASA DONKI space weather through the backend.
- Demo mission "Expedition 7" with four crew; daily vitals, sleep and mood are generated demo data (labelled `seed`); blood panel baselines are real Inspiration4 preflight values. No real astronaut daily vitals exist to show.

## Product Principles
- Status at a glance, explanation on demand: never color alone, always a word and an icon.
- Don't assume medical knowledge: every measurement says how, why, and how space changes it.
- Tell the person who acts next, not just what is wrong.
- Real data over decoration; label anything synthetic.
- The body comes first; panels serve it, never bury it.

## Accessibility & Inclusion
Used one-handed on a phone in a moving, noisy cabin: large touch targets, readable at arm's length, works with reduced motion, status never conveyed by color alone, Spanish and English.

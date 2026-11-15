# CrewHealth · Design system

The nasa.gov visual language applied to a working tool: a black shell, a white work surface, a strict gray scale and square corners. Tokens live in `src/styles/tokens.css`; components in `src/styles/components.css`.

## Color
| Role | Token | Value |
|---|---|---|
| Shell (header, tab bar, toasts, chat header) | `--shell` | `#17171b` |
| Page / surface | `--bg` / `--surface` | `#f6f6f6` / `#ffffff` |
| Ink / secondary / muted | `--ink` / `--ink-2` / `--muted` | `#1b1b1b` / `#2e2e32` / `#58585b` |
| Lines (hairline / strong / inputs) | `--line` / `--line-strong` / `--line-input` | `#e3e3e3` / `#d1d1d1` / `#b9b9bb` |
| NASA Red: alerts, current-tab bar, arrow-circle, list numerals | `--nasa-red` | `#f64137` |
| Interactive blue: links, focus, selection | `--primary` | `#1c67e3` |
| Watch / Normal | `--watch*` / `--normal*` | amber / green, each with ink and soft tints |

Color only where it means something: red = alert, amber = watch, green = in range, blue = you can click this. Primary buttons are solid ink, not colored.

## Type
- **Geist** for the interface. Scale: 11 / 13 / 15 / 16 / 20 / 28 / 32 px.
- **Geist Mono** for measured data (readings, units, MET clock, times, counts) and small uppercase labels tracked at `0.08em` (`.micro`, chips, card labels). Never for prose.

## Shape & depth
- Radius 2px on controls, 4px on panels. Round only for icon buttons, dots and Orbi.
- Borders do the work. Shadows only on panels floating over the 3D stage and on overlays.

## Signature
- Telemetry readouts: every measured value set in Geist Mono with its unit.
- The nasa.gov red arrow-circle (`.link-btn svg.arrow-go`) on links that take you somewhere.
- A 3px red bar marks the current section in the header (bottom edge) and the phone tab bar (top edge).

## Components
- Tabs: underline with a 2px ink bar. The camera-view switch over the stage is the boxed variant.
- Status chips: square, mono, uppercase, tinted background, always icon + word.
- Forms: one surface, one row per reading (label + hint left, input + unit right), no box per field.
- Lists: rows split by hairlines, no cards inside cards.

## Motion
150–250 ms, `--ease-out` for entrances. Motion shows a state change (tab bar, panel entrance, check, toast); nothing loops except Orbi's artwork and the live-data dot. `prefers-reduced-motion` turns it all off.

## Orbi
The mascot artwork and its floating button stay as they are, by product decision.

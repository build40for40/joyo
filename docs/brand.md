# Joyo brand and UI guidelines (v0.1)

Apply these to every Joyo screen: onboarding, the question flow, results and the wheel. The tokens live in [`src/styles/tokens.css`](../src/styles/tokens.css) and the global element styles in [`src/styles/base.css`](../src/styles/base.css), both imported in `main.ts`. Style components only through the `--joyo-*` CSS variables. Never hard-code a hex value in a component.

## 1. Brand idea

- **Product:** Joyo finds your birth time from the dated events of your life, then shows how each area of life moves through seasons.
- **Mood:** a starry night sky with a mood ring glowing on it. The page is calm, and the data is vibrant.
- **Message:** action beats anxiety. Joyo answers "when is a good time to act?", never "what bad thing will happen?".
- **Three words:** calm, warm, luminous.

## 2. Colour

The interface is dark only. `tokens.css` sets `color-scheme: dark`, and `base.css` gives `html` and `body` the night background.

| Token | Hex | Use |
| --- | --- | --- |
| `--joyo-night` | `#0D0E24` | Page background |
| `--joyo-surface` | `#171936` | Cards |
| `--joyo-surface-2` | `#1F2244` | Inputs, chips |
| `--joyo-line` | `#2C2F57` | Borders |
| `--joyo-ivory` | `#F3EBDD` | Text, stars |
| `--joyo-lavender` | `#9A93B8` | Secondary text, labels, placeholders |
| `--joyo-gold` | `#E8C26A` | Action: primary button, selected, focus |
| `--joyo-gold-hover` | `#F2D488` | Gold hover |
| `--joyo-gold-soft` | `rgba(232,194,106,.18)` | Selected fill, focus ring |
| `--joyo-on-gold` | `#1A1530` | Text on gold |
| `--joyo-error` | `#E89A8A` | Soft coral error text |

**Mood scale** (data only, Resting 1 to Active 8): `--joyo-scale-1` `#2E2F5E`, `-2` `#5A3A6E`, `-3` `#8A3558`, `-4` `#C4527A`, `-5` `#DE7E6E`, `-6` `#E4A55C`, `-7` `#E8C26A`, `-8` `#F2DC9A`.

**Rules**

- **Gold means action.** Use it for the primary button, the selected state, slider thumbs and focus rings. One gold primary button per screen.
- **The mood scale is for data only** (wedges and the legend). It always runs in this order, so don't reorder it or add steps.
- **Indigo means "resting", not "bad".** Never label any colour as negative.
- **Never use** green, pure red, black, neutral grey or pure white. Errors use soft coral text with an icon, never a red box.
- These hex values are our own palette. Pantone was a reference only, so never use Pantone names or numbers.

## 3. Typography

Loaded from Google Fonts in `index.html`.

- **Marcellus 400** (`--joyo-font-display`) for page titles, question text, the big date or time and the wheel centre. Never for body copy or buttons.
- **Manrope 400/500/600** (`--joyo-font-body`) for everything else. Buttons use 600.
- **IBM Plex Mono 400/500** (`--joyo-font-mono`) for times, ranges, confidence numbers and ticks, always with `font-variant-numeric: tabular-nums`.
- **Scale:** Display 40 (28 on mobile), Question 28 (22 on mobile), Heading 22, Body 16, Small 14 (lavender), Label 11–12 (uppercase, 0.14em tracking, lavender), Time readout 34 mono.
- Headings use `text-wrap: balance`, and running text is at most 65ch wide.

## 4. Background

A flat night background with a sparse star field: the `StarField` component in `App.vue` draws 200 ivory dots at 25 to 60% opacity that twinkle slowly and stay still under reduced motion. No gradients across the whole page, nebula images or photos.

## 5. Components

Onboarding comes first: one question per screen, not a chat.

- **Question card:** centred, max 560px wide, `--joyo-surface` fill, 1px `--joyo-line` border, `--joyo-radius-card`, 32px padding (20px on mobile). A progress label sits above it, with no percentage. The question uses Marcellus. Questions change with a `--joyo-dur` crossfade and a 12px upward slide.
- **Primary button:** gold fill, on-gold text, Manrope 600, pill shape, 12×22 padding and a soft gold glow. Disabled buttons are at 50% opacity.
- **Secondary button:** transparent, line border, lavender text, gold on hover. Sensitive questions always offer "Skip this one".
- **Inputs:** `--joyo-surface-2` fill, line border, `--joyo-radius-input`, 14px padding, ivory text and lavender placeholder. On focus the border turns gold with a 3px `--joyo-gold-soft` ring. Dates accept an exact date, month and year, or year only, through a segmented toggle. Place uses autocomplete.
- **Choice chips:** surface-2 fill and line border. Selected chips get a gold-soft fill, gold border, gold text and a check icon. Full width on mobile.
- **First question chips:** Morning / Afternoon / Evening / Night / No idea, plus an optional free-text field.
- **Upload:** a dashed dropzone that turns gold on drag-over, with "we only read dates, places and event types".
- **Voice:** a 48px round mic button that pulses with a gold ring while recording.
- **Result card:** the time range in large mono, confidence in words plus a gold bar, and "Events that pinned it down" with ✦ bullets. Always include "This is a best fit to the events you gave, not a certainty."
- **Icons:** thin line icons with a 1.5px stroke. ✦ is the brand glyph. No emoji.

## 6. Wheel

- The 12 houses are fixed, with house 1 at 9 o'clock running anticlockwise. Only the ring of signs rotates with birth time.
- Wedges use the mood scale and blend softly into each other across wedge boundaries, like a mood ring. Each house sits on a continuum from resting to active, never on/off.
- Labels describe actions ("Partner", "Lead", "Let go"), never outcomes like "Loss".
- The 6th and 8th houses are clamped to the middle of the scale.
- Always show a Resting → Steady → Active legend.

## 7. Voice and copy

- Plain, warm English with short sentences.
- Use the Sanskrit term once in brackets, then plain English.
- Ask open questions that never lead.
- Always give a range and a confidence level, never one exact minute.
- Ask about deaths, illness and divorce kindly, and make them skippable.
- Buttons say exactly what happens.
- No fear words ("bad", "danger", "malefic").

## 8. Accessibility

- Text contrast is at least 4.5:1. Every text token passes on night, surface and surface-2.
- Focus shows as a gold ring (`base.css` sets it on `:focus-visible`).
- Never use colour alone to carry meaning.
- Respect `prefers-reduced-motion` (`base.css` turns animation off globally).
- Tap targets are at least 44px.
- Layouts work at 375px with a 16px gutter and no horizontal scroll.

## 9. Don'ts

No light theme or white cards, no default browser form styles, no green, red, black or grey, no Pantone names, no gradients across the whole page, no glassmorphism, no chat bubbles and no scary "bad day" copy.

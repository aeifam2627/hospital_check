---
name: Hospital Daily Inspection
description: A clinical daylight interface for fast, reliable daily hospital inspections.
colors:
  action-green: "#0b5748"
  action-green-hover: "#0e6b58"
  mint-support: "#dceee8"
  canvas: "#f2f5f2"
  surface: "#ffffff"
  border: "#d4ddd8"
  ink: "#182520"
  muted-ink: "#66736d"
  pending-ink: "#755416"
  pending-surface: "#fff2cf"
  success-ink: "#116149"
  success-surface: "#e3f3eb"
  warning-ink: "#8a2e24"
  warning-surface: "#ffebe7"
  danger: "#b42318"
  focus: "#f0a33b"
typography:
  headline:
    fontFamily: '"Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif'
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif'
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: '"Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: '"Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif'
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  control-sm: "8px"
  control: "11px"
  action: "12px"
  card: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action-green}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.action}"
    padding: "0 22px"
    height: "50px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.action-green}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "15px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "48px"
  chip-pending:
    backgroundColor: "{colors.pending-surface}"
    textColor: "{colors.pending-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 8px"
  chip-success:
    backgroundColor: "{colors.success-surface}"
    textColor: "{colors.success-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
  chip-warning:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.warning-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
---

# Design System: Hospital Daily Inspection

## Overview

**Creative North Star: "The Daylight Clinical Checklist"**

This is an Operate-mode system for hospital staff recording inspections quickly, often on a phone and in bright clinical environments. Its visual authority comes from clarity rather than decoration: pale green-neutral canvases, white work surfaces, dark green actions, explicit progress, and controls that remain legible and easy to touch with one hand.

The system should feel calm, dependable, and task-first. Information density is moderate, but the active path is always obvious: choose context, scan progress, find the item, enter a count, identify the inspector, and save. Borders and tonal layering organize the page; shadow is reserved for anchored controls and small identity moments.

**Key Characteristics:**

- Clinical daylight palette with restrained green and warm status accents.
- Mobile-first controls with a 44px minimum touch target and 16px form text.
- Border-led cards, explicit progress, and a persistent save action.
- Thai-first typography with clear numerals and compact supporting labels.

## Colors

The palette uses green as the single action voice, green-neutral surfaces for structure, amber for pending or recoverable states, and a soft red family for standard differences, invalid data, or failed operations.

### Primary

- **Action Green:** The principal color for save actions, selected filters, progress, and active navigation.
- **Action Green Hover:** A slightly brighter companion for progress and interactive emphasis.

### Secondary

- **Mint Support:** A quiet green field behind icons and contextual groupings; it supports action green without competing with it.
- **Amber Focus:** A warm, high-visibility keyboard focus outline that stays distinct from green application state.

### Tertiary

- **Pending Amber:** Reserved for incomplete schedules and restored-draft notices.
- **Success Green:** Reserved for complete schedules, standard-matching results, and successful export confirmation.
- **Warning Red:** A restrained red treatment for recorded quantities that differ from the standard; it is a review signal, not a failure state.
- **Danger Red:** The stronger red is reserved for invalid fields, failed operations, and the actual differing value inside a comparison.

### Neutral

- **Clinical Canvas:** The green-tinted page background that reduces glare while keeping the interface bright.
- **White Surface:** The work surface for cards, fields, and fixed action bars.
- **Soft Border:** The default separator and card outline; borders do most of the structural work.
- **Deep Ink:** Primary text with a green cast rather than pure black.
- **Muted Ink:** Supporting text, units, dates, and secondary progress labels.

### Named Rules

**The One Action Voice Rule.** Green means action, selection, or completion; do not introduce a second action hue.

**The Status Has Meaning Rule.** Amber means missing, partial, unconfigured, or recoverable; soft red means a recorded standard difference; strong red means invalid or failed. Green confirms completion, agreement, or success. Never use these colors as decoration.

## Typography

**Display Font:** Noto Sans Thai (with Leelawadee UI, Tahoma, sans-serif fallbacks)  
**Body Font:** Noto Sans Thai (with Leelawadee UI, Tahoma, sans-serif fallbacks)

**Character:** The single sans-serif stack is direct and highly legible in Thai and Latin text. Hierarchy comes from weight, scale, and spacing rather than a decorative display face.

### Hierarchy

- **Headline:** Bold and compact; used for the home-page task prompt.
- **Title:** Bold, tightly leading; used for screen titles and inspection headers.
- **Body:** Regular-weight, comfortably leading; used for instructions and form controls. Form text stays at 16px or larger to preserve mobile readability and prevent browser zoom.
- **Label:** Small and bold; used for field labels, group headings, status metadata, and concise supporting text.
- **Count Numerals:** Bold, centered, and tabular; quantities are operational data and must remain visually stable while values change.

### Named Rules

**The Thai-First Rule.** Use the established Thai-capable stack everywhere; do not introduce a display font that weakens Thai legibility.

**The Honest Placeholder Rule.** Placeholder text is guidance, never submitted data and never styled to look like a recorded value.

## Layout

The system is mobile-first from a 320px minimum viewport. Primary pages are centered and use 14–16px mobile gutters. The inspection flow is linear: date and shift context, completion progress, search and filtering, grouped item cards, inspector details, validation, then a persistent save action above the bottom navigation.

Content is capped at 760px through tablet sizes and expands to 1100px at 1050px. Item cards move from one column to two columns at 768px and three columns at 1050px; the home task list follows the same one-to-two-to-three-column progression. Fixed navigation and save bars respect safe-area insets, with explicit content spacers so they never cover the last field.

Reporting surfaces keep the same mobile-first frame and add density without becoming table-first. A page header leads into compact context or filter controls, then a three-cell KPI strip or a card list. Dashboard summaries and history records remain single-column disclosure cards on phones and become two columns at 768px; history never collapses into a horizontally scrolling data table. Report fields start as one column and become a two-column form at the same breakpoint, while format choices, preview, export action, and status retain full width.

Spacing follows a compact 4/8/12/16/24px rhythm. Related controls stay close; group changes receive more separation than rows within a card.

**The Work Path Rule.** Preserve the operational order from context to save. Responsive layouts may add columns but must not rearrange that task sequence.

## Elevation & Depth

The system is flat by default. White surfaces sit on a green-neutral canvas and are separated by one-pixel borders. Shadows are limited to the brand mark, selected segmented controls, the primary action, and fixed navigation/save bars where physical anchoring is useful.

### Shadow Vocabulary

- **Identity Lift** (`0 5px 15px rgba(11,87,72,.18)`): Used only on the compact brand mark.
- **Selected Control** (`0 2px 7px rgba(30,60,49,.12)`): Used on the selected shift segment.
- **Primary Action** (`0 5px 14px rgba(11,87,72,.2)`): Used on the save action and removed when disabled.
- **Anchored Bar** (`0 -8px 24px rgba(31,53,44,.09)`): Used above the sticky save bar; bottom navigation uses a still lighter upward shadow.

**The Border-First Rule.** Cards and fields use border and tonal contrast first; add shadow only when an element must read as selected, primary, or fixed above scrolling content.

## Shapes

Shapes are gently rounded and practical. Cards and major contextual panels use a 14px radius. Buttons use 12px, most inputs use 10–11px, segmented controls step down from an 11px container to 8px selections, and status chips are fully pill-shaped. One-pixel borders retain clinical precision inside the softened geometry.

**The Nested Radius Rule.** Inner controls use a slightly smaller radius than the surface containing them, preserving a clear visual hierarchy.

## Components

Components should feel calm, sturdy, and immediately tappable.

### Buttons

- **Shape:** Gently rounded with a 12px action radius and at least a 44px touch height; the main save action is 50px high.
- **Primary:** White text on action green, bold label, 22px horizontal padding, and a restrained green shadow.
- **Secondary:** Action-green text on white, a soft green border, and no resting shadow.
- **Hover / Focus:** Use modest border or color strengthening. Every interactive element receives the warm 3px focus outline with a 2px offset.
- **Disabled:** Muted green-gray with no shadow; disabled state must not rely on opacity alone.

### Chips

- **Pending / Missing:** Amber ink on a pale amber surface, with compact padding and a fully rounded silhouette.
- **Complete / Matching:** Success-green ink on a pale green surface. Completion is reinforced with explicit text rather than color alone.
- **Different:** Warning-red ink on a pale red surface. This marks a reviewable standard difference without presenting the submission itself as failed.

### Cards / Containers

- **Corner Style:** 14px radius for inspection items and major panels.
- **Background:** White for actionable work; pale green for context and privacy guidance.
- **Shadow Strategy:** None at rest.
- **Border:** One-pixel soft green-gray border.
- **Internal Padding:** 14–17px depending on content density.

### KPI Strip

The dashboard KPI strip is one compact bordered surface divided into three equal cells. Each cell stacks a small muted label, a bold tabular value, and a short unit or qualifier. Values use action green by default; only a nonzero standard-difference count switches to danger red. The strip remains three columns on narrow phones, so labels and qualifiers must stay concise rather than wrapping into dashboard tiles.

### Disclosure Summary Cards

Dashboard summaries and history records use native disclosure cards. The closed summary presents the operational essentials: title or date, a text status chip, inspector/time metadata, compact counts, and a right-edge chevron. Opening the card rotates the chevron and reveals submission links, standard differences, notes, or a quiet all-clear state beneath a subtle divider. The entire summary is the target; disclosure content must remain readable as stacked rows on small screens.

### Inputs / Fields

- **Style:** White or very pale green surface, one-pixel green-gray border, 10–11px radius, and at least 44px height.
- **Count Field:** 72px wide, 48px high, centered bold tabular numerals, and the numeric keypad where supported.
- **Focus:** Warm 3px outline outside the field; focus remains visible against both white and tinted panels.
- **Error:** Danger border and pale red fill, paired with actionable text explaining both the problem and how to fix it.

### Navigation

The bottom navigation is fixed, four-column, and safe-area aware. Items are at least 54px high, pair icon and text, and use pale mint plus bold green text for the active state. At tablet widths the navigation becomes a centered floating bar with a border and 16px radius.

### Sticky Save

The save bar is the signature operational anchor. It shows completed-versus-total counts beside one unambiguous primary action, remains above the bottom navigation, reports pending and saved states in text, and exposes status updates to assistive technology.

### Report Export

The report form uses the same selected segmented-control treatment as shift selection, 48px date/type fields, and bordered radio-option cards with explanatory copy. A pale green preview explains the file before the primary export action. Export is a real stateful operation: idle names the `.xlsx` download, loading disables the action and removes its shadow, success confirms completion in a polite live region, and error shows actionable copy plus a 44px retry control. The status remains adjacent to the export action and spans the full form width at tablet sizes.

## Do's and Don'ts

### Do:

- **Do** keep all tappable controls at least 44px high and all mobile form text at least 16px.
- **Do** show progress as both a count and a visual track; color alone is not enough.
- **Do** preserve zero as a valid recorded count and visually distinguish it from an empty field.
- **Do** keep save, error, draft-restored, loading, and completion states explicit in Thai text.
- **Do** keep dashboard and history records as mobile disclosure cards, then add columns at wider breakpoints without changing their reading order.
- **Do** distinguish missing schedules, recorded standard differences, and failed operations with both text and their separate semantic treatments.
- **Do** expose export loading, success, and retryable error states next to the action in a polite live region.
- **Do** use borders and tonal surfaces to group work before adding elevation.

### Don't:

- **Don't** use green, amber, or red decoratively; each color has an operational meaning.
- **Don't** replace the compact KPI strip or mobile history cards with oversized metric tiles or horizontally scrolling tables.
- **Don't** model report export as a bare file link with no pending, success, or failure feedback.
- **Don't** hide the final fields behind fixed navigation or the sticky save bar.
- **Don't** compress count controls or labels below touch-safe, daylight-legible sizes.
- **Don't** replace actionable error guidance with color, icons, or generic failure copy alone.
- **Don't** introduce gradients, glass effects, or ornamental imagery into the inspection workflow.

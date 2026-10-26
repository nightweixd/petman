# PetMan interface

PetMan is a pet-care workspace for salon staff and customers. The visual direction
is soft, clear and friendly: pale blue surfaces, white working panels, rounded
controls and restrained depth. Dense records stay readable; decorative details
belong on welcome surfaces rather than inside tables.

## Shared owners

- `styles/theme.css` owns the shared palette, elevation, final surface treatment,
  responsive navigation and control styling. It loads after the feature styles.
- `styles/admin.css`, `styles/customer.css` and `styles/operations.css` retain
  feature layout and structural styles. Add cross-surface visual changes to the
  theme instead of creating competing per-page treatments.
- `components/AdminShell.tsx` owns the staff navigation and workspace header.
- `components/CustomerLayout.tsx` owns customer navigation and the footer.
- `components/PetIllustration.tsx` is decorative SVG artwork for welcome areas.
  It has no external dependencies and is hidden from assistive technology.

## Tokens and hierarchy

| Token | Value | Use |
| --- | --- | --- |
| `--ui-ink` | `#203846` | Primary text |
| `--ui-muted` | `#5b7180` | Supporting copy |
| `--ui-accent` | `#087f95` | Main actions and current navigation |
| `--ui-accent-dark` | `#086a7d` | Primary hover state |
| `--ui-canvas` | `#edf4f7` | App background |
| `--ui-line` | `#dfe9ee` | Dividers and input boundaries |
| `--ui-pale` | `#e9f7f9` | Quiet accent surfaces |

Use Manrope throughout. Headings are balanced and body copy is left aligned.
Financial values and tabular records use tabular numerals. Status colour must
always be accompanied by a text label.

Use the neutral layered shadows from UI Skills Beautiful Shadows through
`--ui-shadow-sm`, `--ui-shadow-md` and `--ui-shadow-lg`. Compact surfaces and
controls use small elevation; working cards use medium; authentication panels
and drawers use large. Avoid coloured glow and the previous blanket shadow reset.

Panel radii are usually 21–25px, controls 11–15px, and small badges are pill shaped.
Keep borders around fields and table dividers even where shadows create depth.
Bubble shapes and the pet artwork are decorative; do not place them over inputs
or record content.

## Responsive and motion behaviour

The staff sidebar has visible labels on large screens, an icon layout on tablets,
and a labelled slide-out menu on phones. Closed mobile navigation is hidden from
keyboard navigation. Preserve the existing aria labels and menu state.

Customer pages collapse into one column on phones. Forms, account cards, booking
steps, invoice surfaces and drawers use the same material system. Preserve
horizontal scrolling inside dense data tables instead of making the page wider.

Use CSS transforms and opacity for short interaction feedback, at 160–180ms.
Do not continuously animate decorative bubbles, shadows or large blur surfaces.
Respect reduced-motion preferences. Keep invoice print output free of shadows,
navigation and welcome artwork.

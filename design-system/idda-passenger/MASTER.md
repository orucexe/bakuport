# IDDA Passenger design system

Source of truth: `DESIGN-airbnb.md`. Applied with the ui-ux-pro-max workflow.
Scope: passenger page and passenger-scoped map presentation only.

## Intent
- A warm, consumer-facing transit experience with generous spacing and real controls.
- Preserve route/stop selection, Google Maps, arrival estimates and one-tap reports.
- Keep demo GPS and density clearly labeled; do not invent real vehicle data.
- Operator and official-route views retain their existing appearance.
- Passenger defaults to official AYNA routes; simulated GPS/reporting is behind an explicit demo switch.

## Tokens
- Canvas #ffffff; ink #222222; body #3f3f3f; muted #6a6a6a.
- Accent #ff385c; active/accent text #e00b41; disabled #ffd1da.
- Soft surface #f7f7f7; borders #dddddd / #ebebeb; error #c13515.
- Inter/system sans substitutes the unavailable licensed Cereal/Circular fonts.
- Display 28px/600, section 22px/500, body 16px/400, meta 14px/400.
- Spacing 4/8/12/16/24/32/48/64; cards 14px; larger panels 20px; pills fully rounded.
- One subtle shadow tier for search/rail/hover; no gradients or decorative blur.

## Layout and interaction
- Desktop: 80px top navigation, centered segmented search, route cards, map plus arrival rail.
- Mobile <744px: compact header, single search pill opening a native modal, stacked cards.
- A mobile bottom summary reserves safe-area space and scrolls to the map/report controls.
- Route thumbnails derive from existing stop coordinates; no fictional ratings/photos.
- Use native labels, selects, buttons and dialogs; preserve Escape/focus behavior.
- 44px minimum controls, 48px primary targets; visible keyboard focus and reduced motion.
- Accent circles use white icons; readable ink text and semantic density labels accompany color.
- Skill's generic transit palette/font output was rejected in favor of the supplied design file.

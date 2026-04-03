# Design System Specification: Editorial Precision for Spatial Productivity

## 1. Overview & Creative North Star
The "Digital Cartographer" is the Creative North Star for this design system. It moves beyond the utility of a standard checklist to provide a high-fidelity, editorial-grade interface that feels both authoritative and atmospheric. 

While most productivity apps rely on rigid grids and heavy borders, this system utilizes **Tonal Depth** and **Asymmetric Breathing Room** to guide the user’s eye. We treat the interface as a living map: expansive, layered, and premium. By leaning into the contrast between the tech-centric Indigo (`primary`) and the vibrant Pink (`secondary`), we create a signature aesthetic that feels like a bespoke tool for high-achievers, not just another utility.

---

## 2. Colors: The Art of Tonal Transition
Our palette is rooted in Material Design logic but executed with a "No-Line" philosophy.

### The "No-Line" Rule
Explicitly prohibit the use of 1px solid borders for sectioning content. To define boundaries, you must use background color shifts. For instance, a side panel in `surface_container_low` should sit directly against a `background` workspace. Let the color values do the heavy lifting.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers, similar to stacked sheets of frosted glass.
- **Base Layer:** `surface` (#fcf8ff)
- **Content Cards:** `surface_container_lowest` (#ffffff)
- **Nested Controls:** `surface_container_high` (#e9e6f3)

### The Glass & Gradient Rule
To achieve a "Digital Cartographer" look, use glassmorphism for floating spatial elements (like map pins or floating action menus). 
- **Effect:** Apply `surface_variant` at 60% opacity with a 20px Backdrop Blur.
- **Signature Textures:** For high-impact CTAs, use a linear gradient transitioning from `primary` (#4648d4) to `primary_container` (#6063ee) at a 135° angle. This adds a "soul" to the UI that flat indigo cannot match.

---

## 3. Typography: Editorial Authority
We use **Inter** not as a default, but as a precision tool. The key to this system is the dramatic scale difference between "Display" and "Label" styles.

*   **Display Styles (lg/md/sm):** Used for "Big Moments"—location names or daily goals. Use `on_surface` with tight letter-spacing (-0.02em) to feel impactful.
*   **Headline & Title:** Use for task categories. These should be bold and authoritative.
*   **Body (lg/md/sm):** Optimized for legibility in task descriptions.
*   **Labels (md/sm):** Use `secondary` (#b4136d) for metadata labels (e.g., "ETA: 5 mins") to create a sharp, functional contrast against indigo accents.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are largely replaced by **Tonal Layering**. Depth is achieved through the proximity of surface tokens.

*   **The Layering Principle:** To lift a task detail card, place a `surface_container_lowest` card on a `surface_container_low` background. The shift from #ffffff to #f5f2fe creates a natural edge that is softer and more premium than a line.
*   **Ambient Shadows:** When an element must float (e.g., a Map Task Modal), use a shadow with a 32px blur, 0px offset, and 6% opacity of `on_surface`. It should feel like a soft glow, not a dark weight.
*   **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline_variant` (#c7c4d7) at **15% opacity**. This creates a suggestion of a container without breaking the "No-Line" rule.

---

## 5. Components: Precision Primitives

### Buttons & Inputs
- **Primary Action:** 12px corner radius (`md`). Use the Indigo gradient. High-contrast white text (`on_primary`).
- **Input Fields:** Use `surface_container` with no border. On focus, transition the background to `surface_container_highest` and add a subtle `primary` 1px "Ghost Border."

### Cards & Task Lists
- **Cards:** 16px corner radius (`lg`). **Strictly forbid divider lines.** 
- **Separation:** Use 16px or 24px of vertical whitespace. If tasks need grouping, use a subtle `surface_container_low` background "pill" to encircle the group.

### Chips & Spatial Markers
- **Task Chips:** Use `primary_fixed` backgrounds with `on_primary_fixed` text for a soft, readable high-tech look.
- **Location Markers:** Use the Pink `secondary` (#b4136d) to draw immediate attention against the Indigo map elements.

### Specialized Geo-Components
- **Proximity Ring:** A semi-transparent `secondary_container` circle with a `secondary` ghost border to visualize task radius on the map.
- **The "Focus Drawer":** A bottom sheet using `surface_container_lowest` with a 24px corner radius (`xl`) at the top, sliding over the map with a heavy backdrop blur.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use extreme whitespace to separate unrelated task groups.
*   **Do** use `primary_fixed_dim` for disabled or inactive states to maintain the Indigo hue without the intensity.
*   **Do** leverage the Pink `secondary` for "Urgency" or "Active Proximity" to provide a clear functional signal.

### Don’t
*   **Don’t** use pure black #000000 for text. Use `on_surface` (#1b1b23) to keep the "Editorial" softness.
*   **Don’t** use a border to separate a header from a list. Use a transition from `surface_dim` to `surface`.
*   **Don’t** use the 16px radius for buttons; buttons must stay at 12px (`md`) to feel more "active" and "clickable" compared to the "containment" feel of 16px cards.
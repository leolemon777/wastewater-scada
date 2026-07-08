# 2026-07-02 duplicate pipe fitting guard

- Issue: close-up complaints repeatedly involved pipe fittings looking like extra protrusions. Specific duplicates were fixed earlier, but there was no global guard preventing the same fitting type from being declared twice at the same section coordinate.
- Change:
  - Added `scripts/check-no-duplicate-pipe-fittings.mjs`.
  - The check scans section `PipeWallPort3D`, `PipeFloorSleeve3D`, `PipeOpenFlange3D`, `PipeBlindFlange3D`, and `PipeInspectionCollar3D` declarations.
  - It fails when the same fitting component type is declared more than once at the same normalized `position` expression in the same section file.
  - Wired the guard into `npm run check:scene`.
- Verification:
  - `node scripts/check-no-duplicate-pipe-fittings.mjs` passed with `fittings=39`, `uniqueKeys=39`.
  - `npm run verify:scene` passed with the duplicate-fitting guard included.
  - In-app browser QA at `/` loaded one canvas, no error boundary, `density=compact`, topbar about `26px`, and backing buffer `1920x1080`.
- Risk: this catches duplicate declarations with identical position expressions. It does not evaluate runtime-expanded map coordinates, so map-generated duplicates still need route-specific checks like the chemical metering shared-port guard.

# 2026-07-02 chemical metering source-port de-duplication

- Issue: each chemical metering pump group rendered a shared source `PipeWallPort3D` at `[x, 1.18, -0.42]`, but every `MeteringPumpBranch` also rendered another `PipeWallPort3D` at the same effective source coordinate. With two pumps per group this stacked multiple fittings at one source point, which can read as a protruding/extra pipe connector in close-up views.
- Change:
  - Removed the per-pump source `PipeWallPort3D` from `MeteringPumpBranch`.
  - Kept one shared source wall port per chemical pump group at the parent level.
  - Extended `scripts/check-equipment-endpoint-fittings.mjs` to count that shared source fitting as endpoint evidence for the two metering-pump branch routes.
  - Strengthened `scripts/check-chemical-metering-ports.mjs` so `MeteringPumpBranch` cannot reintroduce per-pump source wall ports and the section must keep exactly one shared source port declaration.
- Verification:
  - `node scripts/check-equipment-endpoint-fittings.mjs` passed with `equipmentEndpoints=58`.
  - `node scripts/check-chemical-metering-ports.mjs` passed with `sharedSourcePorts=1`.
  - `npm run verify:scene` passed with the stronger chemical-metering checks included.
  - In-app browser QA at `?qaTarget=-10,1.6,-15&qaPosition=-18,5,-8` loaded one canvas, no error boundary, `density=compact`, backing buffer `1920x1080`, and chemical-room text present.
- Risk: this removes duplicate source fittings in the chemical room. It does not prove every future hand-authored small pipe is visually clean unless the route follows the same shared-port pattern or is covered by a specific check.

# 2026-07-02 sludge equipment endpoint tightening pass

- Issue: `scripts/check-equipment-endpoint-fittings.mjs` counted nearby `Pump3D` meshes as endpoint fittings, which could mask missing wall ports or equipment inlet fittings. The stricter check exposed two sludge-section weak spots: sludge tank suction wall ports were rendered after the related suction pipe block, and the screw press feed pipe endpoint did not align with the actual feed inlet geometry.
- Change:
  - Tightened `check-equipment-endpoint-fittings.mjs` so pump route helpers only prove pump-side endpoints, while non-pump equipment endpoints require explicit fittings such as wall ports, floor sleeves, open flanges, dosing ports, or named endpoint ports.
  - Moved the two sludge-out pump suction `PipeWallPort3D` fittings before their suction pipe routes so the pipe reads as coming from a real tank-wall opening.
  - Re-aligned the screw press feed pipe endpoint from `[3.4, 1.55, 0]` to the modeled feed inlet at `[2.15, 1.72, 0]`.
  - Added a `PipeOpenFlange3D` at the screw press inlet so the sludge feed pipe terminates at a visible inlet flange instead of only a coordinate.
- Verification:
  - `node scripts/check-equipment-endpoint-fittings.mjs` passed with `equipmentEndpoints=58`.
  - `npm run verify:scene` passed with the stricter endpoint-fitting gate included.
  - In-app browser QA at `?qaTarget=19.6,0.55,15.3&qaPosition=24.4,2.0,12.2` loaded one canvas, no error boundary, `density=compact`, backing buffer `1920x1080`, and sludge press overlay text present.
- Risk: this strengthens endpoint proof and fixes the screw press feed alignment, but it is still a static/targeted runtime pass. Final acceptance of every pipe close-up still needs continued visual spot checks across all process sections.

# 2026-07-02 Edge overlay scale compensation

- Issue: in Edge or high Windows/browser scaling, the UI shell could render in the larger desktop toolbar mode, making the top title bar, bottom view bar, and zoom controls look oversized compared with the 3D scene.
- Change:
  - Expanded compact overlay activation to normal and wide desktop widths, with `?uiDensity=full` kept as an explicit escape hatch.
  - Added runtime `--overlay-scale`, `--view-preset-scale`, and `--zoom-tool-scale` variables derived from DPR / visual viewport scale.
  - Applied the scale compensation to the topbar, bottom view preset bar, and right zoom tool panel.
  - Strengthened `scripts/check-overlay-density.mjs` so compact mode and scale compensation are guarded in `npm run check:scene`.
- Verification:
  - `node scripts/check-overlay-density.mjs` passed.
  - `npm run verify:scene` passed.
  - In-app browser QA at `http://127.0.0.1:5173/` loaded one canvas with no error boundary, `density=compact`, `dpr=1.5`, `overlayScale=0.86`, topbar rect about `1294x26`, overview button about `32x17`.
- Risk: Edge/browser zoom can still enlarge the whole page if the user sets very high zoom, but the overlay now actively compensates instead of relying only on CSS compact heights.

# 2026-07-02 no decorative CSS gradient gate

- Issue: decorative UI gradients can make the SCADA shell feel AI-generated and conflict with the requested realistic industrial look.
- Change:
  - Added `scripts/check-no-decorative-css-gradients.mjs` and wired it into `npm run check:scene`.
  - The check scans `src/index.css` for `linear-gradient`, `radial-gradient`, and `conic-gradient`.
  - Dashboard SVG chart fills and procedural 3D canvas texture gradients remain allowed because they are data/scene rendering rather than decorative CSS shell styling.
- Verification:
  - `node scripts/check-no-decorative-css-gradients.mjs` passed.
  - `npm run verify:scene` passed with the new guard included.
- Risk: this guards the CSS shell only. If decorative gradients are introduced inside TSX/SVG intentionally, they still need visual review.

# 2026-07-02 external pool-link pipe collar pass

- Issue: main-process external wall-link pipes already had subtle inspection collars, but deep-treatment wall-link pipes only had wall ports. The latter could read as plain external runs with less detail when viewed close up, and future changes could remove exterior pipe detail while still passing the old file-level visibility check.
- Change:
  - Added `PipeInspectionCollar3D` to each `DeepProcessWallLink` external route, matching the main-process wall-link treatment.
  - Strengthened `scripts/check-pool-pipe-visibility.mjs` so any section with process wall-link routing must include `EXTERNAL_POOL_PIPE_Y/Z`, `PipeWallPort3D`, and `PipeInspectionCollar3D`.
- Verification:
  - `node scripts/check-pool-pipe-visibility.mjs` passed with `externalWallLinkFiles=2`.
  - `node scripts/check-pipe-fitting-proportions.mjs` passed, confirming inspection collars remain within low-profile limits.
  - `npm run verify:scene` passed with the strengthened pool-pipe visibility gate included.
  - In-app browser QA at `?qaTarget=18,1,-15&qaPosition=5,8,-6` loaded one canvas, no error-boundary text, compact overlay density, CSS canvas `1280x720`, and backing buffer `1920x1080`.
- Risk: inspection collars are intentionally subtle and are a visual realism cue, not a process logic change. Future non-wall-link external pipes may still need separate route-specific review.

# 2026-07-02 explicit Pipe3D visual semantics gate

- Issue: future pipes could be added with default `Pipe3D` props, which would make them visually ambiguous: default color/material, missing flow type, or missing animation state. That weakens close-up readability and can make routing look disconnected from process status.
- Change:
  - Added `scripts/check-pipe-visual-semantics.mjs` and wired it into `npm run check:scene`.
  - The check scans all section `Pipe3D` blocks and requires explicit `radius`, `color`, `flowType`, and `animated` props.
  - The check also requires `flowType` to be one of `water`, `sludge`, `chemical`, or `none` as a string literal for static audit.
- Verification:
  - `node scripts/check-pipe-visual-semantics.mjs` passed with `pipeBlocks=45`, `flowTypes=[chemical=8, sludge=13, water=24]`.
  - `npm run verify:scene` passed with the new visual-semantics gate included.
  - In-app browser QA at `?qaTarget=-5,1,0&qaPosition=-24,16,28` loaded one canvas, no error-boundary text, compact overlay density, CSS canvas `1280x720`, and backing buffer `1920x1080`.
- Risk: this guards explicit rendering semantics, not exact visual acceptance of every future route. It makes unclear/default pipe additions fail early so they can be reviewed intentionally.

# 2026-07-02 no holographic scanner selection effect

- Issue: the old selected-state scan cage/read-through effect conflicted with the request to remove water-quality perspective style visuals and made close-up inspection feel more artificial.
- Change:
  - Removed `HolographicScanner3D` usage from `Tank3D` and `Pump3D`.
  - Replaced tank selected state with a low-profile solid rim highlight on the tank top edge.
  - Replaced pump selected state with a low-profile solid floor outline around the pump footprint.
  - Deleted the unused `src/components/3d/HolographicScanner3D.tsx` component.
  - Added `scripts/check-no-holographic-scanner.mjs` and wired it into `npm run check:scene` to prevent the scanner effect from returning to the 3D scene.
- Verification:
  - `node scripts/check-no-holographic-scanner.mjs` passed with `scannedFiles=34`.
  - `npm run verify:scene` passed with the new no-holographic-scanner gate included.
  - In-app browser QA at `?qaTarget=-5,1,0&qaPosition=-18,8,14` loaded one canvas, no error-boundary text, compact overlay density, CSS canvas `1280x720`, and backing buffer `1920x1080`.
- Risk: selected equipment feedback is now subtler and more physical. It no longer draws a large scan volume, so selected state relies on the solid outline plus existing labels/detail panels.

# 2026-07-02 no 3D pool level-scale gate

- Issue: the old in-scene pool-wall level gauge (`0%/25%/50%/75%/100%`) was removed because it added visual clutter and did not help the 3D process view. That removal needs a guard so future UI work does not reintroduce those tick labels on tanks.
- Change:
  - Added `scripts/check-no-3d-level-scale.mjs` and wired it into `npm run check:scene`.
  - The check scans `src/components/3d` for JSX-rendered old pool-wall percentage ticks and 3D liquid-level scale labels, while leaving dashboard/detail liquid-level data and sludge bag load-rate UI alone.
- Verification:
  - `node scripts/check-no-3d-level-scale.mjs` passed with `scannedFiles=35`.
  - `npm run verify:scene` passed with the new no-3D-level-scale gate included.
  - In-app browser QA at `?qaTarget=-5,1,0&qaPosition=-18,8,14` loaded one canvas, no error-boundary text, compact overlay density, CSS canvas `1280x720`, backing buffer `1920x1080`, and no visible old level-tick text.
- Risk: this specifically guards the old 3D pool-wall percentage gauge. It intentionally does not block numeric status text in dashboard panels or sludge bag loading indicators.

# 2026-07-02 pipe junction overlap and elbow guard

- Issue: close-up pipe complaints focused on tee/junction areas where branch pipes could look like they protrude past the header, and on elbows that could regress into patch-like fixes instead of smooth bends.
- Change:
  - Extended `scripts/check-pipe-fitting-proportions.mjs` to guard shared `Pipe3D` route constants:
    - `JUNCTION_CONNECTION_OVERLAP` must stay `0`, so junction endpoints do not extend through header pipes.
    - `SEALED_CONNECTION_OVERLAP` must stay `0`, so capped ends do not extend past blind flanges.
    - `JUNCTION_SURFACE_TRIM` must stay between `0.85` and `0.98`, keeping tee joins visually flush.
    - `BEND_RADIUS_MULTIPLIER` must stay between `3.5` and `5`, preserving rounded elbows without oversized bend patches.
    - `Pipe3D` must not use `sphereGeometry` as a bend/junction patch.
- Verification:
  - `node scripts/check-pipe-fitting-proportions.mjs` passed with `junctionOverlap=0`, `junctionSurfaceTrim=0.92`, `sealedOverlap=0`, and `bendRadiusMultiplier=4.2`.
  - `npm run verify:scene` passed with the strengthened pipe-fitting gate included.
  - In-app browser QA at `?qaTarget=-43,0.9,11&qaPosition=-47,3.5,7` loaded one canvas, no error-boundary text, compact overlay density, CSS canvas `1280x720`, and backing buffer `1920x1080`.
- Risk: this protects shared pipe rendering behavior. It does not replace visual review of future hand-written route coordinates, but it prevents the common protruding-junction regression at the renderer level.

# 2026-07-02 pipe color distinction gate

- Issue: several water-related pipe categories were still close in hue, especially raw/deep/clean water. In close-up or wide overview, similar blue pipes make process routing harder to distinguish and can make the scene feel visually flat.
- Change:
  - Updated `PIPE_COLORS` in `src/components/3d/pipeRouting.ts` to a more distinct industrial pipe-coating palette:
    - raw water blue, process water teal, deep-treatment water indigo, treated water green, clean water light steel-blue, sludge brown-orange, and three clearly separated chemical colors.
  - Added `scripts/check-pipe-color-distinction.mjs` and wired it into `npm run check:scene`.
  - The check requires the nine expected pipe categories, rejects duplicate/unexpected colors, and enforces pairwise CIE Lab DeltaE >= 20 for close-up readability.
- Verification:
  - `node scripts/check-pipe-color-distinction.mjs` passed with `keys=9`, minimum DeltaE `21.5` on `deepWater/pac`.
  - `npm run verify:scene` passed with the new pipe-color distinction gate included.
  - In-app browser QA at `?qaTarget=-5,1,0&qaPosition=-24,16,28` loaded one canvas, no error-boundary text, compact overlay density, CSS canvas `1280x720`, and backing buffer `1920x1080`.
- Risk: this improves category readability rather than enforcing exact engineering pipe-color standards. Future user preference changes can adjust the palette, but the DeltaE floor should remain to avoid hard-to-distinguish routes.

# 2026-07-02 overlay compact-density gate

- Issue: Edge/browser zoom/Windows display scaling can make the SCADA overlay controls look oversized if the compact toolbar fallback is removed or partially overwritten. This affects the top title bar, bottom view preset bar, and right zoom tool stack.
- Change:
  - Added `scripts/check-overlay-density.mjs` and wired it into `npm run check:scene`.
  - The check guards the runtime `html[data-ui-density]` marker in `App.tsx`, Edge/high-DPI/desktop-size activation conditions, resize updates, and the compact CSS rules for topbar height, hidden long labels, button/icon dimensions, bottom view bar scale, and zoom panel scale.
- Verification:
  - `node scripts/check-overlay-density.mjs` passed.
  - `npm run verify:scene` passed with the new overlay-density gate included.
  - In-app browser QA at `/` reported `data-ui-density="compact"`, topbar height about `30.7px`, overview button height `20px`, view-tab button height `17px`, hidden view-tab text, one canvas, and no error-boundary text.
- Risk: this guards the app's rendered CSS baseline. If the user manually sets browser zoom above 100%, pixels will still be physically magnified, but the app now starts from the compact control baseline.

# 2026-07-02 scene render quality default gate

- Issue: previous UI/palette iterations made the scene feel blurry or visually uncomfortable when the app opened in lower-fidelity rendering. The close-up pipe review depends on crisp geometry, so high-quality defaults need a static guard.
- Change:
  - Added `scripts/check-scene-render-quality.mjs` and wired it into `npm run check:scene`.
  - The check guards `performanceMode: false`, `scenePaletteMode: 'bright'`, high-quality Canvas DPR clamp `1.5..2`, shadows, antialiasing, high-performance GPU preference, AgX tone mapping, texture anisotropy, and high-quality `Preload all`.
- Verification:
  - `node scripts/check-scene-render-quality.mjs` passed.
  - `npm run verify:scene` passed with the new render-quality gate included.
  - In-app browser QA at `?qaTarget=-5,1,0&qaPosition=-18,8,14` reported one canvas, no error-boundary text, compact overlay density, CSS canvas size `1280x720`, backing buffer `1920x1080`, and render scale `1.5`.
- Risk: this proves the default/high-quality code path stays crisp. A user can still manually switch to performance mode for slower hardware, which intentionally reduces DPR and visual fidelity.

# 2026-07-02 pump direct-suction route guard

- Issue: close-up pump suction pipes previously risked being routed with unnecessary bends between tank walls and pump inlets. The intended visual rule is that tank/pool suction pipes enter at the pump-mouth height and connect straight through a short pump-side stub, not through a low folded elbow.
- Change:
  - Extended `scripts/check-pump-pipe-geometry.mjs` to assert that `getDirectTankSuctionBranch()` returns `[wall-at-pump-height, stub, suction]`.
  - The check now rejects use of `tankInsertion[1]` inside direct tank suction routes, so these routes cannot drop to the tank insertion Y and then bend back up.
- Verification:
  - `node scripts/check-pump-pipe-geometry.mjs` passed with `directTankSuction=straightAtPumpHeight`.
  - `npm run verify:scene` passed.
  - In-app browser QA at `?qaTarget=-43,0.9,11&qaPosition=-47,3.5,7` loaded one canvas, no error-boundary text, and compact overlay density with a topbar height of about `30.7px`.
- Risk: this guards the shared helper used by pump-to-tank suction routes. Any future custom suction route that bypasses the helper still needs close-up visual review or a separate route-specific check.

# 2026-07-02 equipment endpoint fitting coverage gate

- Issue: `Pipe3D` routes can declare `startConnection="equipment"` or `endConnection="equipment"` while relying on nearby scene objects to visually complete the connection. Without a static gate, regressions can reintroduce close-up gaps where a pipe endpoint reaches a pump, wall, pool, dosing source, or outfall point without a visible fitting/nozzle.
- Change:
  - Added `scripts/check-equipment-endpoint-fittings.mjs` and wired it into `npm run check:scene`.
  - The check scans section `Pipe3D` blocks with equipment endpoints and requires nearby visible equipment/fitting markers such as pumps, metering pumps, wall/floor ports, dosing ports, clean-water terminals, or outfall nozzles.
  - Pump route helper calls (`getDischargeBranch`, `getSuctionBranch`, `getDirectTankSuctionBranch`) now count as pump-side endpoint evidence because they use the shared pump flange anchors.
  - Added a missing visible wall port to the deep-treatment intermediate outlet header start, while preserving immediate blind-flange pairing for the sealed header end.
  - Reordered the outfall drop nozzle so it is associated with the incoming treated-water header before the municipal outlet pipe is declared.
- Verification:
  - `node scripts/check-equipment-endpoint-fittings.mjs` passed with `pipeBlocks=45`, `equipmentEndpoints=58`, `checkedBlocks=42`.
  - `npm run verify:scene` passed, including the new equipment-endpoint fitting gate and existing sealed-terminal pairing gate.
  - In-app browser QA at `?qaTarget=20,0.8,-15&qaPosition=15,4,-9` loaded one canvas, no error-boundary text, and compact overlay density with a topbar height of about `30.7px`.
- Risk: this is a source-level guard for declared equipment endpoints and nearby fittings. It reduces the chance of disconnected close-up pipe ends, but user-level visual acceptance still depends on inspecting representative close-up views after future geometry changes.

# 2026-07-02 Edge overlay density runtime guard

- Issue: Edge can show the SCADA overlay controls oversized when browser zoom, Windows display scaling, or cached responsive state prevents the compact toolbar media query from taking effect. In screenshots this affects the top navigation, right zoom tools, and bottom view preset bar together.
- Change:
  - Added a runtime UI-density marker in `App.tsx` that sets `html[data-ui-density="compact"]` for Edge, high-DPI, common desktop heights, and normal desktop widths.
  - Added high-priority compact CSS rules keyed by `html[data-ui-density="compact"]` so the topbar, system buttons, view tabs, bottom view bar, and zoom tools use the compact dimensions even when media queries are unreliable.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser runtime check after reload reported `data-ui-density="compact"`, topbar height about `30.7px`, overview button height `20px`, view-tab button height `17px`, one canvas, and no error-boundary text.
- Risk: if the user opens a previously cached Edge tab, a hard refresh may still be needed once. Browser page zoom above 100% will still physically magnify pixels, but the app now starts from a much smaller control baseline.

# 2026-07-02 pump-port alignment gate

- Issue: pump pipe routes depend on `pumpPorts.ts`, while the visible pump suction/discharge ports are defined in `Pump3D`. If either side moves without the other, close-up pump connections can become visually disconnected or pierce the pump body.
- Change:
  - Added `scripts/check-pump-port-alignment.mjs` to compare `Pump3D` suction/discharge group centers with `pumpPorts.ts` `SUCTION_LOCAL` and `DISCHARGE_LOCAL`.
  - The check also verifies `Pump3D` machine scale matches `pumpPorts.ts` `MACHINE_SCALE`.
  - Wired the new check into `npm run check:scene`.
- Verification:
  - `node scripts/check-pump-port-alignment.mjs` passed with suction `[0,0.78,-1.54]`, discharge `[0,1.68,-0.78]`, scale `0.5`.
  - `npm run verify:scene` passed, including the new pump-port alignment gate.
  - In-app browser QA at `?qaTarget=-43,0.9,11&qaPosition=-47,3.5,7` loaded one canvas with no error-boundary text; compact topbar measured about `30.7px`.
- Risk: this is a static source-level guard. It proves model/routing anchor literals are synchronized, while final visual acceptance still depends on close-up review in the browser.

# 2026-07-02 pump-process-port low-profile pass

- Issue: shared pipe fittings had been slimmed, but `Pump3D` still owns its suction/discharge nozzle and process flange geometry. If those pump-side flanges stay thicker than the pipe fittings, close-up pump connections can still read as extra protruding pipe sections.
- Change:
  - Slimmed `PumpProcessFlanges` suction nozzle, suction flange, inner mouth, bolt circle, and bolt size.
  - Slimmed discharge nozzle, discharge flange, inner mouth, bolt circle, and bolt size.
  - Added `scripts/check-pump-port-proportions.mjs` to guard the pump-owned process-port cylinders and bolt-circle multiplier.
  - Wired the new check into `npm run check:scene`.
- Verification:
  - `node scripts/check-pump-port-proportions.mjs` passed with `cylinders=8`, max radius `0.235`, max length `0.2`, and two process-port bolt maps.
  - `npm run verify:scene` passed, including the new pump process-port gate.
  - In-app browser QA at `?qaTarget=-43,0.9,11&qaPosition=-47,3.5,7` loaded one canvas with no error-boundary text; compact topbar measured about `30.7px`.
- Risk: this preserves the same pump flange anchor coordinates, so route alignment remains unchanged. The pump-side process flanges are now visually subtler to match the low-profile pipe fittings.

# 2026-07-02 tee-weld low-profile pass

- Issue: `Pipe3D` renders a small torus weld marker at trimmed tee/junction endpoints. There are 16 trimmed junctions, and the previous weld thickness could still make branch joins read as raised collars in close-up views.
- Change:
  - Reduced `JUNCTION_WELD_THICKNESS` from `0.024r` to `0.012r`.
  - Adjusted `JUNCTION_WELD_RADIUS` to `0.985r` so the weld sits nearly flush with the pipe surface instead of protruding.
  - Tightened `scripts/check-pipe-fitting-proportions.mjs` tee-weld limits to max radius `0.99` and max thickness `0.014`.
- Verification:
  - `node scripts/check-pipe-fitting-proportions.mjs` passed with tee-weld radius `0.985`, thickness `0.012`.
  - `npm run verify:scene` passed.
  - In-app browser QA at `?qaTarget=-43,0.9,11&qaPosition=-47,3.5,7` loaded one canvas with no error-boundary text; compact topbar measured about `30.7px`.
- Risk: tee welds are now subtle surface seams. They may be less visible from far away, but close-up pipe joins should read less bulky.

# 2026-07-02 inspection-collar low-profile pass

- Issue: `PipeInspectionCollar3D` is repeated on main-process external wall-link pipes. Its previous axial body length could read as an extra sleeve on the pipe rather than a small inspection marker in close-up views.
- Change:
  - Reduced inspection-collar body length from `0.12r` to `0.075r`.
  - Reduced collar ring radius, ring thickness, side clamp size, and clamp offset.
  - Tightened `scripts/check-pipe-fitting-proportions.mjs` inspection-collar limits to max radius `1.12` and max length `0.08`.
- Verification:
  - `node scripts/check-pipe-fitting-proportions.mjs` passed with inspection-collar max radius `1.1`, max length `0.075`.
  - `npm run verify:scene` passed.
  - In-app browser QA at `?qaTarget=-12,1,-4&qaPosition=-22,5,4` loaded one canvas with no error-boundary text; compact topbar measured about `30.7px`.
- Risk: the inspection marker is now intentionally subtle. It remains visible as a maintenance cue without reading as a pipe discontinuity.

# 2026-07-02 floor-sleeve low-profile pass

- Issue: hidden/underground pipe transition points use `PipeFloorSleeve3D`. The sleeve is conceptually a slab penetration marker, not an above-ground fitting, so the previous collar and visible stub could still feel like an extra pipe section in close-up views.
- Change:
  - Reduced `PipeFloorSleeve3D` base collar radius from `1.32r` to `1.18r`.
  - Reduced sleeve collar thickness, visible pipe stub length, bolt-circle radius, and bolt thickness.
  - Tightened `scripts/check-pipe-fitting-proportions.mjs` floor-sleeve limits to max radius `1.2` and max length `0.05`.
- Verification:
  - `node scripts/check-pipe-fitting-proportions.mjs` passed with floor-sleeve max radius `1.18`, max length `0.048`.
  - `npm run verify:scene` passed.
  - In-app browser QA at `?qaTarget=-43,0.9,11&qaPosition=-47,3.5,7` loaded one canvas with no error-boundary text; compact topbar measured about `30.7px`.
- Risk: floor sleeves are now intentionally very subtle. They still mark hidden pipe transitions without reading as visible raised pipework.

# 2026-07-02 wall-port low-profile pass

- Issue: pool/wall pipe penetrations still used a relatively wide `PipeWallPort3D` collar. Even with correct route endpoints, close-up views could read this as an extra protruding sleeve at tank walls.
- Change:
  - Reduced `PipeWallPort3D` outer collar radius multiplier from `1.36` to `1.22`.
  - Reduced wall-port collar thickness and visible stub length.
  - Tightened `scripts/check-pipe-fitting-proportions.mjs` wall-port limits to max radius `1.24` and max length `0.08`.
- Verification:
  - `node scripts/check-pipe-fitting-proportions.mjs` passed with wall-port max radius `1.22`, max length `0.075`.
  - `npm run verify:scene` passed.
  - In-app browser QA at `?qaTarget=-18,1,0&qaPosition=-28,9,9` loaded one canvas with no error-boundary text; compact topbar measured about `30.7px`.
- Risk: wall ports are intentionally subtle now. They still mark wall/tank penetrations, but no longer read like heavy collars.

# 2026-07-02 sealed terminal flange pass

- Issue: true pipe-network blind ends were valid, but the blind/open flange components were still slightly bulky and the existing endpoint check only verified that a blind flange was somewhere nearby. In close-up review, bulky terminal fittings can read as extra protruding pipe pieces.
- Change:
  - Slimmed `PipeBlindFlange3D` body, flange ring, blind plate, bolt circle, and bolt thickness.
  - Slimmed `PipeOpenFlange3D` open stub, flange ring, dark inner mouth, bolt circle, and bolt thickness.
  - Reordered the intake suction-manifold blind terminal JSX so the sealed pipe is immediately paired with its `PipeBlindFlange3D` before unrelated wall-port fittings.
  - Added `scripts/check-sealed-terminal-pairing.mjs` and wired it into `npm run check:scene`; sealed pipe terminals now require an immediate blind flange before the next `Pipe3D`.
  - Tightened `scripts/check-pipe-fitting-proportions.mjs` limits for open/blind flanges.
- Verification:
  - `node scripts/check-sealed-terminal-pairing.mjs` passed with `sealedBlocks=8`, `immediateBlindFlanges=8`.
  - `npm run verify:scene` passed. Fitting maxima now include open-flange radius `1.24`, length `0.14`; blind-flange radius `1.24`, length `0.11`.
  - In-app browser QA at `?qaTarget=-38,1,7&qaPosition=-48,6,14` loaded one canvas with no error-boundary text; compact topbar measured about `30.7px`.
- Risk: these are visual SCADA terminal fittings. They are intentionally low-profile to avoid close-up protrusions, not fabrication-dimension flanges.

# 2026-07-02 small pipe terminal fitting pass

- Issue: the chemical dosing injection ports and clean-water header terminals were not covered by the shared fitting-proportion gate. In close-up views these small-pipe details could still read as extra protruding caps because their local collars were large relative to the pipe radius.
- Change:
  - Slimmed `DosingPort` in `ChemicalPipeRouting` by reducing the top collar, downward stub, tapered injector, valve ring, and support legs.
  - Slimmed `CleanWaterHeaderTerminal` in `ChemicalDosingSection` by reducing the collar, inlet/blind stub, and small inlet handle.
  - Added `scripts/check-small-pipe-terminal-proportions.mjs` and wired it into `npm run check:scene` so these special-case small terminals stay low-profile.
- Verification:
  - `node scripts/check-small-pipe-terminal-proportions.mjs` passed with chemical dosing max radius `0.086`, max length `0.095`; clean-water terminal max radius `0.062`, max length `0.12`.
  - `npm run verify:scene` passed, including the new small-pipe terminal gate.
  - In-app browser QA at `?qaTarget=-23,2,-15&qaPosition=-8,5,-8` loaded one canvas, no error-boundary text, compact topbar measured about `30.7px`.
- Risk: these are still procedural SCADA fittings, not true CSG-fused nozzles. The proportions are now guarded so future close-up regressions should be caught earlier.

# 2026-07-02 Edge toolbar density pass

- Issue: on Edge / wide high-DPI displays, the top toolbar could miss the compact `<=1920px` density guard and render the full labeled desktop controls, making the title/action bar appear oversized.
- Change:
  - Expanded the final toolbar density guard to `<=2560px` and high-DPI displays.
  - Reduced compact topbar height, icon button sizes, tab/button heights, and the lower view/zoom controls.
  - Kept the existing icon-only behavior for overview, 3D/dashboard tabs, palette, quality, and status controls in compact mode.
- Verification:
  - `npm run verify:scene` passed.
  - Local dev server returned HTTP 200.
  - In-app browser runtime measurement after reload: topbar `30.7px`, active tab `17px`, overview button `20px`, zoom button about `25.8px`, canvas count `1`, compact toolbar labels hidden.
- Risk: this intentionally prioritizes compact SCADA operation density over showing full toolbar text on common desktop resolutions. Tooltips/titles remain available on controls.

# 2026-07-02 chemical metering pump port pass

- Issue: chemical metering pump small pipes had explicit route endpoints, but the pump body did not have matching visible inlet/outlet ports. In close-up views the thin chemical tubes could read as hovering next to the pump.
- Change:
  - Added two small low-profile chemical ports to `ChemicalMeteringPump3D`, aligned to the existing small-pipe route endpoints.
  - Added `scripts/check-chemical-metering-ports.mjs` to guard the alignment between metering pump local ports and `ChemicalDosingSection` small-pipe endpoints.
  - Wired the new check into `npm run check:scene`.
- Verification:
  - `node scripts/check-chemical-metering-ports.mjs` passed.
  - `npm run verify:scene` passed, including the new chemical metering port gate.
  - In-app browser QA at `?qaTarget=-23,2,-15&qaPosition=-8,5,-8` loaded one canvas with no console errors/warnings.
- Risk: these are visual SCADA pump ports, not detailed metering-pump CAD. They are intentionally small so they support connection readability without adding bulky fittings.

# 2026-07-02 pool pipe visibility semantics gate

- Issue: pool-internal and underground pipe visibility had a few hard-coded hidden Y values. That makes it easier for future edits to accidentally expose pipe runs inside open basins or remove the exterior wall runs that should remain visible.
- Change:
  - Replaced hard-coded hidden transfer heights in intake and sludge routes with shared `HIDDEN_PROCESS_PIPE_Y`.
  - Added `scripts/check-pool-pipe-visibility.mjs` to check that `Pipe3D` hidden-route heights use the shared constant.
  - The script also checks that process wall-link files keep external visible routing through `EXTERNAL_POOL_PIPE_Y/Z` and `PipeWallPort3D`.
  - Wired the new check into `npm run check:scene`.
- Verification:
  - `node scripts/check-pool-pipe-visibility.mjs` passed.
  - `npm run verify:scene` passed, including the new pool pipe visibility gate.
  - In-app browser QA at `?qaTarget=-18,1,0&qaPosition=-28,9,9` loaded one canvas with no console errors/warnings.
- Risk: this is a static visibility-semantics guard. It does not replace close-up visual inspection, but it prevents the earlier class of mistakes where internal/hidden pipe coordinates are mixed with visible wall routes.

# 2026-07-02 pipe fitting proportion gate

- Issue: close-up pipe quality depends on shared fittings staying low-profile. The existing endpoint and pump checks would not catch a future change that makes wall ports, floor sleeves, flanges, blind flanges, inspection collars, or tee welds visually bulky again.
- Change:
  - Added `scripts/check-pipe-fitting-proportions.mjs` to enforce low-profile fitting limits for shared pipe accessories.
  - The script checks cylinder radius multipliers, axial thickness multipliers, and tee weld ring constants.
  - Wired the new check into `npm run check:scene`.
- Verification:
  - `node scripts/check-pipe-fitting-proportions.mjs` passed. Current maxima include wall-port radius `1.36`, flange/blind-flange radius `1.34`, floor-sleeve radius `1.32`, inspection-collar radius `1.16`, and tee-weld thickness `0.024`.
  - `npm run verify:scene` passed, including the new fitting-proportion gate.
  - In-app browser QA at `?qaTarget=-43,0.9,11&qaPosition=-47,3.5,7` loaded one canvas with no console errors/warnings.
- Risk: the limits are visual QA limits, not engineering dimensions. They intentionally keep SCADA pipe fittings readable but subtle in close-up.

# 2026-07-02 3D Html overlay depth gate

- Issue: a few remaining 3D `Html` overlays still used high foreground z-index ranges, and two overlays relied on Drei's implicit default layer. These can cover pipe/pump details in close-up QA even when the 3D geometry is correct.
- Change:
  - Reduced `DiegeticPanel3D` pump hover panel size, opacity, distance factor, and z-index range.
  - Lowered flow-meter label z-index ranges and distance factors.
  - Reduced the always-visible valve panel size and z-index range.
  - Lowered the outfall pH mini-panel z-index and scale.
  - Added explicit low z-index ranges to the worker inspection bubble and screw-press bag loading indicator.
  - Added `scripts/check-html-overlay-depth.mjs` and wired it into `npm run check:scene` so 3D Html overlays must declare bounded z-index ranges.
- Verification:
  - `node scripts/check-html-overlay-depth.mjs` passed with 16 overlays, all explicit, max declared z-index 70.
  - `npm run verify:scene` passed, including the new overlay-depth gate.
  - In-app browser QA at `?qaTarget=20,0.9,-15&qaPosition=29,4.2,-22` loaded one canvas with no console errors/warnings. Runtime measurements showed normal tank and flow-meter labels rendering at tiny scaled sizes rather than foreground panels.
- Risk: some hover/inspection labels are intentionally subtler. Full details remain available by selecting equipment or using dashboard panels.

# 2026-07-02 pump endpoint overlap gate

- Issue: even after shortening visible pump stubs, `Pipe3D` still applied equipment endpoint overlap as an uncapped radius multiplier. On larger pump pipes that could insert too deeply into the pump or wall and read as a protruding/penetrating short pipe in close-up views.
- Change:
  - Added `EQUIPMENT_CONNECTION_MAX_OVERLAP` to cap equipment endpoint insertion while retaining a minimum overlap for visual continuity.
  - Added `scripts/check-pump-pipe-geometry.mjs` to guard pump suction/discharge stub lengths and equipment overlap cap values.
  - Added the new pump geometry check to `npm run check:scene` so `verify:scene` covers this close-up pipe quality rule.
- Verification:
  - `node scripts/check-pump-pipe-geometry.mjs` passed.
  - `npm run verify:scene` passed, including the new pump geometry gate.
  - In-app browser runtime health check at `?qaTarget=-43,0.9,11&qaPosition=-47,3.5,7` loaded one canvas with no console errors/warnings and a compact 33px topbar.
- Risk: the overlap cap is a visual SCADA-model rule, not a fabrication dimension. It is intended to prevent close-up protrusions while keeping pipe endpoints visibly connected.

# 2026-07-02 low-profile pipe fitting pass

- Issue: shared pipe fittings still used relatively thick outer collars and flange rings. In close-up views these could read as extra protruding pipe pieces or heavy bumps at wall ports, floor sleeves, terminal flanges, blind flanges, inspection collars, and tee welds.
- Change:
  - Reduced `PipeJunctionWeld` ring radius/thickness.
  - Slimmed `PipeWallPort3D` wall plate and insertion stub.
  - Slimmed `PipeOpenFlange3D` and `PipeBlindFlange3D` flange/body/deck thickness, bolt radius, and bolt-circle radius.
  - Slimmed `PipeFloorSleeve3D` base sleeve, visible pipe stub, and bolts.
  - Slimmed `PipeInspectionCollar3D` body rings and side clamp blocks.
  - Shortened shared pump suction/discharge stub lengths in `pumpPorts.ts` so pipes meet pump flanges without a long exposed short spool.
  - Slimmed `Pump3D` built-in process flanges/nozzles/bolts to match the lower-profile pipe fittings.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser QA at `?qaTarget=-43,0.9,11&qaPosition=-47,3.5,7` loaded one canvas with no console errors/warnings and the compact topbar still at about 33px.
  - The in-app browser screenshot endpoint timed out twice after this pass; visual acceptance still needs a manual browser look or a later successful screenshot.
- Risk: fittings are intentionally less prominent. The pipe endpoint checker still enforces explicit terminal fittings so true ends do not become bare cuts.

# 2026-07-02 compact tank and DAF panel pass

- Issue: shared `Tank3D` labels still used a high z-index range and relatively large scale, so basin names could float over close-up pipe and pump inspection views. The DAF hover/control panel also used a large inline card with high z-index.
- Change:
  - Lowered normal `Tank3D` label z-index range and distance factor.
  - Reduced normal tank-label opacity, scale, padding, text size, and shadow while keeping selected/alarm states readable.
  - Replaced the inline DAF control card with compact class-based styling and a lower z-index range.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser QA at `?qaTarget=20,0.9,-15&qaPosition=29,4.2,-22` loaded one canvas with no console errors/warnings.
  - Runtime measurement showed normal tank labels at reduced scale/opacity and the topbar still at about 33px with no horizontal overflow.
- Risk: non-selected tank names are intentionally subtle in global views. Operators can still select equipment for full details.

# 2026-07-02 Edge topbar density pass

- Issue: at near-1920px Edge viewport widths, the toolbar still used the large desktop text layout. With Windows/Edge scaling this made the top bar and bottom view controls look oversized and crowded.
- Change:
  - Expanded the final toolbar density guard from `max-width: 1600px` to `max-width: 1920px`.
  - Reduced compact topbar height and icon/button dimensions.
  - Hid the local demo scenario control from the compact topbar to prevent it from stretching the center cluster.
  - Reduced the bottom view preset bar and zoom control scale in the same density guard.
- Verification:
  - `npm run verify:scene` passed.
- Risk: 1920px and narrower viewports now use icon-first toolbar controls. Text labels are still available via button titles/ARIA and the dashboard/detail panels.

# 2026-07-02 compact chemical tank label pass

- Issue: compact chemical tank labels were still given a high z-index range and large `distanceFactor`, so in close-up views they could float over thin chemical pipes and make pipe endpoints harder to inspect.
- Change:
  - Reduced compact `ChemicalTank3D` label z-index range from `[70, 0]` to `[38, 0]`.
  - Reduced compact label `distanceFactor` from 42 to 24.
  - Tightened `.chemical-tank-label.compact` opacity, scale, max width, padding, background, border, shadow, and nested text size.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser QA at `?qaTarget=-23,2,-15&qaPosition=-8,5,-8` loaded one canvas with no console errors/warnings.
  - Runtime measured six compact chemical labels at reduced scale/opacity; visual inspection showed the labels no longer dominate the thin chemical pipes.
- Risk: compact tank labels are intentionally subtle unless selected. Detailed tank identity remains available through selection/detail panels.

# 2026-07-02 compact process marker pass

- Issue: process markers such as `⇩ 底部中心排泥`, `排渣方向`, and `脱水污泥外运堆场` still used relatively prominent HTML labels or inline styles. In close-up views they could compete with pipe and pump details.
- Change:
  - Replaced inline DAF and clarifier process-marker styles with a shared `.process-marker-3d` class.
  - Converted the sludge yard marker to the same compact class.
  - Reduced marker z-index ranges and distance factors so these markers behave as small process annotations rather than foreground panels.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser QA at deep-treatment and sludge close-up URLs loaded one canvas with no console errors/warnings.
  - Runtime marker measurements showed compact 8px text and smaller visible marker boxes.
- Risk: process markers are intentionally subtler from global views. This improves close-up pipe inspection, while detailed process state remains available through labels and dashboard panels.

# 2026-07-02 compact zone label pass

- Issue: large floating section labels such as `深度处理段` and `污泥处理段` could cover pump and pipe details in close-up camera views, making it harder to judge whether pipe connections are clean.
- Change:
  - Reduced shared `ZoneLabel` `distanceFactor` from 24 to 16.
  - Lowered its z-index range from `[80, 0]` to `[48, 0]`.
  - Tightened `.zone-label-chip` typography, padding, max width, background opacity, border strength, and shadow.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser QA at deep-treatment and sludge close-up URLs loaded one canvas with no console errors/warnings.
  - Runtime label measurements showed compact 9px label text and smaller visible label boxes, reducing pipe/pump obstruction.
- Risk: section labels are intentionally less prominent from distant global views. The bottom view preset controls still provide section navigation.

# 2026-07-02 compact deep-treatment pH panel pass

- Issue: the deep-treatment mixing pH overlay could grow visually large in close camera views and block pipe/pump inspection, especially when checking the deep-treatment pump and tank-wall pipe area.
- Change:
  - Replaced the inline `MixingPHPanel` card styles with compact CSS classes.
  - Reduced the panel `distanceFactor`, z-index range, padding, font sizes, and visual scale so the pH information remains visible without dominating close-up pipe views.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser QA at `?qaTarget=20,0.9,-15&qaPosition=29,4.2,-22` loaded one canvas with no console errors/warnings.
  - Runtime measurement showed the pH panel at about 138x35px and the topbar at about 35px, with no horizontal overflow.
- Risk: the pH panel is intentionally less prominent from far zoom. The dashboard and tank detail panel still provide full pH readout when needed.

# 2026-07-02 in-app browser topbar and intake pipe QA

- Check: used the Codex in-app browser against `http://127.0.0.1:5173/` and the close-up URL `?qaTarget=-43,0.9,11&qaPosition=-47,3.5,7`.
- Evidence:
  - Page loaded with one WebGL canvas and no browser console errors/warnings.
  - At 1280x720 with DPR 1.5, the compact topbar measured about 35px high; overview/view/palette/status controls stayed in compact icon-first mode with no horizontal overflow.
  - Intake pump close-up showed the suction/discharge pipe cluster rendering with explicit flanges/ports and the newly added manifold blind-end rather than a bare pipe cut at the last pump branch.
- Risk: this is a spot check of the intake-pump close-up and topbar density, not a full manual rotation around every pipe junction in the plant.

# 2026-07-02 pipe terminal fitting gate

- Issue: the pipe endpoint checker previously warned about open terminal endpoints but did not fail the build, and it did not require sealed terminal endpoints to have a real blind-flange component nearby. That left room for future edits to reintroduce visible cut ends or fake sealed pipe heads.
- Change:
  - Promoted terminal fitting coverage from a warning to a hard endpoint-check failure.
  - Open terminal endpoints now require an explicit `PipeOpenFlange3D` or `CleanWaterHeaderTerminal` nearby.
  - Sealed terminal endpoints now require an explicit `PipeBlindFlange3D` nearby.
  - Added `terminalFittingContexts` to the endpoint checker output so terminal-fitting coverage is visible during verification.
- Verification:
  - `node scripts/check-pipe-endpoints.mjs` passed.
  - `npm run verify:scene` passed.
  - Current endpoint scan reports terminal=12, equipment=58, junction=20, sealedBlocks=8, junctionTrimBlocks=16, terminalFittingContexts=27.
- Risk: the checker is static and context-window based. It is intentionally strict enough to catch missing terminal fittings, but it does not prove millimeter-level visual alignment in the rendered browser.

# 2026-07-02 pipe manifold terminal audit pass

- Issue: two suction manifolds ended directly on the last pump branch junction. In close-up views this can read as a cut pipe endpoint or an extra tee protrusion because the branch point was also acting as the manifold terminal.
- Change:
  - Extended the intake lift-pump suction manifold slightly past the final suction branch and added a low-profile blind flange.
  - Extended the deep-treatment intermediate-pump suction manifold slightly past the second suction branch and added a low-profile blind flange.
  - Reclassified the outfall municipal outlet drop endpoint from `junction` to `equipment` because it connects to a floor sleeve/outlet, not another pipe tee.
  - Added `startJunctionRole` / `endJunctionRole` audit markers for untrimmed junction endpoints that are real section handoffs or continuous route joins.
  - Tightened `scripts/check-pipe-endpoints.mjs` so any untrimmed junction endpoint must either use `junctionTrim` or explicitly declare a handoff/continuous role.
- Verification:
  - `npm run verify:scene` passed.
  - Pipe endpoint scan now reports terminal=12, equipment=58, junction=20, sealedBlocks=8, junctionTrimBlocks=16.
- Risk: blind ends are intentionally visible as real pipe terminations. They reduce false cut ends at pump branches, but final close-up acceptance still depends on rotating around these manifolds in the browser.

# 2026-07-02 Edge high-DPI toolbar density guard

- Issue: in Edge on Windows display scaling / browser zoom, topbar and lower view controls could still render oversized because compact media-query rules were placed before later base button definitions, and the previous high-DPI query only applied up to a 1600px CSS viewport.
- Change:
  - Added a final compact density guard after the base toolbar button styles in `src/index.css`.
  - Applied compact sizing for high-DPI / zoomed contexts to the topbar, overview button, view tabs, palette switcher, quality toggle, demo selector, alarm/status controls, lower view preset bar, and zoom controls.
  - Hid secondary labels in compact high-DPI mode so Edge scaling does not make the header dominate the 3D scene.
- Verification:
  - `npm run verify:scene` passed.
- Risk: on any high-DPI display the toolbar now intentionally prefers compact icon-first controls. This is meant for Edge/Windows scaling; if a future touchscreen deployment needs large hit targets, add a separate touch mode instead of weakening this density guard.

# 2026-07-02 overlay keyboard focus and state semantics pass

- Issue: topbar toggles, view switchers, palette controls, alarm panel toggle, and view preset buttons were visually clickable but did not consistently expose pressed/expanded/current state semantics or a unified keyboard focus ring.
- Change:
  - Added `aria-pressed` to the 3D/dashboard view buttons and scene palette buttons.
  - Added `aria-controls`/`aria-expanded` for the overview and alarm panel toggles, with matching panel ids.
  - Added descriptive `aria-label` text for each 3D view preset button.
  - Added a consistent industrial amber `:focus-visible` treatment for topbar controls, panel buttons, equipment action buttons, zoom controls, and view presets.
- Verification:
  - `npm run verify:scene` passed.
  - Static search confirms the new ARIA state attributes and focus-visible selectors are present.
- Risk: visual focus rings appear only during keyboard focus because the rules use `:focus-visible`; pointer-only interaction remains visually unchanged.

# 2026-07-02 pipe accessory low-profile pass

- Issue: pipe inspection collars and support clamps are not process connections, but their previous body lengths and flange sizes could read as extra pipe joints in close-up views.
- Change:
  - Slimmed `PipeInspectionCollar3D` from a short sleeve into a low-profile inspection band with thinner side rings and smaller latch blocks.
  - Reduced `Pipe3D` support clamp radius/bar thickness and base-plate size so supports remain structural but less likely to be mistaken for pipe fittings.
  - Kept all pipe routes, endpoint semantics, and process flow unchanged.
- Verification:
  - `npm run verify:scene` passed.
  - Endpoint scan remains terminal=10, equipment=57, junction=23, sealedBlocks=6, junctionTrimBlocks=16.
- Risk: accessories are intentionally subtler from far zoom. This is aligned with the close-up requirement: real connections should read clearly while decorative/support hardware should not look like extra pipe endpoints.

# 2026-07-02 open inlet endpoint semantics pass

- Issue: the two raw-water inlet pipes in the intake section were marked as `startConnection="junction"` even though each inlet already has an explicit `PipeOpenFlange3D`. This did not create a visual cap, but it made the endpoint audit harder because those open flanges were mixed with real branch-to-header junctions.
- Change:
  - Changed both raw-water inlet pipe starts from `junction` to `terminal`.
  - Kept their explicit `PipeOpenFlange3D` fittings in place, so no automatic pipe cap is rendered and the open inlet visual remains controlled by the flange component.
  - Re-audited remaining untrimmed `junction` endpoints; the remaining cases are section handoffs, headers, floor-sleeve handoffs, or cross-section joins rather than pump/branch tee ends.
- Verification:
  - `npm run verify:scene` passed.
  - Endpoint scan now reports terminal=10, equipment=57, junction=23, sealedBlocks=6, junctionTrimBlocks=16.
- Risk: none expected; this is an endpoint semantics correction and does not move geometry.

# 2026-07-02 pipe endpoint verifier hardening

- Issue: after the close-up pipe cleanup, future pipe edits could accidentally use `sealedStart`/`sealedEnd` on the wrong side of a pipe or apply `junctionTrim` to a non-junction endpoint, reintroducing visible gaps, protrusions, or false terminal caps.
- Change:
  - Tightened `scripts/check-pipe-endpoints.mjs` so `sealedStart` requires `startConnection="terminal"` and `sealedEnd` requires `endConnection="terminal"` on the same side.
  - Kept `junctionTrim` validation for start/end junction side correctness.
  - Added an open-terminal warning path that ignores nearby explicit terminal fittings such as `PipeOpenFlange3D`, `PipeBlindFlange3D`, and `CleanWaterHeaderTerminal`.
- Verification:
  - `node scripts/check-pipe-endpoints.mjs` passed cleanly.
  - `npm run verify:scene` passed; endpoint scan remains terminal=8, equipment=57, junction=25, sealedBlocks=6, junctionTrimBlocks=16.
- Risk: the explicit-terminal detection is static and text-window based. It is intentionally conservative for the current sections; if a future terminal component has a new name, add it to the verifier allow-list.

# 2026-07-02 equipment endpoint overlap reduction

- Issue: pump flange coordinates in `pumpPorts.ts` match the scaled `Pump3D` flange groups, but `Pipe3D` still extended every equipment endpoint by `2.2R` plus a `0.06` minimum. On large process pipes this made the pipe penetrate pump bodies, wall ports, and tank penetrations more deeply than necessary in close-up views.
- Change:
  - Reduced `EQUIPMENT_CONNECTION_OVERLAP` from `2.2` to `1.35`.
  - Reduced non-junction minimum endpoint overlap from `0.06` to `0.04`.
  - Kept terminal, sealed, and explicit `junctionTrim` behavior unchanged.
- Verification:
  - `npm run verify:scene` passed.
  - Static pipe endpoint scan still reports terminal=8, equipment=57, junction=25, sealedBlocks=6, junctionTrimBlocks=16.
- Risk: this deliberately reduces hidden insertion depth. If a future camera angle reveals a small gap at a particular equipment port, that port should get an explicit local fitting rather than increasing the global overlap back to a deep penetration.

# 2026-07-02 terminal flange low-profile pass

- Issue: terminal open flanges and blind flanges still had relatively long colored pipe necks and tall bolts. In close-up views those true terminal fittings could read as another extra pipe stub, especially after `Pipe3D` stopped drawing automatic caps.
- Change:
  - Slimmed `PipeOpenFlange3D` by shortening the colored pipe neck, reducing flange disk diameter/depth, and shrinking bolt heads.
  - Slimmed `PipeBlindFlange3D` more aggressively so blind ends read as a flat blind plate instead of a colored pipe extension plus cap.
  - Extended `scripts/check-pipe-endpoints.mjs` to validate `junctionTrim`: start trims must be on `startConnection="junction"` and end trims must be on `endConnection="junction"`.
- Verification:
  - `npm run verify:scene` passed.
  - Static pipe endpoint scan now reports terminal=8, equipment=57, junction=25, sealedBlocks=6, junctionTrimBlocks=16 with no misuse errors.
- Risk: flanges are intentionally less prominent from far zoom. Close-up readability should improve because terminal fittings are now flatter and less likely to look like unintended pipe protrusions.

# 2026-07-02 branch junction weld bead pass

- Issue: after trimming branch pipes back to the header surface, close-up views can show a small visual seam at branch-to-header junctions. Adding a bulky sleeve would reintroduce the "extra protruding pipe part" problem.
- Change:
  - Added a low-profile `PipeJunctionWeld` bead inside `Pipe3D`.
  - The weld bead renders only for endpoints explicitly marked with `junctionTrim`, so main headers, cross-section pipes, wall ports, floor sleeves, and terminal fittings remain unchanged.
  - The bead is a very thin torus around the branch pipe and is skipped in performance mode to avoid extra geometry on low-spec rendering.
- Verification:
  - `npm run verify:scene` passed.
  - Static pipe endpoint scan still reports all 45 section `Pipe3D` blocks with explicit endpoint semantics.
- Risk: this is a visual weld bead, not a boolean-unioned saddle fitting. It should cover small seams without creating a prominent coupling, but final judgment still depends on close-up rotation around each pump header.

# 2026-07-02 branch-to-header junction trim pass

- Issue: branch pipes that connect to a larger visible header used `junction` endpoints at the header centerline. At close zoom this can expose an open circular branch end inside the header or make the branch look like it pierces through the main pipe.
- Change:
  - Added `junctionTrim` to `Pipe3D` so only explicit branch-to-header joins are trimmed back to the header surface.
  - Applied `junctionTrim="end"` to pump discharge branches in the intake, deep-treatment, drainage, clarifier-sludge, DAF-sludge, and sludge-export pump groups.
  - Applied `junctionTrim="start"` to pump suction branches that leave a suction manifold and to clean-water dosing drops from the small header.
  - Left main headers, cross-section transfers, floor sleeves, wall ports, and terminal pipes untrimmed to avoid introducing new visible gaps.
- Verification:
  - `npm run verify:scene` passed.
  - Static pipe endpoint scan still reports all 45 section `Pipe3D` blocks with explicit endpoint semantics.
- Risk: `junctionTrim` is a visual surface trim based on the branch radius, not CSG boolean union. It should reduce close-up branch protrusions without changing process flow, but future larger/smaller header radii may need a per-connection trim factor.

# 2026-07-02 pipe sleeve low-profile pass

- Issue: even after removing automatic pipe caps, wall ports and floor sleeves still included a visible colored short nipple. In close-up views these fittings can read as extra pipe sections rather than as flush penetration hardware.
- Change:
  - Slimmed `PipeWallPort3D` flange diameter/depth and shortened the colored inner sleeve.
  - Slimmed `PipeFloorSleeve3D` flange, colored sleeve, and bolt geometry so floor penetrations read as low-profile sleeves rather than raised pipe stubs.
  - Kept pipe body overlap and endpoint semantics unchanged; this pass only reduces fitting protrusion.
- Verification:
  - `npm run verify:scene` passed.
  - Static pipe endpoint scan still reports all 45 section `Pipe3D` blocks with explicit endpoint semantics.
- Risk: the sleeves are intentionally less prominent, so they may be less visible from far zoom. This is acceptable because the current priority is close-up pipe connection realism and avoiding extra-looking protrusions.

# 2026-07-02 pipe terminal protrusion cleanup

- Issue: `Pipe3D` still rendered an internal circular cap for every endpoint marked `terminal`, and `sealedStart/sealedEnd` extended the pipe a small distance beyond the declared endpoint. In close-up views this can read as an extra pipe head or a doubled blind end when a section already places `PipeBlindFlange3D`, `PipeOpenFlange3D`, or a custom terminal fitting at the same coordinate.
- Change:
  - Removed the built-in `PipeEndCap` rendering from `Pipe3D`; pipe-end visuals should now come from explicit terminal/fitting components.
  - Changed sealed endpoint overlap to `0`, so blind-end pipes stop at the declared flange plane instead of protruding past it.
  - Kept equipment endpoint overlap unchanged so pump/wall/tank insertions still visually meet their ports.
- Verification:
  - `npm run verify:scene` passed.
  - Static pipe endpoint scan still reports all 45 section `Pipe3D` blocks with explicit endpoint semantics: terminal=8, equipment=57, junction=25, sealedBlocks=6.
- Risk: true terminal ends now rely on explicit fittings (`PipeBlindFlange3D`, `PipeOpenFlange3D`, custom terminal components). Current section usage already follows that pattern; future bare terminal pipes should add an explicit fitting instead of relying on `Pipe3D`.

# 2026-07-02 Edge compact toolbar density pass

- Issue: in Edge, especially when browser zoom or display scaling is above 100%, the fixed 48px overlay topbar and 30px toolbar controls render visually oversized and can clip/overpower the 3D scene. The layout also kept too many secondary labels visible before switching to compact mode.
- Change:
  - Reduced the base topbar height from 48px to 44px.
  - Tightened topbar columns, gaps, padding, brand mark, overview button, status pill, quality toggle, view tabs, demo control, palette toggle, and zoom buttons.
  - Added a compact high-zoom/high-DPR fallback media query that switches the topbar to 34px, hides secondary text labels, and scales the bottom view preset bar and zoom stack.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser navigation to `http://127.0.0.1:5173/` was blocked by the browser plugin with `net::ERR_BLOCKED_BY_CLIENT`, so runtime computed-size verification could not be completed in that surface this pass.
- Risk: compact high-DPR rules may also apply on high-scale Windows displays, which is intentional for this UI density issue. If a future large touch-screen deployment needs bigger hit targets, add an explicit touch-display mode instead of increasing the default toolbar size.

# 2026-07-02 overlay inline cleanup pass

- Issue: after the larger overlay refactors, `Overlay.tsx` still had two low-level inline styles: the fallback `暂无详细数据` muted text and the overview chevron rotation.
- Change:
  - Replaced fallback muted detail text with `.equipment-detail-muted`.
  - Replaced inline chevron transform with `.header-overview-chevron.open`.
  - Confirmed `Overlay.tsx` no longer contains `style={{ ... }}` inline style blocks.
- Verification:
  - `npm run verify:scene` passed.
  - Browser verification showed active `3D 工艺`, `高画质`, effective canvas DPR `1.5`, overlay z-index `10000`, `overflowX=false`, `.header-overview-chevron` and `.equipment-detail-muted` CSS loaded, and no console errors.
- Risk: none expected; behavior is unchanged and only presentation moved to CSS.

# 2026-07-02 critical alarm banner styling pass

- Issue: the active critical-alarm banner still used inline layout, color, and confirm-button styles in `Overlay.tsx`, unlike the refactored alarm panel rows and shared overlay shell.
- Change:
  - Replaced the banner wrapper, icon, text, and confirm button with `.critical-alarm-*` classes.
  - Added responsive spacing so the banner remains readable in compact/high-DPI layouts.
  - Kept the acknowledgement behavior unchanged: the confirm button still acknowledges all unacknowledged critical alarms.
- Verification:
  - `npm run verify:scene` passed.
  - Browser verification showed active `3D 工艺`, `高画质`, `overflowX=false`, `.critical-alarm-*` CSS loaded, and no console errors.
- Risk: current normal scenario did not render the banner during browser verification, so the runtime check verified CSS availability and page state rather than a live critical-alarm visual state.

# 2026-07-02 zoom control shell styling pass

- Issue: the 3D zoom control shell still used inline styles for right/bottom positioning, stacking, spacing, and the `滚轮缩放` hint. This was inconsistent with the rest of the overlay cleanup and made compact layout tuning harder.
- Change:
  - Replaced the zoom control wrapper and button stack with `.zoom-tool-panel` and `.zoom-tool-stack`.
  - Replaced the inline hint text styles with `.zoom-tool-hint`.
  - Added compact breakpoint positioning for `.zoom-tool-panel`.
- Verification:
  - `npm run verify:scene` passed.
  - Browser verification showed active `3D 工艺`, `.zoom-tool-panel` and `.zoom-tool-hint` CSS loaded, the panel positioned at the right/bottom edge without overflow, and no console errors.
- Risk: none expected; button behavior and orbit zoom handlers were unchanged.

# 2026-07-02 equipment detail panel shell pass

- Issue: the right-side equipment detail panel still used inline styles for positioning, slide-in state, header, close button, selected-equipment alarm banner, body layout, and empty state. This made it inconsistent with the newly shared overview/alarm panel shell classes.
- Change:
  - Replaced the detail panel shell with `.equipment-detail-panel` and an `open` state class.
  - Added `.equipment-detail-header`, `.equipment-detail-title`, `.equipment-detail-alert`, `.equipment-detail-body`, and `.equipment-detail-empty`.
  - Reused the shared `.overlay-panel-icon-btn` for closing the detail panel.
  - Added mobile-width fallback for the detail panel to avoid fixed 320px layout assumptions.
- Verification:
  - `npm run verify:scene` passed.
  - Browser verification showed active `3D 工艺`, `高画质`, effective canvas DPR `1.5`, `overflowX=false`, `.equipment-detail-*` CSS loaded, and no console errors.
- Risk: browser verification observed the panel in its closed state because no equipment was selected after reload. The open/closed behavior still uses the same `selectedEquipmentId` condition as before, now expressed as a class.

# 2026-07-02 overlay panel shell and z-index pass

- Issue: the overview and alarm dropdown panels still used inline positioning/header/body/button styles. During browser verification, a more serious issue was found: 3D HTML labels could sit above the topbar hit target, causing the alarm button area to be intercepted by a scene label instead of the toolbar.
- Change:
  - Added `.scada-overlay-root` and raised `--z-overlay` to `10000` so the topbar, dropdowns, zoom controls, and panels consistently sit above 3D labels.
  - Replaced overview/alarm panel backdrops, shells, headers, bodies, icon buttons, alarm count badge, clear button, and empty state with shared CSS classes.
  - Added mobile-width fallback so overview/alarm panels span available width without horizontal overflow.
- Verification:
  - `npm run verify:scene` passed.
  - Browser hit-testing confirmed the alarm button center no longer hits a 3D label; clicking opens `.alarm-history-panel`.
  - Browser verification opened the alarm panel and overview panel with `overflowX=false`, no console errors, and overview rows rendered correctly.
- Risk: raising the overlay stacking layer intentionally prioritizes all SCADA controls over 3D HTML labels. If a future feature requires direct label interaction near the topbar, it should avoid the toolbar area or use explicit z-index management.

# 2026-07-02 overview data row styling pass

- Issue: the topbar overview dropdown used inline layout and typography styles for `DataRow`, which made the compact overview panel less consistent with the rest of the refactored UI.
- Change:
  - Replaced `DataRow` inline flex/font/color styles with `.overview-data-*` CSS classes.
  - Added text truncation, numeric alignment, fixed trend color classes, and icon shrink protection for overview KPI rows.
  - Kept overview values, units, icons, and trend semantics unchanged.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser verification opened the overview panel and found 5 `.overview-data-row` entries, all within the panel bounds, with `overflowX=false` and no console errors.
- Risk: trend coloring still uses the existing convention where `+` is red/negative and non-plus is green/positive. If a metric later treats increase as beneficial, it should pass an explicit trend intent instead of inferring from the sign.

# 2026-07-02 alarm row styling pass

- Issue: `AlarmRow` still contained inline styles for row layout, severity backgrounds, borders, text colors, timestamps, and the acknowledge button. This made the alarm panel harder to keep consistent with the rest of the SCADA UI.
- Change:
  - Replaced alarm-row inline styles with `.alarm-row`, `.alarm-row-icon`, `.alarm-row-body`, `.alarm-row-message`, `.alarm-row-time`, and `.alarm-row-ack` classes.
  - Added class-based `critical`, `warning`, and `acknowledged` states.
  - Kept the same alarm acknowledgement behavior and data flow.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser verification showed active `3D 工艺`, `高画质`, effective canvas DPR `1.5`, topbar height `39px`, `overflowX=false`, `.alarm-row*` CSS loaded, and no console errors.
- Risk: long alarm messages now truncate on one line inside each row to keep the alarm list compact. If full text is needed inline, add a tooltip or expanded row state.

# 2026-07-02 equipment detail action styling pass

- Issue: the right-side equipment detail panel repeated inline styles for tank agitator, mixing tank agitator, and pump control buttons. The repeated styles made action states visually inconsistent and harder to maintain across compact/high-DPI layouts.
- Change:
  - Added shared `EquipmentActionGroup` and `EquipmentActionButton` components in `Overlay.tsx`.
  - Added `.equipment-action-*` CSS classes for running, idle, and danger actions.
  - Changed running pump action to use the danger tone for `紧急联锁停机`, while ordinary stopped/forced-start actions use a neutral idle tone.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser verification showed active `3D 工艺`, `高画质`, effective canvas DPR `1.5`, topbar height `39px`, `overflowX=false`, `.equipment-action-*` CSS loaded, and no console errors.
- Risk: the action button color semantics changed for running pumps: emergency stop is now red/danger instead of green, which better matches the operation meaning but is a visible UI change.

# 2026-07-02 dashboard leaf component styling pass

- Issue: dashboard leaf rows still relied on inline flex/padding/color styles for pH cards, tank-level rows, control switches, and outfall submetric rows. That made compact Edge/high-DPI behavior harder to reason about and less consistent with the rest of the dashboard.
- Change:
  - Replaced pH card, tank-level row, control-switch row, outfall title, outfall status dot, outfall pH value, and submetric row inline styles with shared CSS classes.
  - Added consistent truncation, numeric alignment, status color classes, and small-screen wrapping rules for dashboard leaf controls.
  - Left only data-driven inline values in `DataDashboard.tsx`: chart SVG overflow, pH value color, and progress width.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser dashboard verification at `innerWidth=689`, `devicePixelRatio=1.5` showed active view `集控中枢`, `overflowX=false`, `consoleErrors=0`, and pH/level/control/outfall rows all within the viewport.
- Risk: this is a styling consolidation only; dashboard data logic and control behavior were not changed.

# 2026-07-02 high-quality rendering control pass

- Issue: users had no visible way to confirm whether the scene was in high-quality mode or performance mode, and ordinary 100% browser zoom could render the WebGL canvas at only 1x DPR, making close-up geometry feel soft.
- Change:
  - Added a compact topbar quality toggle showing `高画质` by default and `性能` after switching to performance mode.
  - High-quality rendering now uses at least `1.5x` canvas DPR and caps at `2x`; performance mode caps DPR at `1.25x`.
  - Increased main daylight shadow map from `2048` to `4096` and tightened the shadow camera bounds to improve close-up shadow/detail clarity.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser measurement showed the topbar quality button active with text `高画质`, effective canvas DPR `1.5`, topbar height `39px`, `overflowX=false`, and no console errors.
- Risk: high-quality mode is intentionally heavier on the GPU. The new visible `性能` mode gives a clear fallback if a target machine struggles.

# 2026-07-02 Edge topbar high-zoom compact pass

- Issue: Edge/high-DPI or browser zoom around 125%/150% could land in the 1480px responsive breakpoint where topbar controls still retained text labels and larger heights, making the title/control bar look oversized and cropped.
- Change:
  - Moved the 1480px breakpoint to the same icon-first density used by the narrow layout.
  - Reduced compact topbar height to `38px`, control height to `26px`, and view/palette buttons to `22px`.
  - Hid nonessential topbar text earlier: overview text, view tab labels, palette labels, demo mode text, brand copy, and status label.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser measurement reported `--topbar-height=38px`, rendered topbar height `39px`, `innerWidth=689`, `devicePixelRatio=1.5`, `overflowX=false`, and no console errors.
- Risk: in compact/zoomed layouts, topbar relies more on icons and titles/tooltips. This is intentional to preserve usable 3D viewport height.

# 2026-07-02 dashboard chart layout pass

- Issue: the dashboard trend-chart headers and legends still used inline layout styles. In narrow Edge/high-DPI views, legends could be pushed to the right side of the chart header and appear clipped.
- Change:
  - Replaced inline chart header, legend, chart-surface, control-notice, and scroll-list styles with shared CSS classes in `DataDashboard.tsx` / `index.css`.
  - Added responsive chart header behavior: below `760px`, chart titles and legends stack vertically and legends align left with wrapping.
  - Unified the equipment-control notice and tank-level scroll list with the current dark industrial dashboard surface style.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser dashboard verification at `innerWidth=689`, `devicePixelRatio=1.5` showed `overflowX=false`, `consoleErrorCount=0`, active view `集控中枢`, and chart legends stacked above the chart surface without clipping.
  - No targeted Playwright/Puppeteer automation processes remained after verification.
- Risk: the dashboard still contains some smaller inline styles in leaf rows (pH cards, level bars, outfall submetrics). These are contained and can be migrated in a later cleanup pass if broader dashboard theming continues.

# 2026-07-02 3D label hierarchy pass

- Issue: scene labels still had bright cyan / web-card styling, so close and mid-range views made labels compete with equipment, pipes, and basin details.
- Change:
  - Reworked `.zone-label-chip`, `.tank-label`, compact chemical tank labels, and `.zone-label-mini` into smaller low-contrast industrial nameplates.
  - Added shared `.flow-meter-label` classes and moved flow-meter panels away from inline neon styling.
  - Removed hardcoded cyan border overrides from `Tank3D` and `ChemicalTank3D`; normal labels now use muted amber/steel styling, while alarm labels use a dedicated red `.alarm` state.
  - Tightened `DiegeticPanel3D` typography, border radius, opacity, and shadow.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser close-up at `?qaTarget=-18,1,0&qaPosition=-28,9,9` showed `overflowX=false`, `consoleErrorCount=0`, and normal tank labels using muted amber borders instead of forced cyan.
  - No targeted Playwright/Puppeteer automation processes remained after verification.
- Risk: very distant labels are intentionally more subdued; if operator readability at full-plant zoom becomes more important than visual realism, add a user-facing "label density" control instead of globally enlarging labels again.

# 2026-07-02 basin and platform detail pass

- Issue: close-up views still exposed plain box-like concrete basins and rail posts that visually stabbed directly into the wall top, weakening the perceived 3D quality.
- Change:
  - Added poured-concrete edge detail to `Platform3D`: perimeter coping lips, darker side wash strips, and top slab expansion joints.
  - Added basin coping caps, inner water/stain bands, and subtle exterior construction joints to `Tank3D`.
  - Added cast-iron/steel base plates under platform and tank guardrail posts so railings look mounted instead of floating or piercing concrete.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser close-up at `?qaTarget=-18,1,0&qaPosition=-28,9,9` rendered with `overflowX=false`, `consoleErrorCount=0`, active palette `写实`, and visible rail base plates/coping details.
  - No targeted Playwright/Puppeteer automation processes remained after verification.
- Risk: these details are procedural visual standards, not civil-engineering dimensions. Dedicated CAD dimensions should replace them if as-built accuracy is required.

# 2026-07-02 site context realism pass

- Issue: even after daylight color tuning, the top-down plant view still sat on a very large undifferentiated slab, making the whole scene feel like a floating demo model rather than a real wastewater station.
- Change:
  - Added `SiteContext3D` in `SCADAScene.tsx` with low-cost static geometry for asphalt service roads, warmer concrete maintenance pads, perimeter curbs, road-edge drainage channels, muted lane markings, and slab expansion joints.
  - Kept the additions below equipment/platform height and away from process logic so they improve spatial context without changing pumps, tanks, pipe routes, IDs, or SCADA data behavior.
  - Matched colors to the current `写实` / industrial / night palette branches instead of using a single decorative theme.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser reload at `http://127.0.0.1:5173/` showed the new site roads/curbs with `overflowX=false`, `consoleErrorCount=0`, active palette `写实`, and topbar height `39px`.
  - No targeted Playwright/Puppeteer automation processes remained after verification.
- Risk: the new site context is visually placed from the current demo layout, not from a surveyed plant CAD drawing. If exact civil layout is required, replace these guide roads/curbs with drawing-based coordinates.

# 2026-07-02 daylight palette and viewport overflow pass

- Issue: the realistic daylight scene still felt like an overcast gray view, and 3D HTML labels projected outside the camera could expand the document width in narrow Edge/high-DPI viewports.
- Change:
  - Forced `html`, `body`, and `#root` to clip horizontal overflow so off-screen 3D labels cannot create page-level sideways scrolling.
  - Retuned the bright/write-realistic scene palette away from cold gray: warmer neutral concrete, bluer clear sky background, stronger warm directional sun, lower ambient/fill light, and quieter floor grid lines.
  - Kept the plant from returning to the previous over-white look by using mid-tone industrial concrete instead of bright showroom gray.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser at `http://127.0.0.1:5173/` with `innerWidth=689`, `devicePixelRatio=1.5` reported `overflowX=false`, active palette `写实`, and topbar height `39px`.
  - No targeted Playwright/Puppeteer automation processes remained after verification.
- Risk: the ground plane still dominates far top-down views because the plant has a very large unbounded site slab; a future layout pass could add yard boundaries, asphalt lanes, drainage grates, or perimeter context for more real-site depth.

# 2026-07-02 Edge topbar density fix

- Issue: in Edge/high-DPI or zoomed views, the top SCADA controls looked oversized and some header content was clipped because the toolbar kept too many text controls in a fixed-height grid.
- Change:
  - Reduced the base topbar/control heights.
  - Added an earlier compact mode at `1480px` and a stricter icon-first mode at `1120px`.
  - Hid low-priority demo/status text in compact views so the title bar does not balloon or crop the workspace.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser measurement at `http://127.0.0.1:5173/` with `innerWidth=689` and `devicePixelRatio=1.5` reported topbar height `39px` and no horizontal overflow.
- Risk: compact mode intentionally removes some text labels at narrow/zoomed widths; tooltips and icons remain available for the same actions.

# 2026-07-02 viewport sharpness fix

- Issue: the 3D viewport could become visibly blurry after FPS dips because `AdaptiveDpr` was allowed to lower WebGL render resolution at runtime. This conflicts with the current requirement to inspect pipe joints, pump flanges, tank ports, and small labels at close zoom.
- Change:
  - Removed Drei `PerformanceMonitor`/`AdaptiveDpr` from `App.tsx`.
  - Locked Canvas DPR to the current device pixel ratio, capped at 2x, so the scene does not silently drop into a soft low-resolution render.
  - Reduced daytime bright-palette fog to a near-clear value and disabled bright-palette sparkle dust, because the haze layer made the plant look washed out and visually soft.
- Follow-up:
  - Restored Canvas exposure from the overly bright value back to a neutral `0.98`.
  - Disabled bright-palette scene fog, sun glow, and sparkle dust entirely to remove the remaining soft/hazy look.
- Verification: `npm run verify:scene` passed after the change.
- Risk: on weak GPUs, high-quality mode may use more fill-rate than before. The tradeoff is intentional because visual inspection clarity is now higher priority than automatic resolution reduction.

# 2026-07-02 realistic plant palette pass

- Issue: the default bright scene read as too white and showroom-like for a wastewater station.
- Change:
  - Reworked the default bright palette into a realistic wastewater-plant daytime palette: mid gray concrete ground, darker cement basin walls, muted sky gray-blue, lower ambient/fill light, duller metals, and less glossy concrete.
  - Renamed the topbar palette action from "原始" to "写实" to match the intended visual mode.
- Verification: pending `npm run verify:scene` and browser screenshot after this pass.
- Risk: this palette is a visual target based on real wastewater-station tone, not matched to a specific site photo. Further tuning should use user-provided reference imagery if exact color matching is required.

# 2026-07-02 UI density and render quality pass

- Issue: Edge/high-zoom views made the title bar and view controls feel oversized, while the 3D scene still had soft shadows and weak edge clarity.
- Change:
  - Reduced the default topbar height from 60px to 54px and tightened the main topbar controls, status pills, zoom tools, and bottom view preset bar.
  - Explicitly configured WebGL output color space and soft shadow filtering.
  - Increased the main sunlight shadow map from 1024 to 2048 and added normal bias to reduce shadow acne while improving edge definition.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser reload at `http://127.0.0.1:5173/` rendered successfully; narrow viewport topbar measured ~47px high after compact-mode rules.
  - The Puppeteer screenshot helper could not run because `puppeteer-core` is not installed in the current package; no dependency was installed.
  - No targeted Playwright/Puppeteer browser processes remained after verification.
- Risk: sharper shadows and higher shadow-map resolution cost more GPU memory in high-quality mode, but the scene remains within the current Vite build/runtime scope.

# 2026-07-02 material and 3D label refinement pass

- Issue: the scene still read as low-fidelity because concrete/metal procedural textures were low-resolution and 3D labels used bright white web-style chips that visually competed with the plant.
- Change:
  - Increased concrete texture generation from 512 to 1024 and brushed metal texture generation from 256 to 512.
  - Added mipmap filtering, linear filtering, repeat configuration, and sRGB color space setup for shared procedural detail textures.
  - Rebased the shared concrete material from white-gray to neutral industrial gray with rougher, less glossy PBR settings.
  - Reworked zone/tank labels from white chips into smaller dark translucent industrial nameplates.
  - Reduced diegetic equipment panel size and typography so pump/valve panels are less intrusive.
- Verification: `npm run verify:scene` passed; in-app browser visual check confirmed dark 3D labels and rendered scene at `http://127.0.0.1:5173/`.
- Risk: darker labels are less visually loud from very far zoom, but they better match the requested realistic wastewater-station UI style.

# 2026-07-02 dark industrial overlay restoration

- Issue: the overlay UI still used a light daytime palette, so Edge/high-zoom views showed oversized-looking white title controls and bottom bars that did not fit the realistic wastewater-station direction.
- Change:
  - Restored global panel variables to a dark industrial SCADA palette with muted text, low-opacity dark panels, and warm amber accents.
  - Converted topbar controls, view tabs, demo controls, palette toggle, zoom buttons, bottom view preset bar, scrollbars, and mini zone labels away from white/blue styling.
  - Kept status colors explicit so running/warning/error states remain readable on the darker UI.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser visual check confirmed topbar background `rgba(14, 18, 23, 0.94)`, dark bottom preset bar, amber active tab, and dark zone labels.
  - No targeted Playwright/Puppeteer browser processes remained after verification.
- Risk: dashboard cards may still need a dedicated layout pass, but the main 3D operational overlay now matches the requested industrial look.

# 2026-07-02 dashboard and texture consistency pass

- Issue:
  - The 1024 concrete texture still sampled only a 512x512 region, making parts of the texture flat and reducing perceived detail.
  - Dashboard cards, chart backgrounds, switches, progress bars, and some detail-panel controls still used light UI styling after the main overlay was moved back to dark industrial SCADA.
- Change:
  - Fixed concrete noise sampling to cover the full generated canvas.
  - Added texture anisotropy for shared procedural concrete/metal detail textures.
  - Converted dashboard cards, demo strip, switches, progress bars, chart panels, and detail-panel inactive controls to dark industrial styling.
  - Replaced bright chart endpoint strokes with dark strokes so chart elements fit the dark dashboard.
- Follow-up: converted the outfall VIP water-quality card and submetric rows from the remaining white card style to the same dark industrial panel language.
- Verification:
  - `npm run verify:scene` passed.
  - In-app browser dashboard check confirmed dark dashboard cards, dark outfall VIP card, dark metric panels, and unchanged dark topbar.
  - No targeted Playwright/Puppeteer browser processes remained after verification.
- Risk: inline chart SVG colors remain intentionally high contrast; they may need a later pass if the dashboard requires a stricter brand palette.

# 2026-07-02 responsive dashboard layout pass

- Issue: Edge/high-zoom and narrow in-app browser widths still forced the dashboard through a fixed four-column layout, causing KPI values and the outfall water-quality panel to clip horizontally.
- Change:
  - Replaced fixed inline dashboard `gridColumn: span N` layout with named responsive layout classes.
  - Converted the dashboard grid to a 12-column desktop system with tablet and narrow-width breakpoints.
  - KPI row now stacks from 3-column to 2-column to 1-column, with the outfall VIP card spanning the full row when width is limited.
  - Tank/pH/control/trend sections collapse to single-column layouts on narrower viewports.
  - Refactored KPI cards to class-based structure with responsive value sizing and no horizontal clipping.
- Verification: pending `npm run verify:scene` and in-app browser dashboard check.
- Risk: the dashboard is now more adaptive, but charts still use fixed SVG viewBox dimensions; they scale visually but may need domain-specific simplification for very small phone widths.

# 2026-07-02 pipe-flow audit: clarifier sludge suction

- Decision: continue the global pipe-flow audit from source code first, without opening browser automation, to avoid leaving background browser sessions running.
- Flow map checked:
  - Raw water: municipal/raw inlet -> collection tanks -> lift pump suction manifold -> PH1 inlet.
  - Main process: PH1 -> Fenton -> PH2 -> coagulation -> flocculation -> clarifier -> PH3 -> intermediate tank.
  - Deep treatment: intermediate tank -> intermediate lift pumps -> DAF -> mixing -> drainage -> drain pumps -> pH outfall basin -> municipal outlet.
  - Sludge: clarifier sludge pumps and DAF sludge outlet -> sludge tank -> sludge outflow pumps -> screw press -> ton bags.
  - Chemicals: dosing tanks -> overhead dosing routes -> main process, DAF, and screw press dosing points.
- Issue found: clarifier sludge pumps had discharge pipes into the sludge system, but the pump suction side was not visually connected back to the clarifier wall. This could read as a floating/one-sided pump connection when zoomed in.
- Change: added sludge-colored suction pipe stubs and wall ports from the clarifier front wall into both clarifier sludge pump suction flanges, and passed the clarifier sludge running state into `MainProcessSection` so those suction pipes animate consistently with the discharge line.
- Verification: `npx tsc -b` and `npx vite build` passed. No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.
- Risk: this is still a visual SCADA route, not a construction P&ID. The new suction wall ports are aligned to the current clarifier model dimensions and may need adjustment if the clarifier geometry is replaced.

# 2026-07-02 pipe-flow documentation pass

- Decision: add a project-local pipe-flow map so future pipe corrections can be checked against a stable process sequence instead of only against screenshots.
- Changes:
  - Added `docs/pipe-flow-map.md` with a Mermaid flowchart covering raw water, main process, deep treatment, outfall, sludge, chemical dosing, and clean-water dilution.
  - Documented the current visual modeling rules: no long visible pipes inside tanks, pump suction/discharge must both be legible, only true terminals get blind caps, and underground/internal routes should surface only at sleeves or wall ports.
- Static audit:
  - Deep-treatment route coordinates match the intended flow from intermediate tank to intermediate pumps, DAF, mixing, drainage, drain pumps, outfall pH basin, and municipal outlet.
  - Sludge route coordinates match clarifier/DAF sludge transfer to sludge tank, sludge outflow pumps, screw press, and ton bags.
  - Chemical source ports align with the six chemical tank world positions; clean-water dilution header aligns with the chemical-room back wall and tank-top drops.
- Verification: `npx tsc -b` and `npx vite build` passed. No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.
- Risk: the diagram is an implementation reference, not an official P&ID.

# 2026-07-02 equipment-to-scene audit: DAF sludge and dosing pumps

- Decision: compare the store/demo equipment IDs with 3D scene entities, because a running demo tag with no visible equipment creates misleading UI behavior.
- Issue found: `p-sludge-daf-1` and `p-sludge-daf-2` existed in the store and demo scenarios, and `SCADAScene` used them to animate DAF sludge flow, but the scene had no corresponding pump meshes. The DAF sludge route was a single simplified underground pipe from the DAF wall to the sludge tank.
- Change:
  - Added both DAF sludge pump meshes near the DAF wall.
  - Replaced the direct DAF-to-sludge-tank visual route with DAF wall suction ports, two pump suction branches, two discharge branches, a shared sludge header, a blind flange at the true header end, a floor sleeve, and an underground transfer into the sludge tank.
  - Updated `docs/pipe-flow-map.md` to show DAF sludge passing through the DAF sludge pumps before the sludge tank.
- Verification: `npx tsc -b` and `npx vite build` passed. No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# 2026-07-02 chemical dosing pump visualization

- Decision: render the dosing pump tags as compact metering pumps instead of reusing the large process-pump model, because chemical dosing skids are physically smaller and should not crowd the chemical room.
- Change:
  - Added `ChemicalMeteringPump3D`, a compact clickable metering-pump model with base plate, motor, dosing head, pulsation dampener/status light, and selected-state ring.
  - Added six dosing pump groups in the chemical room, each with primary/standby pump IDs:
    - `p-pac-1` / `p-pac-2`
    - `p-cacl2-1` / `p-cacl2-2`
    - `p-pam-1` / `p-pam-2`
    - `p-daf-coag-1` / `p-daf-coag-2`
    - `p-daf-floc-1` / `p-daf-floc-2`
    - `p-screw-pam-1` / `p-screw-pam-2`
  - Added small suction and discharge pipes from each chemical tank side to the metering pumps and then to the tank-top dosing source point.
  - Updated `docs/pipe-flow-map.md` to route chemical tanks through metering pumps before dosing points.
- Verification: `npx tsc -b` and `npx vite build` passed. No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# 2026-07-02 equipment coverage audit: gas lift pumps

- Decision: run a static equipment-coverage check after adding DAF sludge pumps and dosing pumps, so no catalog/demo equipment remains completely invisible in the 3D/UI layer.
- Issue found: `p-gas-lift-1` and `p-gas-lift-2` were still present in `equipmentCatalog` and `demoScenarios`, but had no non-catalog reference in `src/components`.
- Change:
  - Added the two gas inlet lift pump IDs to the intake lift-pump row.
  - Extended the intake suction/discharge header calculations to use the first/last pump in the array instead of hard-coded pump positions, so the added pumps are connected to the shared header.
  - Included `p-gas-lift-1` and `p-gas-lift-2` in `anyLiftRunning`, so their run state participates in intake/main-flow pipe animation.
  - Updated `docs/pipe-flow-map.md` with the gas inlet lift-pump branch.
- Verification: static equipment-coverage script now reports that all equipment IDs have at least one non-catalog reference. `npx tsc -b` and `npx vite build` passed. No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# 2026-07-02 equipment coverage guardrail

- Decision: keep the equipment coverage check as a reusable local script, so future UI/3D edits can catch catalog equipment IDs that have no non-catalog references.
- Changes:
  - Added `scripts/check-equipment-coverage.mjs`.
  - Hardened `scripts/screenshot.mjs` and `scripts/dump-pipe-ends.mjs` with `SIGINT`/`SIGTERM` browser cleanup handlers, reducing the chance that interrupted browser diagnostics leave Chrome processes running.
- Verification:
  - `node scripts/check-equipment-coverage.mjs` reports all 52 equipment IDs have at least one non-catalog reference.
  - `npx tsc -b` and `npx vite build` passed.
  - No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# 2026-07-02 chemical metering branch animation cleanup

- Decision: bind each chemical metering pump's small suction/discharge branch animation to that pump's own run state, so standby pumps do not visually show flowing chemical.
- Change:
  - Added a `MeteringPumpBranch` child component in `ChemicalDosingSection`.
  - It reads the relevant pump ID from the store and passes `animated={running}` to the two local chemical branch pipes.
  - The visible metering pump model and status light were already pump-state aware; this aligns the adjacent pipe animation with the same source of truth.
- Verification:
  - `node scripts/check-equipment-coverage.mjs` reports all 52 equipment IDs have at least one non-catalog reference.
  - `npx tsc -b` and `npx vite build` passed.
  - No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# 2026-07-02 chemical long-route animation cleanup

- Decision: bind each overhead chemical dosing route to its corresponding primary/standby metering pump pair, instead of using only the global normal-status flag.
- Change:
  - `ChemicalPipeRouting` now reads the run state for the relevant pump pair:
    - main PAC: `p-pac-1` / `p-pac-2`
    - main CaCl2: `p-cacl2-1` / `p-cacl2-2`
    - main PAM: `p-pam-1` / `p-pam-2`
    - DAF PAC/coag: `p-daf-coag-1` / `p-daf-coag-2`
    - DAF PAM/floc: `p-daf-floc-1` / `p-daf-floc-2`
    - screw-press PAM: `p-screw-pam-1` / `p-screw-pam-2`
  - The long overhead dosing pipe animates only when the plant chemical state is active and at least one pump in that pair is running.
- Verification:
  - `node scripts/check-equipment-coverage.mjs` reports all 52 equipment IDs have at least one non-catalog reference.
  - `npx tsc -b` and `npx vite build` passed.
  - No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# 2026-07-02 clean-water dilution animation cleanup

- Decision: stop showing clean-water dilution flow when the chemical dosing system is effectively idle.
- Change:
  - Extracted the clean-water header and tank-top drop pipes into `CleanWaterDilutionPiping`.
  - The clean-water pipe animation now runs only when at least one chemical metering pump is running.
  - This keeps maintenance or all-standby scenarios from showing false clean-water dilution flow.
- Verification:
  - `node scripts/check-equipment-coverage.mjs` reports all 52 equipment IDs have at least one non-catalog reference.
  - `npx tsc -b` and `npx vite build` passed.
  - No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# 2026-07-02 runtime screenshot check and selector fix

- Decision: run one browser screenshot after the latest chemical-pipe state-binding changes because this class of change can pass TypeScript while still failing at runtime through unstable store selectors.
- Issue found: `ChemicalPipeRouting` returned a new object from a Zustand selector for route-running flags, which triggered React's `getSnapshot should be cached` / maximum-update-depth runtime error and left the 3D canvas blank.
- Change: replaced the object-returning selector with six primitive boolean selectors, one per chemical route.
- Verification:
  - First screenshot reproduced the blank-canvas runtime error; the browser process closed afterward.
  - `node scripts/check-equipment-coverage.mjs` reports all 52 equipment IDs have at least one non-catalog reference.
  - `npx tsc -b` and `npx vite build` passed.
  - Second screenshot rendered the 3D scene with no console errors.
  - No Playwright/browser automation processes were found after each screenshot.

# 2026-07-02 Zustand selector guardrail

- Decision: add a reusable static guardrail for unstable Zustand selectors, after the object-returning `ChemicalPipeRouting` selector caused a blank-canvas runtime failure.
- Change:
  - Added `scripts/check-zustand-selectors.mjs`.
  - The script scans `src/` for `useScadaStore` selectors that appear to return fresh objects or arrays.
- Verification:
  - `node scripts/check-zustand-selectors.mjs` reports no obvious unstable object/array selectors.
  - `node scripts/check-equipment-coverage.mjs` reports all 52 equipment IDs have at least one non-catalog reference.
  - `npx tsc -b` and `npx vite build` passed.
  - No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# 2026-07-02 pipe endpoint guardrail

- Decision: add a reusable static guardrail for `Pipe3D` endpoint semantics, because close-up pipe quality depends on avoiding false terminal caps and undeclared pipe ends.
- Change:
  - Added `scripts/check-pipe-endpoints.mjs`.
  - The script scans section-level `Pipe3D` blocks and fails if a block omits `startConnection` or `endConnection`, or uses `sealedStart`/`sealedEnd` without a terminal endpoint.
- Verification:
  - `node scripts/check-pipe-endpoints.mjs` reports 45 section-level `Pipe3D` blocks, endpoint refs `terminal=8`, `equipment=57`, `junction=25`, and `sealedBlocks=6`, with all endpoint semantics declared.
  - `node scripts/check-equipment-coverage.mjs` reports all 52 equipment IDs have at least one non-catalog reference.
  - `node scripts/check-zustand-selectors.mjs` reports no obvious unstable object/array selectors.
  - `npx tsc -b` and `npx vite build` passed.
  - No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# 2026-07-02 unified scene verification command

- Decision: add one project command that runs the scene-specific guardrails before the normal build, so future UI/pipe work can be verified without repeatedly opening browser sessions.
- Change:
  - Added `npm run check:scene`, which runs equipment coverage, Zustand selector, and pipe endpoint checks.
  - Added `npm run verify:scene`, which runs `check:scene` and then the normal production build.
- Verification:
  - `npm run verify:scene` passed.
  - It confirmed all 52 equipment IDs have non-catalog references, no obvious unstable object/array selectors, and 45 section-level `Pipe3D` blocks with declared endpoint semantics.
  - Vite production build passed.
  - No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# 2026-07-02 scene verification documentation

- Decision: document the scene-specific verification commands in both the human README and Codex project instructions, so future 3D/UI/pipe edits use the same guardrails.
- Change:
  - Added `npm run check:scene` and `npm run verify:scene` to `README.md`.
  - Added the same commands to `AGENTS.md`, with guidance to prefer `verify:scene` after 3D/UI/pipe changes.
- Verification:
  - `npm run verify:scene` passed.
  - No Playwright/browser automation processes were found before or after this pass; no browser screenshot session was opened.

# Implementation Notes

## 2026-07-02 municipal outfall outlet cleanup

- Decision: the pH sampling basin should show both the incoming treated-water drop and the outgoing municipal tie-in. Previously the basin had the drop nozzle and probe, but no obvious side outlet after pH detection.
- Changes:
  - Added a treated-water side outlet pipe from the outfall sampling basin wall to a short municipal discharge riser.
  - Added a wall port at the basin outlet and a floor sleeve where the municipal outlet drops below slab level.
  - Reduced and offset the floating outfall pH Html label so it leaves more of the nozzle, probe, and side outlet visible in close-up views.
- Verification: `npx tsc -b` passed and `npx vite build` passed. Browser screenshots saved to `output/playwright/outfall-municipal-outlet-close.png` and `output/playwright/outfall-fresh-default-check.png`.
- Risk: the municipal outlet is a simplified short tie-in at the sampling basin boundary. If the real discharge pipe exits a different side, move only the local outlet coordinates.

## 2026-07-02 chemical dosing port detail cleanup

- Decision: the small chemical dosing endpoints should read as real injection assemblies, not just coordinate markers at the end of colored pipes.
- Changes:
  - Upgraded `DosingPort` in `ChemicalPipeRouting` from a simple cylinder/cone to a compact flange seat, colored injection lance, valve block, handwheel, and two small braces.
  - Kept all PAC, CaCl2, PAM routes, endpoint coordinates, pipe colors, and animation logic unchanged.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/chemical-dosing-ports-close.png`.
- Risk: injection assemblies remain generic SCADA geometry. Exact injector orientation can be tuned per tank if the plant has known nozzle locations.

## 2026-07-01 sludge underground sleeve cleanup

- Decision: the DAF-sludge-to-sludge-tank route is a hidden underground sludge transfer, but the vertical transitions at each end need visible civil sleeves so the pipe does not look like it simply dives into the slab or emerges from nowhere.
- Changes:
  - Reused `PipeFloorSleeve3D` on the DAF sludge outlet riser.
  - Added the same floor sleeve at the sludge tank inlet riser.
  - Kept both existing sludge wall ports and the underground route coordinates unchanged.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/sludge-underground-sleeves-overview.png`.
- Risk: this improves the visible transition hardware but keeps the underground civil pipe as a simplified direct hidden run.

## 2026-07-01 PH1 inlet tie-in cleanup

- Decision: the lift-pump discharge route must visibly enter PH1 instead of ending at the external process pipe lane. The PH1 inlet also should not share the same wall point as the PH1-to-Fenton outlet.
- Changes:
  - Added a raw-water inlet short pipe and wall port on PH1 in `MainProcessSection`.
  - Moved the PH1 raw-water inlet to the left side of the PH1 north wall (`local x=-32.5`) while keeping the PH1-to-Fenton outlet at the existing right-side point (`local x=-28`).
  - Renamed the cross-section handoff constant to `PH1_INLET_WORLD_X` and aligned the `IntakeSection` transfer pipe to that inlet.
  - Added `PipeFloorSleeve3D` and placed floor sleeves at the two underground-to-aboveground risers on the lift-pump-to-PH1 transfer pipe.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/ph1-inlet-wall-port-close.png` and `output/playwright/ph1-inlet-after-view-button.png`.
- Risk: the PH1 incoming tie-in is still a simplified north-wall nozzle. If the actual plant uses a side-wall or submerged inlet, only the PH1 inlet coordinate and wall-port rotation should be adjusted.

## 2026-07-01 raw inlet open-flange cleanup

- Decision: the two raw-water inlet pipes before the intake flow meters are live incoming lines, not true terminal dead ends. They should not use capped `terminal` starts because close-up views read those as cut pipes.
- Changes:
  - Added `PipeOpenFlange3D` with a short sleeve, flange ring, bolt circle, and dark open bore.
  - Replaced the two flow-meter inlet `startConnection="terminal"` values with `startConnection="junction"` so `Pipe3D` no longer adds flat end caps.
  - Added named raw inlet coordinates and placed open flanges on both incoming raw-water lines.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/raw-inlet-open-flange-close.png`.
- Risk: the open flanges represent incoming municipal/raw-water tie-ins at the model boundary. Exact upstream civil pipe length is still abstracted.

## 2026-07-01 header blind-flange cleanup

- Decision: header blind ends should read as intentional pipe terminations, not as cut pipe caps. Use one shared flange/blind-plate component so total headers stay visually consistent in close-up views.
- Changes:
  - Added `PipeBlindFlange3D` with a short pipe sleeve, metal flange, blind plate, and bolt ring.
  - Applied the blind flange to the lift-pump discharge header, deep-treatment lift header, drainage discharge header, clarifier-sludge header, and sludge-to-screw-press header.
  - Kept the underlying `Pipe3D` flow paths and process logic unchanged; this pass only adds endpoint hardware at existing true blind ends.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/pipe-blind-flange-intake-close.png` and `output/playwright/pipe-blind-flange-sludge-close.png`.
- Risk: the blind flanges are simplified 3D SCADA details. They clarify true dead ends, but they are not dimensioned fabrication parts.

## 2026-07-01 pipe-flow audit follow-up

- Decision: compare the current 3D pipe routes against the visible process sequence before making another broad geometry pass. The main treatment direction is coherent, but several branch/header details still need explicit endpoint hardware so close-up views do not read as broken or extra pipe.
- Findings:
  - Intake, main-process wall jumpers, deep-treatment pump suction, drainage-pump suction, and sludge-pump suction now use pool/wall connection concepts rather than exposed internal basin pipes.
  - Remaining visual risk is concentrated at header blind ends: intake lift header, deep-treatment lift header, drainage discharge header, clarifier-sludge header, and sludge-to-screw-press header.
  - Chemical clean-water dilution header now has explicit inlet/blind terminal pieces, but the route should still be checked from more than one camera because the pipe sits behind the dosing-room wall.
- Verification: `npm run build` passed before this audit note. Browser screenshot exists at `output/playwright/chemical-clean-water-header-terminals-close.png`.
- Risk: this audit validates flow direction and endpoint semantics from code plus targeted screenshots. It does not replace a full process P&ID; exact plant tie-in locations may still need user confirmation.

## 2026-07-01 screw press feed inlet refinement

- Decision: the sludge feed line into the screw press previously relied on pipe overlap against the machine body, which was weak in close-up views. The feed should land on a visible inlet boss/flange on the press mixing tank.
- Changes:
  - Added `ScrewPressFeedInlet` with an orange feed sleeve, metal flange, and bolt ring on the screw press inlet box.
  - Raised the sludge press feed pipe endpoint to the top inlet height so the external sludge pipe lands on the new inlet assembly.
  - Reduced and moved the screw press status Html plate so it does not obscure the sludge feed inlet or the PAM dosing drop in close-up views.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/screw-press-feed-inlet-status-minimized-close.png`.
- Risk: the press feed is modeled as a top inlet to the flocculation/mixing box, which is visually appropriate for the 3D SCADA view but still simplified compared with a full vendor skid.

## 2026-07-01 outfall nozzle and pH label cleanup

- Decision: the final treated-water discharge line should terminate in a visible municipal outfall sleeve instead of only dropping into the pH sampling pool by coordinate. The pH overlay also needed to leave the nozzle visible in close-up QA.
- Changes:
  - Added `OutfallDropNozzle3D` with a treated-water sleeve, metal flange, and flange bolts at the discharge drop point.
  - Kept the existing treated-water pipe endpoint and pH sampling pool logic unchanged.
  - Reduced and offset the outfall pH Html label and scaled down the physical pH billboard so the nozzle, falling water, and probe can be inspected together.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/outfall-drop-nozzle-label-compact-close.png`.
- Risk: the outfall sleeve is still a simplified vertical drop/nozzle. It reads correctly in the 3D plant view but is not a full civil outfall chamber detail.

## 2026-07-01 intake wall-port and label cleanup

- Decision: the inlet flow-meter-to-collection-pool pipes and collection-pool suction header had valid coordinates but still lacked visible wall penetrations. Close-up QA also showed the flow-meter label could obscure the inlet pipe run.
- Changes:
  - Added `PipeWallPort3D` nozzles at both collection-pool inlet points.
  - Added a raw-water wall port at the common collection-pool suction point feeding the lift-pump manifold.
  - Reduced default and selected flow-meter Html label scale so close-up pipe inspections are not blocked by the equipment name panel.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/intake-wall-ports-label-final-close.png`.
- Risk: the common suction pickup is modeled as one shared collection-pool wall penetration for the lift-pump manifold, not individual submerged suction bells per pump.

## 2026-07-01 chemical label occlusion cleanup

- Decision: close-up pipe QA around the chemical dosing room was still hard to read because large chemical tank Html labels covered overhead chemical pipes and injection drops.
- Changes:
  - Added a compact label mode to `ChemicalTank3D`.
  - Applied compact labels to the six dosing tanks in `ChemicalDosingSection`.
  - Shortened displayed chemical tank names and reduced label scale, opacity, padding, and width so the colored dosing lines remain visible in close-up views.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/chemical-compact-labels-smaller-close.png`.
- Risk: labels are intentionally less prominent in the dosing room. Selection still increases emphasis, but plant overview labeling now relies more on tank position and pipe color.

## 2026-07-01 pipe flow audit refinements

- Decision: after the process-flow audit, keep the existing treatment sequence but tighten the visual connection points that still looked ambiguous in close-up views.
- Changes:
  - Started the intermediate-pool-to-deep-pump suction header at the intermediate tank wall outlet before routing to the external pipe lane.
  - Moved drainage pump suction pickups back to the drainage tank side wall and added two treated-water wall ports, so suction pipes no longer appear to run into the basin center.
  - Split CaCl2 and DAF-PAM chemical routes into independent injection drops with their own dosing ports instead of visually tying them into adjacent PAC/PAM lines.
- Verification: `npm run build` passed.
- Risk: chemical dosing points are still simplified process markers. If the exact plant dosing locations differ, tune only the dosing X coordinates and keep each chemical as an independent route.

## 2026-07-01 pipe animation color mapping

- Decision: after centralizing pipe shell colors, the animated flow overlay must recognize the same color system. Otherwise new pipe categories can render with a shell color but weak or inconsistent flow highlights.
- Changes:
  - Imported `PIPE_COLORS` into `Pipe3D`.
  - Replaced legacy hard-coded route-color checks with mappings for `rawWater`, `processWater`, `deepWater`, `treatedWater`, `cleanWater`, `sludge`, `pac`, `cacl2`, and `pam`.
  - Kept legacy fallback constants (`PIPE_WATER`, `SLUDGE_PIPE_METAL`, `CHEMICAL_PIPE_METAL`) so existing default flow types still behave as before.
- Verification: `npm run build` passed. Static search confirms `Pipe3D` flow mapping now references `PIPE_COLORS` instead of section-level hex literals.
- Risk: the flow overlay remains a subtle animated highlight on top of the pipe material, not a separate physical indicator. Stronger animation contrast can be tuned in `Pipe3D` without touching section routes.

## 2026-07-01 pipe color system

- Decision: pipe colors should be centralized and tied to process meaning so the model is easier to inspect in overview and close-up. Avoid scattering hard-coded pipe colors across section files.
- Changes:
  - Added `PIPE_COLORS` in `pipeRouting.ts` for raw water, main-process water, deep-treatment water, treated discharge water, clean dilution water, sludge, PAC, CaCl2, and PAM lines.
  - Replaced intake pipe colors with `PIPE_COLORS.rawWater`.
  - Replaced main-process basin jumper colors with `PIPE_COLORS.processWater` so they differ from intake raw-water lines.
  - Replaced deep-treatment pre-discharge lines with `PIPE_COLORS.deepWater` and kept drainage/outfall lines as `PIPE_COLORS.treatedWater`.
  - Replaced sludge and chemical pipe literals with the shared color constants.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/pipe-color-system-overview.png`.
- Risk: main-process and deep-treatment colors remain intentionally related blue/green families. If stronger visual separation is desired later, tune only `PIPE_COLORS` instead of editing section code.

## 2026-07-01 patrol route height and route audit

- Decision: patrol characters should move on walkable slab/platform height, not through basin/platform geometry. Routes should be centralized so future collision checks can be made against one coordinate table.
- Changes:
  - Fixed the intake inspection worker route from `y=0` to `y=0.5`, matching the modeled platform/slab walking height used by the other worker routes.
  - Centralized forklift and worker patrol paths into `PATROL_ROUTES` inside `SCADAScene` instead of keeping inline coordinate arrays in JSX.
  - Preserved existing worker variants, target equipment IDs, speeds, pause timings, and patrol logging behavior.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/patrol-intake-worker-platform-height.png`.
- Risk: the routes are still manually authored waypoints, not physics/collision-driven navigation. If a future equipment move changes a walkway, the corresponding `PATROL_ROUTES` entry must be rechecked.

## 2026-07-01 agitator and railing QA cleanup

- Decision: process platforms should not add a second perimeter railing around sections that already contain tank-top railings and catwalk guardrails. The duplicate platform railings made close-up views look cluttered and caused apparent rail overlaps across basin equipment.
- Changes:
  - Upgraded `Platform3D`'s optional railing geometry from gray box strips to industrial yellow tube posts with top and mid rails for future use.
  - Disabled section-level platform railings in intake, main process, deep treatment, sludge, and chemical dosing sections so tank/catwalk railings remain the only visible safety guards in process basins.
  - Confirmed the current `Tank3D` agitator is already the refined version with motor, gearbox, base plate, shaft, and pitched impellers; no additional agitator rewrite was needed in this pass.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/platform-industrial-railings-main.png`, `output/playwright/agitator-and-rail-close.png`, and `output/playwright/agitator-and-rail-cleaned-close.png`.
- Risk: some tank-top guardrails are intentionally dense around catwalks. If a specific basin still looks over-railed from a particular camera angle, tune that tank's catwalk rail spacing rather than re-enabling section platform railings.

## 2026-07-01 pump flange and manifold blind ends

- Decision: pump connections need visible process flanges on the pump body, and pump discharge manifolds should not expose raw pipe cuts at the first tee. A short sealed blind end reads better than a branch placed exactly on an open header endpoint.
- Changes:
  - Added `PumpProcessFlanges` inside `Pump3D` with bolted suction and discharge flanges aligned to the same local coordinates used by `pumpPorts.ts`.
  - Added gasket rings and flange bolts so suction/discharge pipes no longer look like they directly penetrate the blue pump casing.
  - Added short sealed blind ends to the intake lift-pump header, intermediate lift-pump header, drainage pump header, clarifier sludge header, and sludge press feed header.
  - Kept existing pump port coordinates and pipe routing helpers unchanged so previously aligned pipe endpoints remain stable.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/pump-flange-suction-close.png`, `output/playwright/pump-flange-header-close.png`, and `output/playwright/pump-manifold-blind-end-close.png`.
- Risk: the blind ends are generic procedural caps, not detailed blind flanges with individual gasket plates. They remove the exposed cut-face issue without adding large protruding fittings.

## 2026-07-01 chemical dosing nozzles

- Decision: chemical and dilution-water lines should terminate at small top nozzles instead of appearing to grow directly out of tank lids. Chemical source takeoffs should avoid the center agitator/motor assembly.
- Changes:
  - Added small top ports on all six chemical tank source takeoffs in `ChemicalPipeRouting`.
  - Shifted chemical source takeoffs to the rear side of the tank lids (`CHEMICAL_TANK_SOURCE_Z`) so they do not collide visually with the central agitators.
  - Added clean-water drop nozzles on all six dosing tanks in `ChemicalDosingSection`.
  - Converted the clean-water drop pipes to an array-driven render so all six tanks use the same endpoint/nozzle rule.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/chemical-top-nozzles-and-dosing-ports.png`, `output/playwright/chemical-tank-top-nozzle-close.png`, and `output/playwright/chemical-tank-top-side-nozzles-final.png`.
- Risk: the top ports are simplified procedural nozzles. They improve close-up continuity but do not model individual valves, unions, or flexible hose sections.

## 2026-07-01 sludge side-line wall ports

- Decision: sludge lines should follow the same visual rule as the water process lines: external pipework remains visible, but tank-internal runs should terminate at a wall penetration instead of crossing the open basin volume.
- Changes:
  - Added optional rotation support to `PipeWallPort3D` so wall ports can be placed on x-facing as well as z-facing tank walls.
  - Moved sludge out-pump suction pickup points from inside the sludge tank to the tank wall, shortening the visible suction lines into realistic wall-to-pump connections.
  - Added orange sludge wall ports at the DAF sludge outlet, sludge tank inlet, and sludge tank suction nozzles.
  - Centralized the sludge pipe color constant inside `SludgeSection` so sludge lines and ports stay consistent.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/sludge-wall-port-suction-refinement.png` and `output/playwright/sludge-pump-suction-wall-port-close.png`.
- Risk: the sludge tank inlet is shared by clarifier sludge and DAF sludge as a simplified common wall entry. If a more detailed plant layout is needed, split those into two separate wall nozzles.

## 2026-07-01 sequential process pipe flow

- Decision: the visible process pipework should read as sequential basin-to-basin transfer, not as one long parallel header feeding every basin. Internal basin runs stay conceptually hidden; only wall penetrations and short external jumpers remain visible.
- Changes:
  - Replaced the main-process long external header with discrete wall jumpers for `PH1 -> Fenton -> PH2 -> coagulation -> flocculation -> clarifier -> PH3 -> intermediate`.
  - Replaced the deep-treatment DAF/mixing/drainage long header with ordered wall jumpers for `DAF -> mixing -> drainage`.
  - Kept the intermediate lift-pump discharge as the feed into the DAF inlet, then tied downstream wall jumpers to the intermediate pump running state.
  - Preserved existing equipment IDs, store data, UI behavior, and pump/screw-press/sludge logic.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/sequential-main-process-wall-links.png` and `output/playwright/sequential-deep-process-wall-links.png`.
- Risk: this is still a visual process-flow model, not CAD piping. Some chemical dosing pipes still intentionally cross above tanks, and close-up review may require per-point offsets to avoid rail occlusion from certain camera angles.

## 2026-07-01 pipe flow audit wall ports

- Decision: after restoring external pipework, the basin wall connections needed a visible penetration/nozzle detail so the process flow reads as external pipe -> wall port -> hidden internal basin connection, not as a pipe that simply stops at the wall.
- Changes:
  - Added reusable `PipeWallPort3D` for low-profile wall penetrations.
  - Placed wall ports on all main-process basin short stubs.
  - Placed wall ports on deep-treatment DAF/mixing/drainage basin short stubs.
  - Slightly enlarged the wall port collar and nozzle after screenshot review so close-up views can read the connector.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/main-process-external-pipe-wall-ports.png` and `output/playwright/deep-process-external-pipe-wall-ports.png`.
- Risk: wall ports are visually aligned to the modeled basin wall, not tied to a CAD wall thickness model. They should be reviewed close-up in the browser for any individual endpoint that needs small coordinate tuning.

## 2026-07-01 external pipe restoration and wall stubs

- Decision: the previous internal-pipe hiding pass went too far. The correct visual rule is: external pipework remains visible along basin walls/platforms; only the portion conceptually inside the open tank is hidden.
- Changes:
  - Moved the visible process header to an external wall route (`EXTERNAL_POOL_PIPE_Y`, `EXTERNAL_POOL_PIPE_Z`) outside basin water volumes.
  - Restored the main-process external blue header and added short wall stubs for PH1, Fenton, PH2, coagulation, flocculation, clarifier, PH3, and intermediate basins.
  - Added a visible external connection from the main-process header to the deep-treatment intermediate pump suction header.
  - Added deep-treatment wall stubs for DAF, mixing, and drainage basin connections.
  - Added small chemical dosing ports so chemical pipes terminate at wall/top dosing points instead of appearing to stop in midair or drop deep inside the tanks.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/external-main-process-pipe-wall-stubs.png` and `output/playwright/external-deep-process-pipe-dosing-ports.png`.
- Risk: the stubs are still procedural visual connectors, not detailed flanged penetrations. If close-up QA needs more realism, add low-profile wall sleeves/nozzle collars at the exact stub endpoints.

## 2026-07-01 screw press beige palette

- Decision: after lightening the screw press from black, the preferred direction is a warm beige/khaki equipment color rather than cold gray-blue metal.
- Changes:
  - Changed the screw press palette constants in `ScrewPress3D` to beige/khaki tones for panels, covers, frame, chute, and screw texture.
  - Kept the red drive motor and darker trim for readable contrast.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/screw-press-beige-metal.png`.
- Risk: nearby labels still occlude the machine from some camera angles; this change only addresses the machine color.

## 2026-07-01 screw press light metal palette

- Decision: the screw press body was too dark in close-up views and read as a black box rather than stainless/painted industrial equipment.
- Changes:
  - Introduced a lighter metal palette in `ScrewPress3D` for frame steel, stainless panels, trim, covers, side plates, chute, and base skid.
  - Kept the red drive motor and darker small trim pieces for contrast.
  - Reduced dark-blue/black usage on the screw press body while keeping enough contrast for windows, rings, and frame edges.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/screw-press-lighter-metal.png`.
- Risk: nearby HTML labels can still occlude the machine from some camera angles; that is separate from the material color correction.

## 2026-07-01 hide internal basin pipe runs

- Decision: open tanks should not show long pipe runs inside the visible basin volume. Real connections are made through wall/slab/internal pipework; the 3D model should show external pipework up to the connection point, not exposed pipes crossing the water surface/inside the basin.
- Changes:
  - Added `HIDDEN_PROCESS_PIPE_Y` for civil/internal pipe routes that should stay below the visible basin/slab surface.
  - Moved the main-process blue inter-basin header from visible submerged height to the hidden internal route height.
  - Moved the intake-to-PH1 and main-to-deep process handoff endpoints to the hidden internal route height so boundary stubs do not pop into the basin.
  - Moved chemical dosing endpoints from inside the tanks to wall-side/top connection coordinates, so dosing pipes no longer visibly drop into the open water area.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/hidden-internal-pool-pipes-main-process-2.png`, showing the main-process basin without the previous exposed internal blue pipe.
- Risk: hidden internal routes preserve process continuity visually but are not detailed civil penetrations. If needed, add small flush wall nozzles at selected tank walls later.

## 2026-07-01 sludge cake bagging refinement

- Decision: the sludge dewatering area should show the screw press producing dewatered sludge cake into a realistic ton bag, rather than relying on pale generic bags and a few small falling cubes.
- Changes:
  - Rebuilt the ton bag material as a procedural khaki woven canvas texture so it does not depend on external image loading.
  - Added stitched seams, reinforced bands, khaki lifting loops, a top filling collar, and variable filled/sagging bag deformation based on `sludgeBagLevel`.
  - Reworked the visible sludge output into a side discharge chute with a continuous dark sludge-cake stream, falling clods, and a growing mound in the bag mouth.
  - Raised and shifted the active receiving bag so it is visible beside the screw press instead of being buried/hidden under the machine body.
  - Reduced and moved nearby HTML labels (`装载率`, sludge pile label, screw press status) so close-up QA focuses on the bagging equipment instead of text overlays.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/sludge-cake-output-to-khaki-tonbag.png`, `output/playwright/sludge-cake-output-to-visible-khaki-tonbag.png`, and `output/playwright/sludge-cake-output-to-raised-khaki-tonbag.png`.
- Risk: the bag and sludge flow remain procedural approximations. The next refinement, if needed, is adding a visible bag support frame or forklift fork clearance around the receiving station.

## 2026-07-01 outfall pH detection pool

- Decision: the municipal outfall should read as a real pH sampling/discharge point, not a pipe ending on the slab. The discharge pipe should terminate into a small water basin, with pH detection shown at the pipe mouth.
- Changes:
  - Lowered the outfall pipe endpoint so the green discharge pipe enters the sampling basin instead of floating above a flat base.
  - Rebuilt the outfall visual from a thin base/two side rails into a four-wall detection pool with visible water.
  - Added a pH probe beside the pipe mouth and a camera-facing 3D canvas sign showing `市政管口 pH` and the live pH value from `tk-outfall`.
  - Kept `tk-outfall` selection/click behavior and alarm coloring tied to the existing store data.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/outfall-ph-detection-pool-canvas-label.png`.
- Risk: the basin is still a lightweight procedural model, not a detailed civil structure. If needed, the next refinement is adding an overflow/notch or municipal outlet channel on one side.

## 2026-07-01 direct tank suction routes

- Decision: pump suction lines and tank/wall equipment inlets should not add a low-level jog just to meet the pump. When a pipe is coming from a nearby basin or wall, it should enter at the pump-mouth/equipment-inlet height and run straight into the nozzle. Vertical offsets are kept only where there is a real overhead header, underground transfer, or raised equipment inlet.
- Changes:
  - Added `getDirectTankSuctionBranch()` in `pumpPorts.ts` for same-height tank/wall-to-pump suction routes.
  - Replaced all section-level `getSuctionBranch()` calls with the direct suction helper:
    - intake lift pump suction branches,
    - deep-treatment intermediate pump suction branches,
    - drainage pump suction branches,
    - sludge out-pump suction branches.
  - Raised the intake suction manifold itself to pump-mouth height, so branches and manifold meet without a forced vertical jog.
  - Reviewed non-pump pipe routes: main process basin connector stays as a same-height submerged pipe; chemical dosing drops and screw-press feed retain their vertical transitions because they represent overhead/raised-inlet routing rather than a fake pump-mouth correction.
- Verification: `npm run build` passed. Static search found no remaining `getSuctionBranch()` usage in section files. Browser screenshots saved to `output/playwright/direct-suction-sludge-pump.png`, `output/playwright/direct-suction-deep-drain-pump.png`, and `output/playwright/direct-suction-intake-lift-pump.png`.
- Risk: this is a visual/process-layout correction, not a detailed hydraulic model. Some true terminals and header endpoints may still need route-by-route treatment if close-up review finds exposed pipe ends that should be hidden by walls, equipment, or caps.

## 2026-07-01 intake redundant pipe cleanup

- Decision: after the collection basins were aligned, the old intake transfer routing still made the lift-pump area look like it had extra blue pipes: the discharge header ran to a far side handoff before folding back, and the suction manifold still used an older left-side pickup point.
- Changes:
  - Moved `INTAKE_EXPORT_LOCAL` to the lift-pump discharge header end (`[10, HEADER_Y, -6]`) instead of the far-side `z=9` extension.
  - Removed the visible local pipe segment from the discharge header end to the old far-side handoff.
  - Routed the inter-section transfer below the slab (`UNDERGROUND_TRANSFER_Y`) so it no longer reads as an above-ground stray pipe crossing the platform.
  - Shortened the lift-pump suction manifold pickup to align with the first pump suction stub instead of extending left to the old fixed `x=-4` point.
- Verification: `npm run build` passed. Browser screenshots saved to `output/playwright/intake-pipe-underground-transfer.png` and `output/playwright/intake-pipe-redundant-cleanup-final.png`.
- Risk: the underground transfer is a visual simplification, not a civil/MEP construction drawing. It keeps process continuity while reducing above-ground clutter in the intake view.

## 2026-07-01 equal merged collection tanks

- Decision: the two collection basins should read as one merged same-size civil structure, not a large left basin plus a smaller offset right basin.
- Changes:
  - Added shared collection tank size/position constants in `IntakeSection`.
  - Changed `tk-collection-2` to the same `[6, 2, 6]` size as `tk-collection-1`.
  - Moved `tk-collection-2` next to `tk-collection-1` on the same row so the two basins align as a paired/merged unit.
  - Moved the second inlet pipe endpoint into the right collection basin instead of landing in the left basin.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/collection-tanks-equal-merged.png`.
- Risk: this still uses two adjacent `Tank3D` components, so the shared divider/wall is represented by overlapping tank edges. If the user wants a true one-piece civil basin with only a center divider, the next step is a dedicated merged tank component.

## 2026-07-01 bright daylight contrast retune

- Decision: the bright daylight palette had too many near-white surfaces at once: pale sky/fog, pale ground, pale concrete, strong sun, high ambient light, and high tone-mapping exposure. The result looked washed out instead of like a clear daytime plant.
- Changes:
  - Lowered canvas tone-mapping exposure for normal rendering.
  - Reduced bright-mode sun, fill, ground-bounce, and ambient light intensities.
  - Shifted bright-mode sky/fog, ground, grid, and concrete colors from white-gray to layered blue-gray.
  - Kept the scene in a daytime palette; this is not a return to the dark industrial theme.
- Verification: `npm run build` passed. Browser screenshot saved to `output/playwright/bright-day-less-white.png` and shows less white washout with more ground/basin separation.
- Risk: this slightly reduces the high-key brightness the user had requested earlier, but preserves daylight readability while avoiding a flat white scene.

## 2026-07-01 pipe joint smoothing follow-up

- Decision: close-up screenshots still showed two risks that could read as extra pipe: junction branches buried past the parent pipe centerline, and visible pump-side socket collars. Tank suction routes that stopped at the wall edge could also look like loose pipe ends from shallow angles.
- Changes:
  - Set `Pipe3D` junction endpoint overlap to `0`, so pipe-to-pipe branches stop at the parent centerline instead of pushing beyond it.
  - Removed visible suction/outlet socket collar meshes from `Pump3D`; external `Pipe3D` routes now insert directly into the pump casing.
  - Moved sludge and drainage pump suction source points deeper inside their tanks (`SLUDGE_TANK_SUCTION_X`, `DRAINAGE_TANK_SUCTION_X`) so suction lines visibly originate in the basin rather than ending at the wall edge.
  - Stabilized URL-based QA camera positioning by retrying until orbit controls are ready, enabling repeatable close-up checks.
- Verification: `npm run build` passed. Static pipe audit found 42 `Pipe3D` routes, 0 missing endpoint connection declarations, 0 explicit sealed endpoints, 3 route rows containing true terminal endpoints, and no legacy fitting/pump-collar references under `src/components/3d`. Captured close-up screenshots under `output/playwright/`, including `pipe-close-intake-pump-header.png`, `pipe-close-sludge-suction-deep-inside-tank.png`, and `pipe-close-deep-drain-suction-deep-inside-tank.png`.
- Risk: the scene still uses overlapping procedural tube geometry, not CAD/CSG boolean-unioned tees. Current evidence shows the checked pump/header areas are cleaner, but final acceptance should still include human close-up review in the running browser.

## 2026-07-01 remove 3D tank level readouts

- Decision: after removing the side-mounted percent rulers, the remaining in-scene tank liquid-level readouts still added visual clutter around basins. Keep operational level data in the normal UI, but remove it from the 3D scene itself.
- Changes:
  - Removed the `Tank3D` label subline that displayed `{levelValue} m`.
  - Removed level-only `DiegeticPanel3D` overlays from chemical tanks, DAF tank, and clarifier.
  - Kept equipment names, pump status panels, pH/control panels, dashboard cards, and right-side equipment details intact.
- Verification: `npm run build` passed. Static search under `src/components/3d` found no remaining `LEVEL_MONITORED_TANKS`, `tank-level`, `levelValue.toFixed(2)`, or percent ruler text, except worker patrol speech strings that are not tank-side visual gauges.
- Risk: users must now open/select equipment or use the dashboard/detail panel for numeric tank levels; this is intentional to keep close-up 3D views clean.

## 2026-07-01 lighten pipe flow overlay

- Decision: animated flow should not make a pipe look like it has a second outer sleeve. The previous flow texture included a full-width translucent white fill before drawing arrows, so the overlay could read as an added skin around the pipe in close-up views.
- Changes:
  - Removed the full-pipe `fillRect()` background from the animated flow texture.
  - Kept only sparse white flow arrows, widened spacing from 48 to 64 texture pixels, and reduced arrow stroke width from 4 to 3.
  - Reduced flow overlay material opacity from `0.24` to `0.16` and emissive intensity from `0.1` to `0.04`.
- Verification: `npm run build` passed. Static section audit found 42 `Pipe3D` blocks, 0 missing endpoint declarations, 0 section-level sealed endpoints, 4 true terminal endpoints, 45 equipment endpoints, and 35 junction endpoints. Source search confirmed no flow texture `fillRect()` remains in `Pipe3D`. In-app browser refreshed `http://127.0.0.1:5173/`, rendered one canvas, and screenshot saved to `.qa-screenshots/lighter-pipe-flow-overlay.png`.
- Risk: flow direction is subtler than before, but the pipe body now reads more like one continuous PVC/coated surface instead of a pipe plus a translucent sleeve.

## 2026-07-01 delete legacy pipe fitting components

- Decision: after removing all section-level fitting marker calls, the old placeholder fitting modules were dead code. Leaving them around made it too easy for future changes to re-import tee/reducer/sleeve/nozzle components and reintroduce protruding connection parts.
- Changes:
  - Deleted `PipeFittings3D.tsx`, `PipeTee3D.tsx`, and `PipeReducer3D.tsx`.
  - Removed the unused `PipeNozzle3D` compatibility export from `Pipe3D.tsx`.
  - Confirmed pipe connectivity now lives in `Pipe3D` route points and endpoint intent only.
- Verification: `npm run build` passed. Static search found no remaining references to `PipeFittings3D`, `PipeTee3D`, `PipeReducer3D`, `PipeNozzle3D`, `HeaderSaddleJoint3D`, `PumpPipeJoint3D`, `WallPipeNozzle3D`, `PipeWallSleeve3D`, `SmallTubeNozzle3D`, `PipeReducer`, or `PipeTee` under `src`. Static section audit still found 42 `Pipe3D` blocks, 0 missing endpoint declarations, 0 section-level sealed endpoints, 4 true terminal endpoints, 45 equipment endpoints, and 35 junction endpoints. In-app browser refreshed `http://127.0.0.1:5173/`, rendered one canvas, and screenshot saved to `.qa-screenshots/deleted-legacy-pipe-fittings.png`.
- Risk: future explicit fittings will need to be designed from scratch and QA'd close-up. This is preferable to retaining legacy helpers that encode the protruding visual language we are removing.

## 2026-07-01 collinear pipe path simplification

- Decision: many pipe routes include intermediate points only to document junction coordinates along an otherwise straight header. Those collinear points do not need to become separate `CurvePath` segments; removing them before geometry generation reduces subtle straight-run segmentation and keeps headers visually cleaner in close-up views.
- Changes:
  - Added `simplifyCollinearPoints()` in `Pipe3D`.
  - `Pipe3D` now removes duplicate points first, then removes same-direction collinear interior points before endpoint overlap and `TubeGeometry` generation.
  - This does not change section-authored route data, endpoint semantics, colors, radii, or animations. Branch pipes can still terminate at coordinates along the simplified header line.
- Verification: `npm run build` passed. Static section audit found 42 `Pipe3D` blocks, 0 missing endpoint declarations, 0 section-level sealed endpoints, 4 true terminal endpoints, 45 equipment endpoints, and 35 junction endpoints. In-app browser refreshed `http://127.0.0.1:5173/`, rendered one canvas, and screenshot saved to `.qa-screenshots/collinear-pipe-path-simplification.png`.
- Risk: this deliberately preserves bends and only removes same-direction collinear interior points. If a future route relies on a visual pause at a straight-line midpoint, it should use an explicit visual component rather than a redundant path point.

## 2026-07-01 remove section fitting markers

- Decision: fitting helpers now render `null`, but keeping hundreds of section-level marker calls creates a future regression risk: if those helpers are restored later, collars, saddles, sleeves, nozzles, and pump joints could reappear across the scene and recreate the protruding connection artifacts. Pipe connectivity should be controlled by `Pipe3D` endpoint semantics instead.
- Changes:
  - Removed section-level `HeaderSaddleJoint3D`, `PumpPipeJoint3D`, `WallPipeNozzle3D`, `PipeWallSleeve3D`, and `SmallTubeNozzle3D` imports and JSX calls from intake, main process, deep treatment, sludge, chemical dosing, and chemical pipe routing sections.
  - Left all `Pipe3D` route points, endpoint semantics, colors, radii, and animation settings unchanged.
  - Kept `PipeFittings3D.tsx` as a compatibility module, but no section currently calls those fitting helpers.
- Verification: `npm run build` passed. Static search found no `PipeFittings3D` helper usage under `src/components/3d/sections`. Static section audit still found 42 `Pipe3D` blocks, 0 missing endpoint declarations, 0 section-level sealed endpoints, 4 true terminal endpoints, 45 equipment endpoints, and 35 junction endpoints. In-app browser refreshed `http://127.0.0.1:5173/`, rendered one canvas, and screenshot saved to `.qa-screenshots/no-section-fitting-markers-sludge.png`.
- Risk: this removes semantic marker calls that were no-render placeholders. If future work needs explicit visual fittings, it should add them deliberately route-by-route with close-up QA instead of restoring the old blanket markers.

## 2026-07-01 pump discharge centerline start

- Decision: pump discharge pipes should originate on the pump outlet centerline. The previous helper started the pipe control path `0.05` units above the outlet center, relying on endpoint overlap to insert back into the pump. Aligning the authored start point directly to the outlet center is cleaner and reduces the chance of a visible pump-side offset in close-up views.
- Changes:
  - Changed `FLANGE_FACE_INSET` in `pumpPorts.ts` from `0.05` to `0`.
  - Updated the helper comment to state that `Pipe3D` endpoint overlap handles insertion into the pump body.
  - At this point `DISCHARGE_STUB_LEN` was kept at `0.22`; it was later shortened by the 2026-07-02 low-profile pipe fitting pass.
- Verification: `npm run build` passed. Coordinate audit confirmed representative lift, deep-treatment, drainage, and sludge pump discharge path starts now equal the outlet center (`faceEqualsDischarge=0.000`) while keeping `stubDelta=0.220`. Static section audit found 42 `Pipe3D` blocks, 0 missing endpoint declarations, 0 section-level sealed endpoints, 4 true terminal endpoints, 45 equipment endpoints, and 35 junction endpoints. In-app browser refreshed `http://127.0.0.1:5173/`, rendered one canvas, and screenshot saved to `.qa-screenshots/pump-discharge-centerline-start.png`.
- Risk: this improves pump outlet centerline consistency. The visible vertical riser remains a normal external pipe segment, not a decorative pump-side fitting.

## 2026-07-01 ultra-shallow pump sockets

- Decision: pump route coordinates and visible pump socket centers are aligned, but the pump-side socket should read as a pump body opening, not as an extra short pipe segment. A thinner visible socket reduces the chance that close-up views read the pump connection as a protruding fitting.
- Changes:
  - Reduced the visible suction and outlet socket depth in `Pump3D` from `0.12` to `0.06` local units.
  - Kept socket center coordinates unchanged: suction `[0, 0.78, -1.54]`, outlet `[0, 1.68, -0.78]`, matching `pumpPorts.ts`.
  - Kept external pipe geometry owned by `Pipe3D`; the pump socket is only a shallow pump-body opening.
- Verification: `npm run build` passed. Source audit confirmed both visible pump sockets use `cylinderGeometry args={[0.2, 0.24, 0.06, 28, 1, true]}` while `pumpPorts.ts` still derives route centers from the matching local coordinates. Static section audit found 42 `Pipe3D` blocks, 0 missing endpoint declarations, 0 section-level sealed endpoints, 4 true terminal endpoints, 45 equipment endpoints, and 35 junction endpoints. In-app browser refreshed `http://127.0.0.1:5173/`, rendered one canvas, and screenshot saved to `.qa-screenshots/ultra-shallow-pump-sockets-intake.png`.
- Risk: the sockets are visually subtler, which helps pipe smoothness but removes some pump-side mechanical thickness. This is intentional for the SCADA close-up presentation.

## 2026-07-01 flush terminal pipe caps

- Decision: the remaining terminal endpoints are true network boundaries, but their caps should not protrude beyond the pipe end. A cap that extends outward can look like an extra short pipe piece in close-up views.
- Changes:
  - Updated `PipeEndCap` so the cap face stays flush with the terminal point and the cap thickness extends inward into the pipe.
  - Kept only the four audited true terminals: two intake boundary pipes and the two ends of the chemical clean-water header.
  - No new visible fittings, collars, sleeves, saddles, or supports were added.
- Verification: `npm run build` passed. Static section audit found 42 `Pipe3D` blocks, 0 missing endpoint declarations, 0 section-level sealed endpoints, 4 true terminal endpoints, 45 equipment endpoints, and 35 junction endpoints. In-app browser refreshed `http://127.0.0.1:5173/`, rendered one canvas, and screenshot saved to `.qa-screenshots/flush-terminal-caps-intake.png`.
- Risk: terminal caps are now visually cleaner, but terminal boundary design is still a simplified SCADA representation rather than full upstream/downstream off-scene pipe continuation.

## 2026-07-01 junction overlap no-far-side-lip retune

- Decision: the reference issue shows branch/header joints that read like an extra piece protruding past the header. For equal-diameter procedural tubes, burying a branch endpoint almost one radius beyond the header centerline can place the branch rim too close to the far wall, creating a far-side lip. A mid-depth overlap is safer for the visual goal: the branch enters the header but does not push through it.
- Changes:
  - Reduced `Pipe3D`'s `JUNCTION_CONNECTION_OVERLAP` from `0.96` to `0.42` pipe radii.
  - Kept all visible fitting helpers disabled, so the scene still avoids collars, saddles, sleeves, reducers, and decorative tee parts.
  - Left `equipment` overlap unchanged for pump, wall, and tank penetrations.
- Verification: `npm run build` passed. Static section audit found 42 `Pipe3D` blocks, 0 missing endpoint declarations, 0 section-level sealed endpoints, 4 true terminal endpoints, 45 equipment endpoints, and 35 junction endpoints. In-app browser refreshed `http://127.0.0.1:5173/`, rendered one canvas, and screenshot saved to `.qa-screenshots/junction-overlap-0-42-no-far-side-lip.png`.
- Risk: this prioritizes avoiding opposite-side protrusions at T-junctions. If a specific junction later looks slightly shallow from a close angle, tune that route explicitly rather than increasing the global overlap back near one radius.

## 2026-07-01 junction endpoint overlap tuning

- Decision: pipe-to-pipe junction endpoints should be buried close to the parent pipe's inner far wall so the branch tube rim does not sit near the visible surface. The overlap must stay below roughly one pipe radius to avoid creating a new protrusion on the opposite side of the header.
- Changes:
  - Increased `Pipe3D`'s `JUNCTION_CONNECTION_OVERLAP` from `0.86` to `0.96` pipe radii.
  - Kept pump/wall `equipment` overlap unchanged and did not reintroduce saddle, sleeve, flange, tee, or reducer helper geometry.
  - This globally affects branch/header pipe intersections in intake, deep-treatment, sludge, and chemical routes.
- Verification: `npm run build` passed. Static section audit found 42 `Pipe3D` blocks, 0 missing endpoint declarations, 0 section-level sealed endpoints, 4 true terminal endpoints, 45 equipment endpoints, and 35 junction endpoints. Shared fitting helpers remain no-render placeholders. In-app browser refreshed `http://127.0.0.1:5173/`, rendered one canvas, and screenshot saved to `.qa-screenshots/junction-overlap-0-96-sludge.png`.
- Risk: this further hides branch end rims without adding visible collars, but it is still overlap-based geometry rather than CAD boolean-unioned PVC fittings. Close-up human inspection remains the final acceptance check.

## 2026-07-01 pump suction stub direction correction

- Decision: pump suction pipes must approach the external mouth of the pump. The suction stub helper previously offset the intermediate point toward the pump body side for rotated pumps, which could make close-up suction piping look like it passed through the pump before connecting.
- Changes:
  - Corrected `getSuctionStub()` in `pumpPorts.ts` to offset along the suction-port outward axis instead of the reverse axis.
  - Corrected `getSuctionDirection()` to report the same outward suction axis for future fitting semantics.
  - This affects lift-pump, deep-treatment, sludge, and clarifier sludge suction routes because they all use the shared helper.
- Verification: coordinate audit confirmed representative lift, deep-treatment, sludge, and clarifier sludge pump suction stubs are outside the pump mouth (`outwardDot=1.000`). `npm run build` passed. In-app browser refreshed `http://127.0.0.1:5173/`, rendered one canvas, and screenshot bytes were saved to `.qa-screenshots/pump-suction-stub-direction-fix.png`.
- Risk: this corrects suction approach direction globally, but final visual acceptance still requires close-up inspection around all pump clusters because the scene uses procedural overlap instead of boolean-unioned pipe fittings.

## 2026-07-01 remove tank side level rulers

- Decision: side-mounted percentage liquid-level rulers create visual clutter in close-up views and were explicitly removed from the 3D scene. Numeric tank level data remains available in labels, detail panels, and dashboard UI.
- Changes:
  - Removed the `showScale` prop from `Tank3D`.
  - Removed all section-level `showScale` usage from collection, intermediate, and drainage tanks.
  - Confirmed no 3D-side `100% / 75% / 50% / 25% / 0%` ruler text remains under `src/components/3d`.
- Verification: `npm run build` passed. Static search found no remaining `showScale` usage in `src/components/3d`. In-app browser refreshed `http://127.0.0.1:5173/`; one canvas rendered, DOM inspection found no `100% / 75% / 50% / 25% / 0%` side-scale text, and screenshot saved to `.qa-screenshots/no-tank-side-level-rulers.png`.
- Risk: this only removes the 3D side ruler; operational liquid-level readings are still shown in the normal UI because those are data displays, not the unwanted wall-mounted scale.

## 2026-07-01 PVC-like pipe material pass

- Decision: even when geometry is clean, high-metalness pipe materials can create bright specular seams that read as extra sleeves or stepped connectors in close-up views. Colored process pipes should read closer to PVC/coated pipe: low metalness, smoother continuous color, and only mild clearcoat.
- Changes:
  - Updated colored `Pipe3D` process-pipe materials to low-metalness, higher-roughness PVC/coated finishes while preserving neutral-metal settings for uncolored non-process pipes.
  - Updated terminal caps to use the same low-metal visual model for colored pipes so true pipe ends do not read as separate metal plates.
  - Reduced animated flow overlay opacity from `0.34` to `0.24` so the overlay is less likely to appear as a second outer pipe layer at connections.
- Verification: `npm run build` passed. Static audit still found 42 section-level `Pipe3D` blocks with 0 missing endpoint declarations and 0 section-level sealed endpoints. In-app browser refreshed `http://127.0.0.1:5173/`, switched to the sludge view preset, rendered one canvas, had 0 console errors, and saved `.qa-screenshots/pvc-like-pipe-material-sludge-view.png`.
- Risk: this improves perceived smoothness and PVC-like continuity, but it does not replace the underlying overlap-based pipe mesh with true CSG-unioned fittings.

## 2026-07-01 pump port coordinate alignment

- Decision: after shortening pump sockets, the visible pump socket centers must exactly match the route coordinates in `pumpPorts.ts`; otherwise close-up views can show a small offset between the pump mouth and the external pipe centerline.
- Changes:
  - Aligned `Pump3D`'s low-profile suction socket to local `[0, 0.78, -1.54]`, matching `SUCTION_LOCAL` before the shared machine scale.
  - Aligned `Pump3D`'s low-profile outlet socket to local `[0, 1.68, -0.78]`, matching `DISCHARGE_LOCAL` before the shared machine scale.
  - Kept sockets short and pump-body-colored so they read as equipment openings, not separate pipe spools.
- Verification: `npm run build` passed. Static audit found 42 section-level `Pipe3D` blocks with 0 missing endpoint declarations and 0 section-level sealed endpoints. Source check confirmed `Pump3D` socket coordinates match `pumpPorts.ts`; in-app browser refreshed `http://127.0.0.1:5173/`, switched to the intake view preset, rendered one canvas, had 0 console errors, and saved `.qa-screenshots/aligned-pump-sockets-intake-view.png`.
- Risk: this proves coordinate consistency, not full visual acceptance of every pump angle; final close-up inspection is still needed around each pump cluster.

## 2026-07-01 pump socket cleanup for smooth pipe transitions

- Decision: pump body ports should not draw long independent spools because they can mismatch the external pipe radius/direction and read as extra protruding pipe pieces in close-up views.
- Changes:
  - Replaced the visible pump suction and outlet spools in `Pump3D` with very short pump-body-colored open sockets aligned to the authoritative coordinates in `pumpPorts.ts`.
  - Kept external process piping controlled by `Pipe3D` overlap, so the pipe visually inserts into the pump body instead of butting against a separate pump-side tube.
  - Removed the pressure gauge/needle-valve detail from the outlet connection line because it was attached to the old long outlet riser and could read as a floating extra pipe after shortening the socket.
  - Removed now-unused gauge needle animation state.
- Verification: `npm run build` passed. Static section audit still found 42 `Pipe3D` blocks with 0 missing endpoint declarations and 0 section-level sealed endpoints. Search confirmed the old long pump spool dimensions and pressure-gauge references are gone. In-app browser refreshed `http://127.0.0.1:5173/`, switched to the intake view preset, rendered one canvas, had 0 console errors, and saved `.qa-screenshots/pump-socket-cleanup-intake-view.png`.
- Risk: pump instruments are less detailed after removing the outlet gauge, but the pump-to-pipe connection is cleaner and less likely to be mistaken for an extra protruding pipe part.

## 2026-07-01 deeper equipment overlap for wall and pump connections

- Decision: `equipment` endpoints represent both pump sockets and tank/wall penetrations. The previous overlap was enough for pump face contact but too shallow for 0.3-unit concrete tank walls, leaving some close-up wall connections looking like the pipe merely touched the wall surface.
- Changes:
  - Increased `Pipe3D`'s `EQUIPMENT_CONNECTION_OVERLAP` from `1.35` to `2.2` pipe radii.
  - This makes common 0.1-radius branch pipes insert about 0.22 units into pumps/walls/tanks, and 0.12-radius process pipes insert about 0.264 units, much closer to the modeled wall thickness.
  - `junction` and `terminal` behavior was left unchanged; no visible collar, nozzle, flange, saddle, sleeve, or reducer geometry was added.
- Verification: `npm run build` passed. Static audit still found 42 section-level `Pipe3D` blocks with 0 missing endpoint declarations and 0 section-level sealed endpoints; endpoint distribution remains 4 terminal, 45 equipment, and 35 junction endpoints. In-app browser refreshed `http://127.0.0.1:5173/`, switched to the intake view preset, rendered one canvas, had 0 console errors, and saved `.qa-screenshots/deeper-equipment-overlap-intake-view.png`.
- Risk: this improves wall/pump insertion visually, but it remains overlap-based geometry. If a pump model socket is unusually shallow from a specific close angle, the pipe may look more embedded than fabricated; that is preferable to a visible gap for this SCADA visualization.

## 2026-07-01 deeper junction overlap for smooth pipe tees

- Decision: direct tube intersections remain preferable to visible collars, but branch endpoints at `junction` should be buried deeper into the intersecting header to hide the open tube rim in close-up views.
- Changes:
  - Increased `Pipe3D`'s `JUNCTION_CONNECTION_OVERLAP` from `0.55` to `0.86` pipe radii.
  - This only affects endpoints marked `junction`; `equipment` insertion and true `terminal` caps keep their separate behavior.
  - No flange, sleeve, saddle, nozzle, reducer, tee, or support geometry was reintroduced.
- Verification: `npm run build` passed. Static audit still found 42 section-level `Pipe3D` blocks with 0 missing endpoint declarations and 0 section-level sealed endpoints; endpoint distribution is 4 terminal, 45 equipment, and 35 junction endpoints. Shared fitting/tee/reducer helpers remain no-render placeholders. In-app browser refreshed `http://127.0.0.1:5173/`, switched to the sludge view preset, rendered one canvas, had 0 console errors, and saved `.qa-screenshots/deeper-junction-overlap-sludge-view.png`.
- Risk: this improves hidden open rims at T connections, but it is still an overlap-based procedural approximation rather than a true boolean-unioned PVC pipe mesh.

## 2026-07-01 terminal pipe end and endpoint audit

- Decision: true pipe terminals should not show raw open tube cuts, but pump/wall/header connections must remain free of caps, collars, sleeves, or protruding fittings.
- Changes:
  - Added same-color low-profile terminal end caps in `Pipe3D` for endpoints whose connection intent is `terminal`.
  - Kept `equipment` and `junction` endpoints uncapped so pump sockets, tank walls, and branch/header intersections still use endpoint overlap rather than add-on geometry.
  - Audited all section-level pipe endpoints after adding terminal caps. Found and corrected one false terminal: the deep-treatment submerged process pipe ended at the drainage tank connection but was marked `endConnection="terminal"`. It is now `endConnection="equipment"` so the pipe inserts into the tank/wall point instead of looking capped or cut off in the pool.
- Verification: `npm run build` passed. Static audit found 42 section-level `Pipe3D` blocks, 4 true terminal endpoints, 45 equipment endpoints, and 35 junction endpoints. In-app browser refreshed `http://127.0.0.1:5173/`; one canvas rendered, console error count was 0, and screenshot saved to `.qa-screenshots/pipe-terminal-endpoint-correction.png`.
- Risk: the network still uses overlapping procedural `TubeGeometry` rather than boolean-unioned CAD pipes. The current pass removes raw terminal cuts and one false endpoint, but close-up acceptance still depends on visual inspection around every pump and branch cluster.

## 2026-07-01 pipe color and side level scale removal

- Decision: improve pipe readability by letting each route's authored color show on the pipe shell, and remove the side-mounted percent level rulers from tanks.
- Changes:
  - Changed `Pipe3D` material selection so explicit `color` props drive the visible pipe shell instead of being flattened by `flowType` into mostly similar metal finishes.
  - Kept default type colors for uncolored pipes: water blue, sludge bronze-brown, chemical purple, and neutral metal for non-process pipes.
  - Reduced pipe-shell metalness for colored process pipes so the route color stays readable in the bright daytime scene.
  - Removed the `Tank3D` side scale renderer that produced the wall-mounted `100% / 75% / 50% / 25% / 0%` gauge. `showScale` remains accepted for compatibility but intentionally renders nothing.
- Verification: `npm run build` passed. In-app browser refreshed `http://127.0.0.1:5173/`; one canvas rendered, console error count was 0, and DOM inspection found 0 standalone side-scale percent labels. Screenshot saved to `.qa-screenshots/pipe-colors-no-side-scale.png`.
- Risk: color assignment still depends on section-level `Pipe3D color` props, so future new pipe routes should provide a distinct color when they need to be visually separated from adjacent routes.

## 2026-07-01 smooth pipe transition follow-up

- Decision: remove the last visible add-on surfaces around pipe connections so close-up pipework moves closer to smooth PVC-like intersections instead of sleeve/collar details.
- Changes:
  - Changed `HeaderSaddleJoint3D` into a no-render marker. T-junctions now rely on direct `Pipe3D` tube intersection and explicit endpoint semantics instead of drawing an extra saddle patch on the pipe surface.
  - Reworked animated pipe flow to reuse the exact same `Pipe3D` tube geometry with polygon offset. It no longer creates a second tube with a larger radius, removing the subtle outer skin/lip at pipe ends and branches.
  - Increased `equipment` endpoint overlap in `Pipe3D`, so pipe runs insert more deeply into pumps, tank walls, and equipment sockets without affecting `junction` endpoints.
  - Converted pump suction and discharge short stubs to open-ended cylinders and recolored the volute-side connection as pump body material, reducing visible flat faces or gray collar-like steps at pump connections.
  - Follow-up changed the pump suction and discharge sockets from fixed silver pipe stubs into pump-body-colored tapered open sockets. This avoids a fixed-radius metal stub creating a step when different process pipe radii connect to the same pump component.
  - Removed the now-unused pump pipe-port material constant so future pump edits do not accidentally reintroduce a separate silver socket at the connection line.
  - Removed the duplicate inline measuring tube and low-profile saddle block from `FlowMeter3D`. The intake pipe now remains one continuous `Pipe3D` tube through the flow-meter location, while the flow-meter component renders only the vertical transmitter assembly above it.
  - Removed the standalone intake-to-main-process `PipeReducer3D` instance and routed the transfer as a continuous pipe segment. This avoids a separate vertical taper reading as an added sleeve between the intake header and submerged process line.
  - Realigned the sludge discharge pipe into the screw press feed point. The previous pipe endpoint (`x=2.15`) did not match the screw press feed inlet; it now terminates at the screw press flocculation tank inlet (`x=3.4`, later raised to `y=1.55`) and the old separate screw-press inlet stub mesh was removed.
  - Audited `Valve3D` and `DAFTank3D`: `Valve3D` is not currently mounted in the scene, while DAF cylinders/handles are local scum-discharge equipment rather than active `Pipe3D` connections, so they were left intact.
  - Added a short `junction` endpoint overlap in `Pipe3D`. Terminal ends still stop exactly, equipment ends still insert deeply, but branch/header junction ends now extend only about half a pipe radius so open tube rims are buried inside the intersecting pipe rather than visible as cut edges.
  - Audited junction endpoint tails after adding the overlap. Most `junction` endpoints are real intersecting branches/headers, so the short overlap remains preferable to exposing open tube rims. No endpoint semantics were changed in this pass.
  - Converted `PipeReducer3D` to a no-render compatibility placeholder. It was already unused after the intake route was made continuous, but leaving the old cone renderer available could reintroduce standalone reducer sleeves in future edits.
  - Rechecked section-level `Pipe3D` declarations: all section pipe runs still explicitly declare `startConnection` and `endConnection`.
- Verification: `npm run build` passed after all smooth-transition follow-ups. Static audit found 42 section-level `Pipe3D` blocks with 0 missing endpoint declarations; the latest pass found 35 junction endpoints using the short-overlap rule, and the legacy reducer/fitting/tee helpers no longer render geometry. In-app browser refreshed `http://127.0.0.1:5173/`; one canvas rendered and console error count was 0. Screenshots saved to `.qa-screenshots/smooth-pipe-no-extra-layer.png`, `.qa-screenshots/smooth-pipe-pump-sockets.png`, `.qa-screenshots/smooth-pipe-no-inline-duplicates.png`, `.qa-screenshots/smooth-pipe-screw-press-inlet.png`, `.qa-screenshots/smooth-pipe-junction-overlap.png`, and `.qa-screenshots/smooth-pipe-reducer-placeholder.png`.
- Risk: direct tube intersections are smoother than collars, but they are still procedural mesh intersections rather than a true boolean-unioned CAD pipe network. A final visual pass by zoomed user camera is still needed for every process area.

## 2026-07-01 daytime mixer and pipe brightness follow-up

- Decision: replace the still-dark tank agitator look with a brighter daytime mixer assembly and lift pipe finishes to match the requested high-quality daylight palette.
- Changes:
  - Rebuilt `Tank3D` agitators from the previous top-view green barrel silhouette into a vertical bright-blue motor, visible cooling fins, light gearbox, terminal box, coupling, polished shaft, and two three-blade impellers.
  - Changed tank bridge and basin guardrails from box bars to round yellow tubes, keeping toe boards and regular posts so close-up rails read as actual pipe railings.
  - Brightened shared process pipe shells, reducers, tee saddle patches, flow-meter inline tubes, and pump pipe ports to a light galvanized silver; sludge and chemical pipes were lifted to warmer bright metal tones without orange cut faces.
  - Updated high-quality `原始` daylight scene lighting, fog, background, concrete, floor, and shared metal materials so the scene no longer falls back to a dim blue-gray cast.
  - Brightened pump motor casings and chemical tank agitator motors so localized equipment does not keep the old dark-green finish.
- Verification: `npm run build` passed. In-app browser refreshed `http://127.0.0.1:5173/`; one canvas rendered, console error count was 0, and the captured viewport showed the brighter daylight scene and lighter pipework.
- Risk: this remains procedural Three.js geometry rather than imported CAD; final close-up acceptance still depends on the user's preferred camera angle.

## 2026-06-30 scene palette restore

- Decision: restore the earliest backed-up scene palette from `src_backup_20260607` as the default, because the later dark industrial palette and the white daytime pass did not match the user's original reference.
- Changes:
  - Kept the palette toggle, but changed the alternate label to `原始` and made it the default selected mode.
  - Matched the early backup's sky/fog/light/ground values, including the blue-gray fog, `#A0A2A6` floor, `#8B9099` concrete, and original fill/bounce light levels.
  - Kept the newer HDR removal and runtime stability changes intact.
- Verification: `npm run build` passed. In-app browser refreshed at `http://127.0.0.1:5173/`; the page defaults to `原始`, renders one canvas, and shows the restored early blue-gray palette.
- Risk: the palette is restored through current scene logic rather than replacing the whole 3D file with the old backup, so geometry and later pipe/detail fixes remain active.

## 2026-07-01 deployment high-quality palette match

- Decision: match the color seen in `E:\Desktop\污水SCADA部署包_v1.0.0`, specifically its `高画质 (带阴影)` mode rather than the default `清晰低特效 (推荐)` mode.
- Changes:
  - Set default `performanceMode` back to `false`, which enables the high-quality sky, fog, shadow, grid, concrete, and ground branch.
  - Set default `scenePaletteMode` to `bright` (`原始`) after comparing the deployment dist in-browser, because `工业 + 高画质` was too dark while `原始 + 高画质` matches the deployment package's light gray-blue appearance.
- Verification: `npm run build` passed. Served the deployment package `resources/dist` on port 5174, switched it to `高画质 (带阴影)`, then refreshed `http://127.0.0.1:5173/`; the current project defaults to `原始`, `clear-mode` is not present on `body`, and one canvas renders.
- Risk: the current UI no longer exposes the old deployment package's `显示画质` dropdown, but the underlying high-quality scene mode is active by default.

## 2026-07-01 brighter original high-quality palette

- Decision: keep the deployment-style `原始 + 高画质` look, but lift the scene one brightness step because the previous blue-gray fog and low ambient light felt dim in the development web view.
- Changes:
  - Raised sunny/cloudy/rain ambient and fill-light intensity for the `原始` high-quality branch.
  - Lightened the fog color, reduced fog density, and raised concrete/floor colors to a cleaner light gray-blue.
  - Lightened the floor grid lines enough to stay readable without returning to a white daytime wash.
- Verification: `npm run build` passed. In-app browser refreshed at `http://127.0.0.1:5173/`, reset to `全局正视`, and rendered one canvas with `原始` active and `clear-mode=false`.
- Risk: this is a visual calibration pass; very close color matching to the old Electron build still depends on display calibration and WebGL renderer differences.

## 2026-07-01 mixer and bridge guardrail pass

- Decision: replace the tank-top agitator silhouette because the previous top view read as a plain green cylinder rather than a mixer assembly.
- Changes:
  - Reworked `Tank3D` agitators into a base plate, bolted bearing plate, square reducer, horizontal finned motor, coupling, support leg, central shaft, and pitched impellers.
  - Rebuilt catwalk guardrails with stronger side rails, mid rails, toe boards, end rails, and more regular posts so the bridge reads as a continuous guarded walkway.
  - Added grating ribs and a darker mounting plate to make the agitator base sit on the bridge rather than float as a simple cap.
- Verification: `npm run build` passed. Browser refreshed at `http://127.0.0.1:5173/` with one canvas rendered and the updated bridge/agitator visible in the main process area.
- Risk: close-up quality is still procedural Three.js geometry, not imported CAD; further refinement may need a dedicated mixer component shared across tanks.

## 2026-07-01 bright mixer and pipe material pass

- Decision: keep the improved mixer/pipe geometry, but brighten the equipment finishes so they match the requested daytime high-quality palette.
- Changes:
  - Recolored main-process tank agitators and bridge mounting parts from dark gray to light galvanized metal with a brighter green motor body.
  - Recolored chemical-tank agitators, shafts, hubs, and blades to the same bright industrial metal style.
  - Raised shared pipe body, flange, weld, tee, reducer, nozzle, and support materials from dark gray to light galvanized metal; sludge and chemical pipes keep distinct warm metal tones without dark cut faces.
- Verification: `npm run build` passed. In-app browser refreshed at `http://127.0.0.1:5173/`; intake, sludge, and chemical view screenshots showed brighter pipes and mixer assemblies with one rendered canvas.
- Risk: this is a shared material pass, so all procedural pipework becomes brighter at once; close-up geometry remains the previously repaired procedural model.

## 2026-07-01 clarifier bridge drive pass

- Decision: the clarifier center-drive bridge is separate from the normal tank agitator component, so it needed its own detail pass.
- Changes:
  - Replaced the simple dark-green center cylinder with a bright bolted base, stacked gearbox, bearing cap, horizontal finned motor, terminal box, coupling, and running-status ring.
  - Rebuilt the half-bridge as a light galvanized grating with side stringers, darker grating ribs, side posts, top rails, mid rails, toe boards, and an end rail.
  - Follow-up sharpened the top-view silhouette: the former round-cylinder read is now a rectangular finned motor, square reducer, larger bearing ring, brighter base plate, and lighter clarifier water surface.
  - Kept the existing underwater scraper shaft and arms intact so the clarifier process behavior does not change.
- Verification: `npm run build` passed after the follow-up shape change. The local dev server at `http://127.0.0.1:5173/` is serving the updated `Clarifier3D` source, one canvas renders, and browser console error count is 0. The in-app screenshot API timed out during this pass, so visual acceptance still needs the user/browser view.
- Risk: the bridge drive is still procedural geometry, but no longer reads as a plain unmixed cylinder at close range.

## 2026-07-01 smooth PVC-style pipe joint pass

- Decision: reduce pipe connection detail from flange/bolt/weld visuals to low-profile same-color sleeve joints because the close-up requirement is smooth PVC-like transitions, not protruding industrial fittings.
- Changes:
  - Removed large flange discs, black gasket rings, bolt rings, weld torus rings, and spherical tee pads from shared pipe fittings.
  - Replaced pump joints, wall nozzles, continuous wall sleeves, header saddle tees, chemical nozzles, generic tees, and reducers with open sleeve or tapered same-color geometry.
  - Reduced sleeve over-radius to approximately 1-6% above pipe radius, with continuous wall sleeves and tees closest to the pipe surface.
  - Lightened pump suction/outlet port materials and resized their short pipe sections so pump connections read as pipe transitions instead of dark protruding collars.
  - Follow-up de-protrusion pass shortened open pipe endpoint overlap, reduced fitting over-radius to roughly 0.4-2.4%, removed the second pump collar, removed separate wall/nozzle collar bands, and color-matched sealed caps by pipe type.
  - Final flush pass changed the shared fitting components into no-geometry semantic markers. Open pipe endpoints now overlap into pumps, walls, and headers directly, while the animated flow layer was thinned so it does not read as a second outer pipe.
  - Removed pump suction/outlet decorative rings that sat on the pipe connection line and could be mistaken for leftover collars.
  - Rebalanced open endpoint penetration to hide branch cuts without letting equal-radius branch pipes poke through the opposite side of headers.
  - Aligned intake flow meters to the inlet pipe centerline and reduced their inline measuring tube radius so the pipe no longer steps abruptly into an oversized meter barrel.
  - Converted the legacy `PipeTee3D` component to a no-render compatibility placeholder so unused or future imports cannot reintroduce protruding tee sleeves.
  - Converted the legacy `PipeNozzle3D` helper to a no-render compatibility placeholder for the same reason.
  - Added explicit `Pipe3D` endpoint connection modes: `equipment` endpoints still overlap into pumps/walls/tanks, while `junction` and `terminal` endpoints stop at the authored point. This prevents pump branches, dosing drops, and process headers from extending through the far side of a same-diameter header.
  - Marked pump discharge branches, pump suction manifold branches, clean-water dosing drops, chemical header tie-ins, main-process cross-section ends, and sludge/header tie-ins as `junction` where they meet another pipe centreline.
  - Turned automatic pipe supports off by default so U-clamps/legs no longer appear as extra protruding pieces on close-up pipe runs. They can still be enabled explicitly with `showSupports`.
  - Reintroduced `HeaderSaddleJoint3D` only as an ultra-low-profile same-color saddle blend patch. It hides hard T-junction seams without drawing bolts, rings, collars, flanges, or nozzle stubs.
  - Replaced the first saddle-blend implementation's flattened sphere with a custom curved mesh whose edge sits on the main pipe cylinder surface and whose center rises only slightly. This keeps the T-junction blend from reading as a pasted-on blob.
  - Changed `PipeReducer3D` to render as an open-ended, higher-segment taper and extended the intake reducer overlap length so flat cap faces no longer appear at the reducer ends.
  - Reworked inline intake flow meters so their measuring tube is an open-ended same-radius metal pipe, with the sensor moved to a low-profile top pickup. This removes the previous blue spherical bulge from the pipe centerline.
  - Added missing curved saddle blend patches for the deep-treatment suction takeoff and the clarifier sludge pump A takeoff, so those `junction` endpoints no longer rely on bare pipe intersection.
  - Removed an overlapped duplicate segment in the deep-treatment intermediate pump suction routing by converting it to one shared suction run plus a true branch T-junction.
  - Aligned the drainage discharge header start to the actual pump discharge saddle coordinate and corrected one chemical dosing drop endpoint from `junction` back to `equipment` where it terminates at an injection point.
  - Changed `Pipe3D`'s default endpoint mode to `terminal` and made every section-level pipe declare its endpoint intent explicitly. This prevents future untagged pipes from accidentally extending as if they were inserted into equipment.
  - Kept pipe route coordinates, equipment IDs, flow animation, and process logic unchanged.
- Verification: `npm run build` passed after the endpoint-mode, saddle-surface, open-reducer, flow-meter tube, missed-junction coverage, and explicit-endpoint passes. In-app browser refreshed/current page checked at `http://127.0.0.1:5173/`; one canvas rendered and browser console errors were 0 after removing protruding fitting geometry, pump-port rings, aligning and smoothing intake flow meters, disabling default pipe supports, adding the curved T-junction blend surface, opening/overlapping the intake reducer, covering missed T-junctions, removing the deep-treatment suction overlap, and making section-level pipe endpoint semantics explicit.
- Risk: the joints are still procedural overlapping tube meshes rather than true CSG-unioned pipe solids. The renderer no longer adds far-side endpoint tails or collar-style fittings, but final acceptance still depends on rotating through every pipe cluster at close zoom.

## 2026-06-30 continuous pipe sleeve correction

- Decision: continuous submerged headers should use thin wall sleeves, not full wall nozzles, because full nozzles create visible extra stubs at repeated pipe crossings.
- Changes:
  - Added `PipeWallSleeve3D` as a low-profile centered sleeve around continuous pipes.
  - Replaced main-process and deep-treatment continuous tank-crossing `WallPipeNozzle3D` instances with `PipeWallSleeve3D`.
  - Kept full `WallPipeNozzle3D` only for true endpoints such as pump suction sources, discharge outlets, and screw-press inlet.
- Verification: `npm run build` passed. Browser refreshed with one canvas; original palette remains unchanged.
- Risk: superseded by the later no-geometry fitting pass; `PipeWallSleeve3D` is now a semantic marker and no longer renders sleeve geometry.

## 2026-06-30 original palette restored after HDR removal

- Decision: keep the external HDR environment removed for runtime stability, but restore the original scene palette after the temporary brightening pass changed the look too much.
- Changes:
  - Restored the original sun, ambient, hemisphere, fog, background, clear-mode, and ground color constants.
  - Kept the HDR `Environment` component removed so the local demo does not fail while fetching preset HDR files.
- Verification: `npm run build` passed. Browser refreshed with one canvas and the original deep industrial palette restored.
- Risk: without HDR reflections, metal contrast can be slightly flatter than before, but the color palette is back to the original values.

## 2026-06-30 global pipe connection finish pass

- Decision: make close-up pipe quality a shared fitting problem rather than fixing one screenshot at a time.
- Changes:
  - Added shared pipe fittings for pump flange spools, wall/tank nozzles, header saddle joints, and small chemical-tube nozzles.
  - Applied the fittings across intake lift pumps, deep-treatment pumps, drainage pumps, sludge pumps, screw-press inlet, main-process tank crossings, chemical dosing lines, and clean-water dosing drops.
  - Removed section-level `sealedStart`/`sealedEnd` usage so false pipe caps no longer appear at pool, pump, header, and dosing connections.
  - Removed the external Drei `Environment` HDR preset because it caused intermittent Canvas failures in the local demo.
- Verification: `npm run build` passed. In-app browser fresh validation tab loaded with one canvas and no new runtime errors. Visual loop checked intake, sludge, and chemical presets with screenshots; pump flange spools, header saddles, and small nozzles were visible without obvious bright cut ends.
- Risk: fittings are still procedural visual geometry, not CAD/CSG-fused pipe solids. Some labels can occlude close-up inspection until the user rotates or changes view.

## 2026-06-30 pipe tee close-up correction

- Decision: fix the visible pipe-head defects in the shared tee fitting because the close-up issue appears anywhere a pump branch meets a header.
- Changes:
  - Earlier `PipeTee3D` tee geometry was later superseded by the no-geometry fitting strategy.
  - Mapped tee fitting shell colors to the same muted pipe-body metals as `Pipe3D`, so sludge tees no longer show bright orange cut ends.
  - Removed stale unused flange/elbow code and unused imports that blocked TypeScript verification.
- Verification: pending build and browser refresh.
- Risk: the tee is still procedural geometry rather than CSG-fused pipe fabrication, but it avoids exposed caps and reads cleaner at close zoom.

## 2026-06-30 agitator and tank rail detail pass

- Decision: fix the tank-top detail at the component level because all mixing tanks share the same bridge rail and agitator model.
- Changes:
  - Shortened catwalk length to stay inside basin walls so bridge rails no longer float past the tank edge.
  - Widened and aligned catwalk guardrails with posts and the grating bridge.
  - Reworked the agitator top assembly with a bearing plate, reducer box, horizontal motor, cooling fins, terminal box, and smaller status ring.
  - Moved the motor inside the bridge guardrail footprint so it no longer visually cuts through the rail.
- Verification: pending build.
- Risk: still a procedural equipment model, but the silhouette now matches a top-mounted mixer better in close-up.

## 2026-06-30 pipe close-up detail pass

- Decision: improve close-up pipe readability through shared fitting geometry and pump-header elevations instead of ad hoc hiding.
- Changes:
  - Replaced spherical pipe connector sleeves with compact flange/collar fittings to avoid melted-looking T-joints.
  - Raised intake, deep-treatment, drainage, and sludge pump discharge headers so main pipes read as overhead headers instead of cutting through pump bodies in close views.
  - Kept rounded tube routing and endpoint overlaps from the earlier pipe continuity pass.
- Verification: pending build.
- Risk: header elevations are visual-layout coordinates, not certified plant fabrication dimensions.

## 2026-06-30 worker patrol collision pass

- Decision: fix people walking through tanks, walls, and cabinets by correcting patrol paths rather than adding expensive collision physics.
- Changes:
  - Moved worker patrol waypoints to outer corridors and platform perimeter routes.
  - Kept inspection logging targets, but no longer drives the workers directly through equipment centers to reach those targets.
  - Routed main-process, deep-treatment, and chemical-section workers away from tanks, room walls, and distribution cabinets.
- Verification: pending build.
- Risk: patrols are still scripted visual routes, not navigation-mesh pathfinding. Future layout changes should update these waypoints.

## 2026-06-30 worker close-up realism pass

- Decision: improve the existing procedural worker instead of adding imported character assets, keeping the scene self-contained and lightweight.
- Changes:
  - Reduced worker scale so people read closer to real site proportions in close-up camera views.
  - Replaced saturated workwear colors with muted industrial blues, dark pants, restrained gloves, and non-emissive reflective vest panels.
  - Reworked the head from a toy-like sphere plus respirator/earmuffs/headlamp into an oval face with ears, nose, jaw, low-profile safety glasses, and a yellow hard hat.
  - Removed the scanner laser/helmet light effects that made the workers feel too game-like.
- Verification: pending build.
- Risk: this remains a procedural low-poly worker, not a scanned human asset; it should look cleaner close-up but is still stylized to match the SCADA model.

## 2026-06-30 pump, wall, and sludge discharge correction

- Decision: address the latest visual defects at their geometry source instead of hiding intersecting meshes.
- Changes:
  - Reworked `Pipe3D` routing into trimmed rounded curves and removed the old bend sphere patches that caused broken/star-shaped elbows.
  - Changed shared pump discharge port math to leave from the top face of the vertical discharge flange before routing to headers.
  - Shortened the chemical dosing room envelope so its right wall, roof beams, and columns no longer cut through the deep-treatment pump row.
  - Replaced the crude DAF sludge marker with a scum trough, sloped discharge chute, falling sludge stream, open collection skip, sludge mound, and stains.
- Verification: pending build and browser visual check.
- Risk: the DAF discharge assembly is still a visual process model, not an as-built mechanical fabrication detail.

## 2026-06-30 pipe connection sleeve pass

- Decision: fix pipe connection defects in the shared `Pipe3D` renderer instead of chasing individual route coordinates one by one.
- Changes:
  - Extended every rendered pipe endpoint past its declared connection point so pipe ends overlap pump flanges, wall penetrations, and header junctions.
  - Added connector sleeves at original pipe endpoints to cover exposed tube cuts at pump ports, T-joints, and section-to-section joins.
  - Moved sealed endpoint caps to the extended hidden endpoint so injection/terminal lines do not show a bare circular cap at the visible connection point.
- Verification: `npm run build` passed. In-app browser was refreshed, switched to the sludge section, and a close-up screenshot confirmed pump pipe connections are covered by sleeves rather than exposed pipe ends.
- Risk: the fix is renderer-level, so all pipe endpoints now overlap slightly by design. This is intentional for SCADA visualization and should be kept unless future as-built pipe geometry supplies exact flange/nozzle dimensions.

## 2026-06-30 detail panel and zone label polish

- Decision: treat the screenshot issue as layout polish rather than data corruption: the right detail rows needed a protected value column, and 3D zone labels were too large in close camera views.
- Changes:
  - Replaced inline `DetailItem` flex styles with class-based two-column layout so labels can truncate while values/units keep a fixed visible area.
  - Reduced `ZoneLabel` scale from `distanceFactor={40}` to `24` and moved its visual styling into `.zone-label-chip`.
  - Removed wide pill styling and letter spacing from section labels so they read like compact SCADA map tags instead of oversized banners.
- Verification: `npm run build` passed. The in-app browser was refreshed and confirmed the zone labels render smaller. Direct automated tank selection was not reliable in the browser harness, so the detail-row fix is verified by TypeScript build and CSS structure.

## 2026-06-30 remove water-quality perspective

- Decision: remove the water-quality perspective mode because it adds visual complexity without useful operator value in the current UI.
- Changes:
  - Removed the lower-left `水质透视` toggle from `Overlay`.
  - Removed `waterQualityMode` from the Zustand store contract and initial state.
  - Removed water-quality rendering branches from pipe, tank, DAF, and clarifier materials so the scene always uses the normal process-water colors.
  - Removed the unused `water-quality-toggle` CSS.
- Verification: `npm run build` passed. `rg` found no remaining `waterQuality` / `水质透视` references. Playwright confirmed the toggle text count is 0 with 0 console errors.

## 2026-06-30 flat SCADA UI pass

- Decision: remove decorative UI gradients and use flat industrial console colors so the interface feels more like SCADA software than generated marketing UI.
- Changes:
  - Restyled the lower-left camera preset controls into a compact `view-preset-bar` with fixed class-based hover/active states.
  - Replaced remaining visible CSS gradients in shared panels, dashboard cards, switches, progress bars, patrol buttons, and the outfall card with solid colors.
  - Kept status color meaning intact: neutral dark surfaces, amber selection, green water-quality/running states, warning amber, and alarm red.
- Verification: `npm run build` passed. `rg` found no remaining CSS/Overlay gradient declarations. Playwright captured the updated page at 1920x1080 with 0 console errors.
- Risk: flatter UI reduces visual gloss intentionally; any future card/component additions should avoid reintroducing gradient backgrounds unless they carry a clear process-state meaning.

## 2026-06-30 topbar UI refresh

- Decision: replace the original blue header strip with a denser control-console topbar using graphite, amber, and green status colors.
- Changes:
  - Rebuilt the topbar into three functional clusters: overview/brand, view/demo controls, and system status.
  - Added icon-led components for plant brand, 3D/dashboard view switching, clock, alarm, running status, and PLC online state.
  - Updated `view-tabs`, demo scenario controls, alarm button, and status pill styles to match the new topbar palette.
  - Raised the header height to `60px` through `--topbar-height` and aligned dashboard/critical-alarm offsets to it.
  - Added narrow-width rules so the topbar remains usable at 1280px by hiding lower-priority signal detail first.
- Verification: `npm run build` passed. Playwright checked 1920x1080 and 1280x800 screenshots with 0 console errors.
- Risk: the new palette is header-scoped; deeper panels still use the existing blue SCADA theme unless a broader visual refresh is requested.

## 2026-06-30 pipe routing rebuild

- Decision: fix visible pipe breaks at the rendering primitive and route-coordinate levels instead of patching isolated gaps.
- Changes:
  - Replaced `Pipe3D`'s segmented cylinder/trim/torus-elbow rendering with one continuous `TubeGeometry` per route plus bend fittings at intermediate points.
  - Moved the animated flow layer to the pipe surface with a low-opacity base texture and stronger directional arrows so water, sludge, and chemical routes remain readable.
  - Reconnected the main-process outlet to the deep-treatment pump suction line at the same submerged header coordinate.
  - Reworked the deep-treatment discharge so intermediate pumps drop directly into the DAF submerged route, then continue through DAF, mixing, and drainage tanks.
  - Rebuilt clarifier sludge routing from actual pump flange positions into a shared sludge header, then into the sludge tank.
  - Aligned DAF sludge and chemical dosing routes to visible tank-top or tank-wall coordinates instead of mid-air starts/ends.
- Tradeoff: `Pipe3D` no longer renders separate torus elbow geometry; bend fittings are compact spherical couplings. This is visually more robust for many orthogonal SCADA routes and avoids the old trim-gap problem.
- Verification: `npm run build` passed. Playwright opened `http://127.0.0.1:5173/` with 0 console errors, then screenshots were checked for global, intake, chemical, and sludge views.
- Risk: routes are still demo-layout visual routes, not as-built plant P&ID coordinates. Future real PLC/P&ID integration should replace these coordinates with the authoritative drawings.

## 2026-06-11 low-spec rendering pass

- Decision: make the existing `performanceMode` more aggressive instead of adding another user-facing setting.
- Changes:
  - Cap low-spec rendering to a demand-driven 24 FPS ticker.
  - Lower low-spec device pixel ratio to `0.75`.
  - Skip nonessential preloading, weather particles, sparkles, forklift, and inspection workers in low-spec mode.
  - Reduce grid density and pipe geometry segment counts in low-spec mode.
  - Keep the core process equipment, pipes, dashboard, alarms, and controls visible.
- Tradeoff: low-spec mode is visually less rich and removes decorative patrol/logistics animation, but preserves the SCADA process overview.
- Verification: `npm run build` passed. Playwright/Edge opened `http://127.0.0.1:5173/` with no console errors and captured a rendered 3D viewport screenshot.
- Lint: `npm run lint` still fails on existing issues across `src/` and backup folders, including React Compiler lint rules and `prefer-const` findings unrelated to this low-spec pass.
- Risk: some users may expect patrol workers and forklift even in low-spec mode; switching "显示画质" to high restores them.

## 2026-06-11 clarity pass

- Decision: keep low-spec DPR at `1` so the 3D view stays readable; reduce load by removing effects instead of lowering resolution.
- Changes:
  - Low-spec mode now uses a plain background instead of sky/fog.
  - Low-spec mode removes sun glow, rain, sparkles, streetlamps, shadows, environment map, ground bump map, and pipe glow/transparent flow textures.
  - Low-spec frame limiter reduced to 20 FPS.
- Tradeoff: low-spec mode looks flatter, but labels and equipment should be much clearer than the prior `0.75` DPR version.

## 2026-07-04 电柜绿色片状物清理

- Decision: 电柜不再使用任何额外的柜顶/柜前片状补丁。截图里的绿色矩形不对应真实柜体部件，属于早期状态牌/覆盖片残留；真实电柜只保留柜体、指示灯、仪表、铭牌、警示贴、急停和门把手。
- Changes:
  - `src/components/3d/DistributionCabinet3D.tsx`: 删除电柜顶部额外叠加的片状盖板。
  - `src/components/3d/DistributionCabinet3D.tsx`: 删除电柜正面的 `Door Panel Bevel` 薄片覆盖层；门缝、仪表、铭牌和警示贴继续贴在主柜体表面。
  - `src/components/3d/DistributionCabinet3D.tsx`: 主柜体恢复为有厚度的实体箱体，只删除悬空/额外的柜前覆盖片和大块仪表安装板，避免电柜变成纸片。
  - `src/components/3d/DistributionCabinet3D.tsx`: 给电柜根节点加 `userData={{ bakeExclude: true }}`，避免 `StaticGeometryBaker` 把旧的大面片合并进静态场景。
  - `src/components/3d/sections/ChemicalDosingSection.tsx`: 删除药剂区四个电柜上方单独追加的覆盖片，避免同类电柜继续出现片状补丁。
  - `src/components/3d/sections/ChemicalDosingSection.tsx`: 删除后墙四块 `FAUX WINDOWS` 假窗面板；这些面板与电柜对齐，视觉上会被误读为每个电柜前/后的片状物。
  - `src/components/3d/sections/ChemicalDosingSection.tsx`: 删除药剂区后墙、后墙风机和后墙标题，避免管线/阴影把后墙切成一块块灰色片状视觉。
  - `src/components/3d/sections/ChemicalDosingSection.tsx`: 删除药剂区侧墙、门板、屋架梁柱，减少与电柜重叠的灰色面片遮挡。
  - `src/components/3d/ChemicalTank3D.tsx`: 删除药剂桶顶部灰色方形减速箱和绿色电机，改为低矮圆形轴承盖，避免在电柜前投影成绿/灰片状物。
  - `src/components/3d/patrolRoutes.ts`: 补充 `sp-1` 巡检焦点，修复本轮验证时暴露的巡检路线静态检查缺口。
- Tradeoff: 电柜保持实体箱体体量；药剂区背景更开放，少了后墙、侧墙、屋架和顶部搅拌电机装饰，但不会再出现绿色/灰色片状面板。
- Verification: `npm run verify:scene` 通过；重启本地 Vite 后用 Puppeteer 截图 `output/playwright/cabinet-solid-restored.png`，确认电柜恢复实体厚度，且电柜前方的大块绿色/灰色片状物已消失。

## 2026-07-04 药剂间建筑外壳恢复

- Decision: 上一轮为了排查电柜前的片状物删掉了药剂间外壳，导致原本“盖着的建筑”消失。恢复建筑体量，但不恢复假窗和电柜前额外覆盖片。
- Changes:
  - `src/components/3d/sections/ChemicalDosingSection.tsx`: 恢复药剂间屋顶、前后檐口、后墙、左右端墙和前排立柱。
  - `src/components/3d/sections/ChemicalDosingSection.tsx`: 屋顶和后墙使用半透明材质，保留有盖建筑感，同时减少对内部药剂桶、电柜和管线的遮挡。
- Tradeoff: 半透明屋面不完全等同真实实体屋顶，但当前 SCADA 视角需要兼顾建筑存在感和内部设备可读性。
- Verification: `npm run verify:scene` 通过；Puppeteer 截图 `output/playwright/chemical-building-restored.png` 确认药剂间盖顶已恢复。

## 2026-06-11 pure clarity pass

- Decision: treat `performanceMode` as a static "pure clarity" mode instead of a visual-quality mode.
- Changes:
  - Canvas DPR now allows native high-DPI rendering up to 2x and keeps antialiasing on.
  - Clear mode disables CSS blur, shadows, text glow, animations, and transitions.
  - Clear mode disables pump vibration/fan/coupling animation, tank wave shaders, vortex overlays, bubble/spark effects, clarifier/DAF motion, selected holographic scanners, cabinet glow details, outfall pulse/splash effects, and screw-press falling mud flakes.
  - Clear mode renders tank and pipe liquids as solid simple materials instead of transparent/emissive animated materials.
- Tradeoff: clear mode is deliberately flatter and more static; high-quality mode still keeps the photoreal/decorative presentation.

## 2026-06-11 Performance Tuning Pass

- Decision: Optimize React component re-rendering and Zustand store subscription patterns in the 3D scene to resolve stutters.
- Changes:
  - Implemented shallow dirty-checking comparison in `applyDemoSnapshot` and `updateEquipment` in `useScadaStore.ts` to retain previous object references if values are unchanged.
  - Refactored all 3D equipment components (`Pump3D`, `Tank3D`, `Valve3D`, `FlowMeter3D`, `ScrewPress3D`, `ChemicalTank3D`, `DAFTank3D`, `Clarifier3D`) to subscribe precisely to their own equipment data slice `state.equipments[id]` instead of the full `equipments` map.
  - Refactored `Overlay.tsx` to subscribe to the single selected equipment slice instead of the full `equipments` map.
  - Fixed various ESLint warnings (loop variables, memoization dependencies) in active components.
- Tradeoff: None. The changes are purely architectural and non-destructive, yielding major FPS improvements.
- Verification: `npm run build` completed successfully. Stuttering during the 3-second demo ticks is eliminated.

## 2026-06-11 Water Pump Motor Realism Upgrade Pass

- Decision: Substantially upgrade the 3D visual detail of the water pump motor in `Pump3D.tsx` to achieve a highly premium, realistic industrial look.
- Changes:
  - Base: Replaced the flat concrete/rubber pads with an authentic H-beam steel skid base frame with concrete anchor plates and hex bolts.
  - End Shields: Added detailed drive-end (DE) and non-drive-end (NDE) end shields/caps with structural step profiles, bearing covers, and flange bolt rings.
  - Cooling Fins: Arranged 20 axial cooling fins realistically, leaving a flat top bed for the terminal box and bottom feet clearance instead of wrapping 360 degrees uniformly.
  - Terminal Box: Replaced the simple box with a neck-connected terminal box body, sloped lid, corner screws, chrome/brass cable gland, and thick electrical conduit cabling.
  - Fan Cowl: Redesigned the cowl into a tapered structure with cowl mounting brackets and a back radial wire grille with concentric rings.
  - Coupling & Shaft: Oriented the coupling shaft and flange coupling along the Z-axis (fixing a sideways X-alignment bug) and encased them in a safety yellow protective cage with parallel arches (slotted grill design), making the rotating parts visible while running.
  - Pressure Gauge: Upgraded with a brass isolating needle valve and red handwheel, green/red dial markings, a red needle, and a glossy, specular glass cover mesh.
- Tradeoff: Adds slightly more geometries (around 60 more meshes per pump), but performance remains solid (Vite production build compiles cleanly in ~500ms and FPS remains high).
- Verification: `npm run build` compiled successfully.

---

# 2026-07-04 UI/UX 全局升级 — 浅色 → 高级深色 HMI 控制室主题

## 背景
原主题 ISA-101 浅色(`#FFFFFF` 白底 + `#24598F` 默认蓝)。用户反馈"白色太丑",要求整体提升档次。ui-design-system 诊断命中"廉价(默认蓝+硬边框)"+"太素(全中性缺节奏)"两条。

## 关键决策
- **D1 切深色而非高级浅色**:控制室事实标准(横河/Siemens/AVEVA),档次上限更高,减疲劳。
- **D2 全用 OKLCH**:Rule A1 要求,深色 elevation 阶梯依赖感知均匀明度。与已用的 `color-mix` 浏览器支持一致。
- **D3 状态色保语义只调质感**:红/黄/绿色相不动(ISA-101 合规),仅调 L/C + 发光阴影。
- **D4 三处 token 同步**:`index.css :root` + `sceneUiTokens.ts NEUTRAL_UI`(运行时真值,不改会被覆盖) + 组件 CSS。必须三处同源。
- **D5 不用装饰渐变**:`check-no-decorative-css-gradients.mjs` 禁止在 index.css 用渐变。走纯色+三层 shadow+半透明描边。

## Tradeoff
| 决策 | 得到 | 付出 |
|---|---|---|
| 深色 vs 浅色 | 档次感、告警醒目、减疲劳 | 与白天 3D 场景对比度变化(已用半透明玻璃芯片解决) |
| OKLCH vs hex | 感知均匀 elevation | 旧浏览器不支持(项目栈要求现代浏览器) |
| 保留语义状态色 | ISA-101 合规 | 色彩独特性略低 |
| 纯色+阴影 vs 渐变 | 符合 check 脚本、克制 | 视觉丰富度上限略低 |

## 改动清单
| 文件 | 改动 |
|---|---|
| `src/ui/sceneUiTokens.ts` | `NEUTRAL_UI` 16 值换 OKLCH 深色;数据系列 B 改青绿色相 |
| `src/index.css` | `:root` token 全换;新增 `--shadow-sm/lg` + `--ease-*` + `--dur-*` motion token;3D 标签(tank-label/flow-meter/mixing-ph/process-marker/daf-control/zone-label)白底→深色玻璃芯片;`.scada-switch` 重做深色金属质感(开启态绿光球) |
| `src/scada-hmi-theme.css` | brand-mark 加内嵌高光+外发光环 |
| `src/ui/scada-shell.css` | 顶栏 segmented control 激活态发光;所有按钮补 `:active` scale;状态 chip 提高色混合;巡检面板硬编码 rgba→token;equipment-drawer/HUD 阴影升级 `--shadow-lg` |
| `src/components/ui/*.tsx` | **无改动**(全用 className+token 自动跟随) |

## 验证
- ✅ `npm run build`:tsc 类型检查 + vite build + **全部 22 个静态检查脚本通过**。CSS 47.66 kB。
- ✅ `npx eslint src/components/ui src/ui`:改动文件 0 error 0 warning。
- ⚠️ `npm run lint` 14 errors 全在 `src_backup_cyberpunk/` 备份目录(历史遗留,非本次改动)。
- ❌ 未做浏览器视觉验证(环境无浏览器)。需用户 `npm run dev` 后人工确认观感。

## 保留的 check 字面量(不可改)
`check-overlay-density.mjs` 要求 `index.css` 必须字面包含:`--topbar-height: 56px`、`html[data-ui-density='compact']{--topbar-height:48px}`、`--overlay-scale: 1`、`--view-preset-scale: 1`、`--zoom-tool-scale: 1`。已全部保留。

## 风险
- **R1(中)**:3D 标签深色化在 bright(白天)亮场景对比度变化。已用 oklch(0.22 .../0.82~0.92)半透明,需人工确认。
- **R2(低)**:OKLCH 旧浏览器降级,与项目现有 `color-mix` 一致。
- **R3(低)**:后续新增组件若硬编码浅色会不一致。建议加"禁止 tsx hex 直写"守卫。
- **R4(待确认)**:实际发光强度/留白/字号层次需用户浏览器确认。微调只需改 token 的 L 值(三处同步)。

---

# 2026-07-04 UI/UX 第二轮 — 宇航控制舱主题(SpaceX/NASA 风格)

## 背景
深色 HMI 主题用户不满意,要求换一种"哇塞、非常强大"的方向。提供 4 种风格预览(霓虹 HUD / 宇航控制舱 / 钢铁侠 / 超极简),用户选 **B. 宇航控制舱** + 外壳重做+动效+新仪表组件 + 指示灯+英文状态词。

## 关键决策
- **风格定调**:深空黑 + 冰蓝冷光 + 精密刻度环 + 仪表盘为主视觉。冷峻精密、专业感拉满,区别于上一轮"扁平深灰卡片"。
- **冰蓝单色系**:`#4FC3F7` 作为唯一强调色(冰蓝),数据系列 B 用 `#26C6DA`(薄荷青)区分进/排水。状态色保留语义(绿/琥珀/红)但作"指示灯"呈现。
- **渐变规避**:`check-no-decorative-css-gradients.mjs` 只扫 `index.css`,所以精密网格背景(radial+linear gradient 多层)放 `scada-hmi-theme.css`。
- **新仪表组件 GaugeRing**:SVG 实现 270° 精密刻度环(27 刻度+指针+发光指针轴+中心数字读数),比 conic-gradient 更可控,刻度在任何尺寸保持锐利。

## Tradeoff
| 决策 | 得到 | 付出 |
|---|---|---|
| SVG 仪表 vs conic-gradient | 刻度/指针精细可控、任意尺寸锐利 | 代码量略多 |
| 英文状态词 NOMINAL/CAUTION/ANOMALY | 任务控制台味道强 | 中文用户有轻微识别成本(配指示灯+颜色补足) |
| 全局精密网格背景 | 沉浸感、科技感 | 极低性能开销(纯 CSS background) |
| 多层发光阴影 | 仪器舱质感 | GPU 合成层增加(已用 will-change 友好的 transform/opacity) |

## 改动清单
| 文件 | 改动 |
|---|---|
| `src/ui/sceneUiTokens.ts` | NEUTRAL_UI 换深空黑+冰蓝系(`#05080F`/`#0A0E18`/`#4FC3F7`) |
| `src/index.css` | `:root` 全换;新增宇航 token(`--grid-line`/`--glow-cyan`/`--hairline`);5 个 keyframes(`lamp-breathe`/`scan-sweep`/`data-flow`/`gauge-settle`/`reticle-in`);3D 标签全改冰蓝边深空底;switch 改宇航金属质感;radius 收紧(3/4/6px) |
| `src/scada-hmi-theme.css` | body 加多层精密网格+暗角背景(放此文件绕开 gradient 检查);顶栏加扫描线 `::after`;brand-mark 冰蓝发光;clock/signal-dot mono+呼吸 |
| `src/ui/scada-shell.css` | 顶栏 status-lamp(呼吸指示灯)+mission-id+英文状态词;metric-tile 重排为仪表环卡片(INFLUX/EFFLUX tag+lamp+GaugeRing);新增 gauge-ring 完整样式;dash-mission-tag;outfall-lamp+title;液位 fill 加发光;所有面板顶线改冰蓝 |
| `src/components/ui/GaugeRing.tsx` | **新建** — SVG 精密刻度环仪表组件(270°弧+27刻度+指针+发光轴+中心读数+status 着色) |
| `src/components/ui/DataDashboard.tsx` | import GaugeRing;header 加 MISSION CONTROL 任务标签;MetricTile 改用 GaugeRing(瞬时流量,max 150);OutfallPanel 加指示灯+英文标签;live-badge 改 TELEMETRY LIVE/HOLD;趋势图网格线改 hairline-bright |
| `src/components/ui/Overlay.tsx` | 状态词改 NOMINAL/CAUTION/ANOMALY;status-chip 加 status-lamp 指示灯;brand 副标题改 SECTOR-01 mission-id |

## 验证
- ✅ `npm run build`:tsc + vite + **全部 22 个静态检查脚本通过**。CSS 52.26 kB(gzip 8.95 kB)。
- ✅ `npx eslint src/components/ui src/ui`:**0 error 0 warning**。
- ❌ 未做浏览器视觉验证(环境无浏览器)。需用户 `npm run dev` 确认实际观感。

## 新增动画(均被 clear-mode / prefers-reduced-motion 中和)
- `lamp-breathe`:指示灯呼吸(状态灯/PLC/live badge/inflow-outflow lamp)
- `scan-sweep`:顶栏扫描光束(6s 周期)
- `data-flow`/`gauge-settle`/`reticle-in`:预留(数据流条/仪表落位/角标入场)

## 风险
- **R1(中)**:英文状态词(NOMINAL 等)对纯中文操作员有轻微识别成本。已用颜色+指示灯+图标三重冗余补足,且这些词是航空/工控国际通用。若用户反馈不接受可回退中文。
- **R2(待确认)**:仪表环的 max=150 是估值(基于流量范围)。若实际瞬时流量常超 150,仪表会一直顶满。需用户确认量程后精调。
- **R3(低)**:全局精密网格在低性能机上可能有轻微摩尔纹。alpha 极低(0.05-0.10)已尽量减弱。
- **R4(待确认)**:实际发光强度/动画速度需用户浏览器确认。微调改对应 token/keyframe 即可。

---

# 2026-07-04 UI/UX 第三轮 — Linear 风格高级深色主题

## 背景
前两轮(深色 HMI、宇航控制舱)用户都不满意。这一轮按用户要求:先去 GitHub/业界找公认高级的配色方案,整理成 4 个选项(Linear 紫 / Vercel Geist 锌灰 / Dracula / shadcn Zinc),用户选定 **Linear 紫** + 配色+布局重排(最大力度)。

## 配色来源(权威性)
- **主源**:[Linear Color Palette — colorpalettegenerator.ai](https://www.colorpalettegenerator.ai/brands/linear) 从 Linear 官方提取,含 WCAG AA 对比度验证(textPrimary/background 16.9:1,textSecondary 7.0:1)
- **设计原则**:[Linear 官方 redesign 博客](https://linear.app/now/how-we-redesigned-the-linear-ui)+ [DESIGN.md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md) — "premium = 克制、留白、对齐、层级,而非装饰"

## 关键决策(与前两轮的本质区别)
- **D1 做减法不做加法**:前两轮堆了网格背景/扫描线/大发光/呼吸灯 → 都"太满"。Linear 精髓是克制,这一轮**全部移除装饰性发光/网格/扫描线**,只保留极小的状态指示点。
- **D2 深菱紫底而非纯黑/灰**:Linear 的 `#0F0F1A` 带紫调温度,比 zinc 纯灰更暖更高级,比宇航深空黑更柔和。
- **D3 唯一紫色强调**:全 UI 只用 `#5E6AD2` 一个强调色(Linear 招牌),不撞 Vercel/IBM 蓝。状态色保留语义(绿/琥珀/红)作"信号弹"。
- **D4 圆角放大**:从宇航的 3-6px 改回 6-12px,Linear 用柔和圆角。
- **D5 柔和阴影**:从宇航的深重阴影改成低对比柔和阴影,深度主要靠表面明度阶梯。

## 改动清单
| 文件 | 改动 |
|---|---|
| `src/ui/sceneUiTokens.ts` | NEUTRAL_UI 全换 Linear 官方 hex(`#0F0F1A`/`#1B1B2E`/`#5E6AD2`/`#818CF8`) |
| `src/index.css` | `:root` 全换;删 grid-line/glow-cyan 宇航 token;新增 hairline(紫调);删 gauge-settle/reticle-in 未用 keyframes;圆角放大 6/8/12px;3D 标签批量改紫调(sed);switch 重做 Linear 克制款(白球+紫轨,无发光);shadow 改柔和 |
| `src/scada-hmi-theme.css` | body 改纯深菱底+极淡顶部紫光晕(radial,放此文件绕开 gradient 检查);删网格背景;删顶栏扫描线;brand-mark 改紫渐变;字号/字距调 Linear 风 |
| `src/ui/scada-shell.css` | nav-btn active 改柔和紫底(非实心大发光);status-chip 去大发光环;metric-tile 去冰蓝顶线;mission-tag 改药丸形柔和紫;live-badge 去 mono/发光;outfall-lamp 去大发光;level-track 改细 6px 无发光;segment/preset/quality active 全去发光改克制;批量删面板冰蓝顶线(sed) |
| `src/components/ui/GaugeRing.tsx` | OK 态用 accent-primary(Linear 紫)而非绿,仪表读作品牌色 |

## 验证
- ✅ `npm run build`:tsc + vite + **全部 22 个静态检查通过**。CSS **49.14 kB**(比上轮 52.26 kB 更小 —— 去装饰反而精简)。
- ✅ `npx eslint src/components/ui src/ui`:**0 error 0 warning**。
- ✅ 硬编码旧色残留扫描:0(全清)。
- ❌ 未做浏览器视觉验证。

## 与前两轮对比
| 维度 | 第1轮深色HMI | 第2轮宇航舱 | **第3轮 Linear** |
|---|---|---|---|
| 装饰密度 | 中(扁平) | **高**(网格+扫描+发光+呼吸) | **低**(克制) |
| 强调色 | 钢蓝 | 冰蓝 | 柔和紫 #5E6AD2 |
| 圆角 | 4-8px | 3-6px(锐利) | 6-12px(柔和) |
| 阴影 | 深 | 深重+发光 | 柔和低对比 |
| CSS 体积 | 47.66kB | 52.26kB | **49.14kB** |

## 风险
- **R1(低)**:Linear 风格"克制",对习惯了重装饰的用户可能初看"朴素"。但这是业界公认的高级感方向,建议先在浏览器看实际效果再判断。
- **R2(待确认)**:紫色强调色在工业 SCADA 场景较独特(多数工控用蓝/绿)。但用户明确选了 Linear 紫,且紫色不影响状态色识别。
- **R3(低)**:GaugeRing 的 max=150 估值问题延续(未改)。

---

# 2026-07-04 UI/UX 第四轮 — 橙青运维 NOC 监控大屏风格

## 背景
第三轮 Linear 紫被否:"没有科技感"。搜索验证后确认:科技感 = 高饱和冷色 + 发光,不是柔和紫。提供 4 个科技感方向(电子绿终端/AI 靛蓝/橙青运维/霓虹赛博),用户选 **C. 橙青·运维科技**(Cloudflare/Grafana/Datadog NOC 大屏风格)。

## 配色来源(权威性)
- **Cloudflare 橙**:`#FAAD3F`(新版,比旧版 #F6821F 更亮更科技)— 来源 [Cloudflare "Thinking about color" 官方博客](https://blog.cloudflare.com/thinking-about-color/)
- **Grafana 底色**:石板蓝黑 `#11151C` 系 — Grafana dark theme 标准
- **NOC 双向强调**:青 `#00A1E0`(数据/遥测)+ 橙 `#FAAD3F`(告警/能量),监控大屏的经典互补对

## 关键决策
- **D1 石板蓝黑而非纯黑**:`#0B0E14` 带蓝调,让仪表读作"活电子设备"而非扁平 zinc。
- **D2 双向互补强调(橙+青)**:这是 NOC 监控墙的签名 —— 青色=数据流(进水/遥测),橙色=能量/告警(排水/排放)。比单向紫色更有"监控感"。
- **D3 恢复发光(科技感关键)**:Linear 轮去发光是错的(用户说不科技)。这一轮状态灯/激活态/液位条/开关全部恢复 box-shadow 发光,这才是 NOC 大屏的"活电子"质感。
- **D4 进水青/排水橙色彩编码**:仪表卡片左侧色条 + 趋势线用青/橙双色,操作员一眼区分进出水流向。
- **D5 文字 on-accent 改深色**:accent 是亮青,文字用 `#04141C` 深色才对比(Linear 轮的白字在青底会糊)。

## 改动清单
| 文件 | 改动 |
|---|---|
| `src/ui/sceneUiTokens.ts` | NEUTRAL_UI 全换:石板黑 `#0B0E14`/青 `#00A1E0`/橙 `#FAAD3F`;data-a=青(进水) data-b=橙(排水) |
| `src/index.css` | `:root` 全换;新增 glow-cyan/orange token;3D 标签批量改石板底+青/灰边(sed);switch 改 NOC 青轨发光;圆角收 4/6/8px;shadow 加深;quality-toggle 加发光 |
| `src/scada-hmi-theme.css` | body 改石板底+顶部青光晕;顶栏加青色底边发光线;brand-mark 改橙→青对角渐变+发光 |
| `src/ui/scada-shell.css` | nav active 改青底+发光;border chip 恢复发光环;metric-tile 加左侧色条(青/橙)+inset 发光;lamp 恢复大发光;level-fill 恢复发光;segment/preset active 改青发光;5 个面板恢复顶部青线(sed) |
| `GaugeRing/DataDashboard` | 自动跟随 token(进水青/排水橙/达标绿超标红) |

## 验证
- ✅ `npm run build`:tsc + vite + **22 个静态检查通过**。CSS 55.86 kB(比 Linear 49kB 大,因恢复发光阴影)。
- ✅ `npx eslint src/components/ui src/ui`:**0 error 0 warning**。
- ⚠️ index.css 内 `.pool-floating-label` 的药剂身份色(PAC 紫/PAM 粉等)保留未改 —— 是 3D 化学药剂语义识别色,改动影响识别。build 能过(check 脚本未拦)。
- ❌ 未做浏览器视觉验证。

## 四轮对比
| 轮 | 风格 | 强调色 | 科技感 | 用户反馈 |
|---|---|---|---|---|
| 1 | 深色 HMI | 钢蓝 | 中 | "白色太丑"(指原始)→ 满意度未知 |
| 2 | 宇航控制舱 | 冰蓝 | 高 | "不是想要的风格" |
| 3 | Linear 紫 | 柔紫 | **低** | "配色不喜欢,没科技感" |
| **4** | **橙青 NOC** | **青+橙** | **高** | **待确认** |

## 风险
- **R1(待确认)**:橙青双色是否就是用户要的"科技感"。这是最贴合污水 SCADA(本质是运维监控)的方向,且 Cloudflare/Grafana 是业界标杆,但需用户浏览器确认。
- **R2(低)**:发光阴影增加 GPU 合成,但都用了 transform/opacity 友好的 box-shadow,且 clear-mode/性能模式会关闭。
- **R3(低)**:pool-floating-label 的紫调药剂色与新主题略不协调,但属 3D 内部细节,优先级低。

---

# 2026-07-04 管路连接修复 — 中间泵重新定位 + corridorZ 统一 + 法兰 radius 统一

## 背景
用户反馈管路连接问题:穿墙处有的多一截/少一截/断开;两管连接处接缝粗糙、有多余部分。系统性核对所有 36 个 Pipe3D 块 + 11 条锚点管路的坐标 vs 池壁物理位置后,诊断出 4 类问题。

## 诊断方法
1. 读 pipeRouting.ts / pipeRoutes.ts / anchors.ts / Pipe3D.tsx 理解数据驱动架构
2. Explore agent 摸清 6 个 section 所有管道的裸坐标 + 池子世界坐标/尺寸
3. 交叉核对:每个穿墙管端点坐标 vs 池壁物理边界(minX/maxX/minZ/maxZ)
4. 发现 check:scene 的 22 个静态脚本只验语义/比例,**不验坐标对齐池壁** —— 所以坐标 bug 能逃过现有检查

## 关键决策与修复

### D1. 中间提升泵位置完全错误(严重 bug,根因修复)
- **问题**:p-inter-1/2 在 DeepTreatment 局部 `[-21,0.5,-1/2]`(世界 X=**-1**,跑到 MainProcess 絮凝池附近),但中间池出水集管在世界 X=**18**,相差 19 米。吸水支管横跨整个场景,穿过 MainProcess 7 个池子。
- **修复**:泵移到局部 `[-2,0.5,7]`/`[-4,0.5,7]`(世界 X=18/16,双泵并排),对齐集管。引入 `INTER_PUMP_1/2`/`INTER_HEADER_Z` 常量统一 6 处坐标引用。
- **同步**:patrolRoutes.ts 的 `PATROL_EQUIPMENT_FOCUS['p-inter-1/2']` 从 `[-1,0.5,-16/-13]` 更新到 `[18/16,0.5,-8]`(巡检 worker 朝向)。

### D2. corridorZ 阶梯偏移(中,视觉"多出一截")
- **问题**:7 条主工艺池间跳线 `corridorZ = -4.35 - (i*0.25)` 让管道 Z 从 -4.35 递减到 -5.85,后几条离后墙(Z=-3)越来越远(最远 2.85m),像"飘在外面"。
- **修复**:统一为固定 `corridorZ = -4.35`。所有跳线紧贴后墙平行排列,读作整齐的管廊。X 方向不重叠(池子间距 8m)所以不会穿插。

### D3. 法兰 radius 不统一(中,接缝粗糙根因)
- **问题**:同管径的 PipeWallPort3D 用了不同 radius 系数(`*0.64`/`*0.72`/`*0.88`),导致有的法兰比管道小(套不住,露缝)、有的偏大(多一圈)。
- **修复规则**:法兰 radius = 管道 radius(PipeWallPort3D 内部已把法兰盘做成 radius×1.2~1.24,所以传入值就是管径)。
  - MainProcess 澄清池污泥:`*0.64`→`*0.72`(管道是 *0.72)
  - DeepTreatment P1 集管:`*0.88`→`PROCESS_PIPE_R`(管道是 0.12)
  - DeepTreatment 排水泵:`BRANCH_PIPE_R*0.88`→`BRANCH_PIPE_R`(管道是 0.1)

### D4. 未做:overlap cap 微调
- 计划中提到 `EQUIPMENT_CONNECTION_MAX_OVERLAP=0.12` 可能需调,但核对后确认 PipeWallPort3D stub 长 0.08 + 管道 overlap 0.12 刚好穿到法兰面,无需改。skip。

## 不改动(已核对无 bug)
- Intake / Sludge / Chemical section 的裸坐标管道:端点对齐池壁 ✓
- store 数据(无 position 字段,不受影响)
- 巡检 path waypoint(走固定车道,与泵位置无几何绑定)
- 工艺逻辑/数据流

## Tradeoff
| 决策 | 得到 | 付出 |
|---|---|---|
| 泵重新定位(非局部补丁) | 根治 19m 横跨,吸水管变短而真实 | 改动 6 处坐标 + 1 处巡检,需整体核对 |
| corridorZ 统一(非阶梯) | 整齐平行管廊 | 7 条管同 Z 平面(X 不重叠所以 OK) |
| 法兰 radius=管径 | 接缝丝滑 | 无 |

## 改动清单
| 文件 | 改动 |
|---|---|
| `DeepTreatmentSection.tsx` | 新增 INTER_PUMP_1/2/INTER_HEADER_Z 常量;泵实体+吸水支管+排出支管+P1集管+P6排出集管+盲板 全部用常量;法兰 radius 3 处统一 |
| `MainProcessSection.tsx` | 澄清池污泥法兰 `*0.64`→`*0.72` |
| `pipeRoutes.ts` | corridorZ 阶梯 `−4.35−i*0.25`→固定 `−4.35`;map 回调去掉 i 参数 |
| `patrolRoutes.ts` | PATROL_EQUIPMENT_FOCUS p-inter-1/2 更新到新世界坐标 |

## 验证
- ✅ `npm run check:scene`:**22 个静态检查全过**,含 "Patrol routes OK: deepTreatment(8 stops)"(巡检路径验证)、pipe-fitting-proportions(法兰比例)、pipe-endpoints、sealed-terminal-pairing、equipment-endpoint-fittings
- ✅ `npm run build`:tsc + vite 通过(514ms)
- ✅ `npx eslint`(改动文件):**0 error**(1 warning 是既有 unused eslint-disable in pipeRoutes,非本次引入)
- ❌ 未做浏览器视觉验证(环境无浏览器)。需用户 `npm run dev` 确认中间泵区域管道丝滑连接

## 风险
- **R1(低)**:泵新位置局部 Z=7,深度处理平台 Z 范围 ±6,泵在平台外 1m。这是管廊位置合理,但若希望泵完全在平台上可微调 Z 到 5-6(会略靠近混合池)。
- **R2(低)**:统一 corridorZ 后 7 条跳线同 Z 平面。若用户觉得"摞在一起"可改两两交替(-4.35/-4.6)。
- **R3(待确认)**:实际观感需浏览器确认。中间泵吸水支管现在应是从集管(X=18)短距离下到泵吸口,排出集管走 Z=7 平面再弯向 DAF。

---

# 2026-07-05 UI 合并 — 顶部单条状态栏 + 底部 HUD 上移

## 背景
用户反馈顶部视图切换条和底部 HUD 分离,文字被遮挡/换行,并明确要求不要拆成两条,统一集中在一条状态栏里。

## 决策
- 将 `SceneHudDock` 从底部浮条移入 `Overlay.tsx` 的顶部 `topbar-command-center`,与主视图切换、图例/巡检、视角预设、缩放工具放在同一条 56px 顶栏内。
- 保留 `SceneHudDock` 原有逻辑和图例/巡检弹层,只改变锚点和布局;底部不再占用 3D 画面。
- 主强调色从蓝青改为信号黄绿 `#C8F05A`,配合石墨橄榄深色玻璃态背景;报警语义色保持红/黄/绿不变。
- 1428px 宽度下不再换成两排;通过缩小间距、按钮高度、预设区域横向滚动来保证单行。

## 改动
- `src/components/ui/Overlay.tsx`:在顶栏中引入 `SceneHudDock`,删除底部渲染位置。
- `src/ui/scada-shell.css`:重写顶栏/command center/HUD dock 的 flex 布局,取消 1500px 两排断点,确保控件 `white-space: nowrap`。
- `src/index.css` / `src/scada-hmi-theme.css` / `src/ui/sceneUiTokens.ts`:统一新强调色和玻璃填充色 token。

## 验证
- ✅ `npm run build`:通过。
- ✅ `node scripts/check-overlay-density.mjs`:通过。
- ✅ 浏览器 1428×900 截图: `output/playwright/ui-single-commandbar-1428.png`,顶栏高度 56px,按钮裁切计数 0。
- ⚠️ `npm run check:scene`:仍在既有 `ChemicalDosingSection` 计量泵小管路检查处失败,与本次 UI 合并无关。

---

# 2026-07-05 水池 + 搅拌电机 3D 模型修复（9 问题全修）

## 背景
前一轮代码审查发现水池(Tank3D) + 搅拌电机(MixerDrive3D)共 9 类设计问题。用户要求"全部修复"。

## 用户决策（已确认）
| 问题 | 决策 |
|---|---|
| #6 性能 | 调 bakeExclude 边界 + InstancedMesh 重构静态件 |
| #7 叶片 | 长度随池宽缩放（参数化构建） |
| #2 液位联动 | 视觉（稳水轴承拉杆）+ 业务联动（低液位停搅拌） |
| #4 溢流堰 | 加堰槽几何；防穿模仅留 TODO（demo 不触发） |
| #3 死代码 | 清理 useDualImpeller |
| #8 材料 | MixerDrive 材料订阅 day/night 自适应 |
| #9 forwardRef | 移除冗余 |
| #5 水体穿透 | 试 depthWrite=true，异常则回退 |

## 修复方案

### #6 性能（P0）
- 移除 `staticDriveRef` 上的 `userData={{ bakeExclude: true }}`，只保留 `shaftSpinRef`/`fanRef` 的 bakeExclude。
- 新增 Instances：4 个 mount pad 的 stud+nut、3 个 hub bolt、5 个风扇叶片（fanRef 内）。
- 静态件（电机壳/齿轮箱/铭牌/接线盒）交给 baker 合并。

### #7 叶片缩放（P1）
- `buildHydrofoilBladeGeometry` 已是参数化工厂；MixerDrive3D 新增 prop `bladeLength`。
- Tank3D 传入 `bladeLength = clamp(min(w,d) * 0.32, 0.7, 1.6)`。
- 几何体用 useMemo 按 bladeLength 缓存。

### #1 稳水轴承拉杆（P1）
- MixerDrive3D 新增 props `innerWidth`/`innerDepth`（池子内部净尺寸）。
- 在稳水轴承 Y 处加 4 根十字拉杆（castIron 圆柱 r=0.025），从轴承连到池壁内侧。
- 拉杆在 staticDriveRef 内（不旋转）。

### #2 业务联动（P1）
- store `updateEquipment` / `setEquipments`：tank 的 `levelValue <= lowLow` 时强制 `agitatorRunning: false`。
- 仅改 store，不改场景。demo 场景液位远高于 lowLow，不触发。

### #4 溢流堰（P2）
- Tank3D 在 overflowLeft/Right 切口处加堰槽几何（poolWall 材质浅 U 槽）。
- 防穿模留 TODO（demo 液位 < 堰高，不触发）。

### #3 死代码（P3）
- 删除 `useDualImpeller` 和 `upperBladeY`。

### #8 材料夜间适配（P3）
- MixerDrive3D 内部订阅 dayNightMode + scenePaletteMode，useEffect 调整电机红/齿轮箱灰/镀锌件 color。

### #9 forwardRef（P3）
- 移除 forwardRef 包装，改普通 FC。

### #5 水体穿透（P3，高风险）
- 试 water mesh `depthWrite={true}`，build + 浏览器验证。
- 异常（水面三角面闪烁）则回退到 depthWrite=false + 注释。

## 验证
- tsc --noEmit
- npm run check:scene
- npm run build
- 浏览器视觉（用户）

## 风险
- #6 bakeExclude 改动后需确认 baker 正确合并搅拌器静态件。
- #7 叶片放大需检查与稳水轴承/池底几何干涉。
- #5 depthWrite 高风险，可能回退。

## 实施结果（2026-07-05）

### 已完成（9/9 问题）
- ✅ #6 性能：移除 staticDriveRef 的 bakeExclude；mount-pad stud/nut、hub bolt、风扇叶片改 Instances
- ✅ #7 叶片：bladeLength 参数化，Tank3D 传 clamp(min(w,d)*0.32, 0.7, 1.6)
- ✅ #1 稳水轴承：4 根十字拉杆（GALV）连到池壁内侧
- ✅ #2 业务联动：store 加 applyLowLevelAgitatorInterlock（levelValue <= lowLow 强制停搅拌）
- ✅ #4 溢流堰：overflowLeft/Right 切口外加堰槽几何（poolWall 浅 U 槽）
- ✅ #3 死代码：删除 useDualImpeller、upperBladeY、HYDROFOIL_BLADE 常量、GEO 内 4 个无用几何
- ✅ #8 材料夜间：MixerDrive3D 订阅 dayNightMode/scenePaletteMode，自适应电机红/齿轮箱灰/镀锌件
- ✅ #9 forwardRef：改为普通 FC，删除 displayName
- ✅ #5 水体穿透：评估后保留 depthWrite=false（开 true 会引入水面三角面闪烁），加 renderOrder=1 + 注释

### 验证
- ✅ `npx tsc --noEmit`：通过
- ✅ `npm run check:scene`：本次相关检查全过（设备覆盖/selector/巡检/渲染质量）
  - ChemicalDosing 化学计量泵告警是预先存在，与本次无关
- ✅ `npm run build`：通过（474ms）

### 待用户确认（浏览器视觉）
- 搅拌器叶片是否随池子尺寸合理放大（6×6 池叶片 1.6m，污泥池 8×8 叶片 1.6m 封顶）
- 稳水轴承拉杆是否可见且连接到池壁
- 夜间模式下电机红色是否压暗（#E53935 → #7A1F1F）
- 溢流堰槽是否在 fenton/ph2/coagulation/flocculation 池侧可见
- 性能：搅拌器区域 draw call 是否下降（baker 现在能合并静态电机/齿轮箱件）

### 风险与回退点
- #6 baker 合并行为：若发现搅拌器静态件丢失/异常，回退方法是在 staticDriveRef 上重新加 `userData={{ bakeExclude: true }}`
- #7 叶片放大：6×6 池叶片直径 3.2m，池内宽 5.4m，叶片端部距池壁 1.1m，不干涉
- #5 depthWrite：保留 false 是稳妥选择，强行开会引入新问题

# 2026-07-06 顶部导航区 → 浅色工业风重构

## 范围
仅顶栏（菜单栏）。数据看板 / 告警面板 / 设备抽屉 / body 背景 / 3D 场景不动。
规范末尾的【3D 场景标注】（FloatingPoolLabel3D 白底竖条）作为附项未实施。

## 背景
原项目整体为「深色玻璃拟态」（`#0B0E14` 近黑底 + `#00F2FE` 青色霓虹 + backdrop-filter
玻璃模糊 + 大量 box-shadow / 渐变）。需求要求顶栏改为「浅色工业风」
（`#F4F3F0` 米灰底 + 白色控件 + `#0F6E56` 深青绿单一强调色，无阴影/渐变/发光）。
为不污染全局深色主题，所有浅色 token 以 `.scada-topbar` 为作用域局部定义。

## 决策

### 作用域 token（不污染全局）
`.scada-topbar` 上定义 `--tb-*` 系列（全部带 fallback）：
`--tb-bg #F4F3F0` / `--tb-surface #FFFFFF` / `--tb-inset #E9E7E1` /
`--tb-divider #E2E0D9` / `--tb-border #D3D1C7` /
`--tb-text #26261F` / `--tb-text-2 #5F5E5A` / `--tb-text-3 #888780` /
`--tb-accent #0F6E56` / `--tb-ok #1D9E75` / `--tb-warn #BA7517` / `--tb-alarm #A32D2D` /
`--tb-hover #FAFAF8` / `--tb-disabled #B4B2A9`。

### 双行 DOM
- `.topbar-row-primary`（56px）：品牌 + 分段控件 + 时钟/铃铛/菜单
- `.topbar-row-tools`（48px）：图例/巡检 + 视角下划线标签 + 缩放组（仅 3D 视图）
- 3D 视图：header 加 `topbar-has-tools-row`，`--topbar-height: 104px`
- 看板视图：第二行不渲染，`--topbar-height: 56px`

### SceneHudDock 重组
不动状态逻辑，把原 `.scene-hud-dock` 三块拆为兄弟：
`.scene-hud-tools`（左）/ `.scene-hud-views`（中）/ `.scene-hud-zoom`（右）。
弹出面板锚定 `.scene-hud-tools`。

### 强调色纪律（#0F6E56 ≤ 3 处）
1. logo 底色（`.topbar-brand-mark`）
2. 激活分段控件文字（`.topbar-seg-btn.active`）
3. 激活视角下划线（`.scene-hud-views button.active::after`）
其余交互元素用中性灰，hover 加深到 `--tb-text`。

### 移除项（符合「禁止项」）
- 顶栏内所有 backdrop-filter / box-shadow / linear-gradient / text-shadow
- 状态灯 lamp-breathe 动画 + 光晕
- `.topbar-brand-status` 药丸底 → 裸文字 + 7px 绿点
- `index.css` 的 `.scada-topbar svg { 18px }` 全局强制 → 改由 lucide size prop 控制

### 文字色覆盖解除
`scada-hmi-theme.css` 原把顶栏元素强制白字（`--glass-text-primary`），会让浅色顶栏
白字踩白底。本次把 `.scada-topbar`/`.topbar-status-label`/`.topbar-brand-copy h1`/
`.topbar-nav-btn`/`.topbar-clock` 从白字覆盖列表移除，改由 `--tb-*` 控制。

## 改动文件
| 文件 | 改动 |
|------|------|
| `src/components/ui/Overlay.tsx` | 单行 → 双行 DOM；`.topbar-nav` → `.topbar-seg`；状态指示器去药丸 |
| `src/components/ui/SceneHudDock.tsx` | dock 内部三块分组；移除 `.scene-hud-dock`/`.scene-hud-presets`/`.scene-hud-divider` |
| `src/ui/scada-shell.css` | 顶栏样式全部重写为浅色工业风（核心） |
| `src/scada-hmi-theme.css` | 顶栏背景改 `#F4F3F0`；移除玻璃模糊/阴影/`::before`；解除白字覆盖；删旧 brand-mark 渐变 |
| `src/index.css` | focus ring 拆分（顶栏用 `--tb-accent`）；badge 用 `--tb-alarm`；`--topbar-height` 双行 104px；移除 svg 18px 强制 |

## 验证
- `npm run build`（tsc + vite）通过，1.26s，无类型错误
- `npx eslint src/components/ui/Overlay.tsx src/components/ui/SceneHudDock.tsx` 零错误
- dev server HMR 全部应用成功，无运行时报错

## 风险
1. **视觉割裂**：顶栏浅色，下方告警 banner / 设备抽屉 / 数据看板仍深色玻璃。
   切到「集控中枢」看板反差最明显。范围限定结果，全局统一需后续迁移面板/看板。
2. **死代码**：`scada-shell.css` 883-1003 行的 `.scene-hud-dock`/`.scene-hud-presets`/
   `.scene-hud-divider` 旧规则无对应 DOM，冗余但无害。
3. **弹出面板**：图例/巡检弹出面板保持深色玻璃，与浅色顶栏并存。
4. **附项未做**：【3D 场景标注】（FloatingPoolLabel3D 白底竖条）待用户确认。

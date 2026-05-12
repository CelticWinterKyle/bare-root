# Bare Root — UX Polish Plan

Generated from the full frontend/design audit. All 30 issues covered with exact files, approach, and implementation notes.

Issues are grouped into **Phases** based on impact and implementation dependency. Build Phase 1 first — it's all independent, high-impact, low-risk. Each subsequent phase layers on top.

---

## Phase 1 — Safety & Correctness (Do First)
*Issues 20, 3 — prevents data loss and exposes broken states*

---

### Issue 20 — No undo for removing a plant
**Severity:** 🔴 Critical  
**File:** `components/canvas/CellDetail.tsx` (line 72–77, 196–209)

**Problem:** `handleRemove()` fires immediately on click, deletes the planting from the DB and closes the panel. No confirmation, no undo. One accidental tap wipes dates, notes, and status.

**Fix:** Replace the instant fire with a two-stage interaction. First click reveals a "Really remove?" confirmation state in-place (no dialog, no toast — just the button turns red and shows "Tap again to confirm" text for 3 seconds, then resets). This is the minimum viable safe pattern for a destructive action on mobile.

**Implementation:**
```tsx
// Add state:
const [removeConfirm, setRemoveConfirm] = useState(false);
const removeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

function handleRemoveClick() {
  if (!removeConfirm) {
    setRemoveConfirm(true);
    removeTimerRef.current = setTimeout(() => setRemoveConfirm(false), 3000);
    return;
  }
  clearTimeout(removeTimerRef.current!);
  handleRemove(); // existing function
}

// Button JSX:
<Button
  variant="ghost"
  size="sm"
  onClick={handleRemoveClick}
  disabled={isRemoving}
  className={`w-full transition-all ${
    removeConfirm
      ? "text-white bg-[#B85C3A] hover:bg-[#954928]"
      : "text-[#B85C3A] hover:text-[#B85C3A] hover:bg-red-50"
  }`}
>
  {isRemoving ? (
    <Loader2 className="w-4 h-4 animate-spin mr-2" />
  ) : (
    <Trash2 className="w-4 h-4 mr-2" />
  )}
  {removeConfirm ? "Tap again to confirm removal" : "Remove plant"}
</Button>
```

---

### Issue 3 — Error boundaries exist but are generic
**Severity:** 🔴 Critical  
**Files:** 
- `app/(app)/error.tsx` — exists, is functional ✓
- `app/(app)/garden/[gardenId]/error.tsx` — does NOT exist, needs creating
- `app/(app)/garden/[gardenId]/beds/[bedId]/error.tsx` — does NOT exist, needs creating
- `app/(app)/plants/error.tsx` — does NOT exist, needs creating
- `app/(app)/calendar/error.tsx` — does NOT exist, needs creating

**Problem:** The root `(app)/error.tsx` catches all unhandled errors across the app, but there are no route-segment error boundaries deeper in the tree. If the bed page throws (e.g., Prisma timeout), the entire app shell collapses, not just the bed section.

**Fix:** Create `error.tsx` files at each major route segment. They can be thin wrappers that import and use the same base component, but each should have context-aware messaging and a link back to the relevant parent (bed error → back to garden, garden error → back to dashboard).

**Implementation:** Create `error.tsx` alongside each major `page.tsx` with contextual messaging. Each file is a 20-line `"use client"` component. Template:

```tsx
// app/(app)/garden/[gardenId]/beds/[bedId]/error.tsx
"use client";
import Link from "next/link";
export default function BedError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="font-display text-2xl font-semibold text-[#1C1C1A] mb-2">
        Couldn't load this bed
      </p>
      <p className="text-sm text-[#6B6560] mb-8">Your plants are safe — this is a display error.</p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={reset} className="bg-[#2D5016] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#4A7C2F] transition-colors">
          Try again
        </button>
        <Link href="/garden" className="text-sm text-[#6B6560] hover:text-[#1C1C1A] underline">
          Back to garden
        </Link>
      </div>
    </div>
  );
}
```

---

## Phase 2 — Loading & Empty States
*Issues 1, 9, 19 — makes the app feel alive instead of broken during transitions*

---

### Issue 1 — No skeleton loading states
**Severity:** 🔴 Critical  
**Files to create:**
- `app/(app)/garden/[gardenId]/loading.tsx`
- `app/(app)/garden/[gardenId]/beds/[bedId]/loading.tsx`
- `app/(app)/plants/loading.tsx`
- `app/(app)/calendar/loading.tsx`
- `app/(app)/dashboard/loading.tsx`

**Problem:** The single `app/(app)/loading.tsx` shows a centered spinner for ALL app routes. It's better than nothing, but provides no context about what's loading. On slow connections, users see a bare spinner with no shape or structure.

**Note:** `components/ui/skeleton.tsx` already exists in the project — use it.

**Fix:** Each `loading.tsx` mirrors the shape of its `page.tsx` using `<Skeleton>` components so the layout doesn't shift when content loads.

**Garden page loading skeleton:**
```tsx
// app/(app)/garden/[gardenId]/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
export default function GardenLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-5">
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl mb-5" /> {/* weather strip */}
      <Skeleton className="w-full rounded-2xl" style={{ height: 320 }} /> {/* canvas */}
    </div>
  );
}
```

**Bed page loading skeleton:**
```tsx
// app/(app)/garden/[gardenId]/beds/[bedId]/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
export default function BedLoading() {
  return (
    <div className="w-full px-8 py-8">
      <div className="max-w-3xl mx-auto mb-6">
        <Skeleton className="h-6 w-64" />
      </div>
      <Skeleton className="h-10 w-80 mx-auto mb-6 rounded-lg" /> {/* toolbar */}
      <Skeleton className="w-full rounded-2xl mx-auto" style={{ height: 280 }} />
    </div>
  );
}
```

**Plants page loading skeleton:**
```tsx
// app/(app)/plants/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
export default function PlantsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Skeleton className="h-9 w-40 mb-2" />
      <Skeleton className="h-4 w-56 mb-6" />
      <Skeleton className="h-10 w-full rounded-lg mb-4" /> {/* search input */}
      <div className="flex gap-2 mb-6">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-[#E8E2D9]">
            <Skeleton className="aspect-[4/3] w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Issue 9 — Weather widget disappears silently when unavailable
**Severity:** 🟠 High  
**File:** `app/(app)/garden/[gardenId]/page.tsx` (line 136–176)

**Problem:** When `weatherCurrent` is null (no zip code, API failure, or cache miss), the weather strip simply doesn't render. Users with no zip code set get nothing — no explanation, no CTA to set one.

**Fix:** Show a placeholder strip when weather is unavailable, with different messaging based on whether the garden has a `locationZip` set.

```tsx
{/* Compact weather strip */}
{weatherCurrent ? (
  /* ... existing weather strip JSX ... */
) : (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border bg-[#F5F0E8] border-[#E8E2D9]">
    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/60">
      <Thermometer className="w-4 h-4 text-[#D8D3CB]" />
    </div>
    <p className="text-sm text-[#9E9890]">
      {garden.locationZip
        ? "Weather data unavailable right now."
        : <>
            Add your zip code in{" "}
            <Link href={`/garden/${gardenId}/settings`} className="text-[#6B8F47] hover:underline">
              garden settings
            </Link>{" "}
            for local weather and frost alerts.
          </>
      }
    </p>
  </div>
)}
```

---

### Issue 19 — Empty bed has no onboarding hint
**Severity:** 🟠 High  
**File:** `components/canvas/BedGrid.tsx`

**Problem:** A brand-new bed with no plants is just a grid of dark brown empty cells. There's no visual cue telling the user what to do. New users stall here.

**Fix:** Detect when all cells have no planting and show a gentle pulse animation on the first cell plus a hint tooltip near the top of the grid.

**Implementation:** Add to BedGrid, before the grid render:

```tsx
const isEmpty = cells.every((c) => !c.planting);

// Inside the grid viewport, above the wooden frame when empty:
{isEmpty && (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
    <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-md border border-[#E8E2D9] text-center max-w-[200px]">
      <p className="text-sm font-medium text-[#1C1C1A]">Tap any cell</p>
      <p className="text-xs text-[#9E9890] mt-0.5">to assign a plant</p>
    </div>
  </div>
)}
```

Additionally, add a CSS pulse animation to the first cell when empty:
```tsx
// On the first cell (index 0) when isEmpty:
className={`... ${isEmpty && index === 0 ? "animate-pulse" : ""}`}
```

---

## Phase 3 — Mobile UX Fixes
*Issues 2, 6 — critical on-device interaction failures*

---

### Issue 2 — Status buttons too small to tap on mobile
**Severity:** 🔴 Critical  
**File:** `components/canvas/CellDetail.tsx` (lines 104–118)

**Problem:** Status buttons are `text-xs px-2.5 py-1 rounded-full` — that's roughly 28px tall. Apple HIG minimum is 44px, Google Material is 48px. On mobile, users frequently tap the wrong status or miss entirely.

**Current:** `text-xs px-2.5 py-1 rounded-full`  
**Fix:** Replace the wrapping flex-wrap pills with a 2-column grid of taller buttons.

```tsx
<div className="grid grid-cols-2 gap-1.5">
  {STATUSES.map((s) => (
    <button
      key={s.value}
      onClick={() => handleStatusChange(s.value)}
      disabled={isUpdating}
      className={`text-xs px-3 py-2.5 rounded-lg font-medium transition-all text-left flex items-center gap-2 ${
        status === s.value
          ? `${s.color} ring-2 ring-offset-1 ring-current`
          : "bg-[#F5F0E8] text-[#6B6560] hover:bg-[#EDE8DF]"
      } disabled:opacity-50`}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.value === status ? "rgba(255,255,255,0.6)" : STATUSES.find(x=>x.value===s.value)?.color.split(" ")[0].replace("bg-","") }} />
      {s.label}
    </button>
  ))}
</div>
```

**Simpler version** (2-column grid, bigger hit area, still reads clean):
```tsx
<div className="grid grid-cols-2 gap-1.5">
  {STATUSES.map((s) => (
    <button
      key={s.value}
      onClick={() => handleStatusChange(s.value)}
      disabled={isUpdating}
      className={`text-xs px-3 py-2.5 rounded-lg font-medium transition-all ${
        status === s.value ? s.color : "bg-[#F5F0E8] text-[#6B6560] hover:bg-[#EDE8DF]"
      } disabled:opacity-50`}
    >
      {s.label}
    </button>
  ))}
</div>
```

---

### Issue 6 — Bed page header overflows on narrow mobile
**Severity:** 🟠 High  
**File:** `app/(app)/garden/[gardenId]/beds/[bedId]/page.tsx` (lines 159–184)

**Problem:** The breadcrumb + h1 + 4 chip pills all live in a single `flex flex-wrap` row. On 375px screens, this wraps into 3+ lines with poor visual hierarchy.

**Fix:** On mobile, collapse the chips into a secondary row and trim to only the two most essential (dimensions + zone). Show all chips on md+.

```tsx
<div className="flex items-center gap-2 flex-wrap min-h-[44px]">
  {/* Back link */}
  <Link href={`/garden/${gardenId}`} className="...">
    <ChevronLeft className="w-3.5 h-3.5 ..." />
    <span className="font-medium">{bed.garden.name}</span>
  </Link>
  <span className="text-[#D8D3CB] select-none">/</span>
  <h1 className="font-display text-xl font-semibold text-[#1C1C1A]">{bed.name}</h1>
</div>
{/* Chips on their own line — hidden individually on xs, visible sm+ */}
<div className="flex items-center gap-1.5 flex-wrap mt-1">
  <span className="inline-flex items-center text-xs font-medium bg-[#F5F0E8] text-[#6B6560] px-2 py-0.5 rounded-full border border-[#E8E2D9]">
    {bed.widthFt} × {bed.heightFt} ft
  </span>
  <span className="hidden sm:inline-flex items-center text-xs font-medium bg-[#F5F0E8] text-[#6B6560] px-2 py-0.5 rounded-full border border-[#E8E2D9]">
    {bed.gridCols} × {bed.gridRows} grid
  </span>
  <span className="hidden sm:inline-flex items-center text-xs font-medium bg-[#F5F0E8] text-[#6B6560] px-2 py-0.5 rounded-full border border-[#E8E2D9]">
    {bed.cellSizeIn}&quot; cells
  </span>
  {bed.garden.usdaZone && (
    <span className="inline-flex items-center text-xs font-medium bg-[#EEF6E7] text-[#4A7C2F] px-2 py-0.5 rounded-full border border-[#D4E8C4]">
      Zone {bed.garden.usdaZone}
    </span>
  )}
</div>
```

---

## Phase 4 — Visual Polish (Grid & Cells)
*Issues 4, 12, 13, 15, 16 — makes the core canvas more legible and professional*

---

### Issue 4 — Dense mode loses all plant identity
**Severity:** 🟠 High  
**File:** `components/canvas/BedGrid.tsx` (lines 264–265, 291–316)

**Problem:** When `cellPx < 36`, the plant name label is hidden. For small cells, users have no way to know what's planted without zooming in.

**Fix 1 — HTML title tooltip (free, immediate):** Add `title={planting?.plant.name ?? ""}` to every cell div.

**Fix 2 — Dense mode indicator (better):** Instead of showing nothing, show a 1-2 letter abbreviation in a small font:

```tsx
{/* In the cell div, replace the existing label block with: */}
{planting && !sunMode && (
  dense ? (
    // Compact: 1-2 char abbreviation + tooltip
    <span
      className="absolute inset-0 flex items-center justify-center text-white font-bold select-none pointer-events-none"
      style={{ fontSize: Math.max(8, cellPx * 0.28), textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
      title={planting.plant.name}
    >
      {planting.plant.name.slice(0, Math.floor(cellPx / 14)).toUpperCase()}
    </span>
  ) : (
    // Existing full label...
    <span className="..." style={{ fontSize: labelSize }}>
      {planting.plant.name}
    </span>
  )
)}
```

---

### Issue 12 — Companion warning badges are too small
**Severity:** 🟡 Medium  
**File:** `components/canvas/BedGrid.tsx` (lines 265–266, within cell render)

**Problem:** `badgePx = Math.max(5, Math.min(10, cellPx * 0.13))` produces ~9px dots at 70px cells — nearly invisible.

**Current:** `style={{ width: badgePx, height: badgePx }}`  
**Fix:** Enforce minimum 12px and position as a corner badge with a white ring:

```tsx
const badgePx = Math.max(12, Math.min(14, cellPx * 0.18));

// In the cell JSX, replace existing badge render:
{(hasHarmful || hasBeneficial) && (
  <div
    className="absolute top-1 right-1 rounded-full ring-[1.5px] ring-white shadow-sm"
    style={{
      width: badgePx,
      height: badgePx,
      background: hasHarmful ? "#B85C3A" : "#4A7C2F",
    }}
  />
)}
```

---

### Issue 13 — Legend shows all statuses even on empty bed
**Severity:** 🟡 Medium  
**File:** `components/canvas/BedGrid.tsx` (legend section, bottom of return)

**Problem:** The legend always shows all 9 items. On an empty bed this is visual noise. On a bed with only PLANNED plants, HARVESTED and FAILED add nothing.

**Fix:** Compute which statuses are actually present and filter the legend. Always show BENEFICIAL and CONFLICT if there are companion relations.

```tsx
// Derive present statuses:
const presentStatuses = new Set(cells.map((c) => c.planting?.status).filter(Boolean));
const hasWarnings = cells.some((c) => c.warnings.length > 0);

// In legend:
<div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 px-1">
  {Object.entries(STATUS_STYLES)
    .filter(([key]) => presentStatuses.has(key as PlantingStatus))
    .map(([key, val]) => (
      <span key={key} className="flex items-center gap-1 text-xs text-[#6B6560]">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: val.from }} />
        {val.label}
      </span>
    ))}
  {hasWarnings && <>
    <span className="flex items-center gap-1 text-xs text-[#6B6560]">
      <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#B85C3A]" /> Conflict
    </span>
    <span className="flex items-center gap-1 text-xs text-[#6B6560]">
      <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#4A7C2F]" /> Beneficial
    </span>
  </>}
  {presentStatuses.size === 0 && !hasWarnings && (
    <span className="text-xs text-[#9E9890]">Tap any cell to add a plant</span>
  )}
</div>
```

---

### Issue 15 — Rotation warnings and companion warnings look identical severity
**Severity:** 🟡 Medium  
**File:** `app/(app)/garden/[gardenId]/beds/[bedId]/page.tsx` (lines 188–200)

**Problem:** Both use `bg-yellow-50 border-yellow-200` yellow. But rotation is historical advisory (amber) and companion conflict is active problem (red). They should be visually differentiated.

**Current rotation warning:** yellow-50 background  
**Fix:** Keep rotation warnings amber (advisory), change them to a softer style that reads as "info, not urgent":

```tsx
{rotationWarnings.map((w, i) => (
  <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
    <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
    <div>
      <span className="text-amber-800">
        <span className="font-semibold">Rotation advisory: </span>
        {w.plantFamily} ({w.currentPlants.join(", ")}) grew here in {w.seasonName}.
      </span>
      <span className="text-amber-600 ml-1">Rotating plant families reduces disease risk.</span>
    </div>
  </div>
))}
```

Companion conflicts in `CellDetail.tsx` (lines 163–171) are already red — leave them as-is.

---

### Issue 16 — Smart layout results have no visual link to cells
**Severity:** 🟡 Medium  
**Files:** `components/canvas/SmartLayoutPanel.tsx` + `components/canvas/BedGrid.tsx`

**Problem:** The results list shows "row 0, col 0 → Tomatoes" but hovering a result card does nothing on the grid. Users can't visually match the list to the actual cells.

**Fix:** Use a shared hover state. Add an `onHoverAssignment` callback from BedGrid → SmartLayoutPanel, and highlight the target cell when hovering a result row.

**In BedGrid.tsx:** Add prop and state:
```tsx
const [hoveredAssignment, setHoveredAssignment] = useState<{row:number;col:number} | null>(null);
// Pass to SmartLayoutPanel: onHoverAssignment={setHoveredAssignment}

// In cell render, add hover highlight:
const isHovered = hoveredAssignment?.row === cell.row && hoveredAssignment?.col === cell.col;
// Add to cell style: boxShadow: isHovered ? "inset 0 0 0 3px #C4790A" : existing
```

**In SmartLayoutPanel.tsx:** Add `onHoverAssignment` prop, call on mouse enter/leave of result rows:
```tsx
<div
  key={i}
  onMouseEnter={() => onHoverAssignment?.({ row: a.row, col: a.col })}
  onMouseLeave={() => onHoverAssignment?.(null)}
  className="..."
>
```

---

## Phase 5 — Navigation & Page-Level Polish
*Issues 8, 18, 7, 28, 25 — elevates the app from good to polished*

---

### Issue 8 — No page transitions
**Severity:** 🟠 High  
**File:** `app/layout.tsx`

**Problem:** Navigating between pages is an instant cut. For a visually rich app this reads as unpolished.

**Fix:** Enable the Next.js 15 View Transitions API. This is a one-line addition to the root layout and gives automatic cross-fade transitions between page navigations with zero additional code.

```tsx
// app/layout.tsx — add to <html> tag:
<html lang="en" {...viewport}>
```

**In next.config.js / next.config.ts:**
```js
experimental: {
  viewTransition: true,
}
```

This enables the browser-native View Transitions API. For individual elements that should animate specifically (e.g., bed name, garden header), add `style={{ viewTransitionName: "bed-title" }}` inline.

**Note:** View Transitions is progressive — browsers without support fall back to instant navigation. No JS required.

---

### Issue 18 — No season selector on the bed page
**Severity:** 🟡 Medium  
**File:** `app/(app)/garden/[gardenId]/beds/[bedId]/page.tsx`

**Problem:** The bed page is hardcoded to the active season via `where: { season: { isActive: true } }`. There's no UI to view a historical season's plantings on a bed. Users can see season history in the seasons page but can't drill into a specific bed's history.

**Fix:** Add a compact season selector pill to the bed page header. When a non-active season is selected, pass its ID as a search param and adjust the DB query.

**Step 1 — `page.tsx`:** Read `searchParams.seasonId`, fall back to the active season.
```tsx
// In page.tsx params:
const { gardenId, bedId } = await params;
const { seasonId: selectedSeasonId } = await searchParams; // add searchParams prop

// Query seasons:
const allSeasons = await db.season.findMany({ where: { gardenId }, orderBy: { startDate: "desc" } });
const viewingSeason = allSeasons.find(s => s.id === selectedSeasonId) ?? allSeasons.find(s => s.isActive);

// Adjust plantings query:
plantings: { where: { seasonId: viewingSeason?.id }, ... }
```

**Step 2 — Header JSX:** Add a `<SeasonSelector>` or simple select dropdown before the chips.

```tsx
{allSeasons.length > 1 && (
  <SeasonSwitcher
    seasons={allSeasons}
    currentSeasonId={viewingSeason?.id}
    gardenId={gardenId}
    bedId={bedId}
  />
)}
```

**SeasonSwitcher** (new small client component): renders as a pill dropdown that pushes `?seasonId=xxx` to the URL via `router.push`.

---

### Issue 7 — Bottom nav active state is too subtle
**Severity:** 🟠 High  
**File:** `components/layout/BottomNav.tsx` (lines 28–50)

**Problem:** Active state is just `bg-[#EEF6E7]` (very light green circle) behind the icon. The label turns green but at `text-[10px]` it's hard to notice. Garden tab uses a Sprout icon which doesn't map to "my garden" intuitively.

**Fix 1 — Stronger active indicator:**
```tsx
// Change active icon container from bg-[#EEF6E7] to bg-[#2D5016]:
<div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
  isActive
    ? "bg-[#2D5016] shadow-sm"
    : "bg-transparent hover:bg-[#F5F0E8]"
}`}>
  <Icon className={`w-5 h-5 transition-colors ${
    isActive ? "text-white" : "text-[#9E9890]"
  }`} strokeWidth={isActive ? 2.5 : 2} />
</div>
```

**Fix 2 — Better Garden label:** Rename "Garden" to "My Garden" or change the icon from `Sprout` to `LayoutGrid` or `Map` which better communicates "view/layout" rather than a generic plant.

```tsx
{ href: "/garden", label: "Garden", icon: LayoutGrid },
```

---

### Issue 28 — No per-page `<title>` tags
**Severity:** 🔵 Low  
**Files:** All `page.tsx` files

**Problem:** The root layout sets `title: "Bare Root — Visual Garden Planner"` for every page. A user with 5 tabs open sees "Bare Root" × 5 with no differentiation. Affects PWA window labels too.

**Fix:** Add `generateMetadata()` to the main page files.

```tsx
// app/(app)/garden/[gardenId]/beds/[bedId]/page.tsx
export async function generateMetadata({ params }: { params: Promise<{gardenId: string; bedId: string}> }) {
  const { bedId } = await params;
  const bed = await db.bed.findUnique({ where: { id: bedId }, select: { name: true, garden: { select: { name: true } } } });
  return {
    title: bed ? `${bed.name} — ${bed.garden.name} | Bare Root` : "Bare Root",
  };
}

// app/(app)/garden/[gardenId]/page.tsx
export async function generateMetadata({ params }: ...) {
  const garden = await db.garden.findUnique({ where: { id: gardenId }, select: { name: true } });
  return { title: garden ? `${garden.name} | Bare Root` : "Bare Root" };
}

// app/(app)/plants/[plantId]/page.tsx
export async function generateMetadata({ params }: ...) {
  return { title: `${plant.name} | Bare Root Plant Library` };
}
```

---

### Issue 25 — Trial banner dismiss doesn't persist
**Severity:** 🔵 Low  
**File:** `components/layout/TrialBanner.tsx`

**Problem:** `const [dismissed, setDismissed] = useState(false)` — dismiss only lasts until page reload. Power users see the banner on every page load even after dismissing.

**Fix:** Persist to localStorage with a timestamp. Re-show after 24h.

```tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const DISMISS_KEY = "bareroot_trial_banner_dismissed";

export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (!stored) { setVisible(true); return; }
    const dismissedAt = Number(stored);
    const hoursAgo = (Date.now() - dismissedAt) / (1000 * 60 * 60);
    if (hoursAgo > 24) setVisible(true);
  }, []);

  if (!visible) return null;

  const urgent = daysLeft <= 1;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm ${urgent ? "bg-[#B85C3A]" : "bg-[#C4790A]"} text-white`}>
      <p className="flex-1 text-center">
        {daysLeft === 0 ? "Your Pro trial ends today." : `Your Pro trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`}{" "}
        <Link href="/settings/billing" className="underline font-medium">Upgrade now →</Link>
      </p>
      <button onClick={handleDismiss} aria-label="Dismiss" className="shrink-0 opacity-80 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
```

---

## Phase 6 — Labeling & Information Design
*Issues 14, 22, 23, 24, 29 — copy and label improvements that require no design work*

---

### Issue 14 — Rotation warnings aren't actionable
**Severity:** 🟡 Medium  
**File:** `app/(app)/garden/[gardenId]/beds/[bedId]/page.tsx` (rotation warning strip)

**Problem:** "Rotation: Solanaceae (tomatoes/peppers) was here in Spring 2025." — many users don't know what rotation means or why it matters.

**Fix:** Append a short plain-English explanation inline. No tooltip needed — just more copy.

```tsx
<span className="text-amber-800">
  <span className="font-semibold text-amber-900">Rotation: </span>
  {w.plantFamily} ({w.currentPlants.join(", ")}) grew here in {w.seasonName}.{" "}
  <span className="text-amber-600">Consider a different plant family to prevent disease buildup.</span>
</span>
```

---

### Issue 22 — Plant search shows no result count
**Severity:** 🔵 Low  
**File:** `components/plants/PlantSearch.tsx` (line 141–151)

**Problem:** Search results appear with no count. Users don't know if they got 2 results or 200.

**Fix:** Add a subtle count line between the search input area and the results grid.

```tsx
{/* Above the results grid, below category pills: */}
{plants.length > 0 && query && (
  <p className="text-xs text-[#9E9890] mb-3">
    {plants.length} result{plants.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
  </p>
)}
```

---

### Issue 23 — Cell size chip is not intuitive
**Severity:** 🔵 Low  
**File:** `app/(app)/garden/[gardenId]/beds/[bedId]/page.tsx` (line 177)

**Problem:** `6" cells` means nothing to most users. What they care about is how many plants fit per square foot.

**Fix:** Add the plants-per-sqft derived value inline:

```tsx
<span className="inline-flex items-center text-xs font-medium bg-[#F5F0E8] text-[#6B6560] px-2 py-0.5 rounded-full border border-[#E8E2D9]">
  {bed.cellSizeIn}&quot; cells
  {bed.cellSizeIn < 12 && (
    <span className="ml-1 text-[#9E9890]">
      ({Math.round((12 / bed.cellSizeIn) ** 2)}/sq ft)
    </span>
  )}
</span>
```

---

### Issue 24 — Pro-gated features don't hint at being Pro
**Severity:** 🟡 Medium  
**File:** `components/canvas/BedGrid.tsx` (lines 209–217, Plan bed button)

**Problem:** The "Plan bed" button looks identical for Free and Pro users. Free users click it, enter the panel, then see the upgrade CTA. The paywall is inside the feature, not before it.

**Fix:** For Free users, add a small Pro badge to the button before they click:

```tsx
<button
  onClick={() => setPanel(panel.type === "smart-layout" ? { type: "none" } : { type: "smart-layout" })}
  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ml-auto ${
    panel.type === "smart-layout"
      ? "bg-[#2D5016] text-white shadow-sm"
      : "bg-[#F5F0E8] text-[#6B6560] hover:bg-[#EDE8DF] hover:text-[#1C1C1A]"
  }`}
>
  <Sparkles className="w-4 h-4" />
  Plan bed
  {!isPro && (
    <span className="text-[9px] font-semibold bg-[#C4790A] text-white px-1.5 py-0.5 rounded-full ml-0.5">
      PRO
    </span>
  )}
</button>
```

---

### Issue 29 — Onboarding has no "progress saved" indicator
**Severity:** 🔵 Low  
**File:** `components/wizard/WizardShell.tsx`

**Problem:** If a user closes the browser mid-wizard, they'll resume at the correct step on return — but they don't know this. Many will assume they have to start over and abandon.

**Fix:** After step 1 completes, show a subtle persistent note below the navigation buttons:

```tsx
{currentStep > 0 && (
  <p className="text-center text-xs text-[#9E9890] mt-3">
    ✓ Your progress is saved — you can continue anytime.
  </p>
)}
```

---

## Phase 7 — Hover States & Micro-Interactions
*Issues 27, 17, 26, 11, 10 — refinement pass that elevates perceived quality*

---

### Issue 27 — Plant cards don't communicate they're clickable
**Severity:** 🔵 Low  
**File:** `components/plants/PlantSearch.tsx` (line 158–161)

**Problem:** The plant card has `hover:border-[#6B8F47] hover:shadow-sm` but no cursor change, no color change on the image, and the name color change is subtle. The whole card should feel obviously interactive.

**Current:** `className="bg-white rounded-xl overflow-hidden border border-[#E8E2D9] hover:border-[#6B8F47] hover:shadow-sm transition-all group flex flex-col"`  
**Fix:** Add `cursor-pointer` and a subtle image scale effect:

```tsx
className="bg-white rounded-xl overflow-hidden border border-[#E8E2D9] hover:border-[#6B8F47] hover:shadow-md transition-all group flex flex-col cursor-pointer"

// On the image container, add:
className="aspect-[4/3] relative bg-[#F5F0E8] overflow-hidden"
// On the Image element:
className="object-cover transition-transform duration-300 group-hover:scale-105"
```

---

### Issue 17 — Zoom controls have no keyboard shortcuts
**Severity:** 🔵 Low  
**File:** `components/canvas/BedGrid.tsx`

**Problem:** `+` / `-` are universal zoom shortcuts. The zoom buttons have no `title` hint and no keyboard listener.

**Fix — Add `title` props (immediate):**
```tsx
<button onClick={() => setZoom(z => Math.min(4, z * 1.35))} title="Zoom in (+)" className={btnBase}>
  <ZoomIn className="w-4 h-4" />
</button>
<button onClick={() => setZoom(z => Math.max(0.25, z / 1.35))} title="Zoom out (−)" className={btnBase}>
  <ZoomOut className="w-4 h-4" />
</button>
```

**Fix — Add keyboard listener (full fix):**
```tsx
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return; // don't fire while typing
    if (e.key === "+" || e.key === "=") setZoom(z => Math.min(4, z * 1.35));
    if (e.key === "-") setZoom(z => Math.max(0.25, z / 1.35));
    if (e.key === "0") setZoom(1);
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

---

### Issue 26 — Notification bell empty state appears with no animation
**Severity:** 🔵 Low  
**File:** `components/layout/NotificationBell.tsx`

**Problem:** The "You're all caught up" state snaps in when the last notification is dismissed, with no transition.

**Fix:** Add a short fade-in transition using a key-based remount:

```tsx
{localReminders.length === 0 ? (
  <div key="empty" className="py-8 text-center animate-in fade-in duration-300">
    <Leaf className="w-8 h-8 text-[#D8D3CB] mx-auto mb-2" />
    <p className="text-sm text-[#6B6560]">You&apos;re all caught up</p>
    <p className="text-xs text-[#9E9890] mt-0.5">No pending reminders</p>
  </div>
) : (
  /* reminder list */
)}
```

Note: `animate-in fade-in` requires `tailwindcss-animate` which is already installed via shadcn/ui.

---

### Issue 11 — Font weight inconsistency
**Severity:** 🟡 Medium  
**Files:** Multiple pages

**Problem:** `font-display` class (which applies `font-family: var(--font-fraunces)`) is inconsistently applied. Some section headings use `font-display text-xl font-semibold` correctly; others use plain `text-xl font-semibold` falling back to Inter.

**Audit all heading uses and fix:**
- `app/(app)/garden/[gardenId]/seasons/page.tsx` — check all `<h2>` and section headings
- `app/(app)/calendar/page.tsx` — month headers in timeline should use `font-display`
- `app/(app)/plants/[plantId]/page.tsx` — plant name heading
- `components/canvas/CellDetail.tsx` line 89 — `font-display` already correct ✓
- `components/canvas/SmartLayoutPanel.tsx` — panel heading should use `font-display`

**Rule:** Any standalone heading (`h1`, `h2`, proper section title) → `font-display`. Inline labels, chips, metadata → Inter (no class, it's the default).

---

### Issue 10 — Inconsistent spacing rhythm
**Severity:** 🟡 Medium  
**Files:** Multiple pages

**Problem:** The app mixes `mb-6`, `mt-4`, `mt-2`, `space-y-4`, `gap-6` without a clear system. Some sections use `px-4`, others `px-8`. This isn't immediately obvious but contributes to pages feeling slightly "off" next to each other.

**Standard to enforce going forward:**
- Page outer padding: `px-4 md:px-8` (responsive, not fixed `px-8`)
- Section spacing: `mb-6` between major sections, `mb-4` between subsections
- Max-width: `max-w-3xl mx-auto` for content, `max-w-2xl mx-auto` for text-heavy pages (calendar, settings)
- Card internal padding: `p-4` standard, `p-5` for prominent cards
- Inline gap between chips/pills: `gap-1.5`
- Inline gap between larger elements: `gap-3` or `gap-4`

**Files to audit and normalize:**
- `app/(app)/garden/[gardenId]/page.tsx` — check `mb-5`, `mb-6`, `mt-4` usage
- `app/(app)/calendar/page.tsx` — uses `space-y-8` in some sections and `gap-6` in others
- `app/(app)/settings/page.tsx` — spacing of settings rows

---

## Phase 8 — Accessibility
*Issues 30, and hardening throughout*

---

### Issue 30 — 3D garden canvas has no ARIA
**Severity:** 🟠 High  
**File:** `components/canvas/GardenOverview.tsx`

**Problem:** The SVG canvas is the core of the app but is completely inaccessible. Screen readers see a nameless SVG with click handlers. Keyboard users can't navigate to beds at all.

**Fix — Two-layer approach:**

**Layer 1 — Semantic SVG:**
```tsx
<svg
  role="application"
  aria-label={`Garden overview for ${garden.name}. ${beds.length} bed${beds.length !== 1 ? "s" : ""}. Use arrow keys to navigate between beds.`}
  // ...
>
  {beds.map(bed => (
    <g
      key={bed.id}
      role="button"
      tabIndex={0}
      aria-label={`${bed.name}: ${bed.plantCount} plant${bed.plantCount !== 1 ? "s" : ""}. ${bed.widthFt}×${bed.heightFt} ft.`}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/garden/${gardenId}/beds/${bed.id}`)}
      // ...
    >
  ))}
</svg>
```

**Layer 2 — Screen reader fallback list** (visually hidden):
```tsx
<ul className="sr-only">
  {beds.map(bed => (
    <li key={bed.id}>
      <Link href={`/garden/${garden.id}/beds/${bed.id}`}>
        {bed.name}: {bed.plantCount} plants, {bed.widthFt}×{bed.heightFt} ft
      </Link>
    </li>
  ))}
</ul>
```

---

## Phase 9 — Image & Visual Quality
*Issues 5, 21 — plant images and extreme-case robustness*

---

### Issue 5 — Plant image fallbacks are crude
**Severity:** 🟠 High  
**Files:** `components/plants/PlantSearch.tsx` (line 178–186), `components/canvas/PlantPicker.tsx`, any other plant image render

**Problem:** The fallback for missing plant images is a flat-color box with a `Leaf` icon at 50% opacity. For a premium garden planning app, this placeholder is underwhelming and makes the library look sparse.

**Fix:** Replace the flat color fallback with a subtle pattern + category-appropriate content:

```tsx
{/* Richer fallback: subtle cross-hatch pattern + category initial */}
<div
  className="aspect-[4/3] flex items-center justify-center relative overflow-hidden"
  style={{ background: style.bg }}
>
  {/* Subtle dot pattern */}
  <div
    className="absolute inset-0 opacity-20"
    style={{
      backgroundImage: `radial-gradient(circle, ${style.accent} 1px, transparent 1px)`,
      backgroundSize: "16px 16px",
    }}
  />
  {/* Centered category initial in display font */}
  <span
    className="relative font-display text-4xl font-semibold select-none"
    style={{ color: style.accent, opacity: 0.35 }}
  >
    {plant.name.slice(0, 1).toUpperCase()}
  </span>
</div>
```

---

### Issue 21 — No fallback for extremely dense garden overviews
**Severity:** 🔵 Low  
**File:** `components/canvas/GardenOverview.tsx`

**Problem:** A garden with 20+ small beds would render a visually unreadable SVG. Bed labels would overlap and plant dots would be noise.

**Fix:** Enforce minimum rendered bed size. If a bed would render smaller than ~40×40px on screen, suppress the label text and plant dots. Already partially handled by the existing scale logic, but add an explicit threshold:

```tsx
const bedScreenW = bed.widthFt * scale;
const bedScreenH = bed.heightFt * scale;
const tooSmall = bedScreenW < 40 || bedScreenH < 40;

// In bed render:
{!tooSmall && (
  <text className="bed-label">...</text>
)}
{!tooSmall && plantDots.map(...)}
```

---

## Complete Issue → Phase Map

| # | Issue | Phase | Severity |
|---|-------|-------|----------|
| 20 | No undo for remove | 1 | 🔴 |
| 3 | Missing error boundaries | 1 | 🔴 |
| 1 | No skeleton loading | 2 | 🔴 |
| 9 | Weather widget silent failure | 2 | 🟠 |
| 19 | Empty bed has no hint | 2 | 🟠 |
| 2 | Status buttons too small | 3 | 🔴 |
| 6 | Header overflows on mobile | 3 | 🟠 |
| 4 | Dense mode loses identity | 4 | 🟠 |
| 12 | Companion badges too small | 4 | 🟡 |
| 13 | Legend shows everything | 4 | 🟡 |
| 15 | Rotation vs companion severity | 4 | 🟡 |
| 16 | Smart layout no cell highlight | 4 | 🟡 |
| 8 | No page transitions | 5 | 🟠 |
| 18 | No season selector on bed page | 5 | 🟡 |
| 7 | Bottom nav active too subtle | 5 | 🟠 |
| 28 | No per-page titles | 5 | 🔵 |
| 25 | Trial banner dismiss ephemeral | 5 | 🔵 |
| 14 | Rotation warnings not actionable | 6 | 🟡 |
| 22 | Search has no result count | 6 | 🔵 |
| 23 | Cell size chip not intuitive | 6 | 🔵 |
| 24 | Pro features not hinted | 6 | 🟡 |
| 29 | Onboarding no save indicator | 6 | 🔵 |
| 27 | Plant card hover weak | 7 | 🔵 |
| 17 | No zoom keyboard shortcuts | 7 | 🔵 |
| 26 | Bell empty state no animation | 7 | 🔵 |
| 11 | Font weight inconsistency | 7 | 🟡 |
| 10 | Inconsistent spacing | 7 | 🟡 |
| 30 | Canvas has no ARIA | 8 | 🟠 |
| 5 | Plant image fallbacks crude | 9 | 🟠 |
| 21 | Dense SVG no fallback | 9 | 🔵 |

---

## Effort Estimate

| Phase | Issues | Estimated Hours |
|-------|--------|-----------------|
| 1 — Safety | 2 | 1.5h |
| 2 — Loading/Empty | 3 | 2.5h |
| 3 — Mobile UX | 2 | 2h |
| 4 — Canvas Polish | 5 | 3h |
| 5 — Navigation | 5 | 3.5h |
| 6 — Labels & Copy | 5 | 1.5h |
| 7 — Hover/Micro | 5 | 2h |
| 8 — Accessibility | 1 | 2h |
| 9 — Images | 2 | 1.5h |
| **Total** | **30** | **~19h** |

Build order: 1 → 2 → 3 → 4, then 5–9 can be tackled in any order.

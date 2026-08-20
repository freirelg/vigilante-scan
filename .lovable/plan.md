---
name: Traffic Chart Visual Improvement
description: Plan to enhance the data traffic chart with better aesthetics, real-time feel, and information density.
type: design
---

# Plan: Enhanced Visual Data Traffic Chart

Improve the `LiveTrafficChart` component in `src/components/LiveTrafficChart.tsx` to align with the "Freirenet-SecureGuard" cybersecurity aesthetic.

## Proposed Changes

### 1. Aesthetic Enhancements
- Replace the standard Recharts Tooltip with `ChartTooltip` and `ChartTooltipContent` from shadcn/ui for a more integrated look.
- Use `ChartContainer` to handle theme-aware colors and semantic tokens.
- Refine the linear gradients to be more subtle and professional.
- Add a "Scanning" glow effect to the chart line during active peaks.
- Increase information density with a "Traffic Pulse" indicator.

### 2. Layout & UI
- Redesign the stats grid at the bottom with better spacing and semantic colors.
- Add a "Cybersecurity Terminal" feel using mono fonts and grid lines.
- Improve the legend/labels to be more intuitive.

### 3. Real-time Feel
- Increase the sampling frequency or add interpolation for smoother transitions.
- Ensure the "Peak" and "Total" values are highlighted with distinct icons.

## Technical Details
- Use `src/components/ui/chart.tsx` components.
- Maintain existing real-time logic (PerformanceObserver + Monkey-patch).
- Ensure high performance on mobile devices.

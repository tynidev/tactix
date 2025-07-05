# Tactix Design System

## Overview

The Tactix Design System provides a comprehensive set of design tokens, utility classes, and component styles to ensure consistency across the application.

## Getting Started

The design system is automatically imported via `index.css`. All variables and utility classes are available globally.

## Design Tokens

### Colors

#### Primary Colors
- `--primary-50` to `--primary-900`: Main brand colors (blue gradient)
- `--neutral-50` to `--neutral-900`: Gray scale colors
- `--success-50` to `--success-900`: Success states (green)
- `--error-50` to `--error-900`: Error states (red)
- `--warning-50` to `--warning-900`: Warning states (yellow/orange)

#### Semantic Colors
- Drawing colors: `--color1-color`, `--color2-color`, `--color3-color`
- Overlay colors: `--white-semi`, `--black-overlay`, etc.

### Typography

#### Font Families
- `--font-family`: Primary system font stack
- `--font-family-mono`: Monospace font for code

#### Font Sizes
- `--text-xs` (0.75rem) to `--text-5xl` (3rem)

#### Font Weights
- `--font-normal` (400)
- `--font-medium` (500)
- `--font-semibold` (600)
- `--font-bold` (700)

### Spacing
- `--space-1` (0.25rem) to `--space-20` (5rem)

### Border Radius
- `--radius-sm` to `--radius-3xl`, plus `--radius-full`

### Shadows
- `--shadow-sm` to `--shadow-2xl`

### Z-Index
- `--z-dropdown` (1000) to `--z-tooltip` (1070)

## Component Classes

### Buttons

#### Base Button
```tsx
<button className="btn btn-primary btn-md">Click me</button>
```

#### Button Variants
- `btn-primary`: Primary brand button
- `btn-secondary`: Secondary gray button
- `btn-success`: Green success button
- `btn-error`: Red error/danger button
- `btn-ghost`: Minimal button
- `btn-link`: Link-style button

#### Button Sizes
- `btn-sm`: Small button
- `btn-md`: Medium button (default)
- `btn-lg`: Large button

#### Special Buttons
- `btn-circular`: Round button for icons

### Cards

```tsx
<div className="card">
  <div className="card-header">
    <h3>Card Title</h3>
  </div>
  <div className="card-body">
    <p>Card content</p>
  </div>
  <div className="card-footer">
    <button className="btn btn-primary">Action</button>
  </div>
</div>
```

### Form Elements

#### Form Groups
```tsx
<div className="form-group">
  <label className="form-label">Email</label>
  <input type="email" className="form-input" />
</div>
```

#### Form Input States
- `form-input`: Default input
- `form-input error`: Error state input

### Alerts/Messages

```tsx
<div className="alert alert-success">Success message</div>
<div className="alert alert-error">Error message</div>
<div className="alert alert-warning">Warning message</div>
```

### Tabs

```tsx
<div className="tabs">
  <button className="tab active">Tab 1</button>
  <button className="tab">Tab 2</button>
</div>
```

## Utility Classes

### Layout
- `flex`, `inline-flex`, `grid`
- `items-center`, `items-start`, `items-end`
- `justify-center`, `justify-between`, `justify-start`, `justify-end`
- `flex-col`, `flex-row`, `flex-1`

### Spacing
- `gap-1` to `gap-8`: Flexbox/grid gaps
- `p-1` to `p-10`: Padding
- `px-2` to `px-6`: Horizontal padding
- `py-2` to `py-6`: Vertical padding
- `mb-2` to `mb-8`: Margin bottom

### Typography
- `text-xs` to `text-3xl`: Font sizes
- `font-normal`, `font-medium`, `font-semibold`, `font-bold`: Font weights
- `text-center`, `text-left`, `text-right`: Text alignment
- `text-neutral-500`, `text-primary-600`, etc.: Text colors

### Visual
- `rounded-sm` to `rounded-full`: Border radius
- `shadow-sm` to `shadow-2xl`: Box shadows
- `bg-white`, `bg-neutral-50`, etc.: Background colors

### Grid Layouts
- `grid-auto-fit`: Auto-fit grid with 300px minimum columns
- `grid-auto-fill`: Auto-fill grid with 300px minimum columns

## Best Practices

### 1. Use Design Tokens
Always use CSS custom properties instead of hardcoded values:
```css
/* Good */
color: var(--primary-600);
padding: var(--space-4);

/* Bad */
color: #5a67d8;
padding: 1rem;
```

### 2. Prefer Utility Classes
Use utility classes for common styling patterns:
```tsx
/* Good */
<div className="flex items-center gap-4 p-6">

/* Bad */
<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
```

### 3. Component Classes for Complex Patterns
Use component classes for complex, reusable patterns:
```tsx
/* Good */
<button className="btn btn-primary btn-lg">

/* Bad */
<button className="bg-primary-500 text-white px-6 py-4 rounded-xl font-semibold">
```

### 4. Responsive Design
The design system includes responsive utilities and breakpoints:
- Mobile-first approach
- Automatic scaling on smaller screens
- Safe area handling for mobile devices

### 5. Accessibility
- Focus states are built into all interactive components
- Color contrast ratios meet WCAG standards
- Semantic HTML is encouraged

## Migration Guide

When refactoring existing components:

1. Replace hardcoded colors with design tokens
2. Replace custom button styles with `btn` classes
3. Replace custom spacing with utility classes
4. Use `alert` classes for status messages
5. Apply `card` classes for content containers

## Examples

### Before (Custom CSS)
```css
.my-button {
  background: #667eea;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
}
```

### After (Design System)
```tsx
<button className="btn btn-primary btn-md">My Button</button>
```

This approach ensures consistency, reduces CSS bloat, and makes the codebase more maintainable.

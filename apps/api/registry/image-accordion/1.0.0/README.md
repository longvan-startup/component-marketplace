# Image Accordion 1.0.0

Copy `image-accordion.tsx` and `image-accordion.css` into the same directory. The project needs React 19 and a build tool supporting CSS imports from TSX files. Provide your own photos and give the gallery’s container a height.

```tsx
import { ImageAccordion } from './image-accordion'

export function PhotoGallery() {
  return (
    <div style={{ height: 400 }}>
      <ImageAccordion
        items={[
          { name: 'First photo', src: '/images/first.jpg', alt: 'Describe the first photo' },
          { name: 'Second photo', src: '/images/second.jpg', alt: 'Describe the second photo' },
        ]}
      />
    </div>
  )
}
```

| Prop | Default | Behavior |
| --- | --- | --- |
| `items` | Required | Each item has `name`, `src`, `alt`, and an optional stable `id`. |
| `open` | `50` | Active panel target width in percent, clamped to 20–80. |
| `reach` | `35` | How much neighboring panels widen, clamped to 0–100. |
| `bounce` | `10` | Overshoot amount, clamped to 0–20. |
| `gap` | `8` | Space between panels in pixels, clamped to 0–20. |
| `prompt`, `countLabel` | English | Labels for the resting gallery. |

Hover to explore, click or tap to pin, and use the arrow keys, Home or End to move across panels. Reduced-motion users get immediate panel sizing. The file picker lives in the Luva UI playground. In a consumer project, pass new `items` to replace photos.

Licensed under MIT. Interaction reference [Bencho Image Accordion](https://bencho.dev/blocks/image-accordion).

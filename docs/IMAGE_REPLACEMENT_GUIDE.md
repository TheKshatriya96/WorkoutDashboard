# Exercise image replacement guide

## The only folders you normally edit

```text
assets/images/exercises/monday/
assets/images/exercises/tuesday/
assets/images/exercises/thursday/
assets/images/exercises/saturday/
```

Every exercise uses two files:

- `-a.png` = starting position
- `-b.png` = ending position

Open `image-chart.html` for the complete visual chart and exact filenames.

## Recommended clipping format

- File type: PNG
- Recommended canvas: 1600 × 900 px
- Keep the full body and equipment visible
- Leave 5–10% empty space around the body
- Use one pose per image
- Do not include A/B labels; the dashboard adds those itself
- Avoid placing the body against the extreme top, bottom or side edges

The image may be another size, but using one consistent 16:9 canvas will make every card feel uniform.

## Replacement process

Example: correcting Monday's Band-resisted push-up starting pose.

1. Export your corrected clip as PNG.
2. Rename it exactly to `01-band-resisted-push-up-a.png`.
3. Place it in `assets/images/exercises/monday/`.
4. Approve the Windows overwrite prompt.
5. Refresh `index.html` with `Ctrl + F5` if the old image is cached.

Do not alter `data.js` when you are only replacing an image.

## Original source sheets

The four uncropped generated sheets are kept in:

`assets/images/source-sheets/`

They are reference material only. The dashboard does not load them. You can crop from them or replace the pose images with your own better references.

## If you use JPG or WebP instead

The current dashboard expects `.png`. Either export PNG, or change the corresponding image path in `assets/js/data.js`. Renaming a JPG file to `.png` does not convert it.

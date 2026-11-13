# Image Grid

Arranges pictures in a configurable grid and downloads the result as one
PNG. Everything happens in the browser; images are never uploaded.

- **Grid size:** the Rows and Columns buttons choose 1–8 each (default
  2×4). The grid holds rows × columns images; images that no longer fit
  after shrinking the grid are kept and come back when it grows again.
- **Adding images:** "Add images…" replaces the current images, dropping
  files onto the grid adds to them.
- **Reordering:** drag an image onto another, tap or click two images one
  after the other, or use the keyboard (Tab to the grid, arrow keys to
  choose a cell, Space or Enter to pick up an image and again to swap,
  Escape to cancel).
- **Download:** the PNG uses the original resolution, with each cell as
  large as the largest image. Empty space is transparent. If the result
  would exceed the browser's canvas size limit, it is scaled down and a
  notice says so.

The page aims for WCAG 2.2 AAA (see [Accessibility](#accessibility)).

## Usage

Throw the `./public` folder into some webserver.

Github is configured to serve it under <https://toabi.github.io/imagegrid/>.

### Test it locally

The easiest way to try it out on your machine is to start a simple web
server inside the `./public` folder:

```sh
cd public
python3 -m http.server --bind 0.0.0.0 8888
```

Then open <http://localhost:8888/> in your browser. The `--bind 0.0.0.0`
option also makes it reachable from other devices on your network.

The page uses ES modules, so it has to be served over HTTP; opening
`index.html` directly from disk (`file://`) won't work.

## Code structure

Everything lives in `./public`, with no build step:

| File        | Responsibility                                                     |
|-------------|--------------------------------------------------------------------|
| `main.js`   | UI wiring (pointer, keyboard, files), notices, `render()`          |
| `state.js`  | App state and the rules for changing it (pure, unit-tested)        |
| `layout.js` | Pure layout maths (cell rects, fitting, hit-testing, size limits)  |
| `render.js` | Drawing the grid onto a canvas (used by preview and export)        |
| `export.js` | Building and saving the full-resolution combined PNG               |
| `images.js` | Loading user files into images                                     |

Unit tests live in `./tests`; `package.json` only exists to run them.

Every interaction changes the state through a transition in `state.js` and
then calls `render()` (or just `draw()` while a drag moves). An image's
place in the grid is its index in `state.images`, so reordering is just
swapping two array entries. Any transition that changes the images or the
grid size ends a running drag and drops a picked-up image, since both refer
to images by index.

The preview and the export share `layout.js`, so the downloaded image has
the same layout as the preview.

### Accessibility

The page targets WCAG 2.2 AAA. Things to keep when changing it:

- Colours come from the tokens at the top of `index.html`: text pairs are
  at least 7:1, borders, focus ring and markers at least 3:1, in both themes.
- Interactive targets are at least 44×44 px (`--target-size`, and
  `MIN_CELL_SIZE` for grid cells).
- Everything works with the keyboard; reordering also works by tapping two
  images. Changes are announced through the `#announcer` live region.
- Notices stay until dismissed; nothing depends on a timeout.

### Tests

The layout maths, the state rules and the file-type check have unit tests
that run with Node's built-in test runner (Node 20+, no dependencies):

```sh
npm test
```

GitHub Actions runs them on pull requests and before every deploy to
GitHub Pages; a failing test stops the deploy.

## Notes

The code was written 99% by GPT4o and Claude 3.5 with minor human modifications.

Improved in July 2026 with Claude/Opus 4.8.

Refactored into tested modules, bug-fixed and made accessible (WCAG 2.2
AAA) in November 2026 with Claude Code.
# Image Grid

Arranges pictures in a configurable grid. Use the Rows and Columns buttons
to choose the grid size (1–8 each, defaulting to a 2×4 grid). The maximum
number of images equals rows × columns. Images are reordered by dragging,
by tapping two images, or with the keyboard (arrow keys, then Space or
Enter to pick up and swap). The page aims for WCAG 2.2 AAA.

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
| `main.js`   | UI wiring and the single `render()` function                       |
| `state.js`  | App state and the rules for changing it (pure, unit-tested)        |
| `layout.js` | Pure layout maths (cell rects, fitting, hit-testing, size limits)  |
| `render.js` | Drawing the grid onto a canvas (used by preview and export)        |
| `export.js` | Building and saving the full-resolution combined PNG               |
| `images.js` | Loading user files into images                                     |

Every interaction changes the state through a transition in `state.js` and
then calls `render()`. An image's place in the grid is its index in
`state.images`, so reordering is just swapping two array entries. Any
transition that changes the images or the grid size ends a running drag.
The preview and the export share `layout.js`, so the downloaded image has
the same layout as the preview (empty space is transparent in the PNG).

### Tests

The layout maths and the state rules have unit tests that run with Node's
built-in test runner (Node 20+):

```sh
npm test
```

GitHub Actions runs them before every deploy.

## Notes

The code was written 99% by GPT4o and Claude 3.5 with minor human modifications.

Improved in July 2026 with Claude/Opus 4.8.
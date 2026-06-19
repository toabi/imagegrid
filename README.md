# Image Grid

Arranges pictures in a configurable grid. Use the up/down arrows in the
header to choose the number of rows and columns (1–8 each, defaulting to a
2×4 grid). The maximum number of images equals rows × columns.

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

## Notes

The code was written 99% by GPT4o and Claude 3.5 with minor human modifications.

Improved in July 2026 with Claude/Opus 4.8.
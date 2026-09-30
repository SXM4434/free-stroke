SOURCE_URL: https://raw.githubusercontent.com/steveruizok/perfect-freehand/main/README.md
FETCHED: 2026-08-28
HTTP_OK: yes
WHAT: Perfect Freehand library README - pressure-sensitive stroke rendering with configurable size, thinning, smoothing, streamline parameters

Perfect Freehand is a TypeScript library for rendering pressure-sensitive freehand drawing strokes. It generates polygon outline points from input points, allowing developers to create natural-looking drawn lines with variable width.

## Key Features

- **Pressure Simulation**: The library simulates pressure based on input point velocity or accepts real pressure data from stylus devices
- **Customizable Appearance**: Control stroke size, thinning, smoothing, and streamlining through configurable options
- **Flexible Rendering**: Works with SVG, HTML Canvas, and other rendering technologies
- **Community Ports**: Available implementations in Dart, Odin, Python, and Rust

## Core API

The main export is `getStroke(inputPoints, options)`, which transforms an array of input coordinates into outline points forming a stroke polygon. Input points can be formatted as arrays `[x, y, pressure]` or objects `{x, y, pressure}`.

## Configuration Options

Key parameters include:
- **size**: Base stroke diameter (default: 8)
- **thinning**: Pressure effect on size (default: 0.5)
- **smoothing**: Edge softness (default: 0.5)
- **simulatePressure**: Enable velocity-based pressure simulation (default: true)
- **streamline**: Smooths path by removing points; affects responsiveness vs visual smoothness
- **start/end**: Tapering configuration for line endpoints

## Advanced Features

The library exports lower-level functions (`getStrokePoints`, `getStrokeOutlinePoints`) for custom implementations and supports flattening self-crossing strokes using the `polygon-clipping` package.

See repository at https://github.com/steveruizok/perfect-freehand

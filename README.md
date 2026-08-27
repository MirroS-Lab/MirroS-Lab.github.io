# MirroS Lab project pages

This repository publishes static project pages for MirroS Lab through GitHub Pages.

## Code as Worlds

- Site: <https://mirros-lab.github.io/code-as-world/>
- Upstream project page: <https://github.com/hanyang-21/Code-as-World-web>
- Published path: `code-as-world/`

The deployed snapshot contains only assets referenced by the current page. It intentionally omits the upstream Git history, high-resolution source meshes, the retired interactive viewer runtime, generated deployment directories, and unreferenced legacy media.

Large presentation assets are web-optimized before being committed: the opening demo is encoded as 720p H.264, the hero loop as H.264, and the teaser figure as WebP. GitHub Pages publishes the repository root automatically whenever `main` changes; `.nojekyll` keeps the checked-in static files unchanged.

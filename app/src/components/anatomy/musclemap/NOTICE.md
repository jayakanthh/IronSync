# Vendored artwork: musclemap-rn

The SVG path data in this folder is taken from
[musclemap-rn](https://github.com/ImpLych/Muscle-Map-for-React-Native)
(MIT, © 2026 Hasan ERGUNT), itself a port of
[MuscleMap](https://github.com/melihcolpan/MuscleMap) (MIT, © Melih Colpan).

It's vendored rather than installed because musclemap-rn isn't published to npm.
Only the four path files and the view boxes are copied; the rendering is ours
(see ../MuscleAnatomy.tsx), because IronSync colours muscles by training volume
rather than by the library's own component API.

The path files are unmodified apart from one import path, so they can be
re-synced from upstream by re-copying and re-pointing `from '../types'` at
`'./types'`.

MIT permits this with attribution — kept here and in the app under
Settings ▸ About.

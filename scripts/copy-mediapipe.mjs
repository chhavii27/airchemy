/**
 * Copies MediaPipe's WebAssembly runtime from node_modules into public/,
 * so it is served from our own origin (no third-party CDN at runtime) and
 * always matches the installed @mediapipe/tasks-vision version.
 * Runs automatically after `npm install` (see "postinstall" in package.json).
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const dest = join(root, 'public/mediapipe/wasm')

mkdirSync(dest, { recursive: true })
for (const file of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  copyFileSync(join(src, file), join(dest, file))
}
console.log('MediaPipe WASM copied to public/mediapipe/wasm')

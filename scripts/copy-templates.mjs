import { cpSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))

cpSync(join(root, "src", "templates"), join(root, "dist", "templates"), {
  recursive: true,
})

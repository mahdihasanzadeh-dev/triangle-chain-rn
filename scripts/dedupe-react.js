// npm's `overrides` field should force every nested copy of react to match
// the root version, but in practice expo-three's own pinned copy has
// survived multiple clean reinstalls for at least one real project. Rather
// than keep fighting npm's resolver, this just physically removes the
// nested copy after every install -- Node's module resolution then walks
// up to the project root's node_modules/react automatically, which is
// exactly what we want (one shared React instance for the whole app).
const fs = require("fs");
const path = require("path");

const nestedDirs = [
  path.join(__dirname, "..", "node_modules", "expo-three", "node_modules", "react"),
  path.join(__dirname, "..", "node_modules", "expo-three", "node_modules", "react-dom"),
];

for (const dir of nestedDirs) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log("[dedupe-react] removed nested duplicate at", dir);
  }
}

// File: scripts/set-version.js

const fs = require("fs");
const generateVersion = require("./gen-version.js");

let packageJson = JSON.parse(fs.readFileSync("package.json"));
packageJson.version = generateVersion();
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");

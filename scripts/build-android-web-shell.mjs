import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nextServerAppDir = join(root, ".next", "server", "app");
const nextStaticDir = join(root, ".next", "static");
const publicDir = join(root, "public");
const androidWebDir = join(root, "android", "app", "build", "generated", "assets", "web");

console.log("[android-web] running next build");
execFileSync(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: root,
  stdio: "inherit",
});

if (!existsSync(nextServerAppDir) || !existsSync(nextStaticDir)) {
  throw new Error("Next build output is missing. Cannot build Android web shell.");
}

rmSync(androidWebDir, { recursive: true, force: true });
mkdirSync(androidWebDir, { recursive: true });

copyRouteArtifacts("html");
copyRouteArtifacts("rsc");
copyDirectory(nextStaticDir, join(androidWebDir, "_next", "static"));

copyIfExists(join(nextServerAppDir, "manifest.webmanifest.body"), join(androidWebDir, "manifest.webmanifest"));
copyIfExists(join(publicDir, "sw.js"), join(androidWebDir, "sw.js"));
copyIfExists(join(publicDir, "apple-touch-icon.png"), join(androidWebDir, "apple-touch-icon.png"));
copyIfExists(join(publicDir, "favicon.ico"), join(androidWebDir, "favicon.ico"));
copyIfExists(join(publicDir, "favicon-32.png"), join(androidWebDir, "favicon-32.png"));
copyIfExists(join(publicDir, "favicon-16.png"), join(androidWebDir, "favicon-16.png"));
copyIfExists(join(publicDir, "icons"), join(androidWebDir, "icons"));
copyIfExists(join(publicDir, "data", "words"), join(androidWebDir, "data", "words"));

console.log(`[android-web] shell assets written to ${androidWebDir}`);

function copyRouteArtifacts(extension) {
  for (const file of walk(nextServerAppDir)) {
    if (!file.endsWith(`.${extension}`) || file.includes(`${sep}.segments${sep}`) || file.includes(`${sep}(app)${sep}`)) {
      continue;
    }

    const route = relative(nextServerAppDir, file)
      .replaceAll("\\", "/")
      .replace(new RegExp(`\\.${extension}$`), "");

    if (route === "manifest.webmanifest") {
      continue;
    }

    const target =
      extension === "html"
        ? route === "index"
          ? join(androidWebDir, "index.html")
          : join(androidWebDir, route, "index.html")
        : join(androidWebDir, `${route}.${extension}`);
    copyIfExists(file, target);
  }
}

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      entries.push(...walk(fullPath));
    } else {
      entries.push(fullPath);
    }
  }
  return entries;
}

function copyDirectory(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

function copyIfExists(from, to) {
  if (!existsSync(from)) {
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

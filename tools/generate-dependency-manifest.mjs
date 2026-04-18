import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'docs', 'dependencies');

const appSpecs = [
  {
    id: 'server',
    label: 'server',
    packageDir: path.join(rootDir, 'apps', 'server')
  },
  {
    id: 'web',
    label: 'web',
    packageDir: path.join(rootDir, 'apps', 'web')
  }
];

fs.mkdirSync(outputDir, { recursive: true });

const summary = [];

for (const spec of appSpecs) {
  const packageJsonPath = path.join(spec.packageDir, 'package.json');
  const packageLockPath = path.join(spec.packageDir, 'package-lock.json');
  const packageJson = readJson(packageJsonPath);
  const packageLock = readJson(packageLockPath);

  const runtimeDeps = sortEntries(packageJson.dependencies);
  const devDeps = sortEntries(packageJson.devDependencies);
  const lockPackages = Object.entries(packageLock.packages ?? {})
    .filter(([packagePath]) => Boolean(packagePath))
    .sort(([left], [right]) => left.localeCompare(right, 'en'));

  const uniqueInstalled = new Map();

  const lockLines = lockPackages.map(([packagePath, packageInfo]) => {
    const name = packageInfo.name ?? derivePackageName(packagePath);
    const version = packageInfo.version ?? 'unknown';
    const resolved = packageInfo.resolved ?? '';
    const integrity = packageInfo.integrity ?? '';
    uniqueInstalled.set(`${name}@${version}`, { name, version });
    return [packagePath, name, version, resolved, integrity].join('\t');
  });

  const uniqueInstalledLines = Array.from(uniqueInstalled.values())
    .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`, 'en'))
    .map((entry) => `${entry.name}@${entry.version}`);

  writeLines(path.join(outputDir, `${spec.id}-direct-runtime.txt`), runtimeDeps.map(([name, range]) => `${name}\t${range}`));
  writeLines(path.join(outputDir, `${spec.id}-direct-dev.txt`), devDeps.map(([name, range]) => `${name}\t${range}`));
  writeLines(path.join(outputDir, `${spec.id}-installed-packages.txt`), uniqueInstalledLines);
  writeLines(path.join(outputDir, `${spec.id}-package-lock-paths.txt`), lockLines);

  summary.push({
    id: spec.id,
    label: spec.label,
    runtimeDirectCount: runtimeDeps.length,
    devDirectCount: devDeps.length,
    installedPackageCount: uniqueInstalledLines.length,
    packagePathCount: lockLines.length
  });
}

fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sortEntries(objectValue) {
  return Object.entries(objectValue ?? {}).sort(([left], [right]) => left.localeCompare(right, 'en'));
}

function derivePackageName(packagePath) {
  return packagePath.replace(/^node_modules\//, '').replace(/.*\/node_modules\//, '');
}

function writeLines(filePath, lines) {
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

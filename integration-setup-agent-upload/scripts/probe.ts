// Run the read-only endpoint probes from the command line and print JSON.
// Usage: node scripts/probe.ts --authorize URL --token URL [--discovery URL] [--link URL ...]

import { runEndpointProbes, probeLink } from "../lib/probes.ts";

const args = process.argv.slice(2);
const opt = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : null;
};
const links = args.flatMap((a, i) => (a === "--link" ? [args[i + 1]] : []));

const probes = [
  ...(await runEndpointProbes({
    authorizeUrl: opt("authorize"),
    tokenUrl: opt("token"),
    discoveryUrl: opt("discovery"),
  })),
  ...(await Promise.all(links.map(probeLink))),
];
console.log(JSON.stringify(probes, null, 2));

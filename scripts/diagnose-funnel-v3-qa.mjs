import { readFile } from "node:fs/promises";

const report = JSON.parse(await readFile("research/deep/v3/qa-report.json", "utf8"));
const requested = process.argv.slice(2);
const codes = requested.length ? requested : [...new Set(report.rows.flatMap((row) => row.issues.map((issue) => issue.code)))];

function atPath(value, path) {
  if (!path) return value;
  const parts = path.replace(/^root\.?/, "").replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  return parts.reduce((current, part) => current?.[part], value);
}

function forbiddenMatches(review, code) {
  const body = JSON.stringify(review);
  const patterns = {
    internal_process: /Puente IA|RVC-|RV-PUB-|manual-wave|Bandeja|Origen migraci[oó]n/gi,
    local_path: /file:\/\/[^" ]+|[A-Z]:\\Users\\[^" ]+|\/Users\/[^" ]+/gi,
    temporary_credential: /[?&](?:token|signature|x-amz-[^=]*|x-goog-[^=]*)=[^&" ]+/gi,
  };
  return [...(body.match(patterns[code]) || [])].slice(0, 20);
}

for (const code of codes) {
  console.log(`\n### ${code}`);
  let shown = 0;
  for (const row of report.rows) {
    for (const issue of row.issues) {
      if (issue.code !== code || shown >= 20) continue;
      const review = JSON.parse(await readFile(`research/deep/v3/reviews/${row.id}.json`, "utf8"));
      const value = issue.path ? atPath(review, issue.path) : forbiddenMatches(review, code);
      console.log(`${row.name} | ${issue.path || "body"} | ${JSON.stringify(value).slice(0, 2_000)}`);
      shown += 1;
    }
  }
}

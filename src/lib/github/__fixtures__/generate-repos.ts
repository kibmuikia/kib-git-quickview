// file: src/lib/github/__fixtures__/generate-repos.ts
// Dev/test-only generator for realistic repo list payloads (GET /users/{u}/repos shape).

const LANGUAGES = ["TypeScript", "Python", "Go", "Rust", "JavaScript", null];
const REPO_NAMES = [
  "quickview",
  "playground",
  "notes",
  "toolkit",
  "site",
  "api-client",
  "dotfiles",
  "sandbox",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface GenerateReposOptions {
  owner: string;
}

/** Generates `count` raw repo objects shaped like the GitHub REST API response. */
export function generateGitHubReposResponse(
  count: number,
  { owner }: GenerateReposOptions,
): unknown[] {
  return Array.from({ length: count }, (_, i) => {
    const name = `${pick(REPO_NAMES)}-${i}`;
    return {
      id: randomInt(1_000, 9_000_000),
      name,
      full_name: `${owner}/${name}`,
      description: pick([null, "A small side project.", "WIP — do not use."]),
      html_url: `https://github.com/${owner}/${name}`,
      stargazers_count: randomInt(0, 5_000),
      forks_count: randomInt(0, 500),
      language: pick(LANGUAGES),
      updated_at: new Date(
        Date.now() - randomInt(0, 365) * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
  });
}

/// <reference types="chrome" />
// file: src/background/github-service.ts

import { fetchUserProfile } from "../lib/github/profile.ts";
import { fetchUserRepos } from "../lib/github/repos.ts";

export class GitHubService {
  fetchUserProfile = fetchUserProfile;
  fetchUserRepos = fetchUserRepos;
}

export const githubService = new GitHubService();
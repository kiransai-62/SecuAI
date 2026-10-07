/**
 * GitHub Integration Service
 * Manages repository cloning, webhook validation, and commit diff retrieval
 */
export const githubService = {
  isValidRepoUrl(url: string): boolean {
    return /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(url);
  },
  extractRepoName(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1]?.replace('.git', '') || 'repository';
  },
};

export default githubService;

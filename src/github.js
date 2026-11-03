export async function fetchActivity({fetcher, org, token}) {
  const headers = {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'};
  async function pages(path) {
    let url = `https://api.github.com${path}`;
    const items = [];
    while (url) {
      let response;
      try { response = await fetcher(url, {headers}); }
      catch { throw new Error('GitHub could not be reached. Check your connection and try again.'); }
      if (!response.ok) {
        if (response.status === 401) throw new Error('GitHub rejected the credentials. Check GITHUB_TOKEN and try again.');
        if (response.status === 403 || response.status === 429) throw new Error('GitHub denied the request or rate limit was reached. Check token permissions and rate limits, then retry.');
        throw new Error(`GitHub request failed (${response.status}). Check organization access and try again.`);
      }
      if (/partial-results/i.test(response.headers.get('x-github-sso') || '')) throw new Error('GitHub returned incomplete results due to organization authorization. Check token permissions and SSO authorization, then retry.');
      let data;
      try { data = await response.json(); } catch { throw new Error('GitHub returned an invalid response. Try again.'); }
      if (!Array.isArray(data)) throw new Error('GitHub returned an incomplete response. Try again.');
      items.push(...data);
      const next = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
      if (next && new URL(next).origin !== 'https://api.github.com') throw new Error('GitHub returned an invalid pagination link. Try again.');
      url = next;
    }
    return items;
  }
  const repositories = await pages(`/orgs/${encodeURIComponent(org)}/repos?type=all&per_page=100`);
  const pullRequests = [];
  for (const repo of repositories) {
    const pulls = await pages(`/repos/${encodeURIComponent(org)}/${encodeURIComponent(repo.name)}/pulls?state=all&per_page=100`);
    for (const pr of pulls) pullRequests.push({repository: repo.name, createdAt: pr.created_at, mergedAt: pr.merged_at});
  }
  return {repositories: repositories.map(({name, private: isPrivate}) => ({name, private: isPrivate})), pullRequests, updatedAt: new Date().toISOString()};
}

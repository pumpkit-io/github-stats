# GitHub statistics

A local dashboard for pull request activity in an organization. It includes repositories visible to the supplied GitHub credential, including private repositories, and shows created pull requests in the last 30 UTC days. Counts are grouped by UTC date; the cumulative count starts at zero for this range.

## Run locally

Requires Node.js 20 or later. Create a GitHub token with access to the organization's repositories and permission to read pull requests and repository metadata. A fine-grained personal access token requires organization approval where applicable. Only repositories visible to that token can be included.

```sh
export GITHUB_ORG=your-organization
export GITHUB_TOKEN=your-token
npm start
```

Open http://127.0.0.1:3000. Set `PORT` to change the port. The server fetches on opening and on refresh; it does not cache data. Tokens stay on the server and are not logged or returned to the browser. Avoid sharing screenshots or responses containing private repository data.

GitHub can restrict access without reporting every inaccessible repository. Check the token's repository selection, permissions and organization approval if data is missing. Pagination and request errors stop the update instead of presenting an incomplete result as fresh.

Run tests with `npm test`. The Node server separates retrieval from the browser and can be packaged for a later deployment. It binds to loopback and has no authentication: do not expose private statistics publicly. Authentication, DNS, TLS and deployment are future work.

After the UI ships, run `update-design` to record the design direction.

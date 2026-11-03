import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';

async function serve(handler) {
  const server = createApp(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

test('dashboard fetches paginated public and private repositories and all PR states', async () => {
  const calls = [];
  const api = async (url, options) => {
    calls.push([url, options.headers.Authorization]);
    const u = new URL(url);
    let data;
    let link = '';
    if (u.pathname.endsWith('/orgs/example/repos')) {
      data = u.searchParams.get('page') === '2' ? [{name:'private',private:true}] : [{name:'public',private:false}];
      if (u.searchParams.get('page') !== '2') link = '<https://api.github.com/orgs/example/repos?page=2>; rel="next"';
    } else if (u.pathname.endsWith('/public/pulls')) {
      data = u.searchParams.get('page') === '2' ? [{created_at:'2026-01-03T01:00:00Z',merged_at:null}] : [{created_at:'2026-01-01T23:00:00Z',merged_at:'2026-01-02T00:00:00Z'}];
      if (u.searchParams.get('page') !== '2') link = '<https://api.github.com/repos/example/public/pulls?page=2>; rel="next"';
    } else data = [{created_at:'2026-01-01T00:00:00Z',merged_at:null}];
    return new Response(JSON.stringify(data), {status:200,headers:{link}});
  };
  const app = await serve({fetch:api, org:'example', token:'secret'});
  try {
    const response = await fetch(`${app.url}/api/activity`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.repositories.map(r => r.name), ['public','private']);
    assert.equal(body.pullRequests.length, 3);
    assert.ok(calls.every(([, auth]) => auth === 'Bearer secret'));
    assert.ok(calls.some(([url]) => url.includes('state=all')));
    assert.ok(!JSON.stringify(body).includes('secret'));
  } finally { await app.close(); }
});

test('a failed repository fetch does not return partial activity', async () => {
  let requests = 0;
  const app = await serve({org:'example', token:'secret', fetch: async () => {
    requests++;
    if (requests === 1) return Response.json([{name:'one'},{name:'two'}]);
    if (requests === 2) return Response.json([{created_at:'2026-01-01T00:00:00Z'}]);
    return new Response('', {status:403});
  }});
  try {
    const response = await fetch(`${app.url}/api/activity`);
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.match(body.error, /rate limit|permissions/i);
    assert.equal(body.pullRequests, undefined);
    assert.ok(!JSON.stringify(body).includes('secret'));
  } finally { await app.close(); }
});

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

test('dashboard filters created and merged activity across a selected UTC date range', async () => {
  const { readFile } = await import('node:fs/promises');
  const vm = await import('node:vm');
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {value:'', textContent:'', innerHTML:'', hidden:false, disabled:false, listeners:{}, replaceChildren() {}, append() {}, addEventListener(type, fn) { this.listeners[type] = fn; }});
    return elements.get(id);
  }
  const document = {querySelector: selector => element(selector), querySelectorAll: () => [], createElement: () => ({})};
  const data = {repositories:[{name:'one'},{name:'two'}], pullRequests:[
    {repository:'one', createdAt:'2026-01-01T23:00:00Z', mergedAt:'2026-01-03T00:00:00Z'},
    {repository:'one', createdAt:'2026-01-03T00:00:00Z', mergedAt:null},
    {repository:'two', createdAt:'2026-01-02T00:00:00Z', mergedAt:'2026-01-02T00:00:00Z'}
  ], updatedAt:'2026-01-04T00:00:00Z'};
  const context = vm.createContext({document, fetch: async () => ({ok:true, json:async () => data}), Date, Map, Math, Array, Number});
  vm.runInContext(await readFile(new URL('../public/app.js', import.meta.url), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  element('#repository').value = 'one';
  element('#start').value = '2026-01-01';
  element('#end').value = '2026-01-03';
  element('#metric').value = 'created';
  element('#repository').listeners.change();
  assert.match(element('#counts').innerHTML, /2026-01-01<\/th><td>1<\/td><td>1/);
  assert.match(element('#counts').innerHTML, /2026-01-02<\/th><td>0<\/td><td>1/);
  assert.match(element('#counts').innerHTML, /2026-01-03<\/th><td>1<\/td><td>2/);
  element('#metric').value = 'merged';
  element('#metric').listeners.change();
  assert.match(element('#counts').innerHTML, /2026-01-01<\/th><td>0<\/td><td>0/);
  assert.match(element('#counts').innerHTML, /2026-01-03<\/th><td>1<\/td><td>1/);
  element('#start').value = '2026-01-03';
  element('#start').listeners.change();
  assert.doesNotMatch(element('#counts').innerHTML, /2026-01-01/);
  assert.match(element('#counts').innerHTML, /2026-01-03<\/th><td>1<\/td><td>1/);
  element('#repository').value = 'two';
  element('#repository').listeners.change();
  assert.match(element('#status').textContent, /No pull requests were merged.*Choose another/);
  element('#start').value = '2026-01-04';
  element('#start').listeners.change();
  assert.match(element('#status').textContent, /valid date range/);
  assert.equal(element('#counts').innerHTML, '');
});

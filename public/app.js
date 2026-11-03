const status = document.querySelector('#status');
const updated = document.querySelector('#updated');
const overview = document.querySelector('#overview');
const refresh = document.querySelector('#refresh');
let lastData;

function chart(points, cumulative) {
  const width = 960, height = 220, left = 42, right = 12, top = 14, bottom = 36;
  const max = Math.max(1, ...points.map(p => cumulative ? p.total : p.count));
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = i => left + (i + .5) * plotWidth / points.length;
  const y = value => top + plotHeight * (1 - value / max);
  const grid = [0, .5, 1].map(n => `<line x1="${left}" x2="${width-right}" y1="${y(max*n)}" y2="${y(max*n)}" class="grid"/><text x="${left-10}" y="${y(max*n)+4}" text-anchor="end">${Number((max*n).toFixed(1))}</text>`).join('');
  const marks = cumulative
    ? `<polyline class="line" points="${points.map((p,i) => `${x(i)},${y(p.total)}`).join(' ')}"/>`
    : points.map((p,i) => `<rect class="bar" x="${x(i)-Math.min(10,plotWidth/points.length*.35)}" y="${y(p.count)}" width="${Math.min(20,plotWidth/points.length*.7)}" height="${top+plotHeight-y(p.count)}"><title>${p.date}: ${p.count}</title></rect>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${cumulative ? 'Cumulative' : 'Daily'} created pull request counts. A data table follows the charts.">${grid}${marks}<text x="${left}" y="${height-8}">${points[0].date}</text><text x="${width-right}" y="${height-8}" text-anchor="end">${points.at(-1).date}</text></svg>`;
}
function render(data) {
  const end = new Date(); end.setUTCHours(0,0,0,0);
  const start = new Date(end); start.setUTCDate(start.getUTCDate()-29);
  let total = 0;
  const counts = new Map();
  for (const pr of data.pullRequests) { const date = pr.createdAt?.slice(0,10); counts.set(date, (counts.get(date) || 0) + 1); }
  const points = Array.from({length:30}, (_,i) => {
    const day = new Date(start); day.setUTCDate(day.getUTCDate()+i);
    const date = day.toISOString().slice(0,10), count = counts.get(date) || 0;
    total += count; return {date,count,total};
  });
  document.querySelector('#dates').textContent = `${points[0].date} to ${points.at(-1).date} (UTC)`;
  document.querySelector('#daily').innerHTML = chart(points, false);
  document.querySelector('#cumulative').innerHTML = chart(points, true);
  document.querySelector('#counts').innerHTML = points.map(p => `<tr><th scope="row">${p.date}</th><td>${p.count}</td><td>${p.total}</td></tr>`).join('');
  overview.hidden = false;
  status.textContent = total ? '' : 'No pull requests were created in the last 30 days. Check the date range or repository access.';
}
async function load() {
  refresh.disabled = true;
  status.textContent = 'Fetching pull requests from GitHub…';
  try {
    const response = await fetch('/api/activity', {cache:'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load GitHub data. Try again.');
    lastData = data;
    updated.textContent = `Last updated: ${new Date(data.updatedAt).toLocaleString()}`;
    if (!data.repositories.length) {
      overview.hidden = true;
      status.textContent = 'No accessible repositories found. Check your organization and token permissions, then refresh.';
    } else render(data);
  } catch (error) {
    status.textContent = `${error.message} ${lastData ? 'The charts show stale data from the last successful update.' : ''}`;
    if (!lastData) updated.textContent = 'No successful update yet.';
  } finally { refresh.disabled = false; }
}
refresh.addEventListener('click', load);
load();

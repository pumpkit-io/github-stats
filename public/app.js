const status = document.querySelector('#status');
const updated = document.querySelector('#updated');
const overview = document.querySelector('#overview');
const refresh = document.querySelector('#refresh');
let lastData;
let refreshError = '';
let chartPoints = [];
const chartArea = document.querySelector('#daily');
const chartReadout = document.querySelector('#chart-readout');
const chartWidth = 960, chartLeft = 42, chartRight = 42;
function setStatus(message) { status.textContent = [refreshError, message].filter(Boolean).join(' '); }
const repository = document.querySelector('#repository');
const metric = document.querySelector('#metric');
const startInput = document.querySelector('#start');
const endInput = document.querySelector('#end');
const today = new Date(); today.setUTCHours(0,0,0,0);
const defaultStart = new Date(today); defaultStart.setUTCDate(defaultStart.getUTCDate()-29);
startInput.value = defaultStart.toISOString().slice(0,10);
endInput.value = today.toISOString().slice(0,10);

function chart(points) {
  const width = chartWidth, height = 240, left = chartLeft, right = chartRight, top = 24, bottom = 36;
  const dailyMax = Math.max(1, ...points.map(p => p.count));
  const totalMax = Math.max(1, points.at(-1).total);
  const average = points.at(-1).total / points.length;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = i => left + (i + .5) * plotWidth / points.length;
  const y = (value, max) => top + plotHeight * (1 - value / max);
  const grid = [0, .5, 1].map(n => `<line x1="${left}" x2="${width-right}" y1="${y(n,1)}" y2="${y(n,1)}" class="grid"/><text x="${left-10}" y="${y(n,1)+4}" text-anchor="end">${Number((dailyMax*n).toFixed(1))}</text><text x="${width-right+10}" y="${y(n,1)+4}">${Number((totalMax*n).toFixed(1))}</text>`).join('');
  const bars = points.map((p,i) => `<rect class="bar" x="${x(i)-Math.min(10,plotWidth/points.length*.35)}" y="${y(p.count,dailyMax)}" width="${Math.min(20,plotWidth/points.length*.7)}" height="${top+plotHeight-y(p.count,dailyMax)}"><title>${p.date}: ${p.count}</title></rect>`).join('');
  const line = `<polyline class="line" points="${points.map((p,i) => `${x(i)},${y(p.total,totalMax)}`).join(' ')}"/>${points.length === 1 ? `<circle class="line-point" cx="${x(0)}" cy="${y(points[0].total,totalMax)}" r="4"/>` : ''}`;
  const avg = average > 0 && average < .01 ? '<0.01' : Number(average.toFixed(2));
  document.querySelector('#average-value').textContent = `${avg} per day`;
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily and cumulative ${metric.value} pull requests. Average: ${avg} per day. A data table follows the chart.">${grid}${bars}${line}<line class="average" x1="${left}" x2="${width-right}" y1="${y(average,dailyMax)}" y2="${y(average,dailyMax)}"><title>Average: ${avg} per day</title></line><text x="${left}" y="${height-8}">${points[0].date}</text><text x="${width-right}" y="${height-8}" text-anchor="end">${points.at(-1).date}</text></svg>`;
}
function showChartDay(event) {
  const bounds = chartArea.getBoundingClientRect();
  const position = (event.clientX - bounds.left) * chartWidth / bounds.width;
  if (!chartPoints.length || position < chartLeft || position > chartWidth - chartRight) {
    chartReadout.textContent = '';
    return;
  }
  const index = Math.min(chartPoints.length - 1, Math.floor((position - chartLeft) / (chartWidth - chartLeft - chartRight) * chartPoints.length));
  const point = chartPoints[index];
  chartReadout.textContent = `${point.date} (UTC): Daily ${point.count}, cumulative ${point.total}, average ${document.querySelector('#average-value').textContent}`;
}
chartArea.addEventListener('pointermove', showChartDay);
chartArea.addEventListener('pointerdown', showChartDay);
chartArea.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') chartReadout.textContent = ''; });
function render(data) {
  chartPoints = [];
  chartReadout.textContent = '';
  const start = new Date(`${startInput.value}T00:00:00Z`);
  const end = new Date(`${endInput.value}T00:00:00Z`);
  const days = (end - start) / 86400000 + 1;
  if (!Number.isInteger(days) || days < 1 || days > 3660) {
    overview.hidden = false;
    document.querySelector('#daily').innerHTML = '';
    document.querySelector('#counts').innerHTML = '';
    document.querySelector('#average-value').textContent = '';
    document.querySelector('#dates').textContent = '';
    setStatus('Choose a valid date range of up to 10 years, with the start on or before the end.');
    return;
  }
  let total = 0;
  const counts = new Map();
  for (const pr of data.pullRequests) {
    if (repository.value && pr.repository !== repository.value) continue;
    const date = (metric.value === 'merged' ? pr.mergedAt : pr.createdAt)?.slice(0,10);
    if (date) counts.set(date, (counts.get(date) || 0) + 1);
  }
  const points = Array.from({length:days}, (_,i) => {
    const day = new Date(start); day.setUTCDate(day.getUTCDate()+i);
    const date = day.toISOString().slice(0,10), count = counts.get(date) || 0;
    total += count; return {date,count,total};
  });
  document.querySelectorAll('.metric-name').forEach(node => { node.textContent = metric.value; });
  document.querySelector('#dates').textContent = `${points[0].date} to ${points.at(-1).date} (UTC)`;
  chartPoints = points;
  chartArea.innerHTML = chart(points);
  document.querySelector('#counts').innerHTML = points.map(p => `<tr><th scope="row">${p.date}</th><td>${p.count}</td><td>${p.total}</td></tr>`).join('');
  overview.hidden = false;
  setStatus(total ? '' : `No pull requests were ${metric.value} for these filters. Choose another repository or date range.`);
}
async function load() {
  refresh.disabled = true;
  status.textContent = 'Fetching pull requests from GitHub…';
  try {
    const response = await fetch('/api/activity', {cache:'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load GitHub data. Try again.');
    refreshError = '';
    lastData = data;
    const selected = repository.value;
    repository.replaceChildren();
    const all = document.createElement('option'); all.value = ''; all.textContent = 'All repositories'; repository.append(all);
    for (const repo of data.repositories) {
      const option = document.createElement('option'); option.value = repo.name; option.textContent = repo.name; repository.append(option);
    }
    repository.value = data.repositories.some(repo => repo.name === selected) ? selected : '';
    updated.textContent = `Last updated: ${new Date(data.updatedAt).toLocaleString()}`;
    if (!data.repositories.length) {
      overview.hidden = true;
      status.textContent = 'No accessible repositories found. Check your organization and token permissions, then refresh.';
    } else render(data);
  } catch (error) {
    refreshError = `${error.message} ${lastData ? 'Displayed data is stale from the last successful update.' : ''}`;
    setStatus('');
    if (!lastData) updated.textContent = 'No successful update yet.';
  } finally { refresh.disabled = false; }
}
[repository, metric, startInput, endInput].forEach(control => control.addEventListener('change', () => { if (lastData?.repositories.length) render(lastData); }));
refresh.addEventListener('click', load);
load();

// Shared RBF plotting for the evaluation pages. rbfViewer() drives the pages
// that pick a sequence and a budget; the NATS page uses the helpers directly.

// Colors match the paper's figures; the exact RBF takes FRBF's color.
const STYLE = {
  "Exact RBF": { color: "#CC79A7", fill: "rgba(204,121,167,0.08)", dash: "dot" },
  CRBF: { color: "#E69F00", fill: "rgba(230,159,0,0.16)" },
  SRBF: { color: "#0072B2", fill: "rgba(0,114,178,0.16)" },
  PRBF: { color: "#009E73", fill: "rgba(0,158,115,0.16)", piecewise: true },
};
const GRID = { showgrid: true, gridcolor: "rgba(0,0,0,0.08)" };
const $ = (id) => document.getElementById(id);

// Revalidate data on every load, so an update never mixes with cached files.
// Bump ?v= on the asset links in each page when this file or the CSS changes.
function fetchJson(url) {
  return fetch(url, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  });
}

// units: horizon (data time units), timeScale (data time unit to ms),
// demandScale, demandTitle, demandHover.
//
// Pairs are flat [Δ0, w0, Δ1, w1, ...], starting from (0, 0) like the
// notebook. Curves hold their last value up to H. A piecewise-linear bound
// is 0 before its first vertex and jumps there, so it holds 0 up to that
// duration. Only the vertices themselves get markers.
function rbfCurve(flat, piecewise, units) {
  const x = [0], y = [0], sizes = [4];
  if (piecewise && flat.length) {
    x.push(flat[0] * units.timeScale);
    y.push(0);
    sizes.push(0);
  }
  for (let i = 0; i < flat.length; i += 2) {
    x.push(flat[i] * units.timeScale);
    y.push(flat[i + 1] * units.demandScale);
    sizes.push(4);
  }
  const end = units.horizon * units.timeScale;
  if (x[x.length - 1] < end) {
    x.push(end);
    y.push(y[y.length - 1]);
    sizes.push(0);
  }
  return { x, y, sizes, points: flat.length / 2, piecewise };
}

function rbfTrace(name, c, units) {
  const style = STYLE[name];
  return {
    type: "scatter",
    x: c.x,
    y: c.y,
    name: `${name} (${c.points} ${c.piecewise ? "vertices" : "pairs"})`,
    mode: c.piecewise ? "lines+markers" : "lines",
    line: { color: style.color, width: 2, shape: c.piecewise ? "linear" : "hv", dash: style.dash },
    ...(c.piecewise && { marker: { color: style.color, size: c.sizes } }),
    fill: "tozeroy",
    fillcolor: style.fill,
    hovertemplate: `Δ = %{x:.3f} ms<br>${units.demandHover}<extra></extra>`,
  };
}

function plotLayout(element, xTitle, yTitle) {
  return {
    height: element.clientHeight,
    margin: { l: 70, r: 20, t: 20, b: 50 },
    dragmode: "zoom",
    showlegend: true,
    legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "right", x: 1 },
    xaxis: { title: { text: xTitle }, ...GRID },
    yaxis: { title: { text: yTitle }, ...GRID, rangemode: "tozero" },
  };
}

// rows: [name, budget label, curve, E_U].
function rbfPlot(plot, summary, rows, units) {
  // Draw the bounds first so the exact RBF stays on top, as in the notebook.
  const traces = [...rows.slice(1), rows[0]].map(([name, , c]) => rbfTrace(name, c, units));
  const layout = plotLayout($(plot), "Interval length Δ (ms)", units.demandTitle);
  Plotly.react(plot, traces, layout, { responsive: true, displaylogo: false });
  $(summary).innerHTML = rows.map(([name, label, c, eu]) =>
    `<tr><td><span class="swatch" style="background:${STYLE[name].color}"></span>${name}</td>` +
    `<td>${label || "–"}</td><td>${c.points}</td><td>${eu.toFixed(2)}</td></tr>`
  ).join("");
}

function choiceButtons(id, values, label) {
  $(id).innerHTML = values.map((v) =>
    `<button type="button" data-value="${v}">${label(v)}</button>`
  ).join("");
}

function pressChoice(id, value) {
  for (const button of $(id).children) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.value) === value));
  }
}

function onChoice(id, handler) {
  $(id).addEventListener("click", (event) => {
    const value = Number(event.target.dataset?.value);
    if (value) handler(value);
  });
}

function stepSelect(id, delta, handler) {
  const select = $(id);
  const index = Math.min(Math.max(select.selectedIndex + delta, 0), select.options.length - 1);
  if (index !== select.selectedIndex) {
    select.selectedIndex = index;
    handler();
  }
}

// Curve keys for the show= hash parameter, e.g. #thread=29&show=exact,prbf
// reproduces a paper figure that plots only these curves.
const CURVE_KEYS = { "Exact RBF": "exact", CRBF: "crbf", SRBF: "srbf", PRBF: "prbf" };

// Note above the plot while show= limits the curves, with a way back to all.
function filterNote(names, onShowAll) {
  let note = $("filter-note");
  if (!note) {
    note = document.createElement("p");
    note.id = "filter-note";
    note.className = "caption";
    $("plot").before(note);
  }
  note.hidden = !names;
  if (!names) return note;
  note.innerHTML = `Showing only ${names.join(" and ")}, as in the paper's figure. ` +
    `<button type="button">Show all curves</button>`;
  note.querySelector("button").addEventListener("click", onShowAll);
  return note;
}

// config: index, list, param, units, option(row), details(data).
function rbfViewer(config) {
  const cache = new Map();
  let meta, budget = 64, show = null;

  function loadSequence(id) {
    if (!cache.has(id)) cache.set(id, fetchJson(`data/${id}.json`));
    return cache.get(id);
  }

  async function render() {
    const id = Number($("sequence").value);
    const showParam = show ? `&show=${[...show].join(",")}` : "";
    history.replaceState(null, "", `#${config.param}=${id}&budget=${budget}${showParam}`);
    pressChoice("budgets", budget);
    let data;
    try {
      data = await loadSequence(id);
    } catch (error) {
      $("details").textContent = `Could not load ${config.param} ${id}: ${error.message}`;
      return;
    }
    if (Number($("sequence").value) !== id) return;

    const units = config.units;
    const rows = [
      ["Exact RBF", "", rbfCurve(data.exact, false, units), 0],
      ["CRBF", `B = ${budget}`, rbfCurve(data.crbf[budget].pairs, false, units), data.crbf[budget].eu],
      ["SRBF", `M = ${budget}`, rbfCurve(data.srbf[budget].pairs, false, units), data.srbf[budget].eu],
      ["PRBF", "", rbfCurve(data.prbf.pairs, true, units), data.prbf.eu],
    ].filter(([name]) => !show || show.has(CURVE_KEYS[name]));
    rbfPlot("plot", "summary", rows, units);
    filterNote(show && rows.map(([name]) => name), () => {
      show = null;
      render();
    });
    $("details").innerHTML = config.details(data);
  }

  async function main() {
    meta = await fetchJson(config.index);
    const ids = meta[config.list].map(([id]) => id);
    $("sequence").innerHTML = meta[config.list].map((row) =>
      `<option value="${row[0]}">${config.option(row)}</option>`
    ).join("");
    choiceButtons("budgets", meta.budgets, (b) => b);

    const params = new URLSearchParams(location.hash.slice(1));
    const id = Number(params.get(config.param));
    if (ids.includes(id)) $("sequence").value = String(id);
    if (meta.budgets.includes(Number(params.get("budget")))) budget = Number(params.get("budget"));
    const keys = (params.get("show") || "").split(",")
      .filter((key) => Object.values(CURVE_KEYS).includes(key));
    if (keys.length) show = new Set(keys);

    $("sequence").addEventListener("change", render);
    $("prev").addEventListener("click", () => stepSelect("sequence", -1, render));
    $("next").addEventListener("click", () => stepSelect("sequence", 1, render));
    onChoice("budgets", (value) => {
      budget = value;
      render();
    });
    await render();
    // A figure link lands on the plot, not on the top of the page.
    if (show) $("filter-note")?.scrollIntoView({ block: "start" });
  }

  main();
}

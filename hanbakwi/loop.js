// 아무 출발지에서나 돌아오는 코스 만들기. 규칙은 코스 데이터를 만든 build.py와 같다:
// 출발점에서 각도 θ로 두 경유점을 찍고, 실제 도로망 위 최단경로(출발→경유1→경유2→출발)를 잇는다.
// 이미 지난 길은 4배 비싸게 쳐서 같은 길 왕복을 피한다. 경로는 항상 도로 위에서만 나온다(AI가 그리지 않는다).
(function (root) {
  const STEP = 25;

  function prep(G) {
    const n = G.nodes.length / 2, adj = Array.from({length: n}, () => []);
    for (let k = 0; k < G.edges.length; k += 3) {
      const a = G.edges[k], b = G.edges[k + 1], f = G.edges[k + 2];
      const L = Math.hypot(G.nodes[2*a] - G.nodes[2*b], G.nodes[2*a+1] - G.nodes[2*b+1]);
      // 큰길 1.25배, 계단 4배, 보행로 0.9배로 걷기 좋은 길을 고른다
      const e = {id: k / 3, L, w: L * (f & 4 ? 1.25 : 1) * (f & 2 ? 4 : 1) * (f & 8 ? 0.9 : 1), f};
      adj[a].push(b, e); adj[b].push(a, e);
    }
    return {G, n, adj};
  }

  function near(P, x, y) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < P.n; i++) { const d = (P.G.nodes[2*i] - x) ** 2 + (P.G.nodes[2*i+1] - y) ** 2; if (d < bd) { bd = d; best = i; } }
    return [best, Math.sqrt(bd)];
  }

  // 이진 힙 다익스트라, 목표에 닿으면 멈춘다
  function sp(P, s, t, pen) {
    const dist = new Float64Array(P.n).fill(Infinity), prev = new Int32Array(P.n).fill(-1), pe = new Array(P.n);
    const hd = [0], hn = [s]; dist[s] = 0;
    const push = (d, v) => { let i = hd.length; hd.push(d); hn.push(v); while (i > 0) { const p = (i - 1) >> 1; if (hd[p] <= hd[i]) break; [hd[p], hd[i]] = [hd[i], hd[p]]; [hn[p], hn[i]] = [hn[i], hn[p]]; i = p; } };
    const pop = () => { const d = hd[0], v = hn[0], ld = hd.pop(), lv = hn.pop(); if (hd.length) { hd[0] = ld; hn[0] = lv; let i = 0;
      for (;;) { const l = 2*i + 1, r = l + 1; let m = i; if (l < hd.length && hd[l] < hd[m]) m = l; if (r < hd.length && hd[r] < hd[m]) m = r; if (m === i) break; [hd[m], hd[i]] = [hd[i], hd[m]]; [hn[m], hn[i]] = [hn[i], hn[m]]; i = m; } } return [d, v]; };
    while (hd.length) {
      const [d, u] = pop();
      if (u === t) break;
      if (d > dist[u]) continue;
      const a = P.adj[u];
      for (let k = 0; k < a.length; k += 2) {
        const v = a[k], e = a[k + 1], nd = d + e.w * (pen.has(e.id) ? 4 : 1);
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; pe[v] = e; push(nd, v); }
      }
    }
    if (s !== t && prev[t] < 0) return null;
    const path = [t], es = [];
    for (let v = t; v !== s; v = prev[v]) { es.push(pe[v]); path.push(prev[v]); }
    return {path: path.reverse(), es: es.reverse()};
  }

  function loopOnce(P, s, th, R, spread) {
    const x = P.G.nodes[2*s], y = P.G.nodes[2*s+1];
    const w1 = near(P, x + R * Math.cos(th - spread), y + R * Math.sin(th - spread))[0];
    const w2 = near(P, x + R * Math.cos(th + spread), y + R * Math.sin(th + spread))[0];
    const pen = new Set(); let path = [s], es = [];
    for (const [a, b] of [[s, w1], [w1, w2], [w2, s]]) {
      const r = sp(P, a, b, pen); if (!r) return null;
      r.es.forEach(e => pen.add(e.id)); path = path.concat(r.path.slice(1)); es = es.concat(r.es);
    }
    let L = 0, rep = 0, trail = 0, steps = 0; const seen = new Set();
    for (const e of es) { L += e.L; if (seen.has(e.id)) rep += e.L; seen.add(e.id); if (e.f & 1) trail += e.L; if (e.f & 2) steps++; }
    return {path, L, rep: rep / L, trail: trail / L, steps, th};
  }

  // 25m 간격으로 다시 찍고 고도를 노드 사이에서 보간한다
  function finish(P, c) {
    const N = P.G.nodes, EL = P.G.elev, pts = [N[2*c.path[0]], N[2*c.path[0]+1]], el = [EL[c.path[0]] / 10];
    let carry = 0;
    for (let k = 0; k < c.path.length - 1; k++) {
      const a = c.path[k], b = c.path[k + 1], x1 = N[2*a], y1 = N[2*a+1], x2 = N[2*b], y2 = N[2*b+1], seg = Math.hypot(x2 - x1, y2 - y1);
      if (!seg) continue;
      let pos = STEP - carry;
      while (pos <= seg) { const f = pos / seg; pts.push(Math.round(x1 + (x2 - x1)*f), Math.round(y1 + (y2 - y1)*f)); el.push((EL[a] + (EL[b] - EL[a])*f) / 10); pos += STEP; }
      carry = seg - (pos - STEP);
    }
    const last = c.path[c.path.length - 1]; pts.push(N[2*last], N[2*last+1]); el.push(EL[last] / 10);
    const sm = el.map((_, i) => { let s = 0, n = 0; for (let j = i - 2; j <= i + 2; j++) { s += el[Math.min(el.length - 1, Math.max(0, j))]; n++; } return s / n; });
    let asc = 0; for (let i = 1; i < sm.length; i++) asc += Math.max(0, sm[i] - sm[i-1]);
    const gr = []; for (let k = 0; k + 2 < sm.length; k += 2) gr.push((sm[k+2] - sm[k]) / 50 * 100);
    const g = gr.length ? gr.map(Math.abs) : [0], frac = f => +(g.filter(f).length / g.length).toFixed(2);
    return {pts, el: sm.map(v => +v.toFixed(1)), dist: Math.round(c.L), asc: Math.round(asc), apk: +(asc / (c.L/1000)).toFixed(1),
            rep: +c.rep.toFixed(2), trail: +c.trail.toFixed(2), steps: c.steps, maxg: gr.length ? +Math.max(...gr).toFixed(1) : 0,
            share: [frac(v => v < 2), frac(v => v >= 2 && v < 5), frac(v => v >= 5 && v < 8), frac(v => v >= 8)], th: c.th};
  }

  // 한 거리에 대해 후보를 만들고 지형별로 3개씩 고른다. tick(진행률)으로 화면이 멈추지 않게 쉬어 간다
  async function makeLoops(P, s, D, tick) {
    const cands = [];
    for (let i = 0; i < 16; i++) {
      const th = i * Math.PI / 8;
      for (const spread of [0.5, 0.8]) {
        let R = D / ((2 + 2*Math.sin(spread)) * 1.3), c = null;
        for (let it = 0; it < 3; it++) { c = loopOnce(P, s, th, R, spread); if (!c || Math.abs(c.L - D) / D < 0.08) break; R *= D / c.L; }
        if (c && Math.abs(c.L - D) / D < 0.12 && c.rep <= 0.25) cands.push(finish(P, c));
      }
      if (tick) { tick((i + 1) / 16); await new Promise(r => setTimeout(r)); }
    }
    const score = {flat: c => c.apk + c.rep*20 + c.steps*3, mild: c => Math.abs(c.apk - 12) + c.rep*20 + c.steps*3,
                   hill: c => -c.apk + c.rep*20, trail: c => -c.trail*40 + c.rep*20};
    const out = {};
    for (const t in score) {
      const pick = [];
      for (const c of cands.slice().sort((a, b) => score[t](a) - score[t](b))) {
        if (pick.every(q => Math.abs(((c.th - q.th + 3*Math.PI) % (2*Math.PI)) - Math.PI) > 0.6)) pick.push(c);
        if (pick.length === 3) break;
      }
      out[t] = pick;
    }
    return out;
  }

  // 출발지 → 목적지 코스. 가장 짧은 길, 그와 다른 길(지난 길 1.6배 비용), 원하는 거리가 더 길면
  // 경유점으로 늘린 길을 후보로 만들고 지형별로 3개씩 고른다. 구조는 makeLoops와 같다.
  async function makeRoutes(P, s, t, D, tick) {
    const direct = sp(P, s, t, new Set());
    if (!direct) return {flat: [], mild: [], hill: [], trail: []};
    const Ld = direct.es.reduce((a, e) => a + e.L, 0), T = Math.max(D, Ld), raw = [];
    const add = (path, es, th) => { if (path.length > 1) raw.push({path, es, th}); };
    add(direct.path, direct.es, -1);
    // 비슷하지만 다른 길: 이미 쓴 길을 비싸게 쳐서 두 번 더
    const used = new Set(direct.es.map(e => e.id));
    for (let k = 0; k < 2; k++) {
      const p = spCost(P, s, t, e => used.has(e.id) ? 1.6 : 1); if (!p) break;
      p.es.forEach(e => used.add(e.id)); add(p.path, p.es, -2 - k);
    }
    // 원하는 거리가 최단보다 15% 넘게 길면: 출발·도착 중간에서 θ 방향 경유점으로 늘린다
    if (T > Ld * 1.15) {
      const x0 = (P.G.nodes[2*s] + P.G.nodes[2*t]) / 2, y0 = (P.G.nodes[2*s+1] + P.G.nodes[2*t+1]) / 2;
      for (let i = 0; i < 12; i++) {
        const th = i * Math.PI / 6; let off = (T - Ld) / 2.6, best = null;
        for (let it = 0; it < 3; it++) {
          const w = near(P, x0 + off*Math.cos(th), y0 + off*Math.sin(th))[0], pen = new Set();
          const a = sp(P, s, w, pen); if (!a) break; a.es.forEach(e => pen.add(e.id));
          const b = sp(P, w, t, pen); if (!b) break;
          const es = a.es.concat(b.es), L = es.reduce((q, e) => q + e.L, 0);
          best = {path: a.path.concat(b.path.slice(1)), es, L};
          if (Math.abs(L - T) / T < 0.08) break;
          off *= Math.max(0.3, Math.min(3, 1 + (T - L) / Math.max(L - Ld, 200)));
        }
        if (best && Math.abs(best.L - T) / T < 0.15) add(best.path, best.es, th);
        if (tick) { tick((i + 1) / 12); await new Promise(r => setTimeout(r)); }
      }
    }
    const cands = raw.map(c => {
      let L = 0, rep = 0, trail = 0, steps = 0; const seen = new Set();
      for (const e of c.es) { L += e.L; if (seen.has(e.id)) rep += e.L; seen.add(e.id); if (e.f & 1) trail += e.L; if (e.f & 2) steps++; }
      const r = finish(P, {path: c.path, L, rep: rep / L, trail: trail / L, steps, th: c.th}); r.fit = Math.abs(L - T) / T; return r;
    }).filter(c => c.rep <= 0.25);
    const score = {flat: c => c.apk + c.fit*40 + c.steps*3, mild: c => Math.abs(c.apk - 12) + c.fit*40 + c.steps*3,
                   hill: c => -c.apk + c.fit*40, trail: c => -c.trail*40 + c.fit*40};
    const out = {};
    for (const k in score) {
      const pick = [];
      for (const c of cands.slice().sort((a, b) => score[k](a) - score[k](b))) {
        if (pick.every(q => Math.abs(q.dist - c.dist) > 60 || Math.abs(q.asc - c.asc) > 3)) pick.push(c); // 같은 길 중복 제외
        if (pick.length === 3) break;
      }
      out[k] = pick;
    }
    return out;
  }
  // 간선 비용에 배수를 곱한 최단경로(다른 길 찾기용)
  function spCost(P, s, t, mul) {
    const pen = {has: () => false}, save = P.adj;
    P.adj = save.map(a => { const b = a.slice(); for (let k = 1; k < b.length; k += 2) b[k] = Object.assign({}, b[k], {w: b[k].w * mul(b[k])}); return b; });
    try { return sp(P, s, t, pen); } finally { P.adj = save; }
  }

  // 달리다 코스를 벗어났을 때: 지금 위치에서 앞쪽 남은 코스(100m~1km) 중 가장 덜 돌아가는 지점으로 붙는 길을 찾고,
  // 그 뒤는 원래 코스를 그대로 잇는다. 앞쪽만 보므로 출발점으로 돌아오는 순환은 유지된다.
  function rejoin(P, r, prog, x, y) {
    const n = r.pts.length / 2, [s] = near(P, x, y);
    let best = null;
    for (let i = Math.min(n - 1, prog + 4); i <= Math.min(n - 1, prog + 40); i += 4) {
      const [t] = near(P, r.pts[2*i], r.pts[2*i+1]), p = sp(P, s, t, new Set());
      if (!p) continue;
      const L = p.es.reduce((a, e) => a + e.L, 0), cost = L - (i - prog) * STEP; // 원래 코스보다 더 뛰는 거리
      if (!best || cost < best.cost) best = {i, p, L, cost};
    }
    if (!best) return null;
    const d = finish(P, {path: best.p.path, L: best.L || 1, rep: 0, trail: 0, steps: 0, th: 0});
    return Object.assign({}, r, {pts: d.pts.concat(r.pts.slice(2 * best.i)), el: d.el.concat(r.el.slice(best.i)),
                                 dist: Math.round(best.L + (n - 1 - best.i) * STEP), rerouted: true});
  }

  root.OrcaLoop = {prep, near, makeLoops, makeRoutes, rejoin};
})(typeof window !== 'undefined' ? window : globalThis);

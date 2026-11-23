/* ---------- the brain ---------- */
(function(){
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('brain');
  const hero = document.querySelector('.hero');
  const labelsEl = document.getElementById('labels');
  if (!window.THREE) { document.body.classList.add('no-webgl'); return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true}); }
  catch(e){ document.body.classList.add('no-webgl'); return; }
  const PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(0, .2, 6.2);
  const root = new THREE.Group(); root.rotation.x = .2; scene.add(root);
  const brain = new THREE.Group(); root.add(brain);

  const REG = [
    {id:'space',   name:'Space science', a:'#5ccfff', b:'#8b7bff', anchor:[-.6,.58,.1],  href:'space.html'},
    {id:'data',    name:'Data science',  a:'#39f5a6', b:'#14b8a6', anchor:[-.72,-.28,.35], href:'about.html#education'},
    {id:'product', name:'Product',       a:'#ffb547', b:'#ff7a45', anchor:[.6,.58,.1],   href:'risingcompute.html'},
    {id:'poems',   name:'Poetry',        a:'#ff5fa2', b:'#c86bff', anchor:[.72,-.28,.35],  href:'about.html#poems'},
  ];
  REG.forEach(r => { r.ca = new THREE.Color(r.a); r.cb = new THREE.Color(r.b); });

  /* --- sample a brain-shaped surface --- */
  const small = innerWidth < 760;
  const N = small ? 9000 : 16000;
  const pos = new Float32Array(N*3), col = new Float32Array(N*3);
  const size = new Float32Array(N), seed = new Float32Array(N), reg = new Float32Array(N);
  const samples = [[],[],[],[]];
  const c = new THREE.Color();
  for (let i=0;i<N;i++){
    const side = (i & 1) ? 1 : -1;
    const u = Math.random()*2-1, t = Math.random()*Math.PI*2, s = Math.sqrt(1-u*u);
    const dx = s*Math.cos(t), dy = u, dz = s*Math.sin(t);
    let x = dx*.7, y = dy*.78, z = dz*1.1;
    if (dx*side < 0) x *= .16;                       // flat medial wall
    if (dz > 0) x *= 1 - .16*dz;                      // narrower frontal lobe
    if (dy < -.25) y = -.195 + (y + .195)*.62;        // flatter base
    if (dy < .1 && dy > -.7 && Math.abs(dz) < .7 && dx*side > 0) x *= 1.07; // temporal bulge
    // gyri & sulci
    const A = Math.sin(dx*11 + Math.sin(dz*7)*1.6 + Math.cos(dy*5)*1.2);
    const B = Math.sin(dz*10 + Math.sin(dy*8)*1.4);
    const C = Math.sin(dy*12 + Math.sin(dx*6 + dz*4)*1.8);
    const g = Math.min(1, Math.abs(A + .7*B + .5*C));
    const k = (1 + .075*(g - .6)) * (1 - Math.random()*Math.random()*.1);
    x = x*k + side*.19; y *= k; z *= k;

    const upper = dy + .08*Math.sin(dz*5) > -.05;
    const r = side < 0 ? (upper ? 0 : 1) : (upper ? 2 : 3);
    const R = REG[r];
    c.copy(R.ca).lerp(R.cb, Math.min(1, Math.max(0, .5 + .5*dz + .25*B)));
    const bright = .28 + .72*g;
    pos.set([x,y,z], i*3);
    col.set([c.r*bright, c.g*bright, c.b*bright], i*3);
    size[i] = (g > .5 ? 2.2 : 1.4) + Math.random()*1.4;
    seed[i] = Math.random();
    reg[i] = r;
    if (g > .55 && samples[r].length < 500) samples[r].push(new THREE.Vector3(x,y,z));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col,3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size,1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed,1));
  geo.setAttribute('aReg', new THREE.BufferAttribute(reg,1));

  const uniforms = { uTime:{value:0}, uPR:{value:PR}, uHover:{value:-1} };
  const pointFrag = `
    varying vec3 vColor; varying float vA;
    void main(){
      float d = length(gl_PointCoord - .5);
      if (d > .5) discard;
      float a = smoothstep(.5, .0, d) * vA;
      gl_FragColor = vec4(vColor * a, a);
    }`;
  const brainMat = new THREE.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:`
      attribute vec3 aColor; attribute float aSize; attribute float aSeed; attribute float aReg;
      uniform float uTime; uniform float uPR; uniform float uHover;
      varying vec3 vColor; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.);
        float wave = pow(.5 + .5*sin(position.z*5. + position.y*3. - uTime*2.2), 10.);
        float wave2 = pow(.5 + .5*sin(length(position.xy)*9. - uTime*1.4 + aSeed), 14.);
        float tw = .75 + .25*sin(uTime*2.5 + aSeed*40.);
        float h = 1. - step(.1, abs(aReg - uHover));
        vColor = aColor * (tw + wave*1.3 + wave2*.8 + h*.9);
        vA = 1.;
        gl_PointSize = aSize * uPR * (1. + wave*.5 + h*.35) * (5.5 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: pointFrag
  });
  const cloud = new THREE.Points(geo, brainMat);
  brain.add(cloud);

  /* --- synapses + travelling sparks --- */
  const L = small ? 160 : 280;
  const lp = [], lc = [], sa = [], sb = [], so = [], sc = [];
  for (let i=0;i<L;i++){
    const r = i % 4, S = samples[r]; if (S.length < 2) continue;
    const p = S[(Math.random()*S.length)|0];
    let q = null;
    for (let k=0;k<14;k++){ const cand = S[(Math.random()*S.length)|0]; const d = cand.distanceTo(p); if (d > .12 && d < .5){ q = cand; break; } }
    if (!q) continue;
    // pull the mid-point inward so the connection dives through the tissue
    const m = p.clone().add(q).multiplyScalar(.5).multiplyScalar(.82);
    const segs = [[p,m],[m,q]];
    const cc = REG[r].ca;
    segs.forEach(([a,b]) => { lp.push(a.x,a.y,a.z,b.x,b.y,b.z); lc.push(cc.r,cc.g,cc.b,cc.r,cc.g,cc.b); });
    const off = Math.random();
    segs.forEach(([a,b],j) => { sa.push(a.x,a.y,a.z); sb.push(b.x,b.y,b.z); so.push(off + j*.5); sc.push(cc.r,cc.g,cc.b); });
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp,3));
  lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lc,3));
  brain.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({vertexColors:true, transparent:true, opacity:.16, blending:THREE.AdditiveBlending, depthWrite:false})));

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(sa,3));
  sparkGeo.setAttribute('aB', new THREE.Float32BufferAttribute(sb,3));
  sparkGeo.setAttribute('aOff', new THREE.Float32BufferAttribute(so,1));
  sparkGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(sc,3));
  brain.add(new THREE.Points(sparkGeo, new THREE.ShaderMaterial({
    uniforms, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:`
      attribute vec3 aB; attribute float aOff; attribute vec3 aColor;
      uniform float uTime; uniform float uPR;
      varying vec3 vColor; varying float vA;
      void main(){
        float f = fract(uTime*.35 + aOff);
        float live = step(f, .5);            // each half of the path is lit in turn
        float t = f*2.;
        vec3 p = mix(position, aB, clamp(t,0.,1.));
        vec4 mv = modelViewMatrix * vec4(p,1.);
        vColor = aColor * 2.2 + .35;
        vA = live;
        gl_PointSize = 5. * uPR * (5.5 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: pointFrag
  })));

  /* --- techy little things --- */
  // SPACE: an orbit with a tiny satellite circling the space lobe
  const orbit = new THREE.Group();
  orbit.position.set(-.55,.42,0); orbit.rotation.set(1.15,.35,.2);
  brain.add(orbit);
  const ringPts = []; for (let i=0;i<=128;i++){ const a=i/128*Math.PI*2; ringPts.push(new THREE.Vector3(Math.cos(a)*.95, Math.sin(a)*.72, 0)); }
  const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
  const ringMat = new THREE.LineDashedMaterial({color:0x5ccfff, dashSize:.04, gapSize:.03, transparent:true, opacity:.55});
  const ring = new THREE.Line(ringGeo, ringMat); ring.computeLineDistances(); orbit.add(ring);
  const sat = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({color:0xdfe8ff});
  const panelMat = new THREE.MeshBasicMaterial({color:0x3f7bff, transparent:true, opacity:.9});
  sat.add(new THREE.Mesh(new THREE.BoxGeometry(.06,.06,.08), bodyMat));
  const pL = new THREE.Mesh(new THREE.BoxGeometry(.16,.004,.06), panelMat); pL.position.x = -.12; sat.add(pL);
  const pR = pL.clone(); pR.position.x = .12; sat.add(pR);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.014,8,8), new THREE.MeshBasicMaterial({color:0x5ccfff}));
  beacon.position.y = .045; sat.add(beacon);
  orbit.add(sat);
  // a second, fainter orbit
  const ring2 = new THREE.Line(ringGeo, new THREE.LineBasicMaterial({color:0x8b7bff, transparent:true, opacity:.18}));
  ring2.scale.set(1.25,1.25,1); ring2.rotation.z = .9; orbit.add(ring2);

  // DATA: a live bar chart + grid floating by the data lobe
  const chart = new THREE.Group(); chart.position.set(-1.12,-.62,.45); chart.rotation.y = -.6;
  brain.add(chart);
  const grid = new THREE.GridHelper(.6, 6, 0x39f5a6, 0x1b5e48);
  grid.material.transparent = true; grid.material.opacity = .45; chart.add(grid);
  const bars = [];
  const barMat = new THREE.MeshBasicMaterial({color:0x39f5a6, transparent:true, opacity:.6});
  for (let i=0;i<6;i++){
    const m = new THREE.Mesh(new THREE.BoxGeometry(.055,1,.055), barMat);
    m.position.set(-.22 + i*.088, 0, 0); chart.add(m); bars.push(m);
  }
  // scatter "data cubes"
  const cubeMat = new THREE.MeshBasicMaterial({color:0x14b8a6, wireframe:true, transparent:true, opacity:.7});
  const cubes = [];
  for (let i=0;i<5;i++){ const m = new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.05), cubeMat); m.position.set(-1.05 + Math.random()*.4, -.15 - Math.random()*.4, .7 + Math.random()*.3); brain.add(m); cubes.push(m); }

  // CREATIVE: a golden spiral drawn near the product lobe
  const spiralPts = [];
  for (let i=0;i<=220;i++){ const th = i/220*Math.PI*4.2; const r = .012*Math.exp(.3063*th); spiralPts.push(new THREE.Vector3(Math.cos(th)*r, Math.sin(th)*r, 0)); }
  const spiral = new THREE.Line(new THREE.BufferGeometry().setFromPoints(spiralPts), new THREE.LineBasicMaterial({color:0xffb547, transparent:true, opacity:.75}));
  spiral.position.set(1.15,.72,.2); spiral.rotation.y = .7; brain.add(spiral);

  // background stars (not part of the brain)
  const starN = 1400, sp = new Float32Array(starN*3);
  for (let i=0;i<starN;i++){ const su = Math.random()*2-1, st = Math.random()*Math.PI*2, ss = Math.sqrt(1-su*su); const v = new THREE.Vector3(ss*Math.cos(st), su, ss*Math.sin(st)); v.multiplyScalar(14 + Math.random()*16); sp.set([v.x,v.y,v.z], i*3); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp,3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({color:0x9fb3ff, size:.05, transparent:true, opacity:.6, depthWrite:false}));
  scene.add(stars);

  /* --- HTML labels pinned to the lobes --- */
  const labels = REG.map((r,i) => {
    const b = document.createElement('a');
    b.className = 'lbl' + (i >= 2 ? ' r' : '');
    b.href = r.href; b.style.setProperty('--c', r.a);
    b.innerHTML = '<i></i><span>' + r.name + '</span>';
    b.addEventListener('mouseenter', () => uniforms.uHover.value = i);
    b.addEventListener('mouseleave', () => uniforms.uHover.value = -1);
    labelsEl.appendChild(b);
    return {el:b, v:new THREE.Vector3(...r.anchor), right:i >= 2};
  });
  const WORDS = ['verse','imagine','ship it','rhyme','iterate','dream','design'];
  const words = WORDS.map((w,i) => {
    const el = document.createElement('div'); el.className = 'word'; el.textContent = w;
    el.style.color = i % 2 ? 'var(--prod)' : 'var(--poem)';
    labelsEl.appendChild(el);
    const a = i/WORDS.length*Math.PI*2;
    return {el, base:new THREE.Vector3(.95 + .35*Math.cos(a*1.7), .9*Math.sin(a), .8*Math.cos(a)), ph:Math.random()*6};
  });
  const tmp = new THREE.Vector3(), ctr = new THREE.Vector3();
  let W = 1, H = 1;
  function place(el, local, xShift){
    tmp.copy(local).applyMatrix4(brain.matrixWorld);
    const depth = tmp.z - ctr.z;                       // >0 = facing the camera
    const o = Math.max(0, Math.min(1, (depth + .05) / .45));
    tmp.project(camera);
    const x = (tmp.x*.5 + .5)*W, y = (-tmp.y*.5 + .5)*H;
    el.style.transform = `translate(${x + xShift}px, ${y}px) translate(${xShift < 0 ? '-100%' : '0'}, -50%)`;
    el.style.opacity = o.toFixed(2);
    el.style.pointerEvents = o > .4 ? 'auto' : 'none';
    return o;
  }

  /* --- interaction: drag to spin, hover/click a lobe --- */
  let rotY = -.5, velY = reduce ? 0 : .18, dragging = false, lastX = 0, lastY = 0, moved = 0;
  const AUTO = reduce ? 0 : .18;
  canvas.addEventListener('pointerdown', e => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (dragging){
      const dx = e.clientX - lastX, dy = e.clientY - lastY; moved += Math.abs(dx) + Math.abs(dy);
      rotY += dx*.006; velY = dx*.006*60;
      root.rotation.x = Math.max(-.4, Math.min(.7, root.rotation.x + dy*.003));
      lastX = e.clientX; lastY = e.clientY;
    } else hoverTest(e);
  });
  const endDrag = () => { dragging = false; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', e => { endDrag(); if (moved < 6) { hoverTest(e); const r = uniforms.uHover.value; if (r >= 0) location.href = REG[r].href; } });
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', e => { if (!dragging && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.lbl'))) { uniforms.uHover.value = -1; canvas.classList.remove('hot'); labels.forEach(l => l.el.classList.remove('on')); } });

  const ray = new THREE.Raycaster(); ray.params.Points.threshold = .05;
  const mouse = new THREE.Vector2(); let lastHover = 0;
  function hoverTest(e){
    const now = performance.now(); if (now - lastHover < 40) return; lastHover = now;
    const rect = canvas.getBoundingClientRect();
    mouse.set((e.clientX - rect.left)/rect.width*2 - 1, -(e.clientY - rect.top)/rect.height*2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObject(cloud)[0];
    const r = hit ? reg[hit.index] : -1;
    uniforms.uHover.value = r;
    canvas.classList.toggle('hot', r >= 0);
    labels.forEach((l,i) => l.el.classList.toggle('on', i === r));
  }

  /* --- sizing --- */
  function resize(){
    W = hero.clientWidth; H = hero.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W/H;
    const portrait = W/H < .85;
    camera.position.z = portrait ? 8.4 : (W < 1100 ? 7 : 6.2);
    root.position.set(portrait ? 0 : (W > 1100 ? .35 : .2), portrait ? .75 : .1, 0);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  /* --- HUD --- */
  const clockEl = document.getElementById('clock'), latEl = document.getElementById('lat'), lonEl = document.getElementById('lon'), sigEl = document.getElementById('sig');
  const pad = n => String(n).padStart(2,'0');
  const fmt = (v,w) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(2).padStart(w,'0');

  /* --- loop (paused when the hero is off-screen) --- */
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, {threshold:0}).observe(hero);
  const clock = new THREE.Clock(); let t = 0, hudT = 0;
  function frame(){
    requestAnimationFrame(frame);
    if (!visible) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), .05); t += reduce ? dt*.25 : dt;
    uniforms.uTime.value = t;
    if (!dragging){ velY += (AUTO - velY)*dt*1.5; rotY += velY*dt; }
    brain.rotation.y = rotY;
    stars.rotation.y = t*.01;

    const a = t*.9; sat.position.set(Math.cos(a)*.95, Math.sin(a)*.72, 0); sat.rotation.z = a; beacon.visible = (t*2 % 1) < .5;
    bars.forEach((b,i) => { const h = .08 + .22*(.5 + .5*Math.sin(t*1.6 + i*1.1)) * (.6 + .4*Math.sin(t*.7 + i)); b.scale.y = h; b.position.y = h/2; });
    cubes.forEach((m,i) => { m.rotation.x = t*(.4 + i*.1); m.rotation.y = t*.6; });
    spiral.rotation.z = -t*.25;

    renderer.render(scene, camera);

    ctr.set(0,0,0).applyMatrix4(brain.matrixWorld);
    labels.forEach(l => place(l.el, l.v, l.right ? 14 : -14));
    words.forEach((w,i) => {
      tmp.copy(w.base); tmp.y += Math.sin(t*.6 + w.ph)*.08;
      const o = place(w.el, tmp.clone(), 0);
      w.el.style.opacity = (o * (.45 + .35*Math.sin(t*.8 + w.ph))).toFixed(2);
    });

    if (t - hudT > .25){
      hudT = t; const s = Math.floor(t);
      clockEl.textContent = `T+${pad(Math.floor(s/3600))}:${pad(Math.floor(s/60)%60)}:${pad(s%60)}`;
      const ph = t*.05; latEl.textContent = fmt(97.4/2*Math.sin(ph)*.9, 5); lonEl.textContent = fmt(((t*4) % 360) - 180, 6);
      sigEl.textContent = ['▂___','▂▄__','▂▄▆_','▂▄▆█'][Math.floor(2 + 2*Math.sin(t*.9)) % 4];
    }
  }
  frame();
})();

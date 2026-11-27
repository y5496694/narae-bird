(() => {
  'use strict';
  const main = document.querySelector('main');
  if (!main || document.getElementById('landing-source-tabs')) return;
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const original = el('div');
  original.id = 'aiedue-sites-panel';
  original.setAttribute('role', 'tabpanel');
  original.setAttribute('aria-labelledby', 'aiedue-sites-tab');
  while (main.firstChild) original.append(main.firstChild);
  const tabs = el('div', 'landing-source-tabs');
  tabs.id = 'landing-source-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '사이트 목록 선택');
  const normalTab = el('button', '', '에이두 사이트');
  const birdTab = el('button', '', '나래 버드 사이트');
  const panel = el('section', 'directory bird-directory');
  panel.id = 'aiedue-managed-sites';
  panel.hidden = true;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', 'bird-sites-tab');
  for (const [button, id, target] of [[normalTab, 'aiedue-sites-tab', original.id], [birdTab, 'bird-sites-tab', panel.id]]) {
    button.type = 'button';
    button.id = id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', target);
    tabs.append(button);
  }
  const heading = el('div', 'directory-heading');
  const headingCopy = el('div');
  headingCopy.append(el('span', 'eyebrow', 'NARAE BIRD'), el('h2', '', '나래 버드 사이트'));
  heading.append(headingCopy, el('span', 'open-note', '모든 사이트는 새 탭으로 열려요'));
  const intro = el('p', 'bird-intro', '나래 버드로 공개한 사이트를 한곳에서 찾아보세요.');
  const form = el('form', 'bird-search-form');
  form.setAttribute('role', 'search');
  const label = el('label', 'sr-only', '나래 버드 사이트 검색');
  label.htmlFor = 'bird-site-search';
  const input = el('input');
  input.id = 'bird-site-search';
  input.type = 'search';
  input.placeholder = '사이트 이름, 설명, 주소로 검색하세요';
  input.autocomplete = 'off';
  input.maxLength = 160;
  input.setAttribute('aria-controls', 'bird-site-grid');
  const clear = el('button', 'bird-clear', '지우기');
  clear.type = 'button';
  clear.hidden = true;
  clear.setAttribute('aria-label', '나래 버드 검색어 지우기');
  form.append(label, input, clear);
  const resultBar = el('div', 'result-bar');
  const status = el('p', '', '사이트 목록을 불러오는 중이에요.');
  status.id = 'bird-result-count';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const refresh = el('button', '', '목록 새로고침 ↻');
  refresh.type = 'button';
  refresh.id = 'bird-sites-refresh';
  resultBar.append(status, refresh);
  const grid = el('div', 'service-grid');
  grid.id = 'bird-site-grid';
  const empty = el('div', 'empty-state');
  empty.id = 'bird-empty-state';
  empty.hidden = true;
  const emptyTitle = el('h3');
  const emptyCopy = el('p');
  const emptyAction = el('button');
  emptyAction.type = 'button';
  empty.append(emptyTitle, emptyCopy, emptyAction);
  panel.append(heading, intro, form, resultBar, grid, empty);
  main.append(tabs, original, panel);
  const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/gu, '');
  let sites = [], state = 'loading', active = false, pending = null;
  function icon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const [tag, attrs] of [['circle', {cx: '12', cy: '12', r: '9'}], ['path', {d: 'M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z'}]]) {
      const part = document.createElementNS(svg.namespaceURI, tag);
      for (const [key, value] of Object.entries(attrs)) part.setAttribute(key, value);
      svg.append(part);
    }
    return svg;
  }
  function render() {
    const terms = input.value.normalize('NFKC').trim().split(/\s+/u).filter(Boolean).map(normalize);
    const matched = sites.filter(s => terms.every(term => normalize(`${s.title} ${s.content} ${location.host}/${s.slug}`).includes(term)));
    const cards = matched.map(s => {
      const card = el('article', 'service bird-service');
      card.dataset.slug = s.slug;
      card.dataset.category = 'tools';
      const link = el('a', 'service-link');
      link.href = '/' + s.slug;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const top = el('div', 'card-top');
      const badge = el('span', 'service-icon');
      badge.append(icon());
      const arrow = el('span', 'arrow', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      top.append(badge, arrow);
      link.append(top, el('div', 'card-label', '나래 버드 사이트'), el('h3', '', s.title), el('p', '', s.content.slice(0, 240)), el('span', 'service-address', location.host + '/' + s.slug), el('span', 'sr-only', ' (새 탭에서 열기)'));
      card.append(link);
      return card;
    });
    grid.replaceChildren(...cards);
    clear.hidden = !input.value;
    grid.setAttribute('aria-busy', String(state === 'loading'));
    empty.hidden = state === 'loading' || (state === 'ready' && matched.length > 0);
    if (state === 'error') {
      status.textContent = '사이트 목록을 불러오지 못했어요.';
      emptyTitle.textContent = '잠시 후 다시 확인해 주세요';
      emptyCopy.textContent = '에이두 사이트 탭은 계속 이용할 수 있어요.';
      emptyAction.textContent = '다시 불러오기';
    } else if (state === 'loading') {
      status.textContent = '사이트 목록을 불러오는 중이에요.';
    } else {
      status.textContent = `나래 버드 사이트 ${matched.length}개${input.value.trim() ? ' · 검색 결과' : ''}`;
      emptyTitle.textContent = sites.length ? '일치하는 사이트가 없어요' : '아직 공개된 나래 버드 사이트가 없어요';
      emptyCopy.textContent = sites.length ? '사이트 이름이나 주소를 바꿔 검색해 보세요.' : '새 사이트가 공개되면 이곳에 자동으로 표시돼요.';
      emptyAction.textContent = sites.length ? '전체 다시 보기' : '목록 새로고침';
    }
    panel.dataset.state = state;
    panel.dataset.resultCount = String(matched.length);
  }
  function load() {
    if (pending) return pending;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    refresh.disabled = true;
    pending = fetch('/domain/api/public/sites', {credentials: 'omit', cache: 'no-store', signal: controller.signal})
      .then(response => { if (!response.ok) throw Error('load failed'); return response.json(); })
      .then(body => {
        if (!Array.isArray(body.sites)) throw Error('invalid sites');
        const seen = new Set();
        sites = body.sites.filter(s => {
          if (!s || typeof s.slug !== 'string' || !/^[a-z][a-z0-9-]{2,39}$/.test(s.slug) || typeof s.title !== 'string' || typeof s.content !== 'string' || seen.has(s.slug)) return false;
          seen.add(s.slug);
          return true;
        });
        state = 'ready';
      })
      .catch(() => { state = 'error'; })
      .finally(() => { clearTimeout(timeout); pending = null; refresh.disabled = false; render(); });
    return pending;
  }
  function activate(bird) {
    active = bird;
    original.hidden = bird;
    panel.hidden = !bird;
    normalTab.setAttribute('aria-selected', String(!bird));
    birdTab.setAttribute('aria-selected', String(bird));
    normalTab.tabIndex = bird ? -1 : 0;
    birdTab.tabIndex = bird ? 0 : -1;
    const skip = document.querySelector('.skip-link');
    if (skip) skip.href = bird ? '#bird-site-grid' : '#directory';
    if (bird) load();
  }
  normalTab.addEventListener('click', () => activate(false));
  birdTab.addEventListener('click', () => activate(true));
  tabs.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const bird = event.key === 'End' || (event.key !== 'Home' && !active);
    activate(bird);
    (bird ? birdTab : normalTab).focus();
  });
  form.addEventListener('submit', event => event.preventDefault());
  input.addEventListener('input', render);
  const clearSearch = () => { input.value = ''; render(); input.focus(); };
  clear.addEventListener('click', clearSearch);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); clearSearch(); }
  });
  refresh.addEventListener('click', load);
  emptyAction.addEventListener('click', () => state === 'error' || !sites.length ? load() : clearSearch());
  window.addEventListener('focus', () => { if (active) load(); });
  document.addEventListener('visibilitychange', () => { if (active && !document.hidden) load(); });
  setInterval(() => { if (active && !document.hidden) load(); }, 30000);
  activate(false);
  render();
  load();
})();

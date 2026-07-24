(() => {
  'use strict';
  // Inline review comments. Anchoring: block ids (stable-ish across edits of a
  // living doc); a comment whose anchor disappears is preserved in an orphan
  // bucket with its stored title+quote. Storage is browser-local only.
  const KEY = 'pointdefense.gdd.comments.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const persist = () => localStorage.setItem(KEY, JSON.stringify(comments));
  let comments = load();

  const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  const titleOf = el => {
    if (/^H[23]$/.test(el.tagName)) return el.textContent.replace('💬', '').trim();
    const n = el.querySelector('.law-name, .canon-tag');
    if (n) return n.textContent.trim();
    if (el.classList.contains('tierbox')) return 'Preamble';
    if (el.classList.contains('openbox')) return 'Open questions';
    return el.id;
  };
  // Assign ids to blocks that lack them so they can anchor comments.
  document.querySelectorAll('main h3').forEach(h => { if (!h.id) h.id = 'h3-' + slug(h.textContent); });
  document.querySelectorAll('blockquote.canon, .tierbox, .openbox').forEach(el => {
    if (!el.id) el.id = (el.classList.contains('canon') ? 'canon-' : 'box-') + slug(titleOf(el));
  });

  const anchors = [...document.querySelectorAll(
    'main h2[id], main h3[id], .law[id], blockquote.canon[id], .tierbox[id], .openbox[id]')];
  const anchorIds = anchors.map(a => a.id);

  // ---------- toolbar + toast ----------
  const bar = document.createElement('div'); bar.className = 'cmt-bar';
  const countEl = document.createElement('span'); countEl.textContent = '💬 0';
  const exBtn = document.createElement('button'); exBtn.textContent = 'export';
  const clrBtn = document.createElement('button'); clrBtn.textContent = 'clear';
  bar.append(countEl, exBtn, clrBtn);
  document.body.appendChild(bar);
  let toastT = null;
  function toast(msg) {
    let t = document.querySelector('.cmt-toast');
    if (!t) { t = document.createElement('div'); t.className = 'cmt-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600);
  }

  // ---------- rendering ----------
  function noteEl(c) {
    const d = document.createElement('div'); d.className = 'cmt-note'; d.dataset.cid = c.cid;
    if (c.quote) { const q = document.createElement('div'); q.className = 'cmt-quote'; q.textContent = c.quote; d.appendChild(q); }
    const t = document.createElement('div'); t.className = 'cmt-text'; t.textContent = c.text; d.appendChild(t);
    const f = document.createElement('div'); f.className = 'cmt-foot';
    const when = document.createElement('span');
    when.textContent = new Date(c.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const ed = document.createElement('button'); ed.textContent = 'edit';
    ed.onclick = () => openForm(null, c, '');
    const del = document.createElement('button'); del.textContent = 'delete';
    del.onclick = () => { comments = comments.filter(x => x.cid !== c.cid); persist(); renderAll(); };
    f.append(when, ed, del); d.appendChild(f);
    return d;
  }

  function renderAll() {
    closeForm();
    document.querySelectorAll('.cmt-note').forEach(e => e.remove());
    document.getElementById('cmt-orphans')?.remove();
    const byAnchor = new Map(), orphans = [];
    for (const c of comments) {
      if (document.getElementById(c.anchor)) {
        if (!byAnchor.has(c.anchor)) byAnchor.set(c.anchor, []);
        byAnchor.get(c.anchor).push(c);
      } else orphans.push(c);
    }
    for (const [id, list] of byAnchor) {
      let after = document.getElementById(id);
      for (const c of list) { const n = noteEl(c); after.insertAdjacentElement('afterend', n); after = n; }
    }
    if (orphans.length) {
      const box = document.createElement('div'); box.id = 'cmt-orphans';
      const h = document.createElement('h3'); h.textContent = 'Orphaned comments — their anchor left the document'; box.appendChild(h);
      for (const c of orphans) {
        const label = document.createElement('div'); label.className = 'meta-line';
        label.textContent = 'was on: ' + (c.title || c.anchor); box.appendChild(label);
        box.appendChild(noteEl(c));
      }
      const hr = document.querySelector('main > hr');
      hr ? hr.insertAdjacentElement('beforebegin', box) : document.querySelector('main').appendChild(box);
    }
    countEl.textContent = '💬 ' + comments.length;
  }

  // ---------- comment form ----------
  function closeForm() {
    document.getElementById('cmt-form')?.remove();
    document.querySelectorAll('.cmt-note').forEach(n => n.style.display = '');
  }
  function openForm(anchorEl, existing, presetQuote) {
    closeForm();
    const form = document.createElement('div'); form.className = 'cmt-form'; form.id = 'cmt-form';
    const quote = existing ? existing.quote : presetQuote;
    if (quote) { const q = document.createElement('div'); q.className = 'cmt-quote'; q.textContent = quote; form.appendChild(q); }
    const ta = document.createElement('textarea');
    ta.placeholder = 'Comment — exported as markdown for Zephyr';
    ta.value = existing ? existing.text : '';
    form.appendChild(ta);
    const row = document.createElement('div'); row.className = 'cmt-foot';
    const ok = document.createElement('button'); ok.textContent = existing ? 'save' : 'add';
    ok.onclick = () => {
      const text = ta.value.trim();
      if (!text) return closeForm();
      if (existing) { existing.text = text; existing.ts = Date.now(); }
      else comments.push({
        cid: Math.random().toString(36).slice(2), anchor: anchorEl.id,
        title: titleOf(anchorEl), quote, text, ts: Date.now(),
      });
      persist(); renderAll();
    };
    const no = document.createElement('button'); no.textContent = 'cancel'; no.onclick = closeForm;
    row.append(ok, no); form.appendChild(row);
    if (existing) {
      const n = document.querySelector('.cmt-note[data-cid="' + existing.cid + '"]');
      n.insertAdjacentElement('afterend', form); n.style.display = 'none';
    } else anchorEl.insertAdjacentElement('afterend', form);
    ta.focus();
  }

  // ---------- 💬 buttons (pointerdown snapshots the selection before the click eats it) ----------
  for (const a of anchors) {
    const b = document.createElement('button'); b.className = 'cmt-btn'; b.textContent = '💬';
    b.title = 'comment on this block (select text first to quote it)';
    let pending = '';
    b.addEventListener('pointerdown', () => {
      const sel = window.getSelection();
      pending = sel && a.contains(sel.anchorNode) ? sel.toString().trim().slice(0, 300) : '';
    });
    b.addEventListener('click', e => { e.preventDefault(); openForm(a, null, pending); });
    a.appendChild(b);
  }

  // ---------- export ----------
  function exportMd() {
    if (!comments.length) return toast('no comments to export');
    const ver = (document.querySelector('.meta-line')?.textContent || 'GDD').split('·')[0].trim();
    const order = c => { const i = anchorIds.indexOf(c.anchor); return i < 0 ? 1e9 : i; };
    const sorted = [...comments].sort((x, y) => order(x) - order(y) || x.ts - y.ts);
    const lines = ['# GDD comments — ' + ver + ' · exported ' + new Date().toISOString().slice(0, 16).replace('T', ' ')];
    for (const c of sorted) {
      lines.push('', '## ' + (c.title || c.anchor) + '  (#' + c.anchor + ')');
      if (c.quote) lines.push('> ' + c.quote.replace(/\n/g, '\n> '), '');
      lines.push(c.text);
    }
    const md = lines.join('\n') + '\n';
    const fallback = () => {
      const blob = new Blob([md], { type: 'text/markdown' });
      const dl = document.createElement('a');
      dl.href = URL.createObjectURL(blob); dl.download = 'gdd-comments.md'; dl.click();
      URL.revokeObjectURL(dl.href);
      toast('downloaded gdd-comments.md');
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(md).then(
        () => toast('copied ' + comments.length + ' comment' + (comments.length > 1 ? 's' : '') + ' as markdown'),
        fallback);
    } else fallback();
  }
  exBtn.onclick = exportMd;
  clrBtn.onclick = () => {
    if (comments.length && confirm('Delete all ' + comments.length + ' comments? Export first if they matter.')) {
      comments = []; persist(); renderAll(); toast('cleared');
    }
  };

  renderAll();
})();

(() => {
  const journal = {
    accountId: 'all',
    from: '',
    to: '',
    printMode: null,
    initialized: false
  };

  const accountName = (id) => state.kas.find((account) => account.id === id)?.nama || 'Akun dihapus';
  const isFile = window.location.protocol === 'file:';
  const today = new Date();
  const todayDate = dateKey(today);
  const monthStart = `${todayDate.slice(0, 7)}-01`;

  function defaultJournalFrom() {
    return state.transaksi.map((transaction) => transaction.tanggal).sort()[0] || monthStart;
  }

  function currentPrintRoute() {
    if (window.location.pathname === '/cetak/kas-semua') return { mode: 'all' };
    const match = window.location.pathname.match(/^\/cetak\/kas\/([0-9a-f-]{36})$/i);
    if (match) return { mode: 'account', accountId: match[1] };
    if (isFile && window.location.hash.startsWith('#cetak-kas-semua')) return { mode: 'all' };
    if (isFile && window.location.hash.startsWith('#cetak-kas-')) return { mode: 'account', accountId: window.location.hash.slice('#cetak-kas-'.length) };
    return null;
  }

  function setRoute(route) {
    if (isFile) {
      window.location.hash = route === '/jurnal-kas' ? 'jurnal-kas' : route.replaceAll('/', '-').slice(1);
      return;
    }
    window.history.pushState({}, '', route);
  }

  function ensurePanel() {
    let panel = document.getElementById('view-jurnal-kas');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.className = 'view-panel jurnal-kas-view';
    panel.id = 'view-jurnal-kas';
    panel.innerHTML = `
      <div class="page-heading jurnal-heading no-print">
        <div><p class="eyebrow">BUKU BESAR KAS</p><h1>Jurnal <em>kas</em></h1><p class="muted">Saldo awal dihitung dari seluruh mutasi sebelum tanggal mulai.</p></div>
        <button class="button button-quiet" type="button" id="journal-back"><i data-lucide="arrow-left"></i> Kembali</button>
      </div>
      <div class="jurnal-print-header"><strong>ANNISA BENO CAFE</strong><h1 id="journal-print-title">BUKU KAS</h1><p id="journal-print-period"></p></div>
      <form class="jurnal-filter no-print" id="journal-filter">
        <label>Akun kas<select id="journal-account"></select></label>
        <label>Dari tanggal<input id="journal-from" type="date" required></label>
        <label>Sampai tanggal<input id="journal-to" type="date" required></label>
        <button class="button button-primary" type="submit"><i data-lucide="filter"></i> Terapkan</button>
        <span class="jurnal-filter-spacer"></span>
        <button class="button button-quiet" type="button" id="journal-print-account"><i data-lucide="printer"></i> Cetak Akun Ini</button>
        <button class="button button-quiet" type="button" id="journal-print-all"><i data-lucide="printer"></i> Cetak Semua Kas</button>
        <p class="jurnal-error" id="journal-error" aria-live="polite"></p>
      </form>
      <div class="jurnal-print-account" id="journal-account-report">
        <div class="jurnal-summary"><div><span>Saldo awal</span><strong id="journal-opening">Rp0</strong></div><div><span>Total debit / masuk</span><strong class="jurnal-debit" id="journal-debit">Rp0</strong></div><div><span>Total kredit / keluar</span><strong class="jurnal-credit" id="journal-credit">Rp0</strong></div><div><span>Saldo akhir</span><strong id="journal-closing">Rp0</strong></div></div>
        <div class="jurnal-table-wrap"><table class="jurnal-table"><thead><tr><th>TANGGAL</th><th>KETERANGAN</th><th class="jurnal-number">DEBIT (MASUK)</th><th class="jurnal-number">KREDIT (KELUAR)</th><th class="jurnal-number">SALDO</th></tr></thead><tbody id="journal-rows"></tbody><tfoot><tr><th colspan="2">TOTAL MUTASI PERIODE</th><th class="jurnal-number jurnal-debit" id="journal-total-debit">Rp0</th><th class="jurnal-number jurnal-credit" id="journal-total-credit">Rp0</th><th class="jurnal-number" id="journal-total-balance">Rp0</th></tr></tfoot></table></div>
        <div class="jurnal-signatures"><div>Dibuat oleh,<span></span></div><div>Disetujui oleh,<span></span></div></div>
      </div>
      <div class="jurnal-print-all" id="journal-all-report">
        <div class="jurnal-table-wrap"><table class="jurnal-table"><thead><tr><th>NO</th><th>NAMA AKUN</th><th class="jurnal-number">SALDO AWAL</th><th class="jurnal-number">TOTAL MASUK</th><th class="jurnal-number">TOTAL KELUAR</th><th class="jurnal-number">SALDO AKHIR</th></tr></thead><tbody id="journal-all-rows"></tbody><tfoot><tr><th colspan="2">TOTAL</th><th class="jurnal-number" id="journal-all-opening">Rp0</th><th class="jurnal-number jurnal-debit" id="journal-all-debit">Rp0</th><th class="jurnal-number jurnal-credit" id="journal-all-credit">Rp0</th><th class="jurnal-number" id="journal-all-closing">Rp0</th></tr></tfoot></table></div>
        <div class="jurnal-signatures"><div>Dibuat oleh,<span></span></div><div>Disetujui oleh,<span></span></div></div>
      </div>`;
    document.querySelector('.main-content').append(panel);
    bindPanelEvents(panel);
    return panel;
  }

  function movements(accountId = 'all') {
    const rows = [];
    state.transaksi.forEach((transaction) => {
      (transaction.detail_transaksi || []).forEach((detail) => {
        if (accountId !== 'all' && detail.kas_id !== accountId) return;
        const direction = transaction.jenis === 'transfer' ? detail.arah : transaction.jenis;
        if (!['masuk', 'keluar'].includes(direction)) return;
        rows.push({
          tanggal: transaction.tanggal,
          createdAt: transaction.created_at || '',
          keterangan: transaction.catatan,
          akun: accountName(detail.kas_id),
          rincian: detail.catatan || detail.kategori?.nama || '',
          arah: direction,
          nominal: Number(detail.nominal || 0),
          jenis: transaction.jenis
        });
      });
    });
    return rows.sort((first, second) => first.tanggal.localeCompare(second.tanggal) || first.createdAt.localeCompare(second.createdAt));
  }

  function accountPeriod(accountId) {
    const allRows = movements(accountId);
    const openingRows = allRows.filter((row) => row.tanggal < journal.from);
    const periodRows = allRows.filter((row) => row.tanggal >= journal.from && row.tanggal <= journal.to);
    const opening = openingRows.reduce((balance, row) => balance + (row.arah === 'masuk' ? row.nominal : -row.nominal), 0);
    let balance = opening;
    let debit = 0;
    let credit = 0;
    const rows = periodRows.map((row) => {
      if (row.arah === 'masuk') debit += row.nominal;
      else credit += row.nominal;
      balance += row.arah === 'masuk' ? row.nominal : -row.nominal;
      return { ...row, saldo: balance };
    });
    return { opening, debit, credit, closing: balance, rows };
  }

  function renderJournal() {
    const panel = ensurePanel();
    const accountSelect = panel.querySelector('#journal-account');
    journal.from = journal.from || defaultJournalFrom();
    journal.to = journal.to || todayDate;
    const printRoute = currentPrintRoute();
    if (printRoute?.mode === 'account') journal.accountId = printRoute.accountId;
    const selectedAccount = journal.accountId || state.kas.find((account) => account.nama === 'Kas Utama')?.id || state.kas[0]?.id || 'all';
    journal.accountId = selectedAccount;
    accountSelect.innerHTML = `<option value="all">Semua Kas</option>${orderedKas().map((account) => `<option value="${account.id}">${escapeHtml(account.nama)}</option>`).join('')}`;
    accountSelect.value = selectedAccount;
    panel.querySelector('#journal-from').value = journal.from || monthStart;
    panel.querySelector('#journal-to').value = journal.to || todayDate;
    const account = state.kas.find((item) => item.id === journal.accountId);
    const allMode = journal.printMode === 'all' || printRoute?.mode === 'all';
    const selectedAccountId = journal.accountId === 'all' ? 'all' : journal.accountId;
    const period = accountPeriod(selectedAccountId);

    panel.querySelector('#journal-print-title').textContent = allMode ? 'REKAPITULASI SEMUA AKUN KAS' : `BUKU KAS - ${account?.nama || 'Semua Kas'}`;
    panel.querySelector('#journal-print-period').textContent = `Periode ${displayDate(journal.from)} s.d. ${displayDate(journal.to)}`;
    panel.querySelector('#journal-account-report').hidden = allMode;
    panel.querySelector('#journal-all-report').hidden = !allMode;
    panel.querySelector('#journal-print-account').disabled = state.kas.length === 0;

    panel.querySelector('#journal-opening').textContent = money(period.opening);
    panel.querySelector('#journal-debit').textContent = money(period.debit);
    panel.querySelector('#journal-credit').textContent = money(period.credit);
    panel.querySelector('#journal-closing').textContent = money(period.closing);
    panel.querySelector('#journal-total-debit').textContent = money(period.debit);
    panel.querySelector('#journal-total-credit').textContent = money(period.credit);
    panel.querySelector('#journal-total-balance').textContent = money(period.closing);
    panel.querySelector('#journal-rows').innerHTML = [
      `<tr class="jurnal-opening-row"><td>${displayDate(journal.from)}</td><td>Saldo Awal</td><td class="jurnal-number">-</td><td class="jurnal-number">-</td><td class="jurnal-number">${money(period.opening)}</td></tr>`,
      ...period.rows.map((row) => `<tr><td>${displayDate(row.tanggal)}</td><td>${escapeHtml(row.keterangan)}${journal.accountId === 'all' ? ` · ${escapeHtml(row.akun)}` : ''}${row.rincian ? `<small>${escapeHtml(row.rincian)}</small>` : ''}</td><td class="jurnal-number jurnal-debit">${row.arah === 'masuk' ? money(row.nominal) : '-'}</td><td class="jurnal-number jurnal-credit">${row.arah === 'keluar' ? money(row.nominal) : '-'}</td><td class="jurnal-number">${money(row.saldo)}</td></tr>`)
    ].join('');

    const accounts = state.kas.map((item) => {
      const summary = accountPeriod(item.id);
      return { nama: item.nama, ...summary };
    });
    const allTotals = accounts.reduce((totals, item) => ({ opening: totals.opening + item.opening, debit: totals.debit + item.debit, credit: totals.credit + item.credit, closing: totals.closing + item.closing }), { opening: 0, debit: 0, credit: 0, closing: 0 });
    panel.querySelector('#journal-all-rows').innerHTML = accounts.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.nama)}</td><td class="jurnal-number">${money(item.opening)}</td><td class="jurnal-number jurnal-debit">${money(item.debit)}</td><td class="jurnal-number jurnal-credit">${money(item.credit)}</td><td class="jurnal-number">${money(item.closing)}</td></tr>`).join('');
    panel.querySelector('#journal-all-opening').textContent = money(allTotals.opening);
    panel.querySelector('#journal-all-debit').textContent = money(allTotals.debit);
    panel.querySelector('#journal-all-credit').textContent = money(allTotals.credit);
    panel.querySelector('#journal-all-closing').textContent = money(allTotals.closing);
    refreshIcons();
  }

  function activateJournalView() {
    const panel = ensurePanel();
    document.querySelectorAll('.view-panel').forEach((item) => item.classList.toggle('active', item === panel));
    document.querySelectorAll('.nav-link').forEach((item) => item.classList.toggle('active', item.dataset.view === 'jurnal-kas'));
    document.querySelector('#breadcrumb-current').textContent = 'Jurnal Kas';
    document.querySelector('#sidebar').classList.remove('open');
  }

  function openJournal(route = true) {
    ensurePanel();
    if (!journal.from) journal.from = defaultJournalFrom();
    if (!journal.to) journal.to = todayDate;
    activateJournalView();
    renderJournal();
    if (route) setRoute('/jurnal-kas');
  }

  function printAccount() {
    if (journal.accountId === 'all') {
      const accountWithActivity = state.kas.find((account) => movements(account.id).some((row) => row.tanggal >= journal.from && row.tanggal <= journal.to));
      journal.accountId = accountWithActivity?.id || state.kas.find((account) => account.nama === 'Kas Utama')?.id || state.kas[0]?.id || '';
    }
    if (!journal.accountId) return;
    journal.printMode = 'account';
    setRoute(`/cetak/kas/${journal.accountId}`);
    activateJournalView();
    renderJournal();
    document.body.classList.add('jurnal-printing');
    window.print();
  }

  function printAllAccounts() {
    journal.printMode = 'all';
    setRoute('/cetak/kas-semua');
    activateJournalView();
    renderJournal();
    document.body.classList.add('jurnal-printing');
    window.print();
  }

  function bindPanelEvents(panel) {
    panel.querySelector('#journal-filter').addEventListener('submit', (event) => {
      event.preventDefault();
      const from = panel.querySelector('#journal-from').value;
      const to = panel.querySelector('#journal-to').value;
      if (!from || !to || from > to) {
        panel.querySelector('#journal-error').textContent = 'Tanggal awal harus sama dengan atau sebelum tanggal akhir.';
        return;
      }
      panel.querySelector('#journal-error').textContent = '';
      journal.from = from;
      journal.to = to;
      journal.accountId = panel.querySelector('#journal-account').value;
      renderJournal();
    });
    panel.querySelector('#journal-account').addEventListener('change', (event) => {
      journal.accountId = event.target.value;
      renderJournal();
    });
    panel.querySelector('#journal-print-account').addEventListener('click', printAccount);
    panel.querySelector('#journal-print-all').addEventListener('click', printAllAccounts);
    panel.querySelector('#journal-back').addEventListener('click', () => {
      setView('overview');
      document.querySelector('#breadcrumb-current').textContent = 'Ringkasan';
      setRoute('/');
    });
  }

  function setupJournal() {
    const link = document.querySelector('[data-view="jurnal-kas"]');
    if (link) link.addEventListener('click', (event) => {
      event.preventDefault();
      openJournal();
    });

    window.addEventListener('afterprint', () => {
      journal.printMode = null;
      document.body.classList.remove('jurnal-printing', 'jurnal-print-all');
      if ((!isFile && window.location.pathname.startsWith('/cetak/')) || (isFile && window.location.hash.startsWith('#cetak-kas'))) setRoute('/jurnal-kas');
      activateJournalView();
      renderJournal();
    });

    const printRoute = currentPrintRoute();
    const journalRoute = window.location.pathname === '/jurnal-kas' || (isFile && window.location.hash === '#jurnal-kas');
    if (printRoute) {
      journal.printMode = printRoute.mode;
      if (printRoute.accountId) journal.accountId = printRoute.accountId;
    }

    const appShell = document.querySelector('#app-shell');
    const syncLabel = document.querySelector('#sync-label');
    let initialRouteHandled = false;
    const observer = new MutationObserver(() => {
      if (appShell.hidden || syncLabel.textContent !== 'Tersinkron') return;
      if (!initialRouteHandled) {
        initialRouteHandled = true;
        if (printRoute) {
          journal.from = journal.from || defaultJournalFrom();
          journal.to = journal.to || todayDate;
          openJournal(false);
          renderJournal();
          window.setTimeout(() => window.print(), 150);
        } else if (journalRoute) {
          openJournal(false);
        }
        return;
      }
      if (document.querySelector('#view-jurnal-kas.active')) renderJournal();
    });
    observer.observe(syncLabel, { childList: true, characterData: true, subtree: true });
    observer.observe(appShell, { attributes: true, attributeFilter: ['hidden'] });
    if (!appShell.hidden && syncLabel.textContent === 'Tersinkron') {
      if (printRoute) {
        journal.from = journal.from || defaultJournalFrom();
        journal.to = journal.to || todayDate;
        openJournal(false);
        renderJournal();
        window.setTimeout(() => window.print(), 150);
      } else if (journalRoute) {
        openJournal(false);
      }
      initialRouteHandled = true;
    }

    window.addEventListener('popstate', () => {
      if (window.location.pathname === '/jurnal-kas') openJournal(false);
      else if (!window.location.pathname.startsWith('/cetak/')) {
        setView('overview');
        document.querySelector('#breadcrumb-current').textContent = 'Ringkasan';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupJournal();
    if (window.location.hash === '#jurnal-kas' && !document.querySelector('#app-shell').hidden) openJournal(false);
  });
})();

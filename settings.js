const youtubeNavSettings = (() => {
    const defaults = { enabled: true, zoomPercent: 20 };
    const storageKeys = { enabled: 'youtubeNavEnabled', zoomPercent: 'youtubeNavZoomPercent' };
    const listeners = new Set();
    const pendingWrites = new Map();
    const pendingChanges = new Map();
    let settings = { ...defaults };
    let saveQueue = Promise.resolve();
    let opener = null;

    function normalize(values) {
        return {
            enabled: typeof values.enabled === 'boolean' ? values.enabled : defaults.enabled,
            zoomPercent: typeof values.zoomPercent === 'number' && Number.isFinite(values.zoomPercent)
                ? Math.min(20, Math.max(0, Math.round(values.zoomPercent))) : defaults.zoomPercent
        };
    }

    const host = document.createElement('div');
    host.setAttribute('data-youtube-nav-settings-dialog', '');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
        <style>
            :host { color-scheme: dark; font: 14px/1.5 system-ui, sans-serif; }
            * { box-sizing: border-box; }
            dialog {
                width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
                margin: auto; padding: 24px; border: 1px solid #444; border-radius: 20px;
                background: #202020; color: #f5f5f5; box-shadow: 0 20px 80px #0009;
                overflow: auto; font: inherit;
            }
            dialog::backdrop { background: #0007; }
            header { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
            h2 { margin: 4px 0 0; font-size: 22px; line-height: 1.4; }
            .eyebrow { margin: 0; color: #a9a9a9; font-size: 12px; }
            button, input { font: inherit; }
            button { cursor: pointer; }
            button:focus-visible, input:focus-visible { outline: 3px solid #7ee790; outline-offset: 4px; }
            .close { width: 40px; height: 40px; flex-shrink: 0; border: 0; border-radius: 50%; background: #333; color: inherit; font-size: 24px; }
            .toggle { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 28px; min-height: 48px; font-weight: 600; cursor: pointer; }
            #enabled { appearance: none; width: 48px; height: 28px; margin: 0; border: 1px solid #999; border-radius: 20px; background: #666; position: relative; flex-shrink: 0; cursor: pointer; }
            #enabled::after { content: ''; position: absolute; width: 20px; height: 20px; top: 3px; left: 3px; border-radius: 50%; background: #fff; }
            #enabled:checked { background: #71dc88; border-color: #71dc88; }
            #enabled:checked::after { left: 23px; background: #163a1e; }
            .hint { margin: 4px 0 0; color: #bbb; font-size: 13px; }
            fieldset { min-width: 0; margin: 24px 0 0; padding: 24px 0 0; border: 0; border-top: 1px solid #444; }
            fieldset:disabled { opacity: 0.5; }
            .range-label { display: flex; justify-content: space-between; gap: 16px; font-weight: 600; }
            output { color: #91eba2; font-variant-numeric: tabular-nums; }
            #zoom { display: block; width: 100%; height: 44px; margin: 12px 0 0; accent-color: #7ee790; cursor: pointer; }
            .limits { display: flex; justify-content: space-between; color: #bbb; font-size: 12px; }
            #status { min-height: 21px; margin: 24px 0 0; color: #bbb; font-size: 13px; }
        </style>
        <dialog aria-labelledby="title" aria-describedby="subtitle">
            <header>
                <div><p class="eyebrow" id="subtitle">YouTube Keyboard Navigation</p><h2 id="title">拡張機能の設定</h2></div>
                <button type="button" class="close" aria-label="設定を閉じる" autofocus>×</button>
            </header>
            <label class="toggle" for="enabled">拡張機能を有効にする<input id="enabled" type="checkbox" role="switch" aria-describedby="enabled-hint"></label>
            <p class="hint" id="enabled-hint">オフにすると、YouTube本来の表示とキー操作に戻ります。設定ボタンは引き続き使えます。</p>
            <fieldset id="appearance">
                <label class="range-label" for="zoom">選択時の拡大率<output id="zoom-value" for="zoom"></output></label>
                <input id="zoom" type="range" min="0" max="20" step="1" aria-describedby="zoom-hint">
                <div class="limits" aria-hidden="true"><span>0%（拡大なし）</span><span>20%</span></div>
                <p class="hint" id="zoom-hint">選択枠とプレビューにすぐ反映されます。</p>
            </fieldset>
            <p id="status" role="status" aria-live="polite"></p>
        </dialog>`;

    const dialog = root.querySelector('dialog');
    const enabledInput = root.querySelector('#enabled');
    const zoomInput = root.querySelector('#zoom');
    const status = root.querySelector('#status');

    function render() {
        enabledInput.checked = settings.enabled;
        zoomInput.value = settings.zoomPercent;
        zoomInput.setAttribute('aria-valuetext', `${settings.zoomPercent}%拡大`);
        root.querySelector('#zoom-value').textContent = `+${settings.zoomPercent}%`;
        root.querySelector('#appearance').disabled = !settings.enabled;
    }

    function notify() {
        render();
        listeners.forEach(listener => listener({ ...settings }));
    }

    function update(key, value) {
        settings = normalize({ ...settings, [key]: value });
        notify();
        status.textContent = '保存中…';
        const values = { [storageKeys[key]]: settings[key] };
        const write = {};
        pendingWrites.set(key, write);
        saveQueue = saveQueue.then(async () => {
            try {
                await chrome.storage.local.set(values);
                status.textContent = '設定を保存しました。';
                if (pendingWrites.get(key) === write && pendingChanges.has(key)) {
                    settings = normalize({ ...settings, [key]: pendingChanges.get(key) });
                    notify();
                }
            } catch (error) {
                status.textContent = '保存できませんでした。変更はこのタブでのみ有効です。ページを再読み込みして再度お試しください。';
            } finally {
                if (pendingWrites.get(key) === write) {
                    pendingWrites.delete(key);
                    pendingChanges.delete(key);
                }
            }
        });
    }

    enabledInput.addEventListener('change', () => update('enabled', enabledInput.checked));
    zoomInput.addEventListener('input', () => update('zoomPercent', Number(zoomInput.value)));
    root.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
        if (opener?.isConnected) opener.focus();
    });

    const gear = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 1 3h4l1-3 3-1 2-3-2-2 1-3-3-2-1-3Z"/><circle cx="10" cy="11.5" r="3"/></svg>';

    function createButton(mini) {
        const entry = document.createElement('div');
        entry.setAttribute('data-youtube-nav-settings-entry', '');
        const shadow = entry.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <style>
                :host { display: block; color: var(--yt-spec-text-primary, #f1f1f1); }
                button { display: flex; align-items: center; gap: ${mini ? '6px' : '24px'}; flex-direction: ${mini ? 'column' : 'row'}; width: 100%; min-height: ${mini ? '74px' : '40px'}; padding: ${mini ? '14px 0' : '0 12px'}; border: 0; border-radius: 10px; background: transparent; color: inherit; font: ${mini ? '10px' : '14px'}/1.4 Roboto, Arial, sans-serif; cursor: pointer; }
                button:hover { background: var(--yt-spec-badge-chip-background, #ffffff1a); }
                button:focus-visible { outline: 3px solid #71dc88; outline-offset: -3px; }
                svg { flex-shrink: 0; }
            </style>
            <button type="button" aria-label="YouTube Keyboard Navigation の設定" aria-haspopup="dialog" title="YouTube Keyboard Navigation の設定">${gear}<span>拡張設定</span></button>`;
        const button = shadow.querySelector('button');
        button.addEventListener('click', event => {
            event.stopPropagation();
            opener = button;
            if (!dialog.open) dialog.showModal();
        });
        return entry;
    }

    function ensureButtons() {
        if (!host.isConnected) document.body.append(host);
        document.querySelectorAll('ytd-mini-guide-entry-renderer a[href="/feed/you"], ytd-mini-guide-entry-renderer a[href="/feed/library"], ytd-guide-entry-renderer a[href="/feed/you"], ytd-guide-entry-renderer a[href="/feed/library"]').forEach(link => {
            const entry = link.closest('ytd-mini-guide-entry-renderer, ytd-guide-entry-renderer');
            const anchor = entry.parentElement.id === 'header' ? entry.parentElement : entry;
            let button = anchor.parentElement.querySelector(':scope > [data-youtube-nav-settings-entry]');
            if (!button) button = createButton(entry.matches('ytd-mini-guide-entry-renderer'));
            if (anchor.nextElementSibling !== button) anchor.after(button);
        });
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        let changed = false;
        const values = { ...settings };
        Object.entries(storageKeys).forEach(([key, storageKey]) => {
            if (changes[storageKey]) {
                if (pendingWrites.has(key)) {
                    pendingChanges.set(key, changes[storageKey].newValue);
                } else {
                    values[key] = changes[storageKey].newValue;
                    changed = true;
                }
            }
        });
        if (changed) {
            settings = normalize(values);
            notify();
        }
    });

    const ready = (async () => {
        try {
            const values = await chrome.storage.local.get(Object.values(storageKeys));
            settings = normalize({ enabled: values[storageKeys.enabled], zoomPercent: values[storageKeys.zoomPercent] });
            status.textContent = '変更は自動で保存されます。';
        } catch (error) {
            status.textContent = '設定を読み込めませんでした。ページを再読み込みして再度お試しください。';
        }
        render();
        ensureButtons();
        let refreshTimeout = null;
        new MutationObserver(() => {
            if (refreshTimeout !== null) return;
            refreshTimeout = setTimeout(() => {
                refreshTimeout = null;
                ensureButtons();
            }, 100);
        }).observe(document.body, { childList: true, subtree: true });
        return { ...settings };
    })();

    return {
        ready,
        get isOpen() { return dialog.open; },
        subscribe(listener) { listeners.add(listener); }
    };
})();

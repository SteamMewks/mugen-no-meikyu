// 新しい更新を配列の先頭へ追加してください。items は変更内容の箇条書きです。
window.MUGEN_UPDATE_HISTORY = [
  {
    version: '2026.10.30-2',
    date: '2026-10-30',
    title: '公開版の設定整理',
    items: [
      'デバッグ機能と専用関数・呼び出し経路を削除。',
      '設定に更新履歴を追加。'
    ]
  },
  {
    version: '2026.10.30-1',
    date: '2026-10-30',
    title: 'PWA版の構成を更新',
    items: [
      'サモナミッションの調査完了会話に話者名が混ざる不具合を修正。',
      'HTML・CSS・JavaScriptを分割し、PWAに対応。',
      'タイトル画面の右下にバージョン表示を追加。'
    ]
  }
];
function renderUpdateHistory(container) {
  container.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = '更新履歴';
  container.appendChild(heading);
  for (const entry of window.MUGEN_UPDATE_HISTORY) {
    const article = document.createElement('article');
    article.className = 'update-history-entry';
    const title = document.createElement('h4');
    title.textContent = entry.title;
    const meta = document.createElement('p');
    meta.className = 'update-history-meta';
    meta.textContent = entry.date + ' · Ver. ' + entry.version;
    const list = document.createElement('ul');
    for (const item of entry.items) {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    }
    article.append(meta, title, list);
    container.appendChild(article);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const path = location.pathname.split('/').filter(Boolean);
  const slug = path[0] || new URLSearchParams(location.search).get('biz') || '';
  const grid = document.getElementById('album-grid');
  const index = document.getElementById('album-index');
  const detail = document.getElementById('album-detail');
  const back = document.getElementById('gallery-back');
  const detailBack = document.getElementById('detail-back');
  let albums = [];

  back.href = slug ? '/' + encodeURIComponent(slug) : '/';
  function photo(path) {
    return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path || '')
      ? SUPABASE_URL + '/storage/v1/object/public/service-photos/' + path : '';
  }
  function normalise(data) {
    const saved = Array.isArray(data.gallery_albums) ? data.gallery_albums : [];
    const structured = saved.map((album, position) => ({
      id: String(album.id || position),
      title: album.title || 'Untitled collection',
      date: album.date || '',
      description: album.description || '',
      paths: Array.isArray(album.photo_paths) ? album.photo_paths : [],
      cover: album.cover_photo_path || (album.photo_paths || [])[0] || ''
    })).filter(album => album.paths.length);
    if (structured.length) return structured;
    const paths = Array.isArray(data.gallery_photo_paths) ? data.gallery_photo_paths : [];
    return paths.length ? [{id:'portfolio',title:'Portfolio',date:'',description:'A selection of our latest work.',paths,cover:paths[0]}] : [];
  }
  function renderIndex() {
    index.hidden = false; detail.hidden = true; grid.replaceChildren();
    if (!albums.length) {
      const empty = document.createElement('p'); empty.className = 'album-empty';
      empty.textContent = 'New portfolio collections will appear here soon.';
      grid.appendChild(empty); return;
    }
    albums.forEach(album => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'album-card';
      const cover = document.createElement('img'); cover.className = 'album-cover'; cover.alt = '';
      const coverUrl = photo(album.cover); if (coverUrl) PhotoTools.set(cover, coverUrl, {width:640,sizes:'(max-width:780px) 50vw, 33vw'}); card.appendChild(cover);
      const meta = document.createElement('div'); meta.className = 'album-meta'; meta.textContent = album.date; card.appendChild(meta);
      const title = document.createElement('h2'); title.textContent = album.title; card.appendChild(title);
      const description = document.createElement('p'); description.textContent = album.description; card.appendChild(description);
      const open = document.createElement('div'); open.className = 'album-open'; open.innerHTML = '<span>View the gallery (' + album.paths.length + ')</span><span aria-hidden="true">›</span>'; card.appendChild(open);
      card.addEventListener('click', () => openAlbum(album)); grid.appendChild(card);
    });
  }
  function openAlbum(album) {
    history.pushState({album:album.id}, '', '#' + encodeURIComponent(album.id));
    index.hidden = true; detail.hidden = false;
    document.getElementById('album-date').textContent = album.date;
    document.getElementById('album-title').textContent = album.title;
    document.getElementById('album-description').textContent = album.description;
    const photos = document.getElementById('photo-grid'); photos.replaceChildren();
    album.paths.forEach((path, position) => { const url = photo(path); if (!url) return; const image = document.createElement('img'); image.alt = album.title + ' photo ' + (position + 1); image.loading='lazy'; PhotoTools.set(image,url,{width:960,sizes:'(max-width:780px) 50vw, 33vw'}); photos.appendChild(image); });
    window.scrollTo({top:0,behavior:'smooth'});
  }
  detailBack.addEventListener('click', () => { history.pushState({}, '', location.pathname); renderIndex(); window.scrollTo({top:0,behavior:'smooth'}); });
  window.addEventListener('popstate', () => { const id=decodeURIComponent(location.hash.slice(1)); const album=albums.find(item=>item.id===id); album ? openAlbum(album) : renderIndex(); });
  try {
    const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_public_gallery', {method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_ANON_KEY},body:JSON.stringify({p_slug:slug})});
    if (!response.ok) throw new Error('Could not load the portfolio.');
    const data = await response.json(); if (!data) throw new Error('Could not find this portfolio.');
    document.title = (data.name || 'Portfolio') + ' — Gallery';
    document.getElementById('gallery-brand').textContent = data.name || 'Portfolio';
    albums = normalise(data); renderIndex();
    const selected=albums.find(item=>item.id===decodeURIComponent(location.hash.slice(1))); if(selected) openAlbum(selected);
  } catch (error) { grid.innerHTML='<p class="album-empty">' + error.message + '</p>'; }
});
// Image preparation and delivery shared by Admin and the client.
window.PhotoTools = (() => {
    const widths = [96, 192, 384, 640, 960, 1600];
    const maxInputBytes = 25 * 1024 * 1024;
    function original(source) {
        if (!source || typeof source !== 'string') return '';
        if (/^blob:/.test(source)) return source;
        try {
            const url = new URL(source, location.origin);
            if (url.protocol !== 'https:' && url.origin !== location.origin) return '';
            return url.href;
        } catch (_) { return ''; }
    }
    function optimized(source, width = 640) {
        const safe = original(source);
        if (!safe || safe.startsWith('blob:')) return safe;
        const url = new URL(safe);
        const storage = new URL(SUPABASE_URL);
        const owned = url.origin === storage.origin &&
            /^\/storage\/v1\/object\/public\/service-photos\/[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp)$/i.test(url.pathname);
        const local = url.origin === location.origin && /^\/(final_tax_logo|logo_square|phone)\.png$/.test(url.pathname);
        if ((!owned && !local) || url.search || url.hash) return safe;
        const size = widths.find(value => value >= width) || widths[widths.length - 1];
        return '/_vercel/image?url=' + encodeURIComponent(local ? url.pathname : safe) + '&w=' + size + '&q=75';
    }
    function set(img, source, options = {}) {
        const safe = original(source);
        if (!safe) { delete img.dataset.photoKey; img.removeAttribute('src'); img.removeAttribute('srcset'); img.hidden=true; return; }
        const width = options.width || 640;
        const key = safe + '|' + width + '|' + (options.sizes || '');
        if (img.dataset.photoKey === key) return;
        img.dataset.photoKey = key;
        img.hidden = false;
        img.decoding = 'async';
        img.loading = options.lazy === false ? 'eager' : 'lazy';
        if (options.priority) img.fetchPriority = 'high';
        img.style.visibility = 'hidden';
        const target = optimized(safe, width);
        img.removeAttribute('srcset'); img.removeAttribute('sizes');
        if (options.sizes && target !== safe) {
            img.sizes = options.sizes;
            img.srcset = widths.filter(value => value <= (options.maxWidth || 960))
                .map(value => optimized(safe, value) + ' ' + value + 'w').join(', ');
        }
        // Reveal only a decoded image, so a slow download cannot paint in strips.
        const reveal = async () => {
            try { if (img.decode) await img.decode(); } catch (_) { return; }
            if (img.dataset.photoKey === key) img.style.visibility = '';
        };
        img.onload = reveal;
        img.onerror = () => {
            if (img.dataset.photoKey !== key) return;
            if (img.getAttribute('src') !== safe) {
                img.removeAttribute('srcset'); img.src = safe;
            } else { img.style.visibility = ''; img.hidden = true; if (options.onError) options.onError(); }
        };
        img.src = target;
        if (img.complete && img.naturalWidth) reveal();
    }
    async function prepare(file, options = {}) {
        if (!file || !file.size) throw new Error('Choose an image file.');
        if (file.size > maxInputBytes) throw new Error('Choose an image up to 25 MB. We resize it automatically.');
        const supported = /^(image\/(jpeg|png|webp|avif|heic|heif))$/i.test(file.type || '') ||
            /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name || '');
        if (!supported) throw new Error('Choose a JPG, PNG, WebP, AVIF or supported phone photo.');
        const preview = URL.createObjectURL(file);
        const image = new Image();
        try {
            image.src = preview;
            try { await image.decode(); }
            catch (_) { throw new Error('This browser cannot read this image. Choose a JPG, PNG, WebP or AVIF version of this photo.'); }
            const width = image.naturalWidth, height = image.naturalHeight;
            if (!width || !height || width * height > 60000000) throw new Error('Choose a photo up to 60 megapixels.');
            const edge = options.logo ? 768 : 1920;
            let scale = Math.min(1, edge / Math.max(width, height));
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Image preparation is unavailable. Try another browser.');
            let blob;
            for (let attempt = 0; attempt < 4; attempt++) {
                canvas.width = Math.max(1, Math.round(width * scale));
                canvas.height = Math.max(1, Math.round(height * scale));
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.84 - attempt * 0.06));
                if (!blob) throw new Error('This image could not be prepared. Choose another photo.');
                if (blob.size <= 1024 * 1024) break;
                scale *= 0.75;
            }
            if (blob.size > 5242880) throw new Error('This image could not be prepared. Choose another photo.');
            const extension = blob.type === 'image/webp' ? 'webp' : 'png';
            return new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.' + extension, {type:blob.type});
        } finally { URL.revokeObjectURL(preview); }
    }
    return {prepare, optimized, set};
})();

var
	audio,
	base,
	cfg = {},
	dom,
	ls,
	url,

	currentFilter,
	drag,
	errorCount = 0,
	mode,
	onPlaylist,
	onSeek,
	onScrollWait,
	playerheight,
	playlistLoaded,
	playlists,
	retry,
	toast,
	touch,
	track = 0,
	tv;

const
	def = { 'playlist': [], 'skip': [], 'index': -1 },
	shareapi = {},
	str = {},

	played = [],
	playedFiltered = [],
	songs = [],
	songsFiltered = [],
	tree = [],

	ADD =  1,
	TOG = .1,
	REM =  0,
	SET =  2;

function init() {
	url = document.URL.split('?play=', 2);
	if (url[1] && url[1].startsWith('c:')) url[1] = deBase64(url[1].substring(2));
	base = window.location.protocol +'//'+ window.location.host + window.location.pathname;

	dom = {
		'hide': function(el) { dom.show(el, false) },
		'show': function(el, show = true) {
			if (el.constructor !== Array) el = [el];
			for (var i = 0; i < el.length; i++)
				cls(dom[el[i]], 'hide', show ? REM : ADD);
		}
	};
	document.querySelectorAll('[id]').forEach(function(el) { dom[el.id] = el });

	const lib = document.createElement('script'),
		lng = new URLSearchParams(window.location.search).get('lng') || false;
	lib.src = 'music.php?'+ (lng ? 'lng='+ lng : '') + (url.length > 1 ? '&play='+ esc(url[1]) : '');
	lib.onload = function() {
		if (!library) alert(str.nolibrary);
		else if (!pathexp) alert(str.nopathexp);
		if (pathexp.constructor !== Array) pathexp = [pathexp];
		for(var i = 0; i < pathexp.length; i++) {
			pathexp[i] = pathexp[i].replace(/[\/^$*+?.()|[\]{}]/g, '\\$&')
				.replace(/ /g,'[\\s\\.\\-_]*')
				.replace(/dummy/g,'.+')
				.replace('artist', '(?<artist>.*\\b)')
				.replace('year','(?<year>\\d*)')
				.replace('album', '(?<album>.*)')
				.replace('track','(?<track>[\\d\\.]*)')
				.replace('title', '(?<title>.*)')
				.replace('extension', '(?<extension>.*\\b)');
		}
		prepUI();
		buildLibrary('', library, dom.tree);
		buildPlaylist();
		dom.hide('splash');
		dom.show('body');
		log(sourceurl, true);
		log('Song count: '+ songs.length, true);
		log('PHP request = '+ lib.src.replace(/:\/\/.*?:.*?@/, '://'));
		if (songs.length == 1) prepSongMode();
		if (cfg.autoplay > 1 || cfg.autoplay && url[1]) playPause();
		library = null;
	};
	document.body.appendChild(lib);
}

function lng(el, string, tooltip) {
	if (!el) return log('Element '+ el.id +' not found for string: '+ string);
	if (tooltip) {
		string = string.split('\n');
		el.title = string[0] + keyString(el.accessKey)
			+ (string[1] ? '\n'+ string[1] + keyString(el.getAttribute('contextkey')) : '')
			+ (string[2] ? '\n'+ string[2] : '');
	} else {
		if (!el.accessKey)
			return el.innerHTML = string;
		const index = string.toLowerCase().indexOf(el.accessKey);
		if (index == -1)
			el.innerHTML = string +'<b>'+ el.accessKey +'</b>';
		else
			el.innerHTML = string.substring(0, Math.max(index, 0)) +'<u>'+ string.substring(index, index + 1) +'</u>'+ string.substring(index + 1);
	}
}

function keyString(key) {
	if (!key || key == ' ') return '';
	key = (key != key.toLowerCase() && !key.match(/F\d/) ? 'Shift+' : '') + key.toUpperCase();
	return ' (' + key + ')';
}

function prepUI() {
	ls = ls();
	dom.source.href = sourceurl;
	dom.pagetitle.textContent = pagetitle;
	dom.filter.placeholder = str.filter;
	dom.doc.className = cfg.theme || def.theme;
	dom.volumeslider.max = def.volume;
	dom.volumeslider.value = cfg.volume;
	if (cfg.debug) cls(dom.debug, 'on', ADD);
	if (cfg.enqueue) cls(dom.enqueue, 'on', ADD);
	if (cfg.random) cls(dom.random, 'on', ADD);
	if (cfg.crossfade) cls(dom.crossfade, 'on', ADD);
	if (cfg.locked) {
		cls(document.body, 'locked', ADD);
		cls(dom.lock, 'on', ADD);
	}
	lng(dom.lock, cfg.locked ? str.unlock : str.lock);
	if (url.length > 1 || !onlinepls) dom.hide(['playlistsdiv', 'playlistsave', 'shareplaylist']);
	if (!sharing) dom.hide('share');
	if (cfg.after == 'randomfiltered') cfg.after = 'randomlibrary';
	cfg.removesongs = false;

	if (url.length > 1 && url[1].startsWith('pl:')) {
		prepPlaylistMode();
		prepPlaylists(mode);
	}

	ffor(['TV', 'Andr0id', ' OMI/', 'Viera'], function(s) {
		if (navigator.userAgent.includes(s))
			return (tv = true);
	});

	window.addEventListener('click', function() {	// Try to solve autoplay issues
		[0,1].forEach(function(i) {
			if (audio[i].src.startsWith('data:'))
				audio[i].play();
		});
	}, { once: true, passive: true });

	if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0)
		touchUI();

	window.addEventListener('scroll', function() {
		if (onScrollWait) return;
		onScrollWait = true;
		setTimeout(function() {
			fixPlayer();
			onScrollWait = false;
		}, 400);
	}, { passive: true });

	document.onvisibilitychange = function() {
		if (ls && document.visibilityState == 'hidden') {
			localStorage.setItem(lsid, JSON.stringify(cfg));
			log('Session saved');
		}
	}

	audio = [prepAudio(0), prepAudio(1)];

	if ('mediaSession' in navigator) {
		navigator.mediaSession.setActionHandler('play', playPause);
		navigator.mediaSession.setActionHandler('pause', playPause);
		navigator.mediaSession.setActionHandler('previoustrack', previous);
		navigator.mediaSession.setActionHandler('nexttrack', next);
		navigator.mediaSession.metadata = new MediaMetadata();
	}

	if (cfg.instantfilter) {
		dom.filter.onchange = null;	// Prevent multiple triggers for the same term
		dom.filter.oninput = filter;	// Gives event as parameter
	}

	if (window.innerWidth > 360)
		cls(dom.library, 'unfold', ADD);

	prepHotkeys();
}

function touchUI() {
	touch = true;
	cls(dom.body, 'touch', ADD);
	if (mode) resizePlaylist();
	else dom.show('trash');
	log('Touch device detected', true);
}

function fixPlayer() {
	if (!cls(dom.player, 'fix') && !cls(dom.body, 'dim')
		&& window.pageYOffset > 1.5 * dom.player.offsetHeight
		&& dom.doc.offsetHeight - dom.player.offsetHeight > window.innerHeight) {
		playerheight = dom.player.offsetHeight + parseInt(window.getComputedStyle(dom.player).getPropertyValue('margin-top'));
		dom.doc.style.paddingTop = playerheight +'px';
		cls(dom.player, 'fix', ADD);
	} else if (window.pageYOffset < 1.1 * playerheight) {
		dom.doc.style.paddingTop = '';
		cls(dom.player, 'fix', REM);
	}
}

function ls() {
	if (url.length > 1) {	// Don't use saved options & playlist when not in main library
		def.after = 'playlibrary';
		cfg = def;
		return false;
	}

	try {
		const sav = localStorage.getItem(lsid);
		if (sav != null) {
			cfg = JSON.parse(sav) || {};
			for (var c in def)
				if (typeof cfg[c] === 'undefined' || cfg[c] == null) cfg[c] = def[c];
			return true;
		}
		cfg = def;
		const ls = JSON.stringify(cfg);
		localStorage.setItem(lsid, ls);
		if (localStorage.getItem(lsid) == ls) return true;
		log('LocalStorage issue', true);
		return false;
	} catch(e) {
		log(e, true);
		cfg = def;
		return false;
	}
}

function log(s, force = false) {
	if (cfg.debug || force) {
		if (typeof s === 'string') {
			const t = new Date();
			s = s.replace(/data\:.*/, '(Autoplay Fix)');
			s = String(t.getHours()).padStart(2, '0') +':'+ String(t.getMinutes()).padStart(2, '0') +':'+ String(t.getSeconds()).padStart(2, '0') +'  '+ s;
			dom.log.value += s +'\n';
		}
		if (!touch) console.log(s);
	}
}

function saveLog() {
	const l = new Blob([dom.log.value], { type: 'text/plain', endings: 'native' });
	dom.a.href = window.URL.createObjectURL(l);
	dom.a.download = pagetitle +"_"+ ~~(new Date()/1000) +'.log';
	dom.a.click();
}

function prepPlaylistMode() {
	cfg.after = 'stopplayback';
	dom.hide(['enqueue', 'playlistload', 'playlistsave', 'playlibrary', 'randomlibrary', 'randomfiltered', 'sharefolder', 'library']);
	dom.playlist.style.minHeight = dom.playlist.style.maxHeight = 'unset';
	cls(body, 'mode', ADD);
	mode = 'playlist';
}

function prepAudio(id) {
	const a = new Audio();

	a.log = function(msg) {
		log(msg +' ['+ id +']: '+ decodeURI(a.src.replace(a.baseURI, '')));
	};

	a.onloadstart = function() {
		a.log('Load started');
	};

	a.oncanplaythrough = function() {
		a.log('Can play through');
		a.canplaythrough = true;
	};

	a.onplay = function() {
		a.log('Play');
		if (a.src.startsWith('data:')) return;
		cls(dom.playpause, 'playing', ADD);
		cls(dom.album, 'dim', REM);
		cls(dom.title, 'dim', REM);
		if (cfg.index != -1) {
			cls(dom.playlist.childNodes[cfg.index], 'playing', ADD);
			if (!onPlaylist)
				dom.playlist.scrollTop = dom.playlist.childNodes[cfg.index > 0 ? cfg.index - 1 : cfg.index].offsetTop - dom.playlist.offsetTop;
		}
	};

	a.onplaying = function() {
		a.log('Playing');
	}

	a.onpause = function(e) {
		a.log('Pause');
		if (a == audio[track]) {
			cls(dom.playpause, 'playing', REM);
			cls(dom.album, 'dim', ADD);
			cls(dom.title, 'dim', ADD);
		}
	};

	a.onended = function() {
		a.log('Ended');
	};

	a.ontimeupdate = function() {
		if (a != audio[track] || a.src.startsWith('data:')) return;	// Already switched to other track (crossfade) || autoplay fix

		if (a.currentTime >= a.duration - cfg.buffersec) return playNext();

		if (a.duration > 30 && (a.duration - a.currentTime) < 20) {
			if (!audio[+!track].prepped) prepNext();
			if (cfg.crossfade && !a.fade && a.duration - a.currentTime < 10) {
				a.log('Fade out');
				a.fade = setInterval(function() {
					a.volume -= a.volume > 0.04 ? 0.04 : a.volume;
					if (a.volume == 0) clearInterval(a.fade);
				}, 200);
				playNext();
			}
		}

		if (!onSeek && document.activeElement != dom.seek) {
			dom.time.textContent = timeTxt(~~a.currentTime) +' / '+ timeTxt(~~a.duration);
			dom.seek.value = a.duration ? a.currentTime / a.duration : 0;
		}
	};

	a.onerror = function() {
		a.log('Error: '+ a.error.code +' '+ a.error.message, true);
		dom.playlist.childNodes[cfg.index].setAttribute('error', 1);
		errorCount++;
		if (errorCount >= maxerrors)
			errorCount = 0;
		else if (a == audio[track])
				playNext();
	};

	a.onabort = function() {
		a.log('Aborted (user aborted download or error occurred)');
	}

	a.onstalled = function() {
		a.log('Stalled (media not available)');
	}

	a.onsuspend = function() {
		a.log('Suspended (download completed, or media has been paused)');
	}

	a.onwaiting = function() {
		a.log('Waiting (need to buffer)');
	}

	a.src = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==";
	a.autoplay = true;
	a.preload = 'auto';
	a.load();

	return a;
}

function buildLibrary(root, folder, element) {
	var li, i, f, cover = false;
	for (i in folder) {
		if (i != '/') {	// Subfolder
			li = document.createElement('li');
			cls(li, 'folder', ADD);
			li.path = root + i;
			li.textContent = i;
			li.tabIndex = 1;
			tree.push(li);
			element.appendChild(li);
			const ul = li.appendChild(document.createElement('ul'));
			buildLibrary(root + i +'/', folder[i], ul);
		} else {
			for (f in folder[i]) {
				ffor(ext_images, function(ext) {
					if (f.toLowerCase().endsWith('.'+ ext)) {
						if (!cover || f.toLowerCase().startsWith('cover'))
							cover = f;
						delete(folder[i][f]);
						return true;
					}
				});
			}
			for (f in folder[i]) {
				li = document.createElement('li');
				li.id = songs.length;
				cls(li, 'song', ADD);
				li.path = root + f;
				if (cover) li.cover = cover;
				li.textContent = f.substring(f.lastIndexOf('/') + 1, f.lastIndexOf('.'));
				li.tabIndex = 1;
				tree.push(li);
				songs.push(li);
				element.appendChild(li);
			}
		}
	}
}

function reloadLibrary() {
	if (cfg.locked) return;
	if (!confirm(str.reloadlibrary)) return;
	dom.tree.innerHTML = '',
	tree.length = songs.length = 0;
	const lib = document.createElement('script');
	lib.src = 'music.php'+ (url.length > 1 ? '?play='+ esc(url[1]) +'&' : '?') +'reload';
	lib.onload = function() {
		buildLibrary('', library, dom.tree);
		clearPlayed('reload');
		library = null;
		if (dom.filter.value.length)
			filter();
		if (cfg.after == 'randomfiltered')
			buildFilteredLibrary(dom.randomfiltered.firstElementChild.textContent.trim());
	}
	document.body.appendChild(lib);
}

function prepSongMode() {
	prepPlaylistMode();
	add(0);
	dom.hide(['previous', 'next', 'options', 'playlistdiv']);
	cls(body, 'mode', ADD);
	mode = 'song';
}

function treeClick(e, context = false) {
	if (cls(e.target, 'folder'))
		context ? addFolder(e) : openFolder(e);
	else
		context ? addSongNext(e) : addSong(e);
}

function openFolder(e) {
	e.stopPropagation();
	const li = e.target;
	ffor(li.querySelectorAll(':scope > ul > *'), function(c) {
		if (c.style.display != '') c.style.display = '';
	});
	if (cls(li, 'parent')) {
		cls(li, 'open', ADD);
		cls(li, 'match', ADD);
		cls(li, 'parent', REM);
	} else
		cls(li, 'open', TOG)
	setFocus(li);
	if (audio[track].paused) fillShare(li.path +'/');
}

function addFolder(e) {
	e.preventDefault();
	e.stopPropagation();
	const li = e.target;
	if (confirm(li.path.substring(li.path.lastIndexOf('/') + 1) +'\n'+ str.addfolder)) {
		cls(li, 'dim', ADD);
		ffor(li.querySelectorAll('li.song'), function(s) { add(s.id) });
	}
}

function setFocus (el) {
	el.focus();
	const { top, bottom } = el.getBoundingClientRect(),
		offset = cls(dom.player, 'fix') ? dom.player.offsetHeight : 0;
	if (top < offset || bottom - top + offset > window.innerHeight - offset) {
		window.scrollTo({
			'top': window.scrollY + top - offset,
			'behavior': !cls(dom.player, 'fix') && touch ? 'instant' : 'smooth'	// Instant scroll for mobile Chromium, otherwise fixed player will overlap and not adjust scrolling
		});
	} else if (bottom > window.innerHeight) {
		window.scrollTo({
			'top': window.pageYOffset + bottom - window.innerHeight + 4,
			'behavior': 'smooth'
		});
	}
	if (!offset) setTimeout(function() {
		if (cls(dom.player, 'fix')) setFocus(el);
	}, 500);
}

function setToast(el) {
	setTimeout(function() {
		if (el.className == 'error' || cls(dom.player, 'fix')) {
			if (el.className == 'error') log(str.error +' '+ el.textContent, true);
			if (toast) clearTimeout(toast);
			dom.toast.className = el.className;
			dom.toast.textContent = el.textContent;
			dom.show('toast');
			toast = setTimeout(function() { dom.hide('toast') }, 4000);
		}
	}, onScrollWait ? 400 : 0);
}

function addSong(e) {
	e.stopPropagation();
	const li = e.target;
	if (cfg.enqueue || cfg.locked)
		add(li.id);
	else {
		load(li.id, 'next');
		if (cfg.playlist[cfg.index + 1].path != li.path)	// Other songs are set to be played first
			return setToast({ 'className': 'error', 'textContent': str.othersongsnext });
		else {
			stop();
			playNext();
		}
	}
	if (audio[track].paused) fillShare(li.path);
}

function addSongNext(e) {
	e.preventDefault();
	e.stopPropagation();
	const li = e.target;
	add(li.id, true);
	if (audio[track].paused) fillShare(li.path);
}

function dimSong(path, act = ADD) {
	ffor(songs, function(s) {
		if (s.path == path) {
			cls(s, 'dim', act);
			if (act == REM)	// Undim folder
				cls(s.parentNode.parentNode, 'dim', REM);
			return true;
		}
	});
}

function undimSong(path) {
	var i = cfg.index > 0 ? cfg.index : 0;
	while (i < cfg.playlist.length) {
		if (cfg.playlist[i].path == path)
			return;
		i++;
	}
	return dimSong(path, REM);
}

function buildPlaylist() {
	if (cfg.playlist.length == 0) return;
	cfg.index = Math.min(cfg.index, cfg.playlist.length - 1);
	dom.playlist.innerHTML = '';

	for (var i in cfg.playlist) {
		const s = cfg.playlist[i];
		const li = playlistItem(s);
		dom.playlist.appendChild(li);
		dimSong(s.path);
		if (i == cfg.index) {
			cls(li, 'playing', ADD);
			const nfo = getSongInfo(cfg.playlist[i].path);
			dom.album.innerHTML = getAlbumInfo(nfo);
			dom.title.innerHTML = nfo.title;
		}
	}

	resizePlaylist();

	if (cfg.index != -1) {
		dom.playlist.scrollTop = dom.playlist.childNodes[cfg.index].offsetTop - dom.playlist.offsetTop;
		fillShare(cfg.playlist[cfg.index].path);
	}
}

function playlistItem(s) {
	const li = document.createElement('li');
	cls(li, 'song', ADD);
	li.draggable = 'true';
	if (s.id == 'last') {
		li.id = 'last';
	} else {
		const nfo = getSongInfo(s.path);
		li.innerHTML = nfo.title +'<span class="artist">'+ (nfo.artist ? '('+ nfo.artist +')' : '') +'</span>';
		li.title = getAlbumInfo(nfo) + (mode ? '' : '\n\n'+ str.playlistdesc);
	}
	return li;
}

function clickItem(e) {
	const item = cls(e.target, 'artist') ? e.target.parentNode : e.target;
	if (cfg.locked || e.target.id == 'playlist') return;
	if (cfg.removesongs) {
		drag = item;
		removeItem(e);
	} else play(getIndex(item));
}

function findItem(e) {
	if (mode || touch) return;
	e.preventDefault();
	if (e.target.tagName == 'LI')
		setFilter(e.target.firstChild.textContent.trim());
	else if (e.target.tagName == 'SPAN')
		setFilter(e.target.textContent.replace(/^\(|\)$/g, ''));
}

function prepDrag(e) {
	if (cfg.locked) return e.preventDefault();
	e.stopPropagation();
	cls(dom.trash, 'drag', ADD);
	dom.playlist.appendChild(playlistItem({ 'id': 'last' }));
	setTrashPos();
	if (cfg.index != -1)
		cls(dom.playlist.childNodes[cfg.index], 'playing', REM);

	drag = e.target;
	e.dataTransfer.effectAllowed = 'move';
	e.dataTransfer.setData('text/plain', getIndex(drag));
}

function allowDrop(e) {
	e.preventDefault();
	e.stopPropagation();
}

function endDrag() {
	cls(dom.trash, 'drag', REM);
	dom.playlist.querySelectorAll('#last').forEach(li => dom.playlist.removeChild(li));
	setTrashPos();
	drag = null;
}

function dropItem(e) {
	e.preventDefault();
	e.stopPropagation();
	const to = e.target;
	if (to.tagName != 'LI') to = to.parentNode;
	log('Drag ['+ drag.textContent +'] to place of ['+ to.textContent +']');
	cls(to, 'over', REM);
	const indexfrom = e.dataTransfer.getData('text');
	const indexto = getIndex(to);
	if (indexto != indexfrom) moveItem(drag, to, indexfrom, indexto);
	if (cfg.index != -1) cls(dom.playlist.childNodes[cfg.index], 'playing', ADD);
	log('Drag from '+ indexfrom +' to '+ indexto);
	log('Playback index to '+ cfg.index);
}

function moveItem(drag, to, indexfrom, indexto) {
	dom.playlist.insertBefore(drag, to);
	cfg.playlist.splice(indexto - (indexfrom < indexto ? 1 : 0), 0, cfg.playlist.splice(indexfrom, 1)[0]);
	log('Playback index from '+ cfg.index);
	if (cfg.index != -1) {
		if (indexfrom == cfg.index)
			cfg.index = indexfrom < indexto ? indexto - 1 : indexto;
		else if (indexfrom < cfg.index && indexto > cfg.index)
			cfg.index--;
		else if (indexfrom > cfg.index && indexto <= cfg.index)
			cfg.index++;
	}
}

function removeItem(e) {
	e.preventDefault();
	e.stopPropagation();
	const index = getIndex(drag);
	const playing = index == cfg.index;
	const [removed] = cfg.playlist.splice(index, 1);
	dom.playlist.removeChild(dom.playlist.childNodes[index]);
	if (cfg.index != -1 && index <= cfg.index)
		cfg.index--;
	if (cfg.index != -1 && !playing)
		cls(dom.playlist.childNodes[cfg.index], 'playing', ADD);
	endDrag();
	resizePlaylist();
	undimSong(removed.path);
}

function getIndex(li) {
	if (li.id == 'last')	// Temporary last item for dragging
		return cfg.playlist.length;
//	return Array.prototype.indexOf.call(li.parentNode.children, li);
	for (var i = 0; i < li.parentNode.children.length; i++)
		if (li == li.parentNode.children[i])
			return i;
}

function fillShare(path) {
	if (!sharing) return;
	if (path.endsWith('/')) {
		dom.folderuri.value = path;
		dom.songuri.value = '';
	} else {
		dom.folderuri.value = path.substring(0, path.lastIndexOf('/'));
		dom.songuri.value = path;
	}
}

function esc(s) {
	return s.replace(/\/+$/, '').replace(/[(\?=&#% ]/g, function(char) { return escape(char) });
}

function base64(s) {
	s = btoa(unescape(encodeURIComponent(s)));
	return s.replace(/=+$/, '').replace(/[\/+=]/g, function(char) { return escape(char) });
}

function deBase64(s) {
	return decodeURIComponent(escape(atob(s)));
}

function getSongInfo(path) {
	log('getSongInfo: '+ path);
	if (!path.includes('/') && url.length > 1)
		path = root + path;	// For shared songs/folders

	for(var i = pathexp.length - 1; i > -1; i--) {
		var nfo;
		try {
			nfo = path.match(pathexp[i]);
			log(nfo.groups);
			return nfo.groups;
		} catch(e) {
			if (nfo) log(e);
			if (i < 1) {
				const artalb = path.substring(path.lastIndexOf('/', path.lastIndexOf('/') - 1) + 1, path.lastIndexOf('/'));
				if (!artalb.includes(' -'))
					nfo = { 'artist': artalb }
				else
					nfo = {
						'artist': artalb.substring(0, artalb.indexOf(' -')),
						'album': artalb.substring(artalb.indexOf('- ') + 2)
					}
				nfo.title = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
				log(nfo);
				return nfo;
			}
		}
	}
}

function getAlbumInfo(nfo) {
	const artist = nfo.artist ? nfo.artist : '';
	var album = (nfo.year ? '('+ nfo.year +') ' : '') + (nfo.album || '');
	album = artist + (album.length > 1 ? ' - '+ album : '');
	log('getAlbumInfo: '+ album);
	return album;
}

function timeTxt(t) {
	const h = ~~(t / 3600);
	const m = ~~(t % 3600 / 60);
	const s = ~~(t % 60);
	return (h > 0 ? (h < 10 ? '0' : '') + h +':' : '')
		+ (m < 10 ? '0' : '') + m +':'
		+ (s < 10 ? '0' : '') + s;
}

function zoom() {
	if (window.pageYOffset > 2 * dom.player.offsetHeight)
		return window.scrollTo({ 'top': 0, 'behavior': 'smooth' });
	dom.player.className = cls(dom.player, 'big') ? 'full' :
		(cls(dom.player, 'full') ? '' : 'big');
}

function seek(e) {
	if (e == 'c') {
		audio[track].currentTime = dom.seek.value * audio[track].duration;
		dom.seek.blur();
	}	else {
		dom.time.textContent = timeTxt(~~(dom.seek.value * audio[track].duration))
			+' / '+ timeTxt(~~audio[track].duration);
	}
}

function stop() {
	if (cfg.locked) return;
	clearInterval(retry);
	audio[track].pause();
	audio[track].currentTime = 0;
	dom.seek.disabled = 1;
}

function playPause() {
	if (cfg.index == -1) return playNext();
	if (!audio[track].src || audio[track].src.startsWith('data:')) return play(cfg.index);
	if (audio[track].paused) return start(audio[track]);
	audio[track].pause();
}

function previous() {
	if (cfg.locked) return;
	if (cfg.index > 0)
		play(cfg.index - 1);
	else
		log('No previous item in playlist', true);
}

function skipArtist(e) {
	e.preventDefault();
	if (cfg.locked) return;
	const unskip = e.shiftKey || e.target.id == 'previous';
	const msg = unskip ? str.unskipartist : str.skipartist;
	var artist = cfg.playlist[cfg.index] ? getSongInfo(cfg.playlist[cfg.index].path).artist : "";
	if (artist = prompt(msg, artist)) {
		if (unskip)
			cfg.skip = cfg.skip.filter(t => t !== artist.toLowerCase());
		else
			if (!cfg.skip.includes(artist.toLowerCase())) cfg.skip.push(artist.toLowerCase());
	}
}

function next() {
	if (!cfg.locked) playNext();
}

function prepNext() {
	if (cfg.playlist.length > cfg.index + 1) {
		log('prepNext from playlist');
		if (cfg.random && !cfg.playlist[cfg.index + 1].playNext) {
			const next = cfg.index + ~~(Math.random() * (cfg.playlist.length - cfg.index));
			const drag = dom.playlist.childNodes[next],
				to = dom.playlist.childNodes[cfg.index + 1],
				indexfrom = next,
				indexto = cfg.index + 1;
			moveItem(drag, to, indexfrom, indexto);
		}
		load(cfg.index + 1);
	} else if (cfg.after != 'stopplayback') {
		log('prepNext from library');
		if (cfg.after == 'randomfiltered' || cfg.after == 'randomlibrary') {
			load(getRandom(), true);
		} else if (cfg.after == 'playlibrary')	{
			if (cfg.index == -1) return load(songs[0].id, true);
			const path = cfg.playlist[cfg.index].path;
			var next = -1;
			for (var i = 0; i < songs.length; i++) {
				if (songs[i].path == path) {
					next = i + 1;
					break;
				}
			}
			if (next != -1 && next < songs.length)
				load(songs[next].id, true);
			else {
				log('End of library. Starting at the top', true);
				load(songs[0].id, true);
			}
		} else if (cfg.after == 'repeatplaylist' && cfg.playlist.length > 0)
			return load(0);
	}
}

function getRandom(queue = false) {
	var next = null;
	do {
		const count = cfg.after == 'randomfiltered' ? songsFiltered.length : songs.length;
		if ((cfg.after == 'randomfiltered' ? playedFiltered.length : played.length) == count)
			clearPlayed(cfg.after);

		next = ~~((Math.random() * count));

		if (cfg.after == 'randomfiltered') {
			next = songsFiltered[next];	// songsFiltered is an array of id's from songs
			if (playedFiltered.includes(next.toString()))
				next = null;
		} else if (played.includes(next.toString()))
			next = null;

		if (next != null && artistSkipped(songs[next].path)) {
			if (cfg.after == 'randomfiltered')
				playedFiltered.push(next);
			played.push(next);
			log('Artist of '+ songs[next].path +' is skipped.', true)
			next = null;
		}
	} while (next == null);
	if (queue) {
		const nfo = getSongInfo(songs[next].path);
		if (confirm(getAlbumInfo(nfo) +'\n'+ nfo.title +'\n\n'+ dom.enqueue.textContent +'?'))
			add(songs[next].id, true);
	} else return songs[next].id;
}

function clearPlayed(action) {
	var msg = 'Clearing played';
	if (action == 'randomfiltered') {
		playedFiltered.length = 0;
		msg += 'Filtered[]: all songs from the filtered library have been played.'
	} else {
		played.length = 0;
		if (action == 'reload')
			msg += '[]: user reloaded library.';
		else
			msg += '[]: all songs have been played.';
	}
	log(msg, true);
}

function artistSkipped(path) {
	const artist = getSongInfo(path).artist.toLowerCase();
	const skip = cfg.skip.includes(artist);
	if (skip)
		log('Skipped artist "'+ artist +'"');
	return skip;
}

function load(id, addtoplaylist = false) {
	log('load('+ id +', addtoplaylist = '+ addtoplaylist +')');
	clearInterval(retry);

	if (addtoplaylist == 'next') add(id, true);
	else if (addtoplaylist) add(id);

	const a = audio[+!track];
	a.prepped = true;
	a.index = addtoplaylist ? cfg.index + 1 : id;
	log('a.index = '+ a.index);
	a.autoplay = false;
	a.canplaythrough = false;
	a.src = esc(root + cfg.playlist[a.index].path);
	a.load();
	clearInterval(a.fade);
	a.fade = null;
	a.volume = cfg.volume;

	retry = setInterval(function() {
		if (a.buffered.length == 0 || a.buffered.end(a.buffered.length - 1) < Math.min(5, a.duration)) {
			a.log('No connection. Retrying', true);
			a.load();
		} else clearInterval(retry);
	}, 8000);
}

function play(id) {
	load(id);
	stop();
	playNext();
}

function mute(e = null) {
	if (e) e.preventDefault();
	audio[+!track].muted = audio[track].muted ^= true;
	cls(dom.volume, 'muted', audio[track].muted ? ADD : REM);
}

function setVolume(input) {
	if (input.target) input = input.target.value;
	else dom.volumeslider.value = input;
	cfg.volume = audio[track].volume = +parseFloat(input).toPrecision(2);
	if (audio[track].muted) mute();
}

function shuffle(e) {
	e.preventDefault();
	if (cfg.locked) return;
	var nextIndex = cfg.index + 1;
	while (cfg.playlist[nextIndex] && cfg.playlist[nextIndex].playNext) nextIndex++;
	if (!cfg.playlist[nextIndex]) return;
	const range = cfg.playlist.length - nextIndex;
	for (var i = cfg.playlist.length - 1; i >= nextIndex; i--) {
		var j = nextIndex + ~~(Math.random() * range);
		[cfg.playlist[i], cfg.playlist[j]] = [cfg.playlist[j], cfg.playlist[i]];
	}
	buildPlaylist();
}

function download(type) {
	const share = dom[type +'uri'];
	const shareRoot = type == 'folder' && url.length > 1;
	if (share.value || shareRoot) {
		const uri = (type != 'playlist' ? root : "") + share.value;
		dom.a.href = 'music.php?dl'+ (type == 'playlist' ? 'pl' : '') +'='+ esc(uri);
		dom.a.click();
	}
}

function clip(type) {
	const share = dom[type +'uri'];
	const shareRoot = type == 'folder' && url.length > 1;
	if (share.value || shareRoot) {
		cls(share.nextElementSibling.nextElementSibling, 'clip', ADD);
		const fullUri = type == 'playlist'
			? base +'?play=pl:'+ esc(share.value)
			: base +'?play=c:'+ base64(root + share.value);
		toClipboard(fullUri);
		share.blur();
		setTimeout(function() {
			cls(share.nextElementSibling.nextElementSibling, 'clip', REM);
		}, 1500);
	}
}

function toClipboard(value) {
	const promise = navigator.clipboard.writeText(value);
	if (typeof promise !== 'undefined') {
		promise.catch(function(e) {
				setToast({ 'className': 'error', 'textContent': e });
		});
	}
}

function share(name) {
log('Share() triggered');
	const data = {
		text: dom.sharemsg.value +' '+ dom.sharenfo.value,
		url: base +'?play='+ dom.popup.uri
	};
	log(data);
	dom.sharemsg.uri = null;

	if (shareapi[name]) {
		dom.a.href = shareapi[name].replace('{text}', data.text).replace('{url}', data.url);
		dom.a.click();
	} else {
		const promise = navigator.share(data);
		if (typeof promise !== 'undefined') {
			promise.catch(function(e) {
					setToast({ 'className': 'error', 'textContent': e });
			});
		}
	}
	cfg.sharemsg = dom.sharemsg.value;
	Popup.close();
}

function prepPlaylists(action) {
	const xhttp = new XMLHttpRequest();
	xhttp.onload = function() {
		playlists = JSON.parse(this.responseText);
		log(playlists);
		var playlistElements = '';
		if (playlists.length != []) {
			for (var p in playlists)
				playlistElements += action == 'share' ? '<option value="'+ p +'">'+ p +'</option>' : '<button class="add">'+ p +'</button>';
		} else playlistElements = '<p tabindex="1">'+ str.noplaylists +'</p>';
		switch (action) {
			case 'load':
				dom.playlists.innerHTML = playlistElements;
				dom.show('playlists');
				setFocus(dom.playlists.firstElementChild);
				break;
			case 'save':
				savePlaylist();
				break;
			case 'share':
				dom.playlisturi.innerHTML = playlistElements;
				break;
			case 'playlist':
				loadPlaylist(decodeURIComponent(url[1].substring(3)));
				if (cfg.autoplay && audio[track].paused) playPause();
		}
	};
	xhttp.open('GET', 'music.php?pl', true);
	xhttp.send();
}

function loadPlaylist(name) {
	const pl = JSON.parse(playlists[name]);
	fillPlaylist(pl);
	playlistLoaded = name;
}

function loadPlaylistBtn(e) {
	if (cls(e.target, 'on') || e.target.textContent == str.noplaylists) return;
	cls(e.target, 'on', ADD);
	loadPlaylist(e.target.textContent);
}

function removePlaylist(e) {
	e.preventDefault();
	const name = e.target.textContent;
	if (e.target.tagName != 'BUTTON' || !confirm(str.removeplaylist +' '+ name +'?')) return true;
	const xhttp = new XMLHttpRequest();
	xhttp.onload = function() {
		if (this.responseText != '')
			alert(str.error +'\n\n'+ this.responseText);
		else if (cls(dom.playlists, 'hide'))
			menu('playlistload');
		else {
			dom.playlists.removeChild(e.target);
			if (!dom.playlists.hasChildNodes())
				dom.playlists.innerHTML = '<p tabindex="1">'+ str.noplaylists +'</p>';
			setFocus(dom.playlists.firstElementChild);
		}
	}
	xhttp.open('DELETE', 'music.php', true);
	xhttp.setRequestHeader('Content-type', 'application/json');
	xhttp.send(JSON.stringify({ 'name': name }));
}

function savePlaylist() {
	if (cfg.locked || !onlinepls || url.length > 1 || !cfg.playlist.length) return;
	var name = prompt(str.exportpl, playlistLoaded);
	if (name) {
		name = name.replace(/[\\\/:*?"<>|]/g, ' ');
		for (var pl in playlists)
			if (pl == name && !confirm(str.overwrite)) return;
		const xhttp = new XMLHttpRequest();
		xhttp.onload = function() {
			if (this.responseText != '')
				alert(str.error +'\n\n'+ this.responseText);
		}
		xhttp.open('POST', 'music.php', true);
		xhttp.setRequestHeader('Content-type', 'application/json');
		xhttp.send(JSON.stringify({ 'name': name, 'songs': getPlaylistCopy() }));
	}
}

function importPlaylist() {
	if (cfg.locked || mode == 'song') return;
	const input = document.createElement('input');
	input.setAttribute('type', 'file');
	input.setAttribute('accept', '.mfp.json');
	input.onchange = function(e) {
		const reader = new FileReader();
		reader.onload = function(e) {
			const pl = JSON.parse(e.target.result);
			fillPlaylist(pl);
		};
		reader.readAsText(input.files[0], 'UTF-8');
	}
	input.click();
}

function exportPlaylist() {
	if (cfg.locked || mode == 'song' || !cfg.playlist.length) return;
	const filename = prompt(str.exportpl);
	if (filename) {
		dom.a.href = 'data:text/json;charset=utf-8,'+ esc(getPlaylistCopy());
		dom.a.download = filename +'.mfp.json';
		dom.a.click();
	}
}

function fillPlaylist(pl) {
	if (pl.constructor !== Array) {
		if (confirm(str.restoreposition))
			cfg.index = pl.index + cfg.playlist.length;
		pl = pl.playlist;
	}
	for (var i in pl) cfg.playlist.push(pl[i]);
	buildPlaylist();
}

function getPlaylistCopy() {
	const position = cfg.index > 0 && confirm(str.saveposition) ? cfg.index : 0;
	const copy = JSON.parse(JSON.stringify(cfg.playlist));
	ffor(copy, function(s) { delete s.playNext });
	const pl = position ? { playlist: copy, index: position } : copy;
	return JSON.stringify(pl);
}

function add(id, next = false) {
	const s = {
		'path': songs[id].path,
		'cover': songs[id].cover
	};

	var i = nodupes ? -1 : cfg.index;
	if (cfg.playlist.length > 0) {
		if (next && cfg.index > -1) {
			if (s.path == cfg.playlist[i].path) return cfg.index--;	// Currently playing
			if (cfg.playlist.length > cfg.index + 1 && s.path == cfg.playlist[i+1].path) return;	// Next up
		}
		i++;
		for (; i < cfg.playlist.length && (next ? cfg.playlist[i].playNext : true); i++) {
			if (s.path == cfg.playlist[i].path)
				return setToast({ 'className': 'error', 'textContent': str.alreadyadded });
		}
	}

	const li = playlistItem(s);
	if (next) {
		s.playNext = 1;
		cfg.playlist.splice(i, 0, s);
		playlist.insertBefore(li, dom.playlist.childNodes[i]);
	} else {
		cfg.playlist.push(s);
		dom.playlist.appendChild(li);
	}
	cls(songs[id], 'dim', ADD);

	resizePlaylist();
	log('Add to playlist (#'+ i +'): '+ s.path);
	if (!played.includes(id)) {
		played.push(id);
		if (cfg.after == 'randomfiltered')
			playedFiltered.push(id);
		log('Add id '+ id +' to played');
	}
}

function playNext() {
	if (cfg.index != -1) {
		const li = dom.playlist.childNodes[cfg.index];
		if (li) {
			cls(li, 'playing', REM);
			delete li.playNext;
		}
	}
	if (cfg.index + 1 == cfg.playlist.length && !audio[+!track].prepped && cfg.after == 'stopplayback') return;
	if (!audio[+!track].prepped) {
		log('PlayNext: not prepped');
		prepNext();
		stop();
	}
	if (audio[+!track].index && (!cfg.playlist[audio[+!track].index] || esc(root + cfg.playlist[audio[+!track].index].path) != audio[+!track].getAttribute('src'))) {
		log('PlayNext: last minute adjustment to playlist detected, prepping next track', true);
		prepNext();
	}
	if (!cfg.crossfade) stop();

	track ^= 1;
	const a = audio[track],
		index = cfg.index = a.index;
	start(a);

	const path = cfg.playlist[cfg.index].path,
		nfo = getSongInfo(path),
		prevcover = dom.cover.src || def.cover;
	var cover = cfg.playlist[cfg.index].cover;
	cover = cover ? esc(root + path.substring(0, path.lastIndexOf('/') + 1) + cover) : def.cover;
	if (prevcover.indexOf(cover) == -1) {
		dom.cover.style.opacity = 0;
		if (cls(dom.player, 'full')) dom.current.style.opacity = 0;
		setTimeout(function() {
			if (index != cfg.index) return;	// If song has changed since timeout
			dom.album.innerHTML = getAlbumInfo(nfo);
			dom.title.innerHTML = nfo.title;
			dom.cover.src = cover;
			setTimeout(function() {
				if (cls(dom.player, 'full')) dom.current.style.opacity = '';
			}, 150);
		}, 150);
	} else {
		dom.album.innerHTML = getAlbumInfo(nfo);
		dom.title.innerHTML = nfo.title;
	}

	dom.pagetitle.textContent = nfo.title + (nfo.artist ? ' - '+ nfo.artist : '');
	fillShare(path);
	if ('mediaSession' in navigator) {
		navigator.mediaSession.metadata.title = nfo.title;
		navigator.mediaSession.metadata.artist = nfo.artist;
		navigator.mediaSession.metadata.artwork = [{ src: cover }];
	}
}

function start(a) {
	a.prepped = false;
/*	if (!a.canplaythrough)
		return setTimeout(function() {
			start(a);
			log('Playback was delayed: no "canplaythrough" yet');
		}, 1000);*/
	const promise = a.play();
	if (typeof promise !== 'undefined')
		promise.catch(function(e) {
			log(e, true);
			if (e.code == 9)
				setToast({ 'className': 'error', 'textContent': str.errorfile });
			else if (cfg.autoplay && e.name == 'NotAllowedError')
				setToast({ 'className': 'error', 'textContent': str.errorautoplay });
		});
	dom.seek.disabled = 0;
}

function toggle(e) {
	const button = e.target.tagName == 'U' ? e.target.parentNode : e.target;

	switch (button.id) {
		case 'cover':
			e.preventDefault();
			cls(dom.cover, 'nofade', TOG);
			return;
		case 'volume':
			if (cls(dom.controls, 'volume', TOG))
				if (cls(dom.player, 'fix')) dom.volumeslider.focus();
				else setFocus(dom.volumeslider);
			else
				dom.volumeslider.blur();
			return;
		case 'playlistbtn':
			if (cfg.locked) return;
			dom.hide(['playlists', 'afteroptions']);	// Continue
		case 'share':
			if (!sharing && button.id == 'share') return;
			cls(dom.options, button.id, TOG);
			cls(button, 'on', TOG);
			if (cls(button, 'on')) prepPlaylists('share');
			setFocus(dom[button.id]);
			return;
		case 'randomfiltered':
			if (dom.filter.value == '') return;
		case 'stopplayback':
		case 'repeatplaylist':
		case 'playlibrary':
		case 'randomlibrary':
			cfg.after = button.id;
			dom.hide('afteroptions');
			menu('after');
			if (button.id == 'randomfiltered') {
				const tip = dom.randomfiltered.firstElementChild || dom.randomfiltered.appendChild(document.createElement('b'));
				tip.textContent = dom.filter.value;
				buildFilteredLibrary();
			} else if (dom.randomfiltered.firstElementChild)
				dom.randomfiltered.firstElementChild.remove();
			return;
		case 'lock':
			return Popup.lock();
		case 'logbtn':
			cls(dom.body, 'dim', cls(dom.logdiv, 'hide'));
			if (cls(dom.logdiv, 'hide', TOG))
				dom.log.blur();
			else if (!cls(dom.body, 'touch'))
				dom.log.focus();
			return;
		case 'trash':
			return cls(button, 'over', ADD);
		case 'playlistclear':
			return clearPlaylist();
		case 'unfold':
			if (cfg.locked) return;
			return cls(dom.library, 'unfold', TOG);
		case 'crossfade':
			fade = null;	// Continue
		default:
			if (cfg.locked) return;
			cfg[button.id] ^= true;
			cls(button, 'on', cfg[button.id] ? ADD : REM);
			setToast(button);
			log('Set '+ button.id +' = '+ (cfg[button.id] == 1));
		}
		if (button.id == 'removesongs')
			cls(dom.trash, 'on', cfg.removesongs ? ADD : REM);
}

function buildFilteredLibrary(terms = dom.filter.value.trim()) {
	const termsArray = terms.toLowerCase().split(' ');
	playedFiltered.length = songsFiltered.length = 0;

	for (var s in songs)
		if (matchTerms(songs[s].path.toLowerCase(), termsArray))
			songsFiltered.push(songs[s].id);
}

function toggleLock() {
	if (!password()) return;
	if (!cfg.locked && cls(dom.options, 'playlistbtn'))
		dom.playlistbtn.click();
	cfg.locked ^= true;
	const act = cfg.locked ? ADD : REM;
	cls(document.body, 'locked', act);
	cls(dom.lock, 'on', act);
	lng(dom.lock, cfg.locked ? str.unlock : str.lock);
}

function password() {
	const p = dom.password.value;

	if (!cfg.locked && p == str.enterpass) return true;
	if (cfg.locked && !cfg.password) return true;
	if (!p) return false;

	var pass = 0;
	for (var i = 0; i < p.length; i++)
		pass = pass * 7 + p.charCodeAt(i);

	if (cfg.locked && cfg.password != pass) {
		setToast({ 'className': 'error', 'textContent': str.wrongpass });
		return false;
	}
	if (!cfg.locked) cfg.password = pass;
	return true;
}

function menu(e) {
	if (cfg.locked) return;
	if (e.type == 'mouseleave' && touch) return;

	var btn, el;
	if (e == 'playlistload' || dom.playlistsdiv.contains(e.target)) {
		if (!onlinepls || url.length > 1) return;
		el = dom.playlists;
		btn = dom.playlistload;
	} else if (e == 'after' || dom.afterdiv.contains(e.target)) {
		el = dom.afteroptions;
		btn = dom.after;
	}

	if (cls(el, 'hide') && e.type !== 'mouseleave') {
		const { bottom, left } = btn.getBoundingClientRect();
		el.top = bottom;
		el.left = left;
		switch (el) {
			case dom.playlists:
				cls(el, 'delay', !cls(dom.options, 'playlistbtn'));
				if (!cls(dom.options, 'playlistbtn'))
					dom.playlistbtn.click();
				prepPlaylists('load');
				break;
			case dom.afteroptions:
				cls(el, 'delay', !cls(dom.options, 'playlistbtn'));
				if (!cls(dom.options, 'playlistbtn'))
					dom.playlistbtn.click();
				cls(dom.stopplayback,   'on', cfg.after == 'stopplayback'   ? ADD : REM);
				cls(dom.repeatplaylist, 'on', cfg.after == 'repeatplaylist' ? ADD : REM);
				cls(dom.playlibrary,    'on', cfg.after == 'playlibrary'    ? ADD : REM);
				cls(dom.randomfiltered, 'on', cfg.after == 'randomfiltered' ? ADD : REM);
				cls(dom.randomlibrary,  'on', cfg.after == 'randomlibrary'  ? ADD : REM);
				dom.randomfiltered.disabled = dom.filter.value == '';
				dom.show(el.id);
				setFocus(dom[cfg.after]);
		}
	} else switch (el) {
			case dom.playlists:
			case dom.afteroptions:
				dom.playlistbtn.click();
				break;
			default:
				cls(el, 'hide', ADD);
	}
}

function clearPlaylist() {
	if (cfg.locked || mode || cfg.playlist.length == 0 || !confirm(str.clearplaylist)) return;
	cfg.playlist.length = 0;
	cfg.index = -1;
	dom.playlist.innerHTML = '';
	resizePlaylist();
	if (cfg.removesongs) dom.removesongs.click();
	ffor(tree, function(f) {
		cls(f, 'dim', REM);
	});
}

function resizePlaylist() {
	if (!mode && cfg.playlist.length > 7) {
		if (!cls(dom.playlist, 'resize')) {
			dom.playlist.style.height = dom.playlist.offsetHeight +'px';
			cls(dom.playlist, 'resize', ADD);
		}
	} else {
		dom.playlist.style.height = '';
		cls(dom.playlist, 'resize', REM);
	}
	setTrashPos();
}

function setTrashPos() {
	const scrollBars = dom.playlist.offsetWidth - dom.playlist.clientWidth;
	dom.trash.style.right = scrollBars == 0 ? '' : scrollBars + (cls(dom.doc, 'material') ? 8 : 4) +'px';
}

function filter(instant = false) {	// Gets event from oninput
	const terms = dom.filter.value.trim(),
		length = terms.length,
		display = length ? 'none' : '';
	var results = false;
	if (instant && (length < cfg.instantfilter || terms == currentFilter)) return;

	log('Filtering for: "'+ terms +'"');
	ffor(tree, function(f) {
		if (cls(f, 'folder'))
			f.className = 'folder'+ (cls(f, 'dim') ? ' dim' : '');
		f.style.display = display;
	});

	if (length) {
		const termsArray = terms.toLowerCase().split(' ');

		ffor(tree, function(f) {
			const path = f.path.toLowerCase();

			if (matchTerms(path, termsArray)) {
				if (cls(f, 'song') && !matchTerms(path.substring(path.lastIndexOf('/') + 1), termsArray)
					&& cls(f.parentNode.parentNode, 'match')) return;	// If parent is already a match, only continue if song is a full match

				results = true;
				cls(f, 'match', ADD);
				f.style.display = '';

				if (cls(f, 'folder') && f.path.substring(f.path.lastIndexOf('/') + 1) == dom.filter.value) {	// When clicking on folder in player
					ffor(f.querySelectorAll('ul > *'), function(c) {
						c.style.display = '';
					});
					cls(f, 'open', ADD);
				}

				for (var p = f.parentNode; p && p !== dom.tree; p = p.parentNode) {
					if (cls(p, 'parent'))
						break;
					if (cls(p, 'folder')) {
						cls(p, 'open', ADD);
						cls(p, 'parent', ADD);
					}
					p.style.display = '';
				}
			}
		});
	}

	cls(dom.library, 'unfold', ADD);
	if (results) {
		currentFilter = terms;
		if (!instant) keyNav(null, 'down');
	}
}

function matchTerms(path, termsArray) {
	var match = true;
	ffor(termsArray, function(t) {
		if (!path.includes(t)) {
			match = false;
			return true;
		}
	});
	return match;
}

function cls(el, name, act = null) {
	if (typeof el === 'undefined')
		return null;
	const found = el.classList.contains(name);
	if (act == null)
		return found;
	if (act == SET)
		return name == (el.className = name);
	if (!found && act >= TOG)
		el.classList.add(name);
	else if (found && act <= TOG)
		el.classList.remove(name);
	else
		return found;	// NoOp
	return !found;
}

function ffor(items, callback) {
	const length = items.length;
	for (var i = 0; i < length; i++) {
		if (callback(items[i]))	// If returns true, break the loop
			break;
	}
}

function setFilter(f) {
	if (mode) return;
	if (typeof f === 'string')
		dom.filter.value = f;
	else if (cfg.index == -1)
		return;
	else if (f.target && f.target.id == 'album') {
		f = cfg.playlist[cfg.index].path.split('/');
		if (f.length < 2) return;
		dom.filter.value = f[f.length - 2];
	} else
		dom.filter.value = f.target.textContent;
	filter();
	setFocus(dom.library);
}

function clearFilter() {
	dom.filter.value = '';
	filter();
}

function keyNav(el, direction) {
	var to;

	if (dom.tree.contains(el)) {
		switch (direction) {
			case 'up':
				if (el.previousElementSibling) {
					to = el.previousElementSibling;
					while (cls(to, 'open'))
						to = to.lastElementChild.lastElementChild;
				} else
					to = el.parentNode.parentNode;
				break;
			case 'down':
				if (cls(el, 'open')) {
					to = el.firstElementChild.firstElementChild;
				} else if (el.nextElementSibling) {
					to = el.nextElementSibling;
				} else {
					var parent = el.parentNode.parentNode;
					while (parent.nextElementSibling == null && parent.parentNode)
						parent = parent.parentNode.parentNode;
					to = parent.nextElementSibling;
				}
				break;
			case 'left':
				if (cls(el, 'open'))
					if (cls(el, 'parent'))
						return cls(el, 'open', REM);
					else
						return el.click();
				else
					to = el.parentNode.parentNode;
				break;
			case 'right':
				if (cls(el, 'open') && !cls(el, 'parent'))
					keyNav(el, 'down');
				else if (cls(el, 'folder'))
					el.click();
				return;
			case 'first':
				to = el.parentNode.firstElementChild;
				direction = 'down';
				break;
			case 'last':
				to = el.parentNode.lastElementChild;
				direction = 'up';
		}
	} else if (el && cls(el.parentNode, 'menu')) {
		switch (direction) {
			case 'up':
				if (el.previousElementSibling)
					return setFocus(el.previousElementSibling);
			case 'right':
				return setFocus(el.parentNode.lastElementChild);
			case 'down':
				if (el.nextElementSibling)
					return setFocus(el.nextElementSibling);
			case 'left':
				return setFocus(el.parentNode.firstElementChild);
			default:
				return;
		}
	}

	if (!to || !dom.tree.contains(to)) {
		if (direction == 'up') {
			to = dom.tree.lastElementChild;
			while (cls(to, 'open'))
				to = to.lastElementChild.lastElementChild;
		} else {
			to = dom.tree.querySelector('li');
		}
	}

	if (to) {
		if (to.style.display == 'none')
			return keyNav(to, direction);
		setFocus(to);
	}
}

function changeTheme(e) {
	e.preventDefault();
	var change = 'theme';
	switch(e.target.id) {
		case 'theme':
			if (e.type == 'contextmenu')
				change = 'material';
			break;
		case 'color':
			if (e.type == 'contextmenu')
				change = 'colorbutton';
			else if (e.ctrlKey)
				change = 'colortoggle';
			else
				change = 'focuscolor';
	}

	switch(change) {
		case 'material':
		case 'colorbutton':
		case 'colortoggle':
			cls(dom.doc, change, TOG);
			cfg.theme = dom.doc.className;
			break;
		case 'focuscolor':
			if (!focuscolors.length) return;
			for (var i = 0; i < focuscolors.length; i++) {
				const c = focuscolors[i];
				if (cls(dom.doc, c)) {
					const cnext = focuscolors[(i + 1) % focuscolors.length];
					cls(dom.doc, c, REM);
					cls(dom.doc, cnext, ADD);
					break;
				} else if (i == focuscolors.length - 1)
					cls(dom.doc, focuscolors[0], ADD);
			}
			cfg.theme = dom.doc.className;
			break;
		case 'theme':
			if (!themes.length) return;
			const prev = cfg.theme;
			if (themes.includes(prev))
				themes.splice(themes.indexOf(prev), 1);
			themes.push(prev);
			cfg.theme = themes[0];
			setTimeout(function() {
				cls(dom.playlist, 'resize', REM);
				dom.playlist.style.height = '';
				dom.doc.className = cfg.theme;
				resizePlaylist();
			}, 400);
	}
	log('Theme: '+ cfg.theme, true);
}

const Popup = {

	addButton: function(title, action) {
		const btn = document.createElement('button');
		btn.className = title.toLowerCase();
		btn.textContent = title;
		btn.setAttribute('onclick', action);
		dom.popupcontent.appendChild(btn);
	},

	addInput: function(value, type = false) {
		const input = document.createElement('input');
		input.value = value;
		if (type) input.type = type;
		dom.popupcontent.appendChild(input);
		return input;
	},

	addTitle: function(value) {
		const title = document.createElement('p');
		title.textContent = value;
		dom.popupcontent.appendChild(title);
		return title;
	},

	lock: function() {
		dom.popup.className = cfg.locked ? 'unlockdlg' : 'lockdlg';
		this.addTitle(str.enterpass);
		dom.focus = dom.password = this.addInput(cfg.locked || !cfg.password ? '' : str.enterpass, 'password');
		this.open();
	},

	share: function(type) {
		const share = dom[type +'uri'];
		const shareRoot = type == 'folder' && url.length > 1;
		var nfo;
		if (!share.value && !shareRoot) return;
		var uri = 'c:'+ base64(root + share.value);
		if (type == 'playlist') {
			nfo = share.value;
			uri = 'pl:'+ esc(share.value);
		} else {
			nfo = getSongInfo(dom.songuri.value.length ? dom.songuri.value : share.value);
			if (type == 'folder')
				nfo = getAlbumInfo(nfo);
			else
				nfo = nfo.title +' ['+ getAlbumInfo(nfo) +']';
		}

		dom.popup.className = 'sharedlg';
		dom.popup.uri = uri;
		dom.focus = dom.sharemsg = this.addInput(cfg.sharemsg || str.sharemsg, str.sharetitle);
		dom.sharenfo = this.addInput(nfo);
		for (name in shareapi)
			if (shareapi[name]) this.addButton(name, 'share("'+ name +'")');
		if (navigator.canShare) this.addButton(str.sharenative, 'share(false)');
		dom.hide('ok');
		this.open();
	},

	open: function() {
		cls(dom.body, 'dim', ADD);
		dom.show('popupdiv');
		dom.popup.style.height = (9 + dom.popup.lastElementChild.getBoundingClientRect().bottom - dom.popup.getBoundingClientRect().top) +'px';
		dom.focus.select();
	},

	close: function(e = false) {
		if (e) switch(dom.popup.className) {
			case 'lockdlg':
			case 'unlockdlg':
				toggleLock();
				break;
		}
		cls(dom.body, 'dim', REM);
		dom.focus = false;
		dom.hide('popupdiv');
		dom.popup.className = dom.popup.uri = dom.popupcontent.innerHTML = dom.password = '';
		dom.show('ok');
	}
}

function prepHotkeys() {
	dom.keys = {
		'Backspace': dom.stop,
		'MediaPlayPause': dom.playpause,
		'MediaStop': dom.stop,
		'MediaTrackNext': dom.next,
		'MediaTrackPrevious': dom.previous,
		...tv && {
			1: dom.enqueue,
			3: dom.cover,
			7: dom.playlistload,
			0: dom.playpause,
			'PageDown': dom.previous,
			'PageUp': dom.next
		}
	};
	document.querySelectorAll('[accesskey]' ).forEach(function(el) { dom.keys[el.accessKey] = el });
	document.querySelectorAll('[contextkey]').forEach(function(el) { dom.keys[el.getAttribute('contextkey')] = el });

	dom.filter.addEventListener('keypress', function(e) {
		if (e.key == 'Enter')
			filter();
	}, false);

	document.addEventListener('keydown', function(e) {
		const el = document.activeElement;
		if (e.altKey || e.ctrlKey) return;

		if (el.tagName == 'INPUT' && e.key != dom.reload.accessKey) {
			if (el == dom.volumeslider) {
				if (e.keyCode > 36 && e.keyCode < 41) return;	// Arrow keys
				if (e.key == 'Escape' || e.key == dom.volume.accessKey) return dom.volume.click();
			} else if (el == dom.filter) {
				switch(e.key) {
					case 'ArrowUp': return keyNav(null, "up");
					case 'ArrowDown': return keyNav(null, "down");
				}
			} else if (e.key == 'Enter' && !cls(dom.popupdiv, 'hide') && !cls(dom.ok, 'hide'))
				dom.ok.click();

			var refocus = true;
			if (e.key == 'Escape') {
				e.preventDefault();
				if (el.value == '') {
					if (!cls(dom.popup, 'hide'))
						Popup.close();
					else refocus = false;
				}
				el.value = '';
				el.blur();
				if (el == dom.filter) filter();
				if (refocus) el.focus();
			}
			return;
		}

		if (e.key == 'Escape') {
			if (!cls(dom.popupdiv, 'hide'))
				return Popup.close();
			if (!cls(dom.logdiv, 'hide'))
				return logbtn.click();
		}

		if (el.tagName == 'TEXTAREA') return;

		const keyEl = dom.keys[e.key];

		if (keyEl) {
			e.preventDefault();
			if (!dom.tree.contains(e.target))
				e.target.blur();
			if (e.key == keyEl.getAttribute('contextkey'))
				return keyEl.dispatchEvent(new CustomEvent('contextmenu'));
			else
				return keyEl.click();
		}

		switch (e.key) {
			case 'Escape':
				if (el && cls(el.parentNode, 'menu') && cls(dom.options, 'playlistbtn'))
					dom.playlistbtn.click();
				else
					clearFilter();
				break;

			case '=':
				e.preventDefault();
				if (e.shiftKey)
					setVolume(Math.min(cfg.volume + .05, def.volume));
				else
					audio[track].currentTime += 5;
				break;
			case '-':
				e.preventDefault();
				if (e.shiftKey)
					setVolume(Math.max(cfg.volume - .05, 0));
				else
					audio[track].currentTime -= 5;
				break;

			case 'Home':
				e.preventDefault();
				keyNav(null, 'down');
				break;
			case 'End':
				e.preventDefault();
				keyNav(null, 'up');
				break;
			case tv ? 2 : '':
			case 'ArrowUp':
				e.preventDefault();
				if (e.shiftKey)
					keyNav(el, 'first');
				else
					keyNav(el, 'up');
				break;
			case tv ? 8 : '':
			case 'ArrowDown':
				e.preventDefault();
				if (e.shiftKey)
					keyNav(el, 'last');
				else
					keyNav(el, 'down');
				break;
			case tv ? 4 : '':
			case 'ArrowLeft':
				e.preventDefault();
				keyNav(el, 'left');
				break;
			case tv ? 6 : '':
			case 'ArrowRight':
				e.preventDefault();
				keyNav(el, 'right');
				break;

			case tv ? 5 : '':
			case 'Enter':
				e.preventDefault();
				if (e.shiftKey)
					el.dispatchEvent(new CustomEvent('contextmenu', { bubbles: true }));
				else
					el.click();
				break;

			case tv ? 9 : '':
			case 'b':
				cls(dom.body, 'dim', TOG);
				break;
		}
	}, false);
}
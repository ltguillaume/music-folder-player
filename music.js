var
	audio,
	base,
	cfg = {},
	def = { 'playlist': [], 'skip': [], 'index': -1 },
	dom,
	library,
	ls,
	pathexp,
	shareapi = {},
	songs = [],
	str = {},
	themes = [],
	url,

	drag,
	errorCount = 0,
	mode,
	onPlaylist,
	onSeek,
	onScrollWait,
	played = [],
	playerheight,
	playlistLoaded,
	playlists,
	retry,
	songsFiltered = [],
	toast,
	touch,
	track = 0,
	tree,
	tv;

const
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

	var lib = document.createElement('script'),
		lng = new URLSearchParams(window.location.search).get('lng') || navigator.language.substring(0, 2);
	lib.src = 'music.php?lng='+ lng + (url.length > 1 ? '&play='+ esc(url[1]) : '');
	lib.onload = function() {
		if (!library) alert(str.nolibrary);
		else if (!pathexp) alert(str.nopathexp);
		if (pathexp.constructor !== Array) pathexp = [pathexp];
		for(var i = 0; i < pathexp.length; i++) {
			pathexp[i] = pathexp[i].replace(/[\/^$*+?.()|[\]{}]/g, '\\$&')
				.replace(/ /g,'[\\s\\.\\-()]*')
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
		dom.show('doc');
		log(sourceurl, true);
		log('Song count: '+ songs.length, true);
		log('PHP request = '+ lib.src);
		if (songs.length == 1) prepSongMode();
		if (autoplay > 1 || autoplay && url[1]) playPause();
		library = null;
	};
	document.body.appendChild(lib);
}

function lng(el, string, tooltip) {
	if (!el) return log('Element '+ el.id +' not found for string: '+ string);
	if (tooltip) {
		string = string.split('\n');
		el.title = string[0]
			+ ((el.accessKey && el.accessKey != ' ') ? ' ('+ el.accessKey +')' : '')
			+ (string.length > 1 ? '\n'+ string[1] : '');
	} else {
		if (!el.accessKey)
			return el.innerHTML = string;
		var index = string.toLowerCase().indexOf(el.accessKey);
		if (index == -1)
			el.innerHTML = string +' <b>'+ el.accessKey +'</b>';
		else
			el.innerHTML = string.substring(0, Math.max(index, 0)) +'<u>'+ string.substring(index, index + 1) +'</u>'+ string.substring(index + 1);
	}
}

function prepUI() {
	ls = ls();
	dom.source.href = sourceurl;
	dom.pagetitle.textContent = def.title;
	dom.filter.placeholder = str.filter;
	dom.doc.className = cfg.theme || def.theme;
	dom.volumeslider.max = def.volume;
	dom.volumeslider.value = cfg.volume;
	if (cfg.enqueue) cls(dom.enqueue, 'on', ADD);
	if (cfg.random) cls(dom.random, 'on', ADD);
	if (cfg.crossfade) cls(dom.crossfade, 'on', ADD);
	if (cfg.locked) {
		cls(document.body, 'locked', ADD);
		cls(dom.lock, 'on', ADD);
		dom.lock.textContent = 'Unlock';
	}
	lng(dom.lock, cfg.locked ? str.unlock : str.lock);
	if (url.length > 1 || !onlinepls) dom.hide(['playlistsdiv', 'playlistsave', 'shareplaylist']);
	if (!sharing) dom.hide('share');
	if (cfg.after == 'randomfiltered') cfg.after = 'randomlibrary';
	cfg.removesongs = false;
	if (!debug) dom.hide('logbtn');

	if (url.length > 1 && url[1].startsWith('pl:')) {
		prepPlaylistMode();
		prepPlaylists(mode);
	}

	ffor(['TV', 'Andr0id', ' OMI/', 'Viera'], function(s) {
		if (navigator.userAgent.indexOf(s) > -1) tv = true;
	});

	window.addEventListener('click', function() {	// Solve autoplay issues
		if (audio[0].src.startsWith('data:'))
			audio[0].play();
		if (audio[1].src.startsWith('data:'))
			audio[1].play();
	}, { once: true, passive: true });
	if ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) touchUI();
	else window.addEventListener('touchstart', function() {
		touchUI();
		window.addEventListener('touchend', function(e) {
			e.preventDefault();
/*			dom.playlist.className = dom.playlist.style.height = '';
			resizePlaylist();
			window.addEventListener('touchend', function(e) {
				endDrag();
			}, false);
*/		}, { once: true });
		window.addEventListener('touchmove', function(e) {
			onPlaylist = dom.playlist.contains(e.targetTouches[0].target);
		}, { passive: true });
	}, { once: true, passive: true });

	window.addEventListener('scroll', function() {
		if (onScrollWait) return;
		onScrollWait = true;
		setTimeout(function() {
			fixPlayer();
			onScrollWait = false;
		}, 400);
	}, { passive: true });

	window.onpagehide = function() {
		if (ls) {
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

	if (instantfilter) dom.filter.oninput = filter;	// Gives event as parameter

	if (window.innerWidth > 360)
		cls(dom.library, 'unfold', ADD);

	prepHotkeys();
}

function touchUI() {
	touch = true;
	cls(dom.doc, 'touch', ADD);
	if (mode) resizePlaylist();
	else dom.show('trash');
}

function fixPlayer() {
	if (!cls(dom.player, 'fix') && !cls(dom.doc, 'dim')
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
		var sav = localStorage.getItem(lsid);
		if (sav != null) {
			cfg = JSON.parse(sav) || {};
			for (var c in def)
				if (typeof cfg[c] === 'undefined' || cfg[c] == null) cfg[c] = def[c];
			return true;
		}
		cfg = def;
		var ls = JSON.stringify(cfg);
		localStorage.setItem(lsid, ls);
		if (localStorage.getItem(lsid) == ls) return true;
		log('LocalStorage issue');
		return false;
	} catch(e) {
		log(e);
		cfg = def;
		return false;
	}
}

function log(s, force = false) {
	if (debug || force) {
		if (typeof s === 'string') {
			var t = new Date();
			s = s.replace(/data\:audio.*/, '(Autoplay Fix)');
			s = String(t.getHours()).padStart(2, '0') +':'+ String(t.getMinutes()).padStart(2, '0') +':'+ String(t.getSeconds()).padStart(2, '0') +'  '+ s;
			dom.log.value += s +'\n';
		}
		if (!touch) console.log(s);
	}
}

function saveLog() {
	var l = new Blob([dom.log.value], { type: 'text/plain', endings: 'native' });
	dom.a.href = window.URL.createObjectURL(l);
	dom.a.download = def.title +"_"+ Math.floor(new Date()/1000) +'.log';
	dom.a.click();
}

function prepPlaylistMode() {
	cfg.after = 'stopplayback';
	dom.hide(['enqueue', 'playlistsave', 'playlibrary', 'randomlibrary', 'randomfiltered', 'trash', 'library']);
	dom.playlist.style.minHeight = dom.playlist.style.maxHeight = 'unset';
	mode = 'playlist';
}

function prepAudio(id) {
	var a = new Audio();

	a.log = function(msg) { log(msg +' ['+ id +']: '+ decodeURI(a.src.replace(a.baseURI, ''))) };

	a.onloadstart = function() {
		a.log('Load started');
	}

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
		if (a.src.startsWith('data:')) return;
		if (audio[track].ended)	// For crossfade/"gapless"
			playNext();
	};

	a.ontimeupdate = function() {
		if (a != audio[track] || a.src.startsWith('data:')) return;
//		if (a != audio[track]) return;

		if (a.currentTime >= a.duration - buffersec) return playNext();

		if ((a.duration - a.currentTime) < 20) {
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
		if (errorCount < maxerrors)
			playNext();
		else
			errorCount = 0;
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
			element.appendChild(li);
			var ul = li.appendChild(document.createElement('ul'));
			buildLibrary(root + i +'/', folder[i], ul);
		} else {
			for (f in folder[i]) {
				if (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png')) {
					if (!cover || f.toLowerCase().startsWith('cover'))
						cover = f;
					delete(folder[i][f]);
				}
			}
			for (f in folder[i]) {
				li = document.createElement('li');
				li.id = songs.length;
				cls(li, 'song', ADD);
				li.path = root + f;
				if (cover) li.cover = cover;
				li.textContent = f.substring(f.lastIndexOf('/') + 1, f.lastIndexOf('.'));
				li.tabIndex = 1;
				songs.push(li);
				element.appendChild(li);
			}
		}
	}
}

function reloadLibrary() {
	if (cfg.locked) return;
	dom.tree.innerHTML = '';
	var lib = document.createElement('script');
	lib.src = 'music.php'+ (url.length > 1 ? '?play='+ esc(url[1]) +'&' : '?') +'reload';
	lib.onload = function() {
		buildLibrary('', library, dom.tree);
		tree = dom.tree.querySelectorAll('li');
		clearPlayed();
		library = null;
		if (dom.filter.value.length)
			filter();
	}
	document.body.appendChild(lib);
}

function prepSongMode() {
	prepPlaylistMode();
	add(0);
	dom.hide(['previous', 'next', 'options', 'playlistdiv']);
	mode = 'song';
}

function libClick(e, context = false) {
	if (cls(e.target, 'folder'))
		context ? addFolder(e) : openFolder(e);
	else
		context ? addSongNext(e) : addSong(e);
}

function openFolder(e) {
	e.stopPropagation();
	var li = e.target;
	ffor(li.querySelectorAll(':scope > ul > *'), function(c) {
		if (c.style.display != '') c.style.display = '';
	});
	if (cls(li, 'closedmatch') || cls(li, 'parent')) {
		cls(li, 'open', ADD);
		cls(li, 'closedmatch', REM);
		cls(li, 'parent', REM);
	} else
		cls(li, 'open', TOG)
	setFocus(li);
	if (audio[track].paused) fillShare(li.path +'/');
}

function addFolder(e) {
	e.preventDefault();
	e.stopPropagation();
	var li = e.target;
	if (confirm(str.addfolder +'\n'+ li.path.substring(li.path.lastIndexOf('/') + 1))) {
		cls(li, 'dim', ADD);
		ffor(li.querySelectorAll('li.song'), function(s) {
			add(s.id);
			cls(li, 'dim', ADD);
		});
	}
}

function setFocus (el) {
	el.focus();
	const { top, bottom } = el.getBoundingClientRect(),
		offset = cls(dom.player, 'fix') ? dom.player.offsetHeight : 0;
	if (top < offset || bottom - top + offset > window.innerHeight - offset) {
		window.scrollTo({
			'top': window.scrollY + top - offset,
			'behavior': 'smooth'
		});
	} else if (bottom > window.innerHeight) {
		window.scrollTo({
			'top': window.pageYOffset + bottom - window.innerHeight + 4,
			'behavior': 'smooth'
		});
	}
	if (!offset) setTimeout(function() {
		if (cls(dom.player, 'fix')) setFocus(el);
	}, 500, el);
}

function setToast(el) {
	if (el.className == 'error' || cls(dom.player, 'fix')) {
		if (el.className == 'error') log(str.error +' '+ el.textContent, true);
		if (toast) clearTimeout(toast);
		dom.toast.className = el.className;
		dom.toast.textContent = el.textContent;
		dom.show('toast');
		toast = setTimeout(function() { dom.hide('toast') }, 4000);
	}
}

function addSong(e) {
	e.stopPropagation();
	var li = e.target;
	if (cfg.enqueue || cfg.locked)
		add(li.id);
	else {
		load(li.id, 'next');
		if (cfg.playlist[cfg.index + 1].path != li.path)	// Other songs are set to be played first
			return setToast({ 'className': 'error', 'textContent': str.othersongsnext });
		else
			playNext();
	}
	cls(li, 'dim', ADD);
	if (audio[track].paused) fillShare(li.path);
}

function addSongNext(e) {
	e.preventDefault();
	e.stopPropagation();
	var li = e.target;
	add(li.id, true);
	cls(li, 'dim', ADD);
	if (audio[track].paused) fillShare(li.path);
}

function buildPlaylist() {
	if (cfg.playlist.length == 0 || (url.length > 1 && !mode)) return;	// Only use saved playlist in library mode
	cfg.index = Math.min(cfg.index, cfg.playlist.length - 1);
	dom.playlist.innerHTML = '';

	var i, li;
	for (i in cfg.playlist) {
		li = playlistItem(cfg.playlist[i]);
		cls(li, 'song', ADD);
		dom.playlist.appendChild(li);
		if (i == cfg.index) {
			cls(li, 'playing', ADD);
			var path = cfg.playlist[i].path;
			var nfo = getSongInfo(path);
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
	var li = document.createElement('li');
	cls(li, 'song', ADD);
	li.draggable = 'true';
	if (s.id == 'last') {
		li.id = 'last';
	} else {
		var nfo = getSongInfo(s.path);
		li.innerHTML = nfo.title +'<span class="artist">'+ (nfo.artist ? '('+ nfo.artist +')' : '') +'</span>';
		li.title = getAlbumInfo(nfo) + (mode ? '' : '\n\n'+ str.playlistdesc);
	}
	return li;
}

function clickItem(e) {
	var item = cls(e.target, 'artist') ? e.target.parentNode : e.target;
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
	if (dom.playlist.hasChildNodes() && dom.playlist.lastChild.id == 'last') {
		dom.playlist.removeChild(dom.playlist.lastChild);
	}
	drag = null;
}

function dropItem(e) {
	e.preventDefault();
	e.stopPropagation();
	var to = e.target;
	if (to.tagName != 'LI') to = to.parentNode;
	log('Drag ['+ drag.textContent +'] to place of ['+ to.textContent +']');
	cls(to, 'over', REM);
	var indexfrom = e.dataTransfer.getData('text');
	var indexto = getIndex(to);
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
	var index = getIndex(drag);
	var playing = index == cfg.index;
	cfg.playlist.splice(index, 1);
	dom.playlist.removeChild(dom.playlist.childNodes[index]);
	if (cfg.index != -1 && index <= cfg.index)
		cfg.index--;
	if (cfg.index != -1 && !playing)
		cls(dom.playlist.childNodes[cfg.index], 'playing', ADD);
	endDrag();
	resizePlaylist();
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
	if (path.indexOf('/') == -1 && url.length > 1)
		path = root + path;	// For shared songs/folders

	for(var i = pathexp.length - 1; i > -1; i--) {
		try {
			var nfo = path.match(pathexp[i]);
			log(nfo.groups);
			return nfo.groups;
		} catch(e) {
			log(e);
			if (i < 1) {
				var nfo, artalb = path.substring(path.lastIndexOf('/', path.lastIndexOf('/') - 1) + 1, path.lastIndexOf('/'));
				if (artalb.indexOf(' -') == -1)
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
	var artist = nfo.artist ? nfo.artist : '';
	var album = (nfo.year ? '('+ nfo.year +') ' : '') + (nfo.album || '');
	album = artist + (album.length > 1 ? ' - '+ album : '');
	log('getAlbumInfo: '+ album);
	return album;
}

function timeTxt(t) {
	var h = ~~(t / 3600);
	var m = ~~(t % 3600 / 60);
	var s = ~~(t % 60);
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
		log('No previous item in playlist');
}

function skipArtist(e) {
	e.preventDefault();
	if (!cfg.locked) {
		var artist = dom.album.textContent;
		artist = artist.indexOf(' -') > 0 ? artist.substring(0, artist.indexOf(' -')) : false;
		if (artist && confirm(artist +'\n'+ str.skipartist)) {
			cfg.skip.push(artist);
			next();
		}
	}
}

function next() {
	if (!cfg.locked) playNext();
}

function prepNext() {
	if (cfg.playlist.length > cfg.index + 1) {
		log('prepNext from playlist');
		if (cfg.random && !cfg.playlist[cfg.index + 1].playNext) {
			var next = cfg.index + ~~(Math.random() * (cfg.playlist.length - cfg.index));
			var drag = dom.playlist.childNodes[next],
				to = dom.playlist.childNodes[cfg.index + 1],
				indexfrom = next,
				indexto = cfg.index + 1;
			moveItem(drag, to, indexfrom, indexto);
		}
		load(cfg.index + 1);
	} else if (cfg.after != 'stopplayback' || cfg.locked) {
		log('prepNext from library');
		if (played.length == songs.length) clearPlayed();
		if (cfg.locked || cfg.after == 'randomlibrary' || cfg.after == 'randomfiltered') {
			var set = cfg.after == 'randomlibrary' || cfg.locked || songsFiltered.length == 0 ? songs : songsFiltered;
			var next = null;
			do {
				next = ~~((Math.random() * set.length));
				if (played.indexOf(next.toString()) != -1)
					next = null;
				else if (artistSkipped(set[next].path)) {
					if (played.length == songs.length)
						clearPlayed();
					else {
						played.push(set[next].id);
						next = null;
					}
				}
			} while (next == null);
			load(set[next].id, true);
		} else if (cfg.after == 'playlibrary')	{
			if (cfg.index == -1) return load(songs[0].id, true);
			var path = cfg.playlist[cfg.index].path;
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
				log('End of library. Starting at the top');
				load(songs[0].id, true);
			}
		} else if (cfg.after == 'repeatplaylist' && cfg.playlist.length > 0)
			return load(0);
	}
}

function clearPlayed() {
	log('User reloaded library or all songs have been played. Clearing played array.', true);
	played.length = 0;
}

function artistSkipped(path) {
	var artist = getSongInfo(path).artist;
	if (debug && cfg.skip.indexOf() != -1)
		log('Artist '+ artist +' skipped');
	return cfg.skip.indexOf(artist) != -1;
}

function load(id, addtoplaylist = false) {
	log('load('+ id +', addtoplaylist = '+ addtoplaylist +')');
	clearInterval(retry);

	if (addtoplaylist == 'next') add(id, true);
	else if (addtoplaylist) add(id);

	var a = audio[+!track];
	a.prepped = !addtoplaylist;
	a.index = addtoplaylist ? cfg.index + 1 : id;
	log('a.index = '+ a.index);
	a.canplaythrough = false;
	a.src = esc(root + cfg.playlist[a.index].path);
	a.load();
	clearInterval(a.fade);
	a.fade = null;
	a.volume = cfg.volume;

	retry = setInterval(function() {
		if (a.buffered.length == 0 || a.buffered.end(a.buffered.length - 1) < Math.min(5, a.duration)) {
			a.log('No connection. Retrying');
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

function download(type) {
	var share = dom[type +'uri'];
	if (share.value || type == 'folder') {
		var uri = (type != 'playlist' ? root : "") + share.value;
		dom.a.href = 'music.php?dl'+ (type == 'playlist' ? 'pl' : '') +'='+ esc(uri);
		dom.a.click();
	}
}

function clip(type) {
	var share = dom[type +'uri'];
	if (share.value || type == 'folder') {
		var clearVal = share.value;
		if (type == 'playlist')
			share.value = base +'?play=pl:'+ esc(share.value);
		else
			share.value = base +'?play=c:'+ base64(root + share.value);
		share.select();
		document.execCommand('copy');
		cls(share.nextElementSibling.nextElementSibling, 'clip', ADD);
		share.blur();
		share.value = clearVal;
		setTimeout(function() {
			cls(share.nextElementSibling.nextElementSibling, 'clip', REM);
		}, 1500);
	}
}

function share(name) {
log('Share() triggered');
	var sharemsg = dom.popup.querySelector('#sharemsg'),
		sharenfo = dom.popup.querySelector('#sharenfo');
	var data = {
		text: sharemsg.value +' '+ sharenfo.value,
		url: base +'?play='+ dom.popup.uri };
	log(data);
	sharemsg.uri = null;

	if (shareapi[name]) {
		dom.a.href = shareapi[name].replace('{text}', data.text).replace('{url}', data.url);
		dom.a.click();
	} else {
		var promise = navigator.share(data);
		if (typeof promise !== 'undefined') {
			promise.catch(function(e) {
					setToast({ 'className': 'error', 'textContent': e });
			});
		}
	}
	cfg.sharemsg = sharemsg.value;
	Popup.close();
}

function prepPlaylists(action) {
	var xhttp = new XMLHttpRequest();
	xhttp.onload = function() {
		playlists = JSON.parse(this.responseText);
		log(playlists);
		var playlistElements = '';
		if (playlists.length != []) {
			for (var p in playlists)
				playlistElements += action == 'share' ? '<option value="'+ p +'">' : '<button class="add">'+ p +'</button>';
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
				dom.playlistdata.innerHTML = playlistElements;
				break;
			case 'playlist':
				loadPlaylist(decodeURIComponent(url[1].substring(3)));
				if (autoplay && audio[track].paused) playPause();
		}
	};
	xhttp.open('GET', 'music.php?pl', true);
	xhttp.send();
}

function loadPlaylist(name) {
	var pl = JSON.parse(playlists[name]);
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
	var name = e.target.textContent;
	if (e.target.tagName != 'BUTTON' || !confirm(str.removeplaylist +' '+ name +'?')) return true;
	var xhttp = new XMLHttpRequest();
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
		var xhttp = new XMLHttpRequest();
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
	var input = document.createElement('input');
	input.setAttribute('type', 'file');
	input.setAttribute('accept', '.mfp.json');
	input.onchange = function(e) {
		var reader = new FileReader();
		reader.onload = function(e) {
			var pl = JSON.parse(e.target.result);
			fillPlaylist(pl);
		};
		reader.readAsText(input.files[0], 'UTF-8');
	}
	input.click();
}

function exportPlaylist() {
	if (cfg.locked || mode == 'song' || !cfg.playlist.length) return;
	var filename = prompt(str.exportpl);
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
	var position = cfg.index > 0 && confirm(str.saveposition) ? cfg.index : 0;
	var copy = JSON.parse(JSON.stringify(cfg.playlist));
	ffor(copy, function(s) { delete s.playNext });
	var pl = position ? { playlist: copy, index: position } : copy;
	return JSON.stringify(pl);
}

function add(id, next = false) {
	var s = {
		'path': songs[id].path,
		'cover': songs[id].cover
	};

	var i = (nodupes || cfg.index == -1) ? 0 : cfg.index;
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

	var li = playlistItem(s);
	if (next) {
		s.playNext = 1;
		cfg.playlist.splice(i, 0, s);
		playlist.insertBefore(li, dom.playlist.childNodes[i]);
	} else {
		cfg.playlist.push(s);
		dom.playlist.appendChild(li);
	}

	resizePlaylist();
	log('Add to playlist (#'+ i +'): '+ s.path);
	if (!played.includes(id)) {
		played.push(id);
		log('Add id '+ id +' to played');
	}
}

function playNext() {
	if (cfg.index != -1) {
		var li = dom.playlist.childNodes[cfg.index];
		cls(li, 'playing', REM);
		delete li.playNext;
	}
	if (cfg.index + 1 == cfg.playlist.length && !audio[+!track].prepped && cfg.after == 'stopplayback') return;
	if (!audio[+!track].prepped) {
		log('PlayNext: not prepped');
		prepNext();
		stop();
	}
	if (!cfg.crossfade) stop();

	track ^= 1;
	var a = audio[track];
	cfg.index = a.index;
	start(a);

	var path = cfg.playlist[cfg.index].path,
		nfo = getSongInfo(path),
		cover = cfg.playlist[cfg.index].cover,
		prevcover = dom.cover.src || def.cover;
	cover = cover ? esc(root + path.substring(0, path.lastIndexOf('/') + 1) + cover) : def.cover;
	if (prevcover.indexOf(cover) == -1) {
		dom.cover.style.opacity = 0;
		if (cls(dom.player, 'full')) dom.current.style.opacity = 0;
		setTimeout(function() {
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
	var promise = a.play();
	if (typeof promise !== 'undefined')
		promise.catch(function(e) {
			log(e, true);
			if (e.code == 9)
				setToast({ 'className': 'error', 'textContent': str.errorfile });
			else if (autoplay && e.name == 'NotAllowedError')
				setToast({ 'className': 'error', 'textContent': str.errorautoplay });
		});
	dom.seek.disabled = 0;
}

function toggle(e) {
	var button = e.target.tagName == 'U' ? e.target.parentNode : e.target;

	switch (button.id) {
		case 'cover':
			e.preventDefault();
			cls(dom.cover, 'nofade', TOG);
			return;
		case 'volume':
			if (cls(dom.volumeslider, 'hide', TOG))
				dom.volumeslider.blur();
			else
				setFocus(dom.volumeslider);
			return;
		case 'playlistbtn':
			if (cfg.locked) return;
			dom.hide(['playlists', 'afteroptions']);	// Continue
		case 'share':
			if (!sharing) return;
			cls(dom.options, button.id, TOG);
			cls(button, 'on', TOG);
			setFocus(dom.share);
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
			if (!dom.randomfiltered.firstElementChild)
				dom.randomfiltered.appendChild(document.createElement('span'));
			if (button.id == 'randomfiltered') {
				dom.randomfiltered.firstElementChild.textContent = '['+ dom.filter.value +']';
				buildFilteredLibrary();
			} else dom.randomfiltered.firstElementChild.textContent = '';
			return;
		case 'lock':
			return toggleLock();
		case 'logbtn':
			if (!debug) return;
			cls(dom.doc, 'dim', cls(dom.logdiv, 'hide'));
			if (cls(dom.logdiv, 'hide', TOG))
				dom.log.blur();
			else
				dom.log.focus();
			return;
		case 'trash':
			return cls(button, 'over', ADD);
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
		}
		if (button.id == 'removesongs')
			cls(dom.trash, 'on', cfg.removesongs ? ADD : REM);
}

function buildFilteredLibrary() {
	songsFiltered = [];
	var term = dom.filter.value.toLowerCase();
	for (var s in songs)
		if (songs[s].path.toLowerCase().indexOf(term) != -1)
			songsFiltered.push(songs[s]);
}

function toggleLock() {
	if (!password()) return;
	if (!cfg.locked && cls(dom.options, 'playlistbtn'))
		dom.playlistbtn.click();
	cfg.locked ^= true;
	var act = cfg.locked ? ADD : REM;
	cls(document.body, 'locked', act);
	cls(dom.lock, 'on', act);
	lng(dom.lock, cfg.locked ? str.unlock : str.lock);
}

function password() {
	if (cfg.locked && !cfg.password) return true;

	var p = prompt(str.enterpass, (!cfg.locked && cfg.password ? str.prevpass : ''));
	if (p == null) return false;
	if (p == str.prevpass) return true;

	var pass = 0;
	for (var i = 0; i < p.length; i++)
		pass = pass * 7 + p.charCodeAt(i);

	if (cfg.locked && cfg.password != pass) {
		alert(str.wrongpass);
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
				cls(dom.randomfiltered, 'dim', dom.filter.value == '' ? ADD : REM);
				dom.show(el.id);
				setFocus(dom.afteroptions.firstElementChild);
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
	if (cfg.locked || mode || !confirm(str.clearplaylist)) return;
	if (cfg.playlist.length > 0) {
		cfg.playlist = [];
		cfg.index = -1;
		dom.playlist.innerHTML = '';
		resizePlaylist();
	}
	if (cfg.removesongs) dom.removesongs.click();
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

	var scrollBars = dom.playlist.offsetWidth - dom.playlist.clientWidth;
	dom.trash.style.right = scrollBars == 0 ? '' : scrollBars + 4 +'px';
}

function filter(instant = false) {	// Gets event from oninput
	if (instant && dom.filter.value.length < instantfilter) return;
	var display = dom.filter.value == '' ? '' : 'none';
	if (!tree) tree = dom.tree.querySelectorAll('li');
	ffor(tree, function(f) {
		f.style.display = display;
		if (cls(f, 'open'))
			f.className = 'folder'+ (cls(f, 'dim') ? ' dim' : '');
	});

	if (display != '') {
		var term = dom.filter.value.toLowerCase();
		ffor(tree, function(f) {
			var path = f.path.substring(f.path.lastIndexOf('/') + 1).toLowerCase();
			if (path.indexOf(term) != -1) {
				f.style.display = '';

				if (cls(f, 'folder')) {
					cls(f, 'match', ADD);
					if (path == dom.filter.value) {
						ffor(f.querySelectorAll('ul > *'), function(c) {
							c.style.display = '';
						});
						cls(f, 'open', ADD);
					} else cls(f, 'closedmatch', ADD);
				}

				for (var p = f.parentNode; p && p !== dom.tree; p = p.parentNode) {
					if (cls(p, 'parent'))
						break;
					if (p.style.display != '')
						p.style.display = '';
					if (cls(p, 'folder')) {
						cls(p, 'open', ADD);
						cls(p, 'parent', ADD);
					}
				}
			}
		});
	}

	cls(dom.library, 'unfold', ADD);
	if (!instant) keyNav(null, 'down');
}

function cls(el, name, act = null) {
	var found = el.classList.contains(name);
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

function ffor(items, callback, scope) {
	var length = items.length;
	for (var i = 0; i < length; i++) {
		callback.call(scope, items[i]);
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

function changeTheme() {
	if (!themes.length) return;
	var prev = cfg.theme;
	themes = themes.filter(t => t !== prev);
	themes.push(prev);
	cfg.theme = themes[0];
	setTimeout(function() {
		dom.doc.className = dom.doc.className.replace(prev, cfg.theme);
		log('Theme: '+ cfg.theme);
	}, 400);
}

var Popup = {

	addButton: function(txt) {
		var btn = document.createElement('button');
		btn.textContent = txt;
		btn.setAttribute('onclick', 'share("'+ txt +'")');
		dom.popupcontent.appendChild(btn);
	},

	addInput: function(id, value) {
		var input = document.createElement('input');
		input.id = id;
		input.value = value;
		dom.popupcontent.appendChild(input);
	},

	share: function(type) {
		var nfo,
			share = dom[type +'uri'];
		if (!share.value && type != 'folder') return;
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
		this.addInput('sharemsg', cfg.sharemsg || str.sharemsg, str.sharetitle);
		this.addInput('sharenfo', nfo);
		for (name in shareapi)
			if (shareapi[name]) this.addButton(name);
		if (navigator.canShare) this.addButton(str.sharenative, 'share(false)');
		dom.hide('ok');
		this.open();
	},

	open: function() {
		cls(dom.doc, 'dim', ADD);
		dom.show('popupdiv');
		dom.popup.style.height = (9 + dom.popup.lastElementChild.getBoundingClientRect().bottom - dom.popup.getBoundingClientRect().top) +'px';
	},

	close: function(e = false) {
		cls(dom.doc, 'dim', REM);
		dom.hide('popupdiv');
		dom.popup.className = dom.popup.uri = dom.popupcontent.innerHTML = '';
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
		...(tv) && {
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
		var el = document.activeElement;
		if (e.altKey || e.ctrlKey) return;

		if (el.tagName == 'INPUT') {
			if (el == dom.volumeslider) {
				if (e.keyCode > 36 && e.keyCode < 41) return;	// Arrow keys
				if (e.key == 'Escape' || e.key == dom.volume.accessKey) return dom.volume.click();
			} else if (el == dom.filter)
				switch(e.key) {
					case 'ArrowUp': return keyNav(null, "up");
					case 'ArrowDown': return keyNav(null, "down");
				}

			var refocus = true;
			if (e.key == 'Escape') {
				e.preventDefault();
				if (el.value == '') refocus = false;
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
			if (el == dom.log && !cls(dom.logdiv, 'hide'))
				return logbtn.click();
		}

		if (el.tagName == 'TEXTAREA') return;

		var keyEl = dom.keys[e.key];

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
				cls(dom.doc, 'dim', TOG);
				break;
		}
	}, false);
}
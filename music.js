var
	audio,
	base,
	cfg,
	dom,
	library,
	ls,
	songs = Array(),
	url,

	drag,
	errorcount = 0,
	filteredsongs = Array(),
	mode,
	onplaylist,
	onseek,
	onscrollwait,
	played = Array(),
	playerheight,
	playlistloaded,
	playlists,
	retry,
	toast,
	track = 0,
	tree,
	tv;

function init() {
	url = document.URL.split('?play=', 2);
	if (url[1] && url[1].startsWith('c:')) url[1] = atob(decodeURIComponent(url[1].substring(2)));
	base = window.location.protocol +'//'+ window.location.host + window.location.pathname;

	var get = function(id) { return document.getElementById(id) };
	dom = {
		'doc': document.documentElement,
		'player': get('player'),
		'cover': get('cover'),
		'current': get('current'),
		'folder': get('folder'),
		'song': get('song'),
		'time': get('time'),
		'seek': get('seek'),
		'volume': get('volume'),
		'volumeslider': get('volumeslider'),
		'playpause': get('playpause'),
		'previous': get('previous'),
		'next': get('next'),
		'toast': get('toast'),
		'options': get('options'),
		'crossfade': get('crossfade'),
		'enqueue': get('enqueue'),
		'random': get('random'),
		'playlistbtn': get('playlistbtn'),
		'playlistsdiv': get('playlistsdiv'),
		'load': get('load'),
		'save': get('save'),
		'playlists': get('playlists'),
		'afterdiv': get('afterdiv'),
		'after': get('after'),
		'afteroptions': get('afteroptions'),
		'stopplayback': get('stopplayback'),
		'repeatplaylist': get('repeatplaylist'),
		'playlibrary': get('playlibrary'),
		'randomlibrary': get('randomlibrary'),
		'randomfiltered': get('randomfiltered'),
		'share': get('share'),
		'lock': get('lock'),
		'shares': get('shares'),
		'folderuri': get('folderuri'),
		'songuri': get('songuri'),
		'shareplaylist': get('shareplaylist'),
		'playlisturi': get('playlisturi'),
		'playlistdata': get('playlistdata'),
		'a': get('a'),
		'clear': get('clear'),
		'playlist': get('playlist'),
		'library': get('library'),
		'filter': get('filter'),
		'unfold': get('unfold'),
		'tree': get('tree'),
		'hide': function(el) { dom.show(el, false) },
		'show': function(el, show = true) {
			if (el.constructor === Array)
				for (var i = 0; i < el.length; i++)
					dom[el[i]].style.display = show ? 'unset' : 'none';
			else
				dom[el].style.display = show ? 'unset' : 'none';
		}
	};

	get('splash').className = 'show';

	var lib = document.createElement('script');
	lib.src = 'music.php'+ (url.length > 1 ? '?play='+ esc(url[1]) : '');
	lib.onload = function() {
		prepUI();
		buildLibrary('', library, dom.tree);
		buildPlaylist();
		get('splash').className = '';
		dom.doc.className = cls(dom.doc, 'touch') ? 'touch' : '';
		console.log('https://github.com/ltGuillaume/MusicFolderPlayer'+ (mode ? '' : '\nSong count: '+ songs.length));
		log('PHP request = '+ lib.src);
		if (songs.length == 1) prepSongMode();
		if (autoplay > 1 || autoplay && url[1]) playPause();
	};
	document.body.appendChild(lib);
}

function prepUI() {
	ls = ls();
	title.textContent = deftitle;
	dom.volumeslider.max = maxvolume;
	dom.volumeslider.value = cfg.volume;
	if (cfg.enqueue) dom.enqueue.className = 'on';
	if (cfg.random) dom.random.className = 'on';
	if (cfg.crossfade) dom.crossfade.className = 'on';
	if (cfg.locked) {
		document.body.className = 'locked';
		dom.lock.className = 'on';
		dom.lock.textContent = 'Unlock';
	}
	if (url.length > 1) dom.hide(['playlistsdiv', 'save', 'share']);
	if (!onlinepls) dom.hide(['playlistsdiv', 'save', 'shareplaylist']);
	if (!sharing) dom.hide('share');
	if (whatsapp) dom.options.className = 'whatsapp';
	if (cfg.after == 'randomfiltered') cfg.after = 'randomlibrary';

	if (url.length > 1 && url[1].startsWith('pl:')) {
		prepPlaylistMode();
		prepPlaylists(mode);
	}

	dom.cover.onload = function() { dom.cover.style.opacity = 1 }

	ffor(['TV', 'Andr0id', ' OMI/', 'Viera'], function(s) {
		if (navigator.userAgent.indexOf(s) > -1) tv = true;
	});

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
			onplaylist = dom.playlist.contains(e.targetTouches[0].target);
		}, { passive: true });
	}, { once: true, passive: true });

	window.onscroll = function() {
		if (onscrollwait) return;
		onscrollwait = true;
		setTimeout(function() {
			fixPlayer();
			onscrollwait = false;
		}, 400);
	}

	window.onunload = function() {
		if (ls) {
			localStorage.setItem(lsid, JSON.stringify(cfg));
			log('Session saved');
		}
	}

	audio = [new Audio(), new Audio()];
	prepAudio(audio[0]);
	prepAudio(audio[1]);

	if ('mediaSession' in navigator) {
		navigator.mediaSession.setActionHandler('play', playPause);
		navigator.mediaSession.setActionHandler('pause', playPause);
		navigator.mediaSession.setActionHandler('previoustrack', previous);
		navigator.mediaSession.setActionHandler('nexttrack', next);
		navigator.mediaSession.metadata = new MediaMetadata();
	}
	
	if (window.innerWidth > 360)
		dom.library.className = 'unfold';
}

function touchUI() {
	dom.doc.className += ' touch';
	if (mode) resizePlaylist();
	else dom.show('clear');
}

function fixPlayer() {
	if (!cls(dom.player, 'fix') && !cls(dom.doc, 'dim')
		&& window.pageYOffset > 2 * dom.player.offsetHeight
		&& dom.doc.offsetHeight - dom.player.offsetHeight > window.innerHeight) {
		playerheight = dom.player.offsetHeight + parseInt(window.getComputedStyle(dom.player).getPropertyValue('margin-top'));
		dom.doc.style.paddingTop = playerheight +'px';
		dom.player.className += ' fix';
	} else if (window.pageYOffset < playerheight) {
		dom.doc.style.paddingTop = '';
		dom.player.className = dom.player.className.replace(' fix', '');
	}
}

function ls() {
	var def = {
		'crossfade': false,
		'enqueue': false,
		'random': false,
		'after': (url.length == 1 ? 'randomlibrary' : 'playlibrary'),
		'locked': false,
		'password': false,
		'playlist': [],
		'skip': [],
		'index': -1,
		'volume': maxvolume
	};

	if (url.length > 1) {	// Don't use saved options & playlist when not in main library
		cfg = def;
		return false;
	}

	try {
		var sav = localStorage.getItem(lsid);
		if (sav != null) {
			cfg = JSON.parse(sav) || {};
			for (var c in def)
				if (typeof cfg[c] == 'undefined') cfg[c] = def[c];
			return true;
		}
		cfg = def;
		def = JSON.stringify(def);
		localStorage.setItem(lsid, def);
		if (localStorage.getItem(lsid) == def) return true;
		log('LocalStorage WTF');
		return false;
	} catch(e) {
		log(e);
		cfg = def;
		return false;
	}
}

function log(s) {
	if (debug) console.log(s);
}

function prepPlaylistMode() {
	cfg.after = 'stopplayback';
	dom.hide(['enqueue', 'save', 'share', 'playlibrary', 'randomlibrary', 'randomfiltered', 'clear', 'library']);
	dom.playlist.style.minHeight = dom.playlist.style.maxHeight = 'unset';
	mode = 'playlist';
}

function prepAudio(a) {
	a.oncanplaythrough = function() {
		a.canplaythrough = true;
	};

	a.onplay = function() {
		dom.playpause.className = 'playing';
		dom.folder.className = dom.song.className = '';
		if (cfg.index != -1) {
			dom.playlist.childNodes[cfg.index].className = 'playing';
			if (!onplaylist)
				dom.playlist.scrollTop = dom.playlist.childNodes[cfg.index > 0 ? cfg.index - 1 : cfg.index].offsetTop - dom.playlist.offsetTop;
		}
	};

	a.onpause = function(e) {
		if (a == audio[track]) {
			dom.playpause.className = '';
			dom.folder.className = dom.song.className = 'dim';
		}
	};

	a.onended = function() {
		if (audio[track].ended)	// For crossfade/"gapless"
			playNext();
	};

	a.ontimeupdate = function() {
		if (a != audio[track]) return;

		if (a.currentTime >= a.duration - buffersec) return playNext();

		if ((a.duration - a.currentTime) < 20) {
			if (!audio[+!track].prepped) prepNext();
			if (cfg.crossfade && !a.fade && a.duration - a.currentTime < 10) {
				log('Fade out: '+ dom.song.textContent);
				a.fade = setInterval(function() {
					if (a.volume > 0.04)
						a.volume -= 0.04;
					else if (a.volume > 0)
						a.volume = 0;
				}, 200);
				playNext();
			}
		}

		if (!onseek && document.activeElement != dom.seek) {
			dom.time.textContent = timeTxt(~~a.currentTime) +' / '+ timeTxt(~~a.duration);
			dom.seek.value = a.duration ? a.currentTime / a.duration : 0;
		}
	};

	a.onerror = function() {
		console.log(a.error);
		dom.playlist.childNodes[cfg.index].setAttribute('error', 1);
		errorcount++;
		if (errorcount < maxerrors)
			playNext();
		else
			errorcount = 0;
	};

	a.preload = 'auto';
	a.load();
}

function buildLibrary(root, folder, element) {
	var li, i, f, cover = false;
	for (i in folder) {
		if (i != '/') {	// Subfolder
			li = document.createElement('li');
			li.className = 'folder';
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
				li.className = 'song';
				li.path = root + f;
				if (cover) li.cover = cover;
				li.textContent = getSong(f);
				li.tabIndex = 1;
				songs.push(li);
				element.appendChild(li);
			}
		}
	}
}

function prepSongMode() {
	prepPlaylistMode();
	add(0);
	dom.hide(['previous', 'next', 'options']);
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
	var li = e.target, dim = cls(li, 'dim') ? ' dim' : '';
	if (cls(li, 'filtered') || cls(li, 'parent')) {
		ffor(li.querySelectorAll('ul > *'), function(c) {
			if (c.style.display != '') c.style.display = '';
		});
		li.className = 'folder open'+ dim;
	} else {
		li.className = (cls(li, 'open') ? 'folder' : 'folder open') + dim;
	}
	setFocus(li);
	if (audio[track].paused) fillShare(li.path +'/');
}

function addFolder(e) {
	e.preventDefault();
	e.stopPropagation();
	var li = e.target;
	if (confirm(addfolderdlg +'\n'+ li.path.substring(li.path.lastIndexOf('/') + 1))) {
		if (!cls(li, 'dim')) li.className += ' dim';
		ffor(li.querySelectorAll('li.song'), function(s) {
			add(s.id);
			if (!cls(li, 'dim')) s.className += ' dim';
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
	if (toast) clearTimeout(toast);
	if (cls(el, 'error') || cls(dom.player, 'fix')) {
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
		playNext();
	}
	if (!cls(li, 'dim')) li.className += ' dim';
	if (audio[track].paused) fillShare(li.path);
}

function addSongNext(e) {
	e.preventDefault();
	e.stopPropagation();
	var li = e.target;
	add(li.id, true);
	if (!cls(li, 'dim')) li.className += ' dim';
	if (audio[track].paused) fillShare(li.path);
}

function buildPlaylist() {
	if (cfg.playlist.length == 0 || (url.length > 1 && !mode)) return;	// Only use saved playlist in library mode
	cfg.index = Math.min(cfg.index, cfg.playlist.length - 1);
	dom.playlist.innerHTML = '';

	var i, li;
	for (i in cfg.playlist) {
		li = playlistItem(cfg.playlist[i]);
		li.className = i == cfg.index ? 'playing' : 'song';
		dom.playlist.appendChild(li);
		if (i == cfg.index) {
			var path = cfg.playlist[i].path;
			dom.folder.textContent = getFolder(path);
			dom.song.textContent = getSong(path);
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
	li.className = 'song';
	li.draggable = 'true';
	if (s.id == 'last') {
		li.id = 'last';
	} else {
		li.innerHTML = getSong(s.path) +'<span class="artist">'+ getArtist(s.path, true) +'</span>';
		li.title = getFolder(s.path) + (mode ? '' : '\n\n'+ playlistdesc);
	}
	return li;
}

function playItem(e) {
	if (!cfg.locked && e.target.tagName.toLowerCase() == 'li')
		play(getIndex(e.target));
}

function findItem(e) {
	e.preventDefault();
	var s = e.target.tagName.toLowerCase() == 'li' ? e.target : (e.target.parentNode.tagName.toLowerCase() == 'li' ? e.target.parentNode : null);
	if (s) setFilter(s.firstChild.textContent);
}

function prepDrag(e) {
	if (cfg.locked) return e.preventDefault();
	e.stopPropagation();
	dom.clear.className = 'drag';
	dom.clear.textContent = '';
	dom.playlist.appendChild(playlistItem({ 'id': 'last' }));
	if (cfg.index != -1)
		dom.playlist.childNodes[cfg.index].className = 'song';

	drag = e.target;
	e.dataTransfer.effectAllowed = 'move';
	e.dataTransfer.setData('text/plain', getIndex(drag));
}

function allowDrop(e) {
	e.preventDefault();
	e.stopPropagation();
}

function endDrag() {
	if (dom.clear.className != '') {
		dom.clear.className = '';
		dom.clear.textContent = 'Clear';
	}
	if (dom.playlist.hasChildNodes() && dom.playlist.lastChild.id == 'last') {
		dom.playlist.removeChild(dom.playlist.lastChild);
	}
}

function dropItem(e) {
	e.preventDefault();
	e.stopPropagation();
	var to = e.target;
	if (to.tagName.toLowerCase() != 'li') to = to.parentNode;
	log('Drag ['+ drag.textContent +'] to place of ['+ to.textContent +']');
	to.className = to.className.replace(' over', '');
	var indexfrom = e.dataTransfer.getData('text');
	var indexto = getIndex(to);
	if (indexto != indexfrom) moveItem(drag, to, indexfrom, indexto);
	if (cfg.index != -1) dom.playlist.childNodes[cfg.index].className = 'playing';
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
	resizePlaylist();
	if (cfg.index != -1 && index <= cfg.index)
		cfg.index--;
	if (cfg.index != -1 && !playing)
		dom.playlist.childNodes[cfg.index].className = 'playing';
	endDrag();
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
		dom.folderuri.value = dom.songuri.value = base +'?play='+ esc(root + path);
	} else {
		dom.folderuri.value = root + path.substring(0, path.lastIndexOf('/'));
		dom.songuri.value = root + path;
	}
}

function esc(s) {
	return s.replace(/\/+$/, '').replace(/[(\?=&# ]/g, function(char) { return escape(char) });
}

function escBase64(s) {
	return s.replace(/=+$/, '').replace(/[\/+=]/g, function(char) { return escape(char) });
}

function getFolder(path) {
	if (path.indexOf('/') == -1 && url.length > 1)
		path = root;
	return path.substring(path.lastIndexOf('/', path.lastIndexOf('/') - 1) + 1, path.lastIndexOf('/'));
}

function getArtist(path, parenthesize = false) {
	var artist = getFolder(path);
	artist = artist.substring(0, artist.indexOf(' -'));
	if (parenthesize && artist.length > 0) artist = ' ('+ artist + ')';
	return (artist.length > 0 ? artist : '');
}

function getSong(path) {
	return path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
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
	if (!audio[track].src) return play(cfg.index);
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
		var artist = dom.folder.textContent;
		artist = artist.indexOf(' -') > 0 ? artist.substring(0, artist.indexOf(' -')) : false;
		if (artist && confirm(artist +'\n'+ skipartistdlg)) {
			cfg.skip.push(artist);
			next();
		}
	}
}

function next() {
	if (!cfg.locked) playNext();
}

function prepNext() {
	log('prepNext()');
	if (cfg.playlist.length > cfg.index + 1) {
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
		if (played.length == songs.length) clearPlayed();
		if (cfg.locked || cfg.after == 'randomlibrary' || cfg.after == 'randomfiltered') {
			var set = cfg.after == 'randomlibrary' || cfg.locked || filteredsongs.length == 0 ? songs : filteredsongs;
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
	log('All songs have been played. Clearing played.');
	played.length = 0;
}

function artistSkipped(path) {
	if (debug && cfg.skip.indexOf(getArtist(decodeURI(path))) != -1)
		log('Artist '+ getArtist(decodeURI(path)) +' skipped');
	return cfg.skip.indexOf(getArtist(decodeURI(path))) != -1;
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
			log('No connection. Retrying... '+ dom.playlist.childNodes[cfg.index].textContent);
			a.load();
		} else clearInterval(retry);
	}, 2500);
}

function play(id) {
	load(id);
	stop();
	playNext();
}

function mute(e = null) {
	if (e) e.preventDefault();
	audio[+!track].muted = audio[track].muted ^= true;
	dom.volume.className = audio[track].muted ? 'muted' : '';
}

function setVolume(input) {
	if (input.target) input = input.target.value;
	else dom.volumeslider.value = input;
	cfg.volume = audio[track].volume = +parseFloat(input).toPrecision(2);
	if (audio[track].muted) mute();
}

function download(type) {
	var uri = dom[type +'uri'].value;
	if (uri) {
		dom.a.href = 'music.php?dl='+ esc(uri);
		dom.a.click();
	}
}

function share(type) {
	var share = dom[type +'uri'];
	if (share.value) {
		var clearVal = share.value;
		if (type == 'playlist')
			share.value = base +'?play=pl:'+ esc(share.value);
		else
			share.value = base +'?play=c:'+ escBase64(btoa(share.value));
		share.select();
		document.execCommand('copy');
		share.nextElementSibling.nextElementSibling.className = 'copied';
		share.blur();
		share.value = clearVal;
		setTimeout(function() {
			share.nextElementSibling.nextElementSibling.className = 'link';
		}, 1500);
	}
}

function shareWhatsApp(type) {
	var share = dom[type +'uri'];
	if (share.value) {
		var msg = prompt(whatsappdlg, whatsappmsg);
		if (msg != null) window.open('https://api.whatsapp.com/send?text='+ msg +' '
			+ base +'?play=c:'+ escBase64(btoa(share.value)));
	}
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
		} else playlistElements = '&nbsp;'+ noplaylists +'&nbsp;';
		switch (action) {
			case 'load':
				dom.playlists.innerHTML = playlistElements;
				dom.playlists.style.display = 'block';
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
	xhttp.open('GET', 'music.php?pl=1', true);
	xhttp.send();
}

function loadPlaylist(name) {
	var items = JSON.parse(playlists[name]);
	if (items.constructor !== Array) {
		if (confirm(restoreposition))
			cfg.index = items.index + cfg.playlist.length;
		items = items.playlist;
	}
	for (var i in items)
		cfg.playlist.push(items[i]);
	buildPlaylist();
	playlistloaded = name;
}

function loadPlaylistBtn(e) {
	if (e.target.className == 'on') return;
	e.target.className = 'on';
	loadPlaylist(e.target.textContent);
}

function savePlaylist() {
	if (!cfg.playlist.length) return;
	var name = prompt(exportdlg, playlistloaded);
	if (name) {
		var position = cfg.index && confirm(saveposition) ? cfg.index : 0;
		var playlist = position ? { playlist: cfg.playlist, index: position } : cfg.playlist;
		name = name.replace(/[\\\/:*?"<>|]/g, ' ');
		for (var pl in playlists)
			if (pl == name && !confirm(overwritedlg)) return;
		var xhttp = new XMLHttpRequest();
		xhttp.onload = function() {
			if (this.responseText != '')
				alert(errorsave +'\n\n'+ this.responseText);
		}
		xhttp.open('POST', 'music.php', true);
		xhttp.setRequestHeader('Content-type', 'application/json');
		xhttp.send(JSON.stringify({ 'name': name, 'songs': JSON.stringify(playlist) }));
	}
}

function importPlaylist() {
	var input = document.createElement('input');
	input.setAttribute('type', 'file');
	input.setAttribute('accept', '.mfp.json');
	input.onchange = function(e) {
		var reader = new FileReader();
		reader.onload = function(e) {
			var items = JSON.parse(e.target.result);
			for (var i in items)
				cfg.playlist.push(items[i]);
			buildPlaylist();
		};
		reader.readAsText(input.files[0], 'UTF-8');
	}
	input.click();
}

function exportPlaylist() {
	if (!cfg.playlist.length) return;
	var filename = prompt(exportdlg);
	if (filename) {
		dom.a.href = 'data:text/json;charset=utf-8,'+ esc(JSON.stringify(cfg.playlist));
		dom.a.download = filename +'.mfp.json';
		dom.a.click();
	}
}

function add(id, next = false) {
	var s = {
		'path': songs[id].path,
		'cover': songs[id].cover
	};

	var i = nodupes || cfg.index == -1 ? 0 : cfg.index;
	if (cfg.playlist.length > 0) {
		if (next && s.path == cfg.playlist[i].path) {	// Currently playing
			if (cfg.index > -1) cfg.index--;
			return;
		}
		if (cfg.index > -1) i++;
		for (; i < cfg.playlist.length && (next ? cfg.playlist[i].playNext : true); i++) {
			if (s.path == cfg.playlist[i].path) {
				setToast({ 'className': 'error', 'textContent': alreadyadded });
				return;
			}
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
	if (cfg.index != -1) dom.playlist.childNodes[cfg.index].className = 'song';
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
		cover = cfg.playlist[cfg.index].cover,
		prevcover = dom.cover.src || defcover;
	cover = cover ? esc(root + path.substring(0, path.lastIndexOf('/') + 1) + cover) : defcover;
	if (prevcover.indexOf(cover) == -1) {
		dom.cover.style.opacity = 0;
		if (dom.player.className == 'full') dom.current.style.opacity = 0;
		setTimeout(function() {
			dom.folder.textContent = getFolder(path);
			dom.song.textContent = getSong(path);
			dom.cover.src = cover;
			setTimeout(function() {
				if (dom.player.className == 'full') dom.current.style.opacity = '';
			}, 150);
		}, 150);
	} else {
		dom.folder.textContent = getFolder(path);
		dom.song.textContent = getSong(path);
	}

	title.textContent = getSong(path) + getArtist(path, true);
	fillShare(path);
	if ('mediaSession' in navigator) {
		navigator.mediaSession.metadata.title =  getSong(path);
		navigator.mediaSession.metadata.artist = getArtist(path);
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
	if (typeof promise != 'undefined')
		promise.catch(function(e) {
			error = e;
			console.log(e);
			if (e.code == 9)
				setToast({ 'className': 'error', 'textContent': errorfile });
			else if (autoplay && e.name == 'NotAllowedError')
				setToast({ 'className': 'error', 'textContent': errorautoplay });
		});
	delete cfg.playlist[a.index].playNext;
	dom.seek.disabled = 0;
}

function toggle(e) {
	var button = e.target.tagName.toLowerCase() == 'u' ? e.target.parentNode : e.target;
	switch (button.id) {
		case 'cover':
			e.preventDefault();
			dom.cover.className = dom.cover.className == '' ? 'nofade' : '';
			return;
		case 'volume':
			dom.volumeslider.style.display = dom.volumeslider.style.display == 'unset' ? '' : 'unset';
			return;
		case 'playlistbtn':
			if (cfg.locked) return;
			dom.hide(['playlists', 'afteroptions']);	// Continue
		case 'share':
			if (button.className == 'on') {
				dom.options.className = dom.options.className.replace(' '+ button.id, '');
				button.className = '';
			} else {
				dom.options.className += ' '+ button.id;
				button.className = 'on';
			}
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
				dom.randomfiltered.firstElementChild.textContent = '['+ dom.filter.value +']';
				buildFilteredLibrary();
			} else dom.randomfiltered.firstElementChild.textContent = '';
			return;
		case 'lock':
			return toggleLock();
		case 'unfold':
			return dom.library.className = cls(dom.library, 'unfold') ? '' : 'unfold';
		case 'crossfade':
			fade = null;	// Continue
		default:
			if (cfg.locked) return;
			cfg[button.id] ^= true;
			button.className = cfg[button.id] ? 'on' : '';
		}
}

function buildFilteredLibrary() {
	filteredsongs = [];
	var term = dom.filter.value.toLowerCase();
	for (var s in songs)
		if (songs[s].path.toLowerCase().indexOf(term) != -1)
			filteredsongs.push(songs[s]);
}

function toggleLock() {
	if (!password()) return;
	if (!cfg.locked && cls(dom.options, 'playlistbtn'))
		dom.playlistbtn.click();
	cfg.locked ^= true;
	document.body.className = cfg.locked ? 'locked' : '';
	dom.lock.className = cfg.locked ? 'on' : '';
	dom.lock.textContent = cfg.locked ? 'Unlock' : 'Lock';
}

function password() {
	if (cfg.locked && !cfg.password) return true;

	var prev = prevpassdlg;
	var p = prompt(passdlg, (!cfg.locked && cfg.password ? prev : ''));
	if (p == null) return false;
	if (p == prev) return true;

	var pass = 0;
	for (var i = 0; i < p.length; i++)
		pass = pass * 7 + p.charCodeAt(i);

	if (cfg.locked && cfg.password != pass) {
		alert(wrongpassdlg);
		return false;
	}
	if (!cfg.locked) cfg.password = pass;
	return true;
}

function menu(e) {
	if (e.type == 'mouseleave' && cls(dom.doc, 'touch')) return;

	var btn, el;
	if (e == 'load' || dom.playlistsdiv.contains(e.target)) {
		el = dom.playlists;
		btn = dom.load;
	} else if (e == 'after' || dom.afterdiv.contains(e.target)) {
		el = dom.afteroptions;
		btn = dom.after;
	}

	if (el.style.display != 'block' && e.type !== 'mouseleave') {
		const { bottom, left } = btn.getBoundingClientRect();
		el.top = bottom;
		el.left = left;
		switch (el) {
			case dom.playlists:
				if (!cls(dom.options, 'playlistbtn'))
					dom.playlistbtn.click();
				prepPlaylists('load');
				break;
			case dom.afteroptions:
				if (!cls(dom.options, 'playlistbtn'))
					dom.playlistbtn.click();
				dom.stopplayback.className = cfg.after == 'stopplayback' ? 'on' : '';
				dom.repeatplaylist.className = cfg.after == 'repeatplaylist' ? 'on' : '';
				dom.playlibrary.className = cfg.after == 'playlibrary' ? 'on' : '';
				dom.randomfiltered.className = cfg.after == 'randomfiltered' ? 'on' : '';
				dom.randomlibrary.className = cfg.after == 'randomlibrary' ? 'on' : '';
				if (dom.filter.value == '') dom.randomfiltered.className += ' dim';
				el.style.display = 'block';
				setFocus(dom[cfg.after]);
		}
	} else switch (el) {
			case dom.playlists:
			case dom.afteroptions:
				dom.playlistbtn.click();
				break;
			default:
				el.style.display = 'none';
	}
}

function clearPlaylist() {
	if (cfg.playlist.length > 0 && confirm(clearplaylistdlg)) {
		cfg.playlist = [];
		cfg.index = -1;
		dom.playlist.innerHTML = '';
		resizePlaylist();
	}
}

function resizePlaylist() {
	if (!mode && cfg.playlist.length > 7) {
		if (dom.playlist.className != 'resize') {
			dom.playlist.style.height = dom.playlist.offsetHeight +'px';
			dom.playlist.className = 'resize';
		}
	} else dom.playlist.className = dom.playlist.style.height = '';

	var scrollBars = dom.playlist.offsetWidth - dom.playlist.clientWidth;
	dom.clear.style.right = scrollBars == 0 ? '' : scrollBars + 2 +'px';
}

function filter() {
	var clear = dom.filter.value == '' ? '' : 'none';
	if (!tree) tree = dom.tree.querySelectorAll('li');
	ffor(tree, function(f) {
		f.style.display = clear;
		if (cls(f, 'open'))
			f.className = 'folder'+ (cls(f, 'dim') ? ' dim' : '');
	});

	if (clear != '') {
		var term = dom.filter.value.toLowerCase();
		ffor(tree, function(f) {
			var path = f.path.substring(f.path.lastIndexOf('/') + 1);
			if (path.toLowerCase().indexOf(term) != -1) {
				f.style.display = '';

				if (cls(f, 'folder')) {
					if (path == dom.filter.value) {
						ffor(f.querySelectorAll('ul > *'), function(c) {
							c.style.display = '';
						});
						f.className = 'folder open filtered'+ (cls(f, 'dim') ? ' dim' : '');
					} else f.className = 'folder filtered'+ (cls(f, 'dim') ? ' dim' : '');
				}

				for (var p = f.parentNode; p && p !== dom.tree; p = p.parentNode) {
					if (cls(p, 'parent'))
						break;
					if (p.style.display != '')
						p.style.display = '';
					if (cls(p, 'folder'))
						p.className = 'parent folder open'
							+ (cls(p, 'filtered') ? ' filtered' : '')
							+ (cls(p, 'dim') ? ' dim' : '');
				}
			}
		});
	}

	dom.library.className = 'unfold';
	keyNav(null, 'down');
}

function cls(el, name) {
	return el.className.indexOf(name) != -1;
}

function ffor(items, callback, scope) {
	var length = items.length;
	for (var i = 0; i < length; i++) {
		callback.call(scope, items[i]);
	}
}

function setFilter(f) {
	if (mode) return;
	if (f.constructor === String)
		dom.filter.value = f;
	else
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
					while (parent.nextElementSibling == null)
						parent = parent.parentNode.parentNode;
					to = parent.nextElementSibling;
				}
				break;
			case 'left':
				if (cls(el, 'open') && !cls(el, 'parent'))
					return el.click();
				else
					to = el.parentNode.parentNode;
				break;
			case 'right':
				if (cls(el, 'open'))
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

	if (to.style.display == 'none')
		return keyNav(to, direction);

	setFocus(to);
}

document.addEventListener('keydown', function(e) {
	if (e.altKey || e.ctrlKey) return;
	var el = document.activeElement;

	if (el.tagName.toLowerCase() == 'input') {
		if (el == dom.volumeslider) {
			if (e.keyCode > 36 && e.keyCode < 41) return;	// Arrow keys
		} else {
			if (e.keyCode == 27) {	// Esc
				if (el == dom.filter)
					clearFilter();
				else {
					e.preventDefault();
					el.value = '';
					el.blur();
					el.focus();
				}
			}
			return;
		}
	}

	switch (e.keyCode) {
		case 27:	// Esc
			if (el && cls(el.parentNode, 'menu') && cls(dom.options, 'playlistbtn'))
				dom.playlistbtn.click();
			else
				clearFilter();
			break;
		case tv ? 51 : '':	// 3
		case 90:	// Z
			zoom();
			break;
		case 61:	// = Firefox
		case 187:	// =
			e.preventDefault();
			if (e.shiftKey)
				setVolume(Math.min(cfg.volume + .05, maxvolume));
			else
				audio[track].currentTime += 5;
			break;
		case 173:	// - Firefox
		case 189:	// -
			e.preventDefault();
			if (e.shiftKey)
				setVolume(Math.max(cfg.volume - .05, 0));
			else
				audio[track].currentTime -= 5;
			break;
		case 85:	// U
			if (el == dom.volumeslider)
				dom.hide('volumeslider');
			else {
				dom.show('volumeslider');
				setFocus(dom.volumeslider);
			}
			break;
		case 77:	// M
			e.preventDefault();
			mute(e);
			break;
		case 8:	// Backspace
		case 'MediaStop':
			e.preventDefault();
			stop();
			break;
		case tv ? 48 : '':	// 0
		case 32:	// Space
		case 179:	// MediaPlayPause
			e.preventDefault();
			if (!dom.tree.contains(e.target))
				e.target.blur();
			playPause();
			break;
		case tv ? 34 : '':	// PgDn
		case 219:	// [
		case 177:	// MediaTrackPrevious
			e.preventDefault();	// Necessary?
			previous();
			break;
		case tv ? 33 : '':	// PgUp
		case 221:	// ]
		case 176:	// MediaTrackNext
			e.preventDefault();	// Necessary?
			next();
			break;
		case 75:	// K
			skipArtist(e);
			break;
		case tv ? 49 : '':	// 1
		case 69:	// E
			dom.enqueue.click();
			setToast(dom.enqueue);
			break;
		case 82:	// R
			dom.random.click();
			setToast(dom.random);
			break;
		case 79:	// O
			dom.crossfade.click();
			setToast(dom.crossfade);
			break;
		case 80:	// P
			dom.playlistbtn.click();
			break;
		case tv ? 55 : '':	// 7
		case 68:	// D
			if (cfg.locked || !onlinepls || url.length > 1) return;
			menu('load');
			break;
		case 86:	// V
			if (cfg.locked || !onlinepls || url.length > 1) return;
			prepPlaylists('save');
			break;
		case 73:	// I
			if (!cfg.locked && mode != 'song') importPlaylist();
			break;
		case 88:	// X
			if (!cfg.locked && mode != 'song') exportPlaylist();
			break;
		case 65:	// A
			if (cfg.locked) return;
			menu('after');
			break;
		case 83:	// S
			if (!sharing) return;
			if (url.length > 1) return;
			dom.share.click();
			setFocus(dom.share);
			break;
		case 76:	// L
			dom.lock.click();
			break;
		case 67:	// C
			if (!cfg.locked && !mode) clearPlaylist();
			break;
		case 70:	// F
			e.preventDefault();
			dom.filter.focus();
			if (dom.filter.value != '') dom.filter.select();
			break;
		case 84:	// T
			e.preventDefault();
			if (!cfg.locked && !mode) dom.unfold.click();
			break;
		case 36:	// Home
			e.preventDefault();
			keyNav(null, 'down');
			break;
		case 35:	// End
			e.preventDefault();
			keyNav(null, 'up');
			break;
		case tv ? 50 : '':	// 2
		case 38:	// ArrowUp
			e.preventDefault();
			if (e.shiftKey)
				keyNav(el, 'first');
			else
				keyNav(el, 'up');
			break;
		case tv ? 56 : '':	// 8
		case 40:	// ArrowDown
			e.preventDefault();
			if (e.shiftKey)
				keyNav(el, 'last');
			else
				keyNav(el, 'down');
			break;
		case tv ? 52 : '':	// 4
		case 37:	// ArrowLeft
			e.preventDefault();
			keyNav(el, 'left');
			break;
		case tv ? 54 : '':	// 6
		case 39:	// ArrowRight
			e.preventDefault();
			keyNav(el, 'right');
			break;
		case tv ? 53 : '':	// 5
		case 13:	// Enter
			if (e.shiftKey && dom.tree.contains(el))
				el.dispatchEvent(new CustomEvent('contextmenu', { bubbles: true }));
			else
				el.click();
			break;
		case tv ? 57 : '':	// 9
		case 66:	// B
			var dim = cls(dom.doc, 'dim') ? '' : ' dim';
			dom.doc.className = cls(dom.doc, 'touch') ? 'touch' : '' + dim;
			break;
		default:
			switch (e.code) {
				case 'MediaStop':
					stop();
					break;
				case 'MediaPlayPause':
					e.preventDefault();
					playPause();
					break;
				case 'MediaTrackPrevious':
					previous();
					break;
				case 'MediaTrackNext':
					next();
					break;
			}
			return false;
	}
}, false);

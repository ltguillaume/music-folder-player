var
	autoplay = false,	// Try to start playback on load
	debug = false,	// Show some debug messages in console
	defcover = 'music.png',	// Default cover image if none found
	deftitle = 'Music',	// Default page title
	lsid = 'asymm_music',	// Local storage ID for this instance
	nodupes = false,		// Don't add already played songs to playlist
	onlinepls = true,	// Show buttons to load/save playlists online
	whatsapp = true,	// Add button to share directly to WhatsApp
	whatsappmsg = 'Have a listen to',	// Default WhatsApp message
	maxvolume = .9,	// Default volume (.9 might prevent clipping during playback)

	errorcf = 'Your browser is set to disable autoplay: re-enable crossfade manually',
	playlistdesc = 'L: Play now\nR: Find in library',
	addfolderdlg = 'Add this folder to playlist?',
	whatsappdlg = 'Your message via WhatApp (the url will be added at the end):',
	exportdlg = 'Save playlist as:',
	overwritedlg = 'Playlist already exists. Overwrite?',
	prevpassdlg = '[Use previously set password]',
	passdlg = 'Enter password:',
	wrongpassdlg = 'Intruder alert!',
	noplaylists = 'No playlists available',
	errorsave = 'Error on saving:',
	clearplaylistdlg = 'Clear the playlist?',

	audio,
	base,
	cfg,
	dom,
	library,
	ls,
	songs = Array(),
	url,

	drag,
	fade,
	filteredsongs = Array(),
	mode,
	onplaylist,
	onseek,
	played = Array(),
	playlists,
	retry,
	toast,
	track = 0,
	tree;

function init() {
	url = document.URL.replace('?play=', '?').split('?', 2);
	base = window.location.protocol +'//'+ window.location.host + window.location.pathname;
	ls = ls();

	var get = function(id) { return document.getElementById(id) };
	dom = {
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
		'tree': get('tree'),
		'hide': function(el) { dom.show(el, false) },
		'show': function(el, show = true) {
			if (el.constructor === Array)
				for (var i = 0; i < el.length; i++)
					dom[el[i]].style.display = show ? 'initial' : 'none';
			else
				dom[el].style.display = show ? 'initial' : 'none';
		}
	};

	get('splash').className = 'show';
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
	if (whatsapp) dom.options.className = 'whatsapp';
	if (cfg.after == 'randomfiltered') cfg.after = 'randomlibrary';

	dom.cover.onload = function() { dom.cover.style.opacity = 1 }	// Flickering appearance of old cover src is Firefox bug

	window.addEventListener('touchstart', function() {
		window.addEventListener('touchend', function(e) {
			e.preventDefault();
		}, { once: true });
		window.addEventListener('touchmove', function(e) {
			onplaylist = dom.playlist.contains(e.targetTouches[0].target);
		}, { passive: true });
		if (mode) resizePlaylist();
		else dom.show('clear');
		document.documentElement.className = 'touch';
	}, { once: true, passive: true });

	window.onunload = function() {
		if (ls) {
			localStorage.setItem(lsid, JSON.stringify(cfg));
			log('Session saved');
		}
	}

	if (url.length > 1 && url[1].startsWith('pl:')) {
		prepPlaylistMode();
		prepPlaylists(mode);
	}

	audio = [get('audio'), null];
	prepAudio(audio[0]);

	var lib = document.createElement('script');
	log('PHP request = '+ lib.src);
	lib.src = 'music.php'+ (url.length > 1 ? '?play='+ url[1] : '');
	lib.onload = function() {
		buildLibrary('', library, dom.tree);
		buildPlaylist();
		document.documentElement.className = '';
		get('splash').className = '';
		console.log('https://github.com/ltGuillaume/MusicFolderPlayer'+ (mode ? '' : '\nSong count: '+ songs.length));
		if (songs.length == 1) prepSongMode();
		if (autoplay) playPause();
	};
	document.body.appendChild(lib);

	if ('mediaSession' in navigator) {
		navigator.mediaSession.setActionHandler('previoustrack', previous);
		navigator.mediaSession.setActionHandler('nexttrack', nextBtn);
		navigator.mediaSession.metadata = new MediaMetadata();
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
			cfg = JSON.parse(sav);
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
	a.onplay = function() {
		dom.playpause.className = 'playing';
		dom.folder.className = dom.song.className = '';
		if (cfg.index != -1) {
			dom.playlist.childNodes[cfg.index].className = 'playing';
			if (!onplaylist)
				dom.playlist.scrollTop = dom.playlist.childNodes[cfg.index].offsetTop - dom.playlist.offsetTop;
		}
	};

	a.onpause = function(e) {
		if (this == audio[track]) {
			dom.playpause.className = '';
			dom.folder.className = dom.song.className = 'dim';
		}
	};

	a.onended = function() {
		if (audio[track].ended)	// For crossfade
			next();
	};

	a.ontimeupdate = function() {
		if (this == audio[track]) {
			if (!onseek && document.activeElement != dom.seek) {
				dom.time.textContent = timeTxt(~~this.currentTime) +' / '+ timeTxt(~~this.duration);
				dom.seek.value = (this.duration ? this.currentTime / this.duration : 0);
			}
			if (cfg.crossfade && !fade && (this.duration - this.currentTime) < 10) {
				var fading = track;
				log('Fading out '+ audio[fading].src);
				fade = setInterval(function() {
					if (audio[fading].ended) {
						clearInterval(fade);
						fade = null;
					} else if (audio[fading].volume > 0.04)
						audio[fading].volume -= 0.04;
					else if (audio[fading].volume > 0)
						audio[fading].volume = 0;
				}, 200);
				track ^= 1;
				next();
			}
		}
	};

	a.onerror = function() {
		console.log(this.error);
		dom.playlist.childNodes[cfg.index].setAttribute('error', 1);
		next();
	};

	a.preload = 'auto';
}

function prepCrossfade() {
	var a = new Audio();
	a.load();
	prepAudio(a);
	a.muted = audio[0].muted;
	audio[1] = a;
	dom.crossfade.className = 'on';
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
	if (e.target.className.indexOf('folder') != -1)
		(context ? addFolder(e) : openFolder(e));
	else
		(context ? addSongNext(e) : addSong(e));
}

function openFolder(e) {
	e.stopPropagation();
	var li = e.target, dim = (li.className.indexOf('dim') != -1 ? ' dim' : '');
	if (li.className.indexOf('filtered') != -1 || li.className.indexOf('parent') != -1) {
		ffor(li.querySelectorAll('ul > *'), function(c) {
			if (c.style.display != '') c.style.display = '';
		});
		li.className = 'folder open'+ dim;
	} else {
		li.className = (li.className.indexOf('open') != -1 ? 'folder' : 'folder open') + dim;
	}
	setFocus(li, (li.className.indexOf('open') != -1 ? 'open' : 'close'));
	if (audio[track].paused) fillShare(li.path +'/');
}

function addFolder(e) {
	e.preventDefault();
	e.stopPropagation();
	var li = e.target;
	if (confirm(addfolderdlg +'\n'+ li.path.substring(li.path.lastIndexOf('/') + 1))) {
		li.className += ' dim';
		ffor(li.querySelectorAll('li.song'), function(s) {
			add(s.id);
			s.className += ' dim';
		});
	}
}

function setFocus (el, direction = 'open') {
	el.focus();
	const { top, bottom } = el.getBoundingClientRect();
	if (top < 0 || bottom > window.innerHeight)
		el.scrollIntoView({
			block: (direction == 'left' || direction == 'open' ? 'start' : 'nearest'),
			behavior: 'smooth'
		});
}

function setToast(el) {
	if (toast) clearTimeout(toast);
	ffor([dom.enqueue, dom.random, dom.crossfade], function(b) {
		clearToast(b);
	});
	const { top, bottom } = el.getBoundingClientRect();
	if (top < 0 || bottom > window.innerHeight) {
		el.className += ' toast';
		el.style.top = window.innerHeight + window.scrollY +'px';
		toast = setTimeout(function() { clearToast(el) }, 2000);
	}
}

function clearToast(el) {
	el.className = el.className.replace(' toast', '');
}

function addSong(e) {
	e.stopPropagation();
	var li = e.target;
	if (cfg.enqueue || cfg.locked)
		add(li.id);
	else
		load(li.id);
	li.className += ' dim';
	if (audio[track].paused) fillShare(li.path);
}

function addSongNext(e) {
	e.preventDefault();
	e.stopPropagation();
	var li = e.target;
	add(li.id, true);
	li.className += ' dim';
	if (audio[track].paused) fillShare(li.path);
}

function buildPlaylist() {
	if (cfg.playlist.length == 0 || (url.length > 1 && !mode)) return;	// Only rebuild saved playlist in library mode
	cfg.index = Math.min(cfg.index, cfg.playlist.length - 1);
	dom.playlist.innerHTML = '';

	var i, li;
	for (i in cfg.playlist) {
		li = playlistItem(cfg.playlist[i]);
		li.className = (i == cfg.index ? 'playing' : 'song');
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
	var s = (e.target.tagName.toLowerCase() != 'li' ? e.target.parentNode : e.target);
	setFilter(s.firstChild.textContent);
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
	log('Drag '+ drag.innerHTML +' to place of '+ to.innerHTML);
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
			cfg.index = (indexfrom < indexto ? indexto - 1 : indexto);
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
	cfg.playlist.splice(index, 1);
	dom.playlist.removeChild(dom.playlist.childNodes[index]);
	resizePlaylist();
	if (cfg.index != -1 && index <= cfg.index)
		cfg.index--;
	if (cfg.index != -1)
		dom.playlist.childNodes[cfg.index].className = 'playing';
	endDrag();
}

function getIndex(li) {
	if (li.id == 'last')	// Temporary last item for dragging
		return cfg.playlist.length;
	for (var i = 0; i < li.parentNode.children.length; i++)
		if (li == li.parentNode.children[i])
			return i;
}

function fillShare(path) {
	if (path.endsWith('/')) {
		dom.folderuri.value = dom.songuri.value = base +'?play='+ esc(root + path);
	} else {
		dom.folderuri.value = base +'?play='+ esc(root + path.substring(0, path.lastIndexOf('/')));
		dom.songuri.value = base +'?play='+ esc(root + path);
	}
}

function fillPlaylistUri() {
	ffor(document.querySelectorAll('#playlistdata > option'), function(o) {
		if (o.value.toLowerCase() == dom.playlisturi.value.toLowerCase())
			dom.playlisturi.value = base +'?play=pl:'+ esc(o.value);
	});
}

function esc(s) {
	return s.replace(/\/+$/, '').replace(/[(\?=&# ]/g, function(char) { return escape(char) });
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
	dom.player.className = (dom.player.className == '' ? 'zoom' : 
		(dom.player.className == 'zoom' ? 'fullzoom' : ''));
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
	audio[track].oncanplaythrough = null;
	audio[track].pause();
	audio[track].currentTime = 0;
	dom.seek.disabled = 1;
}

function playPause() {
	if (!audio[track].src)
		play(cfg.index);
	else if (audio[track].paused) {
		audio[track].play();
		dom.seek.disabled = 0;
	} else {
		clearInterval(retry);
		audio[track].oncanplaythrough = null;
		audio[track].pause();
	}
}

function previous() {
	if (cfg.locked) return;
	if (cfg.index > 0)
		play(cfg.index - 1);
	else
		log('No previous item in playlist');
}

function nextBtn() {
	if (!cfg.locked) next();
}

function next() {
	if (cfg.playlist.length > cfg.index + 1) {
		if (cfg.random && !cfg.playlist[cfg.index + 1].playNext) {
			var next = cfg.index + ~~(Math.random() * (cfg.playlist.length - cfg.index));
			var drag = dom.playlist.childNodes[next],
				to = dom.playlist.childNodes[cfg.index + 1],
				indexfrom = next,
				indexto = cfg.index + 1;
			moveItem(drag, to, indexfrom, indexto);
		}
		play(cfg.index + 1);
	} else if (cfg.after != 'stopplayback' || cfg.locked) {
		if (played.length == songs.length) {
			log('All songs have been played. Clearing played.');
			played.length = 0;
		}
		if (cfg.locked || cfg.after == 'randomlibrary' || cfg.after == 'randomfiltered') {
			var set = (cfg.after == 'randomlibrary' || cfg.locked || filteredsongs.length == 0 ? songs : filteredsongs);
			var next = null;
			do {
				next = ~~((Math.random() * set.length));
				if (played.indexOf(next.toString()) != -1)
					next = null;
			} while (next == null);
			load(set[next].id);
		} else if (cfg.after == 'playlibrary')	{
			if (cfg.index == -1) return load(songs[0].id);
			var path = cfg.playlist[cfg.index].path;
			var next = -1;
			for (var i = 0; i < songs.length; i++) {
				if (songs[i].path == path) {
					next = i + 1;
					break;
				}
			}
			if (next != -1 && next < songs.length)
				load(songs[next].id);
			else {
				log('End of library. Starting at the top');
				load(songs[0].id);
			}
		} else if (cfg.after == 'repeatplaylist' && cfg.playlist.length > 0)
			return play(0);
	}
}

function load(id) {
	add(id, true);
	play(cfg.index + 1);
}

function mute(e = null) {
	if (e) e.preventDefault();
	dom.volume.className = (audio[track].muted ^= true) ? 'muted' : '';
	if (audio[+!track]) audio[+!track].muted = audio[track].muted;
}

function setVolume(input) {
	if (input.target) input = input.target.value;
	else dom.volumeslider.value = input;
	cfg.volume = audio[track].volume = +parseFloat(input).toPrecision(2);
	if (audio[track].muted) mute();
}

function download(type) {
	var uri = dom[type +'uri'].value;
	if (uri.indexOf(base) == 0) {
		dom.a.href = 'music.php?dl='+ uri.substring(uri.indexOf('?play=') + 6);
		dom.a.click();
	}
}

function share(type) {
	var share = dom[type +'uri'];
	if (share.value.indexOf(base) == 0) {
		share.select();
		document.execCommand('copy');
		share.nextElementSibling.nextElementSibling.className = 'copied';
		share.blur();
		setTimeout(function() {
			share.nextElementSibling.nextElementSibling.className = 'link';
		}, 1500);
	}
}

function shareWhatsApp(type) {
	var share = dom[type +'uri'];
	if (share.value.indexOf(base) == 0) {
		msg = prompt(whatsappdlg, whatsappmsg);
		whatsappmsg = (msg ? msg : '');
		window.open('https://api.whatsapp.com/send?text='+ whatsappmsg +' '+ encodeURIComponent(share.value));
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
				break;
			case 'save':
				savePlaylist();
				break;
			case 'share':
				dom.playlistdata.innerHTML = playlistElements;
				break;
			case 'playlist':
				loadPlaylist(decodeURIComponent(url[1].substring(3)));
		}
	};
	xhttp.open('GET', 'music.php?pl', true);
	xhttp.send();
}

function loadPlaylist(name) {
	var items = JSON.parse(playlists[name]);
	for (var i in items)
		cfg.playlist.push(items[i]);
	buildPlaylist();
}

function loadPlaylistBtn(e) {
	if (e.target.className == 'on') return;
	e.target.className = 'on';
	loadPlaylist(e.target.textContent);
}

function savePlaylist() {
	var name = prompt(exportdlg);
	if (name) {
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
		xhttp.send(JSON.stringify({ 'name': name, 'songs': JSON.stringify(cfg.playlist) }));
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

	var i = (nodupes || cfg.index == -1 ? 0 : cfg.index);
	if (cfg.playlist.length > 0) {
		if (next && s.path == cfg.playlist[i].path) {	// Currently playing
				if (cfg.index > -1) cfg.index--;
				return;
		}
		if (cfg.index > -1) i++;
		for (; i < cfg.playlist.length && (next ? cfg.playlist[i].playNext : true); i++) {
			if (s.path == cfg.playlist[i].path) {
				dom.tree.className = 'dim';
				setTimeout(function() { dom.tree.className = '' }, 500);
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
	log('Added to playlist (#'+ i +'): '+ s.path);
	if (!played.includes(id)) {
		played.push(id);
		log('Added id '+ id +' to played');
	}
}

function play(index) {
	if (!audio[1] && cfg.crossfade)
		prepCrossfade();
	if (cfg.index != -1)
		dom.playlist.childNodes[cfg.index].className = 'song';
	if (index == -1) return next();
	var path = cfg.playlist[index].path;
	var c = cfg.playlist[index].cover;

	cfg.index = index;
	var a = audio[track];
	a.src = esc(root + path);
	a.volume = cfg.volume;
	clearInterval(retry);
	retry = setInterval(function() {
		if (a.buffered.length > 0) {
			clearInterval(retry);
		} else {
			log('No connection. Retrying... '+ dom.playlist.childNodes[cfg.index].textContent);
			a.load();
		}
	}, 2500);
	a.oncanplaythrough = function() {
		this.oncanplaythrough = null;
		var promise = this.play();
		if (typeof promise != 'undefined')
			promise.catch(function(e) { console.log(e) });
	};
	a.load();
	dom.seek.disabled = 0;

	var prevcover = dom.cover.src || defcover;
	c = (c ? esc(root + path.substring(0, path.lastIndexOf('/') + 1) + c) : defcover);
	if (prevcover.indexOf(c) == -1) {
		dom.cover.style.opacity = 0;
		if (dom.player.className == 'fullzoom') dom.current.style.opacity = 0;
		setTimeout(function() {
			dom.folder.textContent = getFolder(path);
			dom.song.textContent = getSong(path);
			dom.cover.src = c;
			setTimeout(function() {
				if (dom.player.className == 'fullzoom') dom.current.style.opacity = 1;
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
		navigator.mediaSession.metadata.artwork = [{ src: c }];
	}
}

function toggle(e) {
	var button = (e.target.tagName.toLowerCase() == 'u' ? e.target.parentNode : e.target);
	switch (button.id) {
		case 'cover':
			e.preventDefault();
			dom.cover.className = dom.cover.className == '' ? 'nofade' : '';
			return;
		case 'volume':
			dom.volumeslider.style.display = dom.volumeslider.style.display == 'initial' ? '' : 'initial';
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
		case 'crossfade':
			if (!audio[1]) prepCrossfade();
			fade = null;	// Continue
		default:
			if (cfg.locked) return;
			cfg[button.id] ^= true;
			button.className = (cfg[button.id] ? 'on' : '');
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
	if (!cfg.locked && dom.options.className.indexOf('playlist') != -1)
		dom.playlistbtn.click();
	cfg.locked ^= true;
	document.body.className = (cfg.locked ? 'locked' : '');
	dom.lock.className = (cfg.locked ? 'on' : '');
	dom.lock.textContent = (cfg.locked ? 'Unlock' : 'Lock');
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
	if (e.type == 'mouseleave' && document.documentElement.className == 'touch') return;

	var btn, el;
	if (e == 'load' || dom.playlistsdiv.contains(e.target)) {
		el = dom.playlists;
		btn = dom.load;
	} else if (e == 'after' || dom.afterdiv.contains(e.target)) {
		el = dom.afteroptions;
		btn = dom.after;
	}

	if (el.style.display == 'none' && e.type !== 'mouseleave') {
		const { bottom, left } = btn.getBoundingClientRect();
		el.top = bottom;
		el.left = left;
		switch (el) {
			case dom.playlists:
				prepPlaylists('load');
				break;
			case dom.afteroptions:
				dom.stopplayback.className = (cfg.after == 'stopplayback' ? 'on' : '');
				dom.repeatplaylist.className = (cfg.after == 'repeatplaylist' ? 'on' : '');
				dom.playlibrary.className = (cfg.after == 'playlibrary' ? 'on' : '');
				dom.randomfiltered.className = (cfg.after == 'randomfiltered' ? 'on' : '');
				dom.randomlibrary.className = (cfg.after == 'randomlibrary' ? 'on' : '');
				if (dom.filter.value == '') dom.randomfiltered.className += ' dim';
				el.style.display = 'block';
		}
	} else el.style.display = 'none';
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
	dom.clear.style.right = (scrollBars == 0 ? '' : scrollBars + 2 +'px');
}

function filter() {
	var clear = (dom.filter.value == '' ? '' : 'none');
	if (!tree) tree = dom.tree.querySelectorAll('li');
	ffor(tree, function(f) {
		f.style.display = clear;
		if (f.className.indexOf('open') != -1)
			f.className = 'folder'+ (f.className.indexOf('dim') != -1 ? ' dim' : '');
	});

	if (clear != '') {
		var term = dom.filter.value.toLowerCase();
		ffor(tree, function(f) {
			var path = f.path.substring(f.path.lastIndexOf('/') + 1);
			if (path.toLowerCase().indexOf(term) != -1) {
				f.style.display = '';

				if (f.className.indexOf('folder') != -1) {
					if (path == dom.filter.value) {
						ffor(f.querySelectorAll('ul > *'), function(c) {
							c.style.display = '';
						});
						f.className = 'folder open filtered'+ (f.className.indexOf('dim') != -1 ? ' dim' : '');
					} else f.className = 'folder filtered'+ (f.className.indexOf('dim') != -1 ? ' dim' : '');
				}

				for (var p = f.parentNode; p && p !== dom.tree; p = p.parentNode) {
					if (p.className.indexOf('parent') != -1)
						break;
					if (p.style.display != '')
						p.style.display = '';
					if (p.className.indexOf('folder') != -1)
						p.className = 'parent folder open'
							+ (p.className.indexOf('filtered') != -1 ? ' filtered' : '')
							+ (p.className.indexOf('dim') != -1 ? ' dim' : '');
				}
			}
		});
	}

	keyNav(null, 'down');
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
	setFocus(dom.library, 'open');
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
					while (to.className.indexOf('open') != -1)
						to = to.lastElementChild.lastElementChild;
				} else
					to = el.parentNode.parentNode;
				break;
			case 'down':
				if (el.className.indexOf('open') != -1) {
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
				if (el.className.indexOf('open') != -1 && el.className.indexOf('parent') == -1)
					return el.click();
				else
					to = el.parentNode.parentNode;
				break;
			case 'right':
				if (el.className.indexOf('open') != -1)
					keyNav(el, 'down');
				else if (el.className.indexOf('folder') != -1)
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
	}

	if (!to || !dom.tree.contains(to)) {
		if (direction == 'up') {
			to = dom.tree.lastElementChild;
			while (to.className.indexOf('open') != -1)
				to = to.lastElementChild.lastElementChild;
		} else {
			to = dom.tree.querySelector('li');
		}
	}

	if (to.style.display == 'none')
		return keyNav(to, direction);

	setFocus(to, direction);
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
			clearFilter();
			break;
		case 90:	// z
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
		case 48:	// 0
		case 'MediaStop':
			stop();
			break;
		case 32:	// space
		case 179:	// MediaPlayPause
			e.preventDefault();
			if (!dom.tree.contains(e.target))
				e.target.blur();
			playPause();
			break;
		case 219:	// [
		case 177:	// MediaTrackPrevious
			previous();
			break;
		case 221:	// ]
		case 176:	// MediaTrackNext
			nextBtn();
			break;
		case 69:	// e
			dom.enqueue.click();
			setToast(dom.enqueue);
			break;
		case 82:	// r
			dom.random.click();
			setToast(dom.random);
			break;
		case 79:	// o
			dom.crossfade.click();
			setToast(dom.crossfade);
			break;
		case 80:	// p
			dom.playlistbtn.click();
			setFocus(dom.options);
			break;
		case 68:	// d
			if (cfg.locked || !onlinepls || url.length > 1) return;
			if (dom.options.className.indexOf('playlist') == -1)
				dom.playlistbtn.click();
			menu('load');
			setFocus(dom.options);
			break;
		case 86:	// v
			if (cfg.locked || !onlinepls || url.length > 1) return;
			prepPlaylists('save');
			break;
		case 73:	// i
			if (!cfg.locked && mode != 'song') importPlaylist();
			break;
		case 88:	// x
			if (!cfg.locked && mode != 'song') exportPlaylist();
			break;
		case 65:	// a
			if (cfg.locked) return;
			if (dom.options.className.indexOf('playlist') == -1)
				dom.playlistbtn.click();
			menu('after');
			setFocus(dom.options);
			break;
		case 83:	// s
			if (url.length > 1) return;
			dom.share.click();
			setFocus(dom.share);
			break;
		case 76:	// l
			dom.lock.click();
			break;
		case 67:	// c
			if (!cfg.locked && !mode) clearPlaylist();
			break;
		case 70:	// f
			e.preventDefault();
			dom.filter.focus();
			if (dom.filter.value != '') dom.filter.select();
			break;
		case 36:	// Home
			e.preventDefault();
			keyNav(null, 'down');
			break;
		case 35:	// End
			e.preventDefault();
			keyNav(null, 'up');
			break;
		case 38:	// ArrowUp
			e.preventDefault();
			if (e.shiftKey)
				keyNav(el, 'first');
			else
				keyNav(el, 'up');
			break;
		case 40:	// ArrowDown
			e.preventDefault();
			if (e.shiftKey)
				keyNav(el, 'last');
			else
				keyNav(el, 'down');
			break;
		case 37:	// ArrowLeft
			e.preventDefault();
			keyNav(el, 'left');
			break;
		case 39:	// ArrowRight
			e.preventDefault();
			keyNav(el, 'right');
			break;
		case 13:	// Enter
			if (dom.tree.contains(el)) {
				if (e.shiftKey)
					el.dispatchEvent(new CustomEvent('contextmenu'));
				else
					el.click();
			}
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
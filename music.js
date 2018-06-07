var
	debug = false,	// Show some debug messages in console
	defcover = 'music.png',	// Default cover image if none found
	deftitle = 'Music',	// Default page title
	nodupes = true,		// Don't add already played songs to playlist
	whatsapp = false,	// Add button to share directly to WhatsApp
	whatsappmsg = 'Have a listen to',	// Default WhatsApp message
	audio,
	cfg,
	dom,
	drag,
	library,
	ls,
	onplaylist,
	url,
	songs = Array();

function init() {
	url = document.URL.replace('?root=', '?').split('?', 2);
	ls = ls();

	var get = function(id) { return document.getElementById(id) };
	audio = get('audio');
	dom = {
		'cover': get('cover'),
		'folder': get('folder'),
		'song': get('song'),
		'playpause': get('playpause'),
		'options': get('options'),
		'enqueue': get('enqueue'),
		'random': get('random'),
		'share': get('share'),
		'shares': get('shares'),
		'lock': get('lock'),
		'folderuri': get('folderuri'),
		'songuri': get('songuri'),
		'a': get('a'),
		'clear': get('clear'),
		'playlist': get('playlist'),
		'filter': get('filter'),
		'time': get('time'),
		'tree': get('tree')
	};

	title.textContent = deftitle;
	if (cfg.enqueue) dom.enqueue.className = 'on';
	if (cfg.random) dom.random.className = 'on';
	if (cfg.locked) {
		document.body.className = 'locked';
		dom.lock.className = 'on';
		dom.lock.textContent = 'Unlock';
	}
	if (whatsapp)
		dom.options.className = 'whatsapp';

	audio.onplay = function() {
		dom.playpause.className = 'playing';
		dom.folder.className = dom.song.className = '';
		if (cfg.index != -1) {
			if (cfg.index > 0)
				dom.playlist.childNodes[cfg.index - 1].className = 'song';
			if (cfg.index < cfg.playlist.length - 1)
				dom.playlist.childNodes[cfg.index + 1].className = 'song';
			dom.playlist.childNodes[cfg.index].className = 'playing';
			if (!onplaylist)
				dom.playlist.scrollTop = dom.playlist.childNodes[cfg.index].offsetTop - dom.playlist.offsetTop;
		}
	}
	
	audio.onpause = function() {
		dom.playpause.className = '';
		dom.folder.className = dom.song.className = 'dim';
	}

	audio.onended = function() {
		next();
	}
	
	audio.ontimeupdate = audio.durationchange = function() {
		dom.time.textContent = timeTxt(~~audio.currentTime) +" / "+ timeTxt(~~audio.duration);
	}
	
	audio.onerror = function() {
		dom.playlist.childNodes[cfg.index].style.color = 'red';
		next();
	};
	
	window.addEventListener('touchstart', function onFirstTouch() {
		document.documentElement.className = 'touch';
		dom.clear.style.display = 'initial';
		window.addEventListener('touchmove', function(e) {
			onplaylist = dom.playlist.contains(e.targetTouches[0].target);
		}, false);
		window.removeEventListener('touchstart', onFirstTouch, false);
	}, false);
	
	window.onunload = function() {
		if (ls) {
			localStorage.setItem("asymm_music", JSON.stringify(cfg));
			log('Session saved');
		}
	}
	
	var lib = document.createElement('script');
	lib.src = 'music.php'+ (url.length > 1 ? '?root='+ url[1] : '');
	log('PHP request = '+ lib.src);
	lib.onload = function() {
		buildLibrary('', library, tree);
		buildPlaylist();
	};
	document.body.appendChild(lib);
}

function ls() {
	var def = {
		'enqueue': false,
		'random': false,	// (url.length == 1 ? true : false)
		'locked': false,
		'password': false,
		'playlist': [],
		'index': -1
	};
	
	if (url.length > 1) {	// Don't use saved options & playlist when not in main library
		cfg = def;
		return false;
	}

	try {
		var sav = localStorage.getItem('asymm_music');
		if (sav != null) {
			cfg = JSON.parse(sav);
			for (c in def)
				if (cfg[c] == undefined) cfg[c] = def[c];
			return true;
		}
		cfg = def;
		def = JSON.stringify(def);
		localStorage.setItem('asymm_music', def);
		if (localStorage.getItem('asymm_music') == def) return true;
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

function get(id) {
	return document.getElementById(id);
}

function buildLibrary(root, folder, element) {
	var li, i, f, s, cover = false;
	for (i in folder) {
		if (i != '/') {	// Subfolder
			li = document.createElement('li');
			li.className = 'folder';
			li.setAttribute('path', root + i);
			li.textContent = i;
			li.onclick = function(e) { folderClick(e) };
			element.appendChild(li);
			var ul = li.appendChild(document.createElement('ul'));
			buildLibrary(root + i +'/', folder[i], ul);
		} else {
			for (f in folder[i]) {
				if (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png')) {
					if (!cover || f.toLowerCase().startsWith('folder'))
						cover = f;
					delete(folder[i][f]);
				}
			}
			for (f in folder[i]) {
				li = document.createElement('li');
				li.id = songs.length;
				li.className = 'song';
				li.setAttribute('path', root + f);
				if (cover) li.setAttribute('cover', cover);
				li.textContent = getSong(f);
				li.onclick = function(e) { songClick(e) };
				songs.push(li);
				element.appendChild(li);
			}
		}
	}
}

function folderClick(e) {
	e.stopPropagation();
	var li = e.target;
	if (dom.filter.value != '' && li.className.indexOf('open') == 0) {
		li.querySelectorAll('ul > *').forEach(function(f) {
			if (f.style.display != '') f.style.display = '';
		});
	} else {
		if (li.className.indexOf('open') == -1) li.className = 'open folder';
		else li.className = 'folder';
	}
}

function songClick(e) {
	e.stopPropagation();
	var li = e.target;
	if (cfg.enqueue)
		add(li.id);
	else
		load(li.id);
	li.className += ' dim';
}

function buildPlaylist() {
	if (cfg.playlist.length == 0 || url.length > 1) return;	// Only rebuild saved playlist for main library
	cfg.index = Math.min(cfg.index, cfg.playlist.length - 1);

	var i, li;
	for (i in cfg.playlist) {
		li = playlistElement(cfg.playlist[i]);
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
	
	// Only for next(): if songs were added/removed since last session, id'could be changed
	var last = cfg.playlist[cfg.playlist.length - 1];
	last.id = -1;
	for (s in songs) {
		if (last.path == songs[s].getAttribute('path')) {
			last.id = songs[s].getAttribute('id');
			break;
		}
	}
}

function playlistElement(s) {
	var li = document.createElement('li');
	li.setAttribute('id', s.id);
	li.className = 'song';
	li.draggable = 'true',
	li.onclick = function() { setFilter(this.textContent) };
	li.ondblclick = function (e) { if (!cfg.locked) play(getIndex(s.id)) };
	li.ondragstart = function(e) { prepareDrag(e) };
	li.ondragenter = function() { this.classList.add('over') };
	li.ondragleave = function() { this.classList.remove('over') };
	li.ondragover = function (e) { allowDrop(e) }
	li.ondragend = function() { endDrag() }
	li.ondrop = function(e) { dropSong(e) };
	li.textContent = getSong(s.path);
	return li;
}

function prepareDrag(e) {
	e.stopPropagation();
	dom.clear.className = 'drag';
	dom.clear.textContent = '';
	dom.playlist.appendChild(playlistElement({ 'id': 'last', 'path': '' }));
	if (cfg.index !=-1)
		dom.playlist.childNodes[cfg.index].className = 'song';

	drag = e.target;
	e.dataTransfer.effectAllowed = 'move';
	e.dataTransfer.setData('text/plain', (cfg.index != -1 ? cfg.playlist[cfg.index].id : -1));
}

function allowDrop(e) {
	e.preventDefault();
	e.stopPropagation();
}

function endDrag() {
	dom.clear.className = '';
	dom.clear.textContent = 'Clear';
	dom.playlist.removeChild(dom.playlist.lastChild);
}

function dropSong(e) {
	e.preventDefault();
	e.stopPropagation();
	var to = e.target;
	to.classList.remove('over');
	if (drag == to) return;

	dom.playlist.insertBefore(drag, to);
	
	var indexfrom = getIndex(drag.getAttribute('id'));
	var indexto = getIndex(to.getAttribute('id'));
	cfg.playlist.splice(indexto - (indexfrom < indexto ? 1 : 0), 0, cfg.playlist.splice(indexfrom, 1)[0]);
	cfg.index = getIndex(e.dataTransfer.getData('text'));

	if (cfg.index != -1)
		dom.playlist.childNodes[cfg.index].className = 'playing';
}

function removeItem(e) {
	e.preventDefault();
	e.stopPropagation();
	var playId = (cfg.index != -1 ? cfg.playlist[cfg.index].id : -1);
	var index = getIndex(drag.getAttribute('id'));
	cfg.playlist.splice(index, 1);
	dom.playlist.removeChild(dom.playlist.childNodes[index]);
	resizePlaylist();
	if (cfg.index != -1) {
		if (index != cfg.index) dom.playlist.childNodes[cfg.index].className = 'playing';
		cfg.index = (index == cfg.index ? cfg.index - 1 : getIndex(playId));
	}
}

function getIndex(id) {
	if (id == 'last') return cfg.playlist.length;
	if (id != -1) for (var i = 0; i < cfg.playlist.length; i++)
		if (id == cfg.playlist[i].id) return i;
	return -1;
}

function fillShare(path) {
	dom.folderuri.value = url[0] +'?root='+ esc(dir + path.substring(0, path.lastIndexOf('/')));
	dom.songuri.value = url[0] +'?root='+ esc(dir + path);
}

function esc(s) {
	return s.replace(/\/+$/, '').replace(/[(\?=&# ]/g, function(char) { return escape(char) });
}

function getFolder(path) {
	if (path.indexOf('/') == -1 && url.length > 1)
		path = dir;
	return path.substring(path.lastIndexOf('/', path.lastIndexOf('/') - 1) + 1, path.lastIndexOf('/'));
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
	dom.cover.className = (dom.cover.className == '' ? 'zoomed' : '');
}

function stop() {
	if (cfg.locked) return;
	audio.pause();
	audio.currentTime = 0;
}

function playPause() {
	if (!audio.src)
		play(cfg.index);
	else if (audio.paused)
		audio.play();
	else
		audio.pause();
}

function previous() {
	if (cfg.locked) return;
	if (cfg.index > 0)
		play(cfg.index - 1);
	else
		log('No previous item in playlist');
}

function next() {
	if (cfg.locked && cfg.index != -1) return;
	if (cfg.playlist.length > cfg.index + 1)
		play(cfg.index + 1);
	else if (cfg.random) {
		var next, dupe = false;
		for (i = 0; i < songs.length; i++) {
			if (songs.length == 1)	// Repeat when sharing single song
				return load(0);
			next = songs[~~((Math.random() * songs.length))];
			for (var s in cfg.playlist)
				if (next.getAttribute('path') == cfg.playlist[s].path) {
					dupe = true;
					log('Random song was found to be duplicate');
					break;
				}
			if (!dupe && next) {
				load(next.id);
				break;
			}
		}
	} else if (cfg.index != -1)	{
		var next = parseInt(cfg.playlist[cfg.index].id) + 1;
		if (next < songs.length)
			load(songs[next].id);
		else
			log('End of library');
	} else load(songs[0].id);
}

function load(id) {
	add(id, true);
	play(cfg.index + 1);
}

function download(type) {
	if (cfg.index != -1) {
		var path = cfg.playlist[cfg.index].path;
		var uri = dir + (type == 'f' ? path.substring(0, path.lastIndexOf('/')) : path);
		dom.a.href = 'music.php?dl='+ esc(uri);
		dom.a.click();
	}
}

function share(type) {
	var share = (type == 'f' ? dom.folderuri : dom.songuri);
	if (share.value) {
		share.select();
		document.execCommand('copy');
		share.nextElementSibling.nextElementSibling.className = 'copied';
		setTimeout(function() {
			share.nextElementSibling.nextElementSibling.className = 'link';
		}, 1500);
	}
}

function shareWhatsApp(type) {
	var share = (type == 'f' ? dom.folderuri : dom.songuri);
	if (share.value) {
		msg = prompt('Your message via WhatApp (the url will be added at the end):', whatsappmsg);
		whatsappmsg = (msg ? msg : '');
		window.open('https://api.whatsapp.com/send?text='+ whatsappmsg +' '+ encodeURIComponent(share.value));
	}
}

function add(id, next) {
	var s = {
		'id': id,
		'path': songs[id].getAttribute('path'),
		'cover': songs[id].getAttribute('cover')
	};
	
	if (cfg.playlist.length > 0) {
		if (next) {
			if (s.path == cfg.playlist[cfg.index].path) {
				cfg.index--;
				return;
			}
		} else {
			var i = (nodupes ? 0 : cfg.index);
			for (; i < cfg.playlist.length; i++) {
				if (s.path == cfg.playlist[i].path) {
					dom.tree.className = 'dim';
					setTimeout(function() {
						dom.tree.className = '';
					}, 500);
					return;
				}
			}
		}
	}
	
	var li = playlistElement(s);
	if (next) {
		cfg.playlist.splice(cfg.index + 1, 0, s);
		if (cfg.index > 0)
			playlist.insertBefore(li, dom.playlist.childNodes[cfg.index + 1]);
		else
			dom.playlist.appendChild(li);
	} else {
		cfg.playlist.push(s);
		dom.playlist.appendChild(li);
	}
	
	resizePlaylist();
	log('Added to playlist: '+ s.path);
}

function play(index) {
	if (index == -1) return next();
	var path = cfg.playlist[index].path;
	var c = cfg.playlist[index].cover;

	cfg.index = index;
	audio.src = esc(dir + path);
	audio.play();

	if (c)
		dom.cover.src = esc(dir + path.substring(0, path.lastIndexOf('/') + 1) + c);
	else
		dom.cover.src = defcover;
	dom.folder.textContent = getFolder(path);
	dom.song.textContent = getSong(path);
	title.textContent = dom.song.textContent +' - '+ deftitle;
	fillShare(path);
}

function toggle(e) {
	if (e.target.id == 'share') {
		var shown = (dom.shares.className == '');
		dom.share.className = (shown ? '' : 'on');
		dom.shares.className = (shown ? 'hide' : '');
	} else if (!cfg.locked) {
		cfg[e.target.id] ^= true;
		e.target.className = (cfg[e.target.id] ? 'on' : '');
	}
}

function toggleLock() {
	if (!password()) return;
	if (!cfg.locked) {
		if (!cfg.enqueue) dom.enqueue.click();
		if (!cfg.random) dom.random.click();
	}
	cfg.locked ^= true;
	document.body.className = (cfg.locked ? 'locked' : '');
	dom.lock.className = (cfg.locked ? 'on' : '');
	dom.lock.textContent = (cfg.locked ? 'Unlock' : 'Lock');
}

function password() {
	if (cfg.locked && !cfg.password) return true;

	var prev = 'Use previously set password';
	var p = prompt('Enter password', (!cfg.locked && cfg.password ? prev : ''));
	if (p == null) return false;
	if (p == prev) return true;

	var pass = 0;
	for (var i = 0; i < p.length; i++)
		pass = pass * 7 + p.charCodeAt(i);
	
	if (cfg.locked && cfg.password != pass) {
		alert('Intruder alert!');
		return false;
	}
	if (!cfg.locked) cfg.password = pass;
	return true;
}

function clearPlaylist() {
	if (cfg.playlist.length > 0 && confirm('Clear the playlist?')) {
		cfg.playlist = [];
		cfg.index = -1;
		dom.playlist.innerHTML = '';
		for (s in songs) {
			if (songs[s].className.indexOf('dim') != -1)
				songs[s].className = 'song';
		}
		resizePlaylist();
	}
}

function resizePlaylist() {
	if (cfg.playlist.length > 6) {
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
	var items = dom.tree.querySelectorAll('li');
	items.forEach(function(f) {
		f.style.display = clear;
		if (f.className.indexOf('open') == 0)
			f.className = 'folder';
	});
	if (clear == '') return;
	var term = dom.filter.value.toLowerCase();
	items.forEach(function(f) {
		if (f.getAttribute('path').toLowerCase().indexOf(term) != -1)
			for (; f && f !== dom.tree; f = f.parentNode) {
				if (f.style.display != '') f.style.display = '';
				if (f.className.indexOf('folder') != -1 && f.className.indexOf('open') == -1)
					f.className='open folder';
			}
	});
}

function setFilter(f) {
	if (typeof f === 'string')
		dom.filter.value = f;
	else
		dom.filter.value = f.target.textContent;
	filter();
}

document.addEventListener('keydown', function(e) {
	if (e.altKey || e.ctrlKey) return;
	
	if (e.which == 27) {	// esc
		setFilter('');
		dom.filter.blur();
		return;
	} else if (dom.filter == document.activeElement) return false;

	switch (e.which) {
		case 32:	// space
			e.preventDefault();
			playPause();
			return;
		case 48:	// 0
			stop();
			return;
		case 67:	// c
			if (!cfg.locked) clearPlaylist();
			return;
		case 69:	// e
			dom.enqueue.click();
			return;
		case 70:	// f
			e.preventDefault();
			dom.filter.focus();
			return;
		case 76:	// l
			dom.lock.click();
			return;
		case 82:	// r
			dom.random.click();
			return;
		case 83:	// s
			dom.share.click();
			return;
		case 61:	// = Firefox
		case 187:	// =
			e.preventDefault();
			next();
			return;
		case 173:	// - Firefox
		case 189:	// -
			e.preventDefault();
			previous();
			return;
		case 219:	// [
			audio.currentTime -= 5;
			return;
		case 221:	// ]
			audio.currentTime += 5;
			return;
	}
	return false;
}, false);
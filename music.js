var
	debug = false,	// Show some debug messages in console
	defcover = 'music.png',	// Default cover image if none found
	deftitle = 'Music',	// Default page title
	nodupes = true,	// Don't add already played songs to playlist
	audio,
	cfg,
	dom,
	ls = ls(),
	songs = Array();

function init() {
	var get = function(id) { return document.getElementById(id) };
	audio = get('audio');
	dom = {
		'player': get('player'),
		'cover': get('cover'),
		'folder': get('folder'),
		'song': get('song'),
		'playpause': get('playpause'),
		'enqueue': get('enqueue'),
		'shuffle': get('shuffle'),
		'playlist': get('playlist'),
		'filter': get('filter'),
		'time': get('time'),
		'tree': get('tree')
	};

	title.textContent = deftitle;
	if (cfg.enqueue) dom.enqueue.className = 'on';
	if (cfg.shuffle) dom.shuffle.className = 'on';

	audio.onplay = function() {
		dom.playpause.className = 'playing';
		dom.folder.className = dom.song.className = '';
		if (cfg.index > 0)
			dom.playlist.childNodes[cfg.index - 1].className = 'song';
		if (cfg.index < cfg.playlist.length - 1)
			dom.playlist.childNodes[cfg.index + 1].className = 'song';
		dom.playlist.childNodes[cfg.index].className = 'playing';
		dom.playlist.scrollTop = dom.playlist.childNodes[cfg.index].offsetTop - dom.playlist.offsetTop;
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

	buildLibrary(dir, library, tree);
	buildPlaylist();
}

function ls() {
	var def = {
		'volume': 1,
		'enqueue': false,
		'shuffle': true,
		'playlist': [],
		'index': -1
	};

	try {
		var sav = localStorage.getItem('asymm_music');
		if (sav != null) {
			cfg = JSON.parse(sav);
			for (c in def)
				if (cfg[c] === 'undefined') cfg[c] = def[c];
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
		if (i != '/') {	// subfolder
			li = document.createElement('li');
			li.className = 'folder';
			li.setAttribute('path', root + i);
			li.textContent = i;
			li.onclick = function(e) {
					e.stopPropagation();
					if (dom.filter.value != '' && this.className.indexOf('open') == 0) {
						this.querySelectorAll('ul > *').forEach(function(f) {
							if (f.style.display != '') f.style.display = '';
						});
					} else {
						if (this.className.indexOf('open') == -1) this.className = 'open folder';
						else this.className = 'folder';
					}
				};
			element.appendChild(li);
			var ul = li.appendChild(document.createElement('ul'));
			buildLibrary(root + i +'/', folder[i], ul);
		} else {
			for (f in folder[i]) {
				if (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png')) {
					cover = f;
					delete(folder[i][f]);
					break;
				}
			}
			for (f in folder[i]) {
				li = document.createElement('li');
				li.id = songs.length;
				li.className = 'song';
				li.setAttribute('path', root + f);
				if (cover) li.setAttribute('cover', cover);
				li.textContent = getSong(f);
				li.onclick = function(e) {
						e.stopPropagation();
						if (cfg.enqueue)
							add(this.id);
						else
							open(this.id);
						this.className += ' dim';
					};
				songs.push(li);
				element.appendChild(li);
			}
		}
	}
}

function buildPlaylist() {
	if (cfg.playlist.length == 0) return;

	var i, li;
	for (i in cfg.playlist) {
		var path = cfg.playlist[i].path;
		li = document.createElement('li');
		li.className = (i == cfg.index ? 'playing' : 'song');
		li.textContent = getSong(path);
		li.onclick = function() {
			setFilter(this.textContent);
		};
		dom.playlist.appendChild(li);
		if (i == cfg.index) {
			dom.folder.textContent = getFolder(path);
			dom.song.textContent = getSong(path);
		}
	}

	dom.playlist.scrollTop = dom.playlist.childNodes[cfg.index].offsetTop - dom.playlist.offsetTop;

	// Only for next(): if songs were added/removed since last session, id's changed
	var last = cfg.playlist[cfg.playlist.length - 1];
	last.id = -1;
	for (s in songs) {
		if (last.path == songs[s].getAttribute('path')) {
			last.id = songs[s].getAttribute('id');
			break;
		}
	}
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
	}
}

function getFolder(path) {
	var f = path.substring(0, path.lastIndexOf('/'));
	return f.substring(f.lastIndexOf('/') + 1);
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
	dom.cover.className = (dom.cover.className == 'zoomed' ? '' : 'zoomed');
}

function stop() {
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
	if (cfg.index > 0)
		play(cfg.index - 1);
	else
		log('No previous item in playlist');
}

function next() {
	if (cfg.playlist.length > cfg.index + 1)
		play(cfg.index + 1);
	else if (cfg.shuffle) {
		var next = null;
		var found = false;
		do {
			next = songs[~~((Math.random() * songs.length))];
			found = false;
			for (var i in cfg.playlist)
				if (next.getAttribute('path') == cfg.playlist[i].path) {
					found = true;
					break;
				}
		} while (found);
		if (next)
			open(next.id);
	} else if (cfg.index != -1)	{
		var next = parseInt(cfg.playlist[cfg.index].id) + 1;
		if (songs[next].id)
			open(songs[next].id);
		else
			log('End of library');
	}
}

function open(id) {
	add(id, true);
	play(cfg.index + 1);
}

function add(id, next) {
	var path = songs[id].getAttribute('path');
	
	if (cfg.index != -1) {
		if (next) {
			if (path == cfg.playlist[cfg.index].path) {
				cfg.index--;
				return;
			}
		} else {
			var i = (nodupes ? 0 : cfg.index);
			for (; i < cfg.playlist.length; i++) {
				if (path == cfg.playlist[i].path) {
					dom.tree.className = 'dim';
					setTimeout(function() {
						dom.tree.className = '';
					}, 500);
					return;
				}
			}
		}
	}
		
	var li = document.createElement('li');
	li.className = 'song';
	li.textContent = getSong(path);
	li.onclick = function() {
		setFilter(this.textContent);
	};

	var c = songs[id].getAttribute('cover');
	item = {'id': id, 'path': path, 'cover': c};

	if (next) {
		cfg.playlist.splice(cfg.index + 1, 0, item);
		if (cfg.index > 0)
			playlist.insertBefore(li, dom.playlist.childNodes[cfg.index + 1]);
		else
			dom.playlist.appendChild(li);
	} else {
		cfg.playlist.push(item);
		dom.playlist.appendChild(li);
	}
	
	log('Added to playlist: '+ item.path);
}

function play(index) {
	if (index == -1) return next();
	var path = cfg.playlist[index].path;
	var c = cfg.playlist[index].cover;

	cfg.index = index;
	audio.src = escape(path);
	audio.play();

	if (c)
		dom.cover.src = escape(path.substr(0, path.lastIndexOf('/') + 1) + c);
	else
		dom.cover.src = defcover;
	dom.folder.textContent = getFolder(path);
	dom.song.textContent = getSong(path);
	title.textContent = dom.song.textContent +' - '+ deftitle;
}

function escape(s) {
	return s.split('#').join('%23').split('?').join('%3F');
}

function toggle(e) {
	cfg[e.target.id] ^= true;
	e.target.className = (cfg[e.target.id] ? 'on' : '');
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
	if (e.ctrlKey) return;
	if (e.which == 27) {	// esc
		setFilter('');
		dom.filter.blur();
		return;
	} else if (dom.filter == document.activeElement) return false;
	switch (e.which) {
		case 67:	// c
			clearPlaylist();
			return;
		case 69:	// e
			dom.enqueue.click();
			return;
		case 70:	// f
			dom.filter.focus();
			return;
		case 83:	// s
			dom.shuffle.click();
			return;
		case 48:	// 0
			stop();
			return;
		case 32:	// space
			e.preventDefault();
			playPause();
			return;
		case 173:	// -
			e.preventDefault();
			previous();
			return;
		case 61:	// =
			e.preventDefault();
			next();
			return;
	}
	return false;
}, false);

window.onunload = function() {
	if (ls) {
		localStorage.setItem("asymm_music", JSON.stringify(cfg));
		log('Session saved');
	}
}
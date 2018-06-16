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
	fade,
	library,
	ls,
	onplaylist,
	url,
	current = 0,
	played = Array(),
	songs = Array();

function init() {
	url = document.URL.replace('?play=', '?').split('?', 2);
	ls = ls();

	var get = function(id) { return document.getElementById(id) };
	dom = {
		'player': get('player'),
		'cover': get('cover'),
		'current': get('current'),
		'folder': get('folder'),
		'song': get('song'),
		'playpause': get('playpause'),
		'options': get('options'),
		'crossfade': get('crossfade'),
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
	if (cfg.crossfade) dom.crossfade.className = 'on';
	if (cfg.enqueue) dom.enqueue.className = 'on';
	if (cfg.random) dom.random.className = 'on';
	if (cfg.locked) {
		document.body.className = 'locked';
		dom.lock.className = 'on';
		dom.lock.textContent = 'Unlock';
	}
	if (whatsapp)
		dom.options.className = 'whatsapp';
	
	window.addEventListener('touchstart', function() {
		window.addEventListener('touchend', function(e) {
			e.preventDefault();
		}, {once: true});
		window.addEventListener('touchmove', function(e) {
			onplaylist = dom.playlist.contains(e.targetTouches[0].target);
		}, {passive: true});
		document.documentElement.className = 'touch';
		dom.clear.style.display = 'initial';
	}, {once: true, passive: true});

	window.onunload = function() {
		if (ls) {
			localStorage.setItem("asymm_music", JSON.stringify(cfg));
			log('Session saved');
		}
	}
	
	var audio1 = (cfg.crossfade ? new Audio() : null);
	audio = [get('audio'), audio1];
	prepAudio(audio[0]);
	if (audio[1]) prepAudio(audio[1]);
	
	var lib = document.createElement('script');
	lib.src = 'music.php'+ (url.length > 1 ? '?play='+ url[1] : '');
	log('PHP request = '+ lib.src);
	lib.onload = function() {
		buildLibrary('', library, tree);
		buildPlaylist();
		if (document.documentElement.className == 'load')
			document.documentElement.className = '';
	};
	document.body.appendChild(lib);
}

function ls() {
	var def = {
		'crossfade': false,
		'enqueue': false,
		'random': false,	// (url.length == 1 ? true : false)
		'repeat': true,
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

function prepAudio(a) {
	a.onplay = function() {
		dom.playpause.className = 'playing';
		dom.folder.className = dom.song.className = '';
		if (cfg.index != -1) {
			dom.playlist.childNodes[cfg.index].className = 'playing';
			if (!onplaylist)
				dom.playlist.scrollTop = dom.playlist.childNodes[cfg.index].offsetTop - dom.playlist.offsetTop;
		}
	}
	
	a.onpause = function(e) {
		if (this == audio[current]) {
			dom.playpause.className = '';
			dom.folder.className = dom.song.className = 'dim';
		}
	}

	a.onended = function() {
		if (!cfg.crossfade) next()
	}
	
	a.ontimeupdate = function() {
		if (this == audio[current])
			dom.time.textContent = timeTxt(~~this.currentTime) +" / "+ timeTxt(~~this.duration);
		if (cfg.crossfade && !fade && (this.duration - this.currentTime) < 7) {
			var fading = current;
			log('Crossfading '+ audio[fading].src +' (should pop up once)');
			fade = setInterval(function() {
				if (!audio[fading].paused && audio[fading].volume >= 0.04) {
					audio[fading].volume -= 0.04;
				} else if (audio[fading].ended) {
					clearInterval(fade);
					fade = null;
				}
			}, 200);
			setTimeout(function() {
				if (!audio[current].paused) {
					current ^= 1;
					if (audio[current].paused)
						next();
				}
			}, 2000);
		}
	}
	
	a.onerror = function() {
		dom.playlist.childNodes[cfg.index].style.color = 'red';
		next();
	};
}

function buildLibrary(root, folder, element) {
	var li, i, f, cover = false;
	for (i in folder) {
		if (i != '/') {	// Subfolder
			li = document.createElement('li');
			li.className = 'folder';
			li.path = root + i;
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
				li.path = root + f;
				if (cover) li.cover = cover;
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
	if (li.className.indexOf('filtered') != -1 || li.className.indexOf('parent') != -1) {
		li.querySelectorAll('ul > *').forEach(function(f) {
			if (f.style.display != '') f.style.display = '';
		});
		li.className = 'open folder';
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
	dom.playlist.innerHTML = '';

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
}

function playlistElement(s) {
	var li = document.createElement('li');
	li.className = 'song';
	li.draggable = 'true',
	li.onclick = function() { setFilter(this.textContent) };
	li.ondblclick = function (e) { dblClick(e) };
	li.ondragstart = function(e) { prepareDrag(e) };
	li.ondragenter = function() { this.classList.add('over') };
	li.ondragleave = function() { this.classList.remove('over') };
	li.ondragover = function (e) { allowDrop(e) };
	li.ondragend = function() { endDrag() };
	li.ondrop = function(e) { dropSong(e) };
	if (s.id == 'last') {
		li.id = 'last';
	} else {
		li.textContent = getSong(s.path);
		li.title = getFolder(s.path);
	}
	return li;
}

function dblClick(e) {
	if (!cfg.locked) {
		e.preventDefault();
		play(getIndex(e.target));
	}
}

function prepareDrag(e) {
	e.stopPropagation();
	if (cfg.locked) return;
	dom.clear.className = 'drag';
	dom.clear.textContent = '';
	dom.playlist.appendChild(playlistElement({ 'id': 'last' }));
	if (cfg.index !=-1)
		dom.playlist.childNodes[cfg.index].className = 'song';

	drag = e.target;
	e.dataTransfer.effectAllowed = 'move';
	e.dataTransfer.setData('text/plain', (getIndex(drag)));
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

function dropSong(e) {
	e.preventDefault();
	e.stopPropagation();
	var to = e.target;
	log('Drag '+ drag.innerHTML +' to place of '+ to.innerHTML);
	to.classList.remove('over');
	var indexfrom = e.dataTransfer.getData('text');
	var indexto = getIndex(to);
	if (indexto != indexfrom) {
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
	dom.playlist.childNodes[cfg.index].className = 'playing';
	log('Drag from '+ indexfrom +' to '+ indexto);
	log('Playback index to '+ cfg.index);
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
}

function getIndex(li) {
	if (li.id == 'last')	// Temporary last item for dragging
		return cfg.playlist.length;
	return Array.prototype.indexOf.call(li.parentNode.children, li);
}

function fillShare(path) {
	dom.folderuri.value = url[0] +'?play='+ esc(root + path.substring(0, path.lastIndexOf('/')));
	dom.songuri.value = url[0] +'?play='+ esc(root + path);
}

function esc(s) {
	return s.replace(/\/+$/, '').replace(/[(\?=&# ]/g, function(char) { return escape(char) });
}

function getFolder(path) {
	if (path.indexOf('/') == -1 && url.length > 1)
		path = root;
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
	dom.player.className = (dom.player.className == '' ? 'fullzoom' : 
		(dom.player.className == 'zoom' ? '' : 'zoom'));
}

function stop() {
	if (cfg.locked) return;
	audio[current].pause();
	audio[current].currentTime = 0;
}

function playPause() {
	if (!audio[current].src)
		play(cfg.index);
	else if (audio[current].paused)
		audio[current].play();
	else
		audio[current].pause();
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
		if (played.length == songs.length) {
			log('All songs have been played');
			if (cfg.repeat) {
				log('Clearing played');
				played.length = 0;
			} else return;
		}
		var next;
		do { next = ~~((Math.random() * songs.length)) }
			while (played.indexOf(next.toString()) != -1);
		load(songs[next].id);
	} else if (cfg.index != -1)	{
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
			log('End of library');
			if (cfg.repeat) {
				log('Starting at the top');
				load(songs[0].id);
			}
		}
	} else load(songs[0].id);
}

function load(id) {
	add(id, true);
	play(cfg.index + 1);
}

function download(type) {
	if (cfg.index != -1) {
		var path = cfg.playlist[cfg.index].path;
		var uri = root + (type == 'f' ? path.substring(0, path.lastIndexOf('/')) : path);
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

function importPlaylist() {
	var input = document.createElement('input');
	input.setAttribute('type', 'file');
	input.setAttribute('accept', '.mfp.json');
	input.onchange = function(e) {
		var reader = new FileReader();
		reader.onload = function(e) {
			var items = JSON.parse(e.target.result);
			for (i in items)
				cfg.playlist.push(items[i]);
			buildPlaylist();
		};
		reader.readAsText(input.files[0], 'UTF-8');
	}
	input.click();
}

function exportPlaylist() {
	var filename = prompt('Enter a filename', deftitle +' Playlist');
	if (filename) {
		dom.a.href = 'data:text/json;charset=utf-8,'+ esc(JSON.stringify(cfg.playlist));
		dom.a.download = filename +'.mfp.json';
		dom.a.click();
	}
}

function add(id, next) {
	var s = {
		'path': songs[id].path,
		'cover': songs[id].cover
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
	if (!played.includes(id)) {
		played.push(id);
		log('Added id '+ id +' to played');
	}
}

function play(index) {
	if (cfg.index != -1)
		dom.playlist.childNodes[cfg.index].className = 'song';
	if (index == -1) return next();
	var path = cfg.playlist[index].path;
	var c = cfg.playlist[index].cover;

	cfg.index = index;
	audio[current].src = esc(root + path);
	audio[current].volume = 1;
	audio[current].play();
	
	var prevcover = dom.cover.src || defcover;
	c = (c ? esc(root + path.substring(0, path.lastIndexOf('/') + 1) + c) : defcover);
	if (prevcover.indexOf(c) == -1) {
		dom.cover.style.opacity = '0';
		if (dom.player.className == 'fullzoom')
			dom.current.style.opacity = 0;
			dom.folder.textContent = getFolder(path);
			dom.song.textContent = getSong(path);
		setTimeout(function() {
			dom.cover.src = c;
			setTimeout(function() {
				dom.cover.style.opacity = '1';
				if (dom.player.className == 'fullzoom')
					dom.current.style.opacity = 1;
			}, 150);
		}, 150);
	} else {
		dom.folder.textContent = getFolder(path);
		dom.song.textContent = getSong(path);
	}
	
	title.textContent = getFolder(path) +' - '+ getSong(path);
	fillShare(path);
}

function toggle(e) {
	switch(e.target.id) {
		case 'share':
			var shown = (dom.shares.className == 'show');
			dom.share.className = (shown ? '' : 'on');
			dom.shares.className = (shown ? '' : 'show');
			return;
		case 'lock':
			return toggleLock();
		case 'crossfade':	// No return
			if (!audio[1]) {
				audio[1] = new Audio();
				prepAudio(audio[1]);
			}
		default:
			if (!cfg.locked) {
				cfg[e.target.id] ^= true;
				e.target.className = (cfg[e.target.id] ? 'on' : '');
			}
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
		if (f.className.indexOf('open') != -1)
			f.className = 'folder';
	});
	if (clear == '') return;

	var term = dom.filter.value.toLowerCase();
	items.forEach(function(f) {
		var path = f.path.substring(f.path.lastIndexOf('/') + 1);
		if (path.toLowerCase().indexOf(term) != -1) {
			f.style.display = '';
			
			if (f.className.indexOf('folder') != -1) {
				if (path == dom.filter.value) {
					f.querySelectorAll('ul > *').forEach(function(f) {
						f.style.display = '';
					});
					f.className = 'folder open filtered';
				} else f.className = 'folder filtered';
			}
			
			for (var p = f.parentNode; p && p !== dom.tree; p = p.parentNode) {
				if (p.style.display != '')
					p.style.display = '';
				if (p.className.indexOf('folder') != -1)
					p.className = 'folder open '+
						(p.className.indexOf('filtered') != -1 ? 'filtered ' : '')
						+'parent';
			}
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

function clearFilter() {
	dom.filter.value = '';
	filter();
}

document.addEventListener('keydown', function(e) {
	if (e.altKey || e.ctrlKey) return;
	
	if (e.which == 27) {	// esc
		e.preventDefault();
		clearFilter();
		return;
	} else if (dom.filter == document.activeElement) return false;

	switch (e.which) {
		case 90:	// z
			zoom();
			return;
		case 88:	// x
			dom.crossfade.click();
			return;
		case 69:	// e
			dom.enqueue.click();
			return;
		case 82:	// r
			dom.random.click();
			return;
		case 83:	// s
			dom.share.click();
			return;
		case 76:	// l
			dom.lock.click();
			return;
		case 67:	// c
			if (!cfg.locked) clearPlaylist();
			return;
		case 70:	// f
			e.preventDefault();
			dom.filter.focus();
			return;
		case 61:	// = Firefox
		case 187:	// =
			e.preventDefault();
			audio[current].currentTime += 5;
			return;
		case 173:	// - Firefox
		case 189:	// -
			e.preventDefault();
			audio[current].currentTime -= 5;
			return;
		case 79:	// o
			stop();
			return;
		case 80:	// p
		case 32:	// space
			e.preventDefault();
			playPause();
			return;
		case 219:	// [
			previous();
			return;
		case 221:	// ]
			next();
			return;
	}
	return false;
}, false);
var
	debug = false,	// Show some debug messages in console
	defcover = 'music.png',	// Default cover image if none found
	deftitle = 'Music',	// Default page title
	nodupes = false,		// Don't add already played songs to playlist
	onlinepls = true,	// Show buttons to load/save playlists online
	whatsapp = true,	// Add button to share directly to WhatsApp
	whatsappmsg = 'Have a listen to',	// Default WhatsApp message

	folderdesc = 'Click: Expand/collapse (Enter)\nRClick: Enqueue (Shift-Enter)',
	songdesc = 'Click: Play/enqueue (Enter)\nRClick: Play next (Shift-Enter)',
	playlistdesc = '\n\nClick: Play now\nRClick: Find in library',
	addfolderdlg = 'Add this folder to playlist?',
	whatsappdlg = 'Your message via WhatApp (the url will be added at the end):',
	exportdlg = 'Playlist name:',
	overwritedlg = 'Playlist already exists. Overwrite?',
	prevpassdlg = '[Use previously set password]',
	passdlg = 'Enter password:',
	wrongpassdlg = 'Intruder alert!',
	noplaylists = 'No playlists available',
	errorsave = 'Error on saving:',
	clearplaylistdlg = 'Clear the playlist?',
	
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
		'share': get('share'),
		'shares': get('shares'),
		'lock': get('lock'),
		'folderuri': get('folderuri'),
		'songuri': get('songuri'),
		'a': get('a'),
		'clear': get('clear'),
		'playlist': get('playlist'),
		'library': get('library'),
		'filter': get('filter'),
		'time': get('time'),
		'tree': get('tree')
	};


	get('splash').className = 'show';
	title.textContent = deftitle;
	if (cfg.crossfade) dom.crossfade.className = 'on';
	if (cfg.enqueue) dom.enqueue.className = 'on';
	if (cfg.random) dom.random.className = 'on';
	if (cfg.locked) {
		document.body.className = 'locked';
		dom.lock.className = 'on';
		dom.lock.textContent = 'Unlock';
	}
	if (url.length > 1) dom.load.style.display = 'none';
	if (!onlinepls) dom.load.style.display = dom.save.style.display = 'none';
	if (whatsapp) dom.options.className = 'whatsapp';
	
	dom.cover.onload = function() { dom.cover.style.opacity = 1 }	// Flickering appearance of old cover src is Firefox bug
	
	window.addEventListener('touchstart', function() {
		window.addEventListener('touchend', function(e) {
			e.preventDefault();
		}, { once: true });
		window.addEventListener('touchmove', function(e) {
			onplaylist = dom.playlist.contains(e.targetTouches[0].target);
		}, { passive: true });
		document.documentElement.className = 'touch';
		dom.clear.style.display = 'initial';
	}, { once: true, passive: true });
	
	window.onunload = function() {
		if (ls) {
			localStorage.setItem('asymm_music', JSON.stringify(cfg));
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
		buildLibrary('', library, dom.tree);
		buildPlaylist();
		document.documentElement.className = '';
		get('splash').className = '';
		console.log('Song count: '+ songs.length +'\nhttps://github.com/ltGuillaume/MusicFolderPlayer');
	};
	document.body.appendChild(lib);
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
		if (audio[current].ended)	// For crossfade
			next();
	}
	
	a.ontimeupdate = function() {
		if (this == audio[current]) {
			dom.time.textContent = timeTxt(~~this.currentTime) +' / '+ timeTxt(~~this.duration);
			if (cfg.crossfade && !fade && (this.duration - this.currentTime) < 10) {
				var fading = current;
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
				current ^= 1;
				next();
			}
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
			li.onclick = function(e) { openFolder(e) };
			li.oncontextmenu = function(e) { addFolder(e) };
			li.tabIndex = 1;
			li.title = folderdesc;
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
				li.onclick = function(e) { addSong(e) };
				li.oncontextmenu = function(e) { addSongNext(e) };
				li.tabIndex = 1;
				li.title = songdesc;
				songs.push(li);
				element.appendChild(li);
			}
		}
	}
}

function openFolder(e) {
	e.stopPropagation();
	var open, li = e.target, dim = (li.className.indexOf('dim') != -1 ? ' dim' : '');
	if (li.className.indexOf('filtered') != -1 || li.className.indexOf('parent') != -1) {
		li.querySelectorAll('ul > *').forEach(function(f) {
			if (f.style.display != '') f.style.display = '';
			else if (!open) open = f;
		});
		li.className = 'open folder'+ dim;
	} else {
		li.className = (li.className.indexOf('open') != -1 ? 'folder' : 'open folder') + dim;
	}
	setFocus(li, (li.className.indexOf('open') != -1 ? 'open' : 'close'));
	if (audio[current].paused) fillShare(li.path +'/');
}

function addFolder(e) {
	e.preventDefault();
	e.stopPropagation();
	var li = e.target;
	if (confirm(addfolderdlg +'\n'+ li.path.substring(li.path.lastIndexOf('/') + 1))) {
		li.className += ' dim';
		li.querySelectorAll('li.song').forEach(function(f, i) {
			add(f.id);
			f.className += ' dim';
		});
	}
}

function setFocus (el, direction) {
	el.focus();
	const { top, bottom } = el.getBoundingClientRect();
	if (top < 0 || bottom > (window.innerHeight || document.documentElement.clientHeight))
		el.scrollIntoView({
			block: (direction == 'left' || direction == 'open' ? 'start' : 'nearest'),
			behavior: 'smooth'
		});
}

function addSong(e) {
	e.stopPropagation();
	var li = e.target;
	if (cfg.enqueue || cfg.locked)
		add(li.id);
	else
		load(li.id);
	li.className += ' dim';
	if (audio[current].paused) fillShare(li.path);
}

function addSongNext(e) {
	e.preventDefault();
	e.stopPropagation();
	var li = e.target;
	add(li.id, true);
	li.className += ' dim';
	if (audio[current].paused) fillShare(li.path);
}

function buildPlaylist() {
	if (cfg.playlist.length == 0 || url.length > 1) return;	// Only rebuild saved playlist for main library
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
	li.draggable = 'true',
	li.onclick = function (e) { playItem(e) };
	li.oncontextmenu = function(e) { findItem(e) };
	li.ondragstart = function(e) { prepareDrag(e) };
	li.ondragenter = function() { this.classList.add('over') };
	li.ondragleave = function() { this.classList.remove('over') };
	li.ondragover = function (e) { allowDrop(e) };
	li.ondragend = function() { endDrag() };
	li.ondrop = function(e) { dropItem(e) };
	if (s.id == 'last') {
		li.id = 'last';
	} else {
		li.innerHTML = getSong(s.path) +'<span class="dim">'+ getArtist(s.path) +'</span>';
		li.title = getFolder(s.path) + playlistdesc;
	}
	return li;
}

function playItem(e) {
	if (!cfg.locked) play(getIndex(e.target));
}

function findItem(e) {
	e.preventDefault();
	var s = (e.target.tagName.toLowerCase() != 'li' ? e.target.parentNode : e.target);
	setFilter(s.firstChild.textContent);
}

function prepareDrag(e) {
	e.stopPropagation();
	if (cfg.locked) return;
	dom.clear.className = 'drag';
	dom.clear.textContent = '';
	dom.playlist.appendChild(playlistItem({ 'id': 'last' }));
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

function dropItem(e) {
	e.preventDefault();
	e.stopPropagation();
	var to = e.target;
	if (to.tagName.toLowerCase() != 'li') to = to.parentNode;
	log('Drag '+ drag.innerHTML +' to place of '+ to.innerHTML);
	to.classList.remove('over');
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
}

function getIndex(li) {
	if (li.id == 'last')	// Temporary last item for dragging
		return cfg.playlist.length;
	return Array.prototype.indexOf.call(li.parentNode.children, li);
}

function fillShare(path) {
	if (path.endsWith('/')) {
		dom.folderuri.value = dom.songuri.value = url[0] +'?play='+ esc(root + path);
	} else {
		dom.folderuri.value = url[0] +'?play='+ esc(root + path.substring(0, path.lastIndexOf('/')));
		dom.songuri.value = url[0] +'?play='+ esc(root + path);
	}
}

function esc(s) {
	return s.replace(/\/+$/, '').replace(/[(\?=&# ]/g, function(char) { return escape(char) });
}

function getFolder(path) {
	if (path.indexOf('/') == -1 && url.length > 1)
		path = root;
	return path.substring(path.lastIndexOf('/', path.lastIndexOf('/') - 1) + 1, path.lastIndexOf('/'));
}

function getArtist(path) {
	var artist = getFolder(path);
	artist = artist.substring(0, artist.indexOf(' -'));
	return (artist.length > 0 ? ' ('+ artist +')' : '');
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

function next(e) {
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
		if (cfg.after == 'randomlibrary' || cfg.locked) {
			var next;
			do { next = ~~((Math.random() * songs.length)) }
				while (played.indexOf(next.toString()) != -1);
			load(songs[next].id);
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

function download(type) {
	var uri = (type == 'f' ? dom.folderuri.value : dom.songuri.value);
	if (uri) {
		dom.a.href = 'music.php?dl='+ uri.substring(uri.indexOf('?play=') + 6);
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
		msg = prompt(whatsappdlg, whatsappmsg);
		whatsappmsg = (msg ? msg : '');
		window.open('https://api.whatsapp.com/send?text='+ whatsappmsg +' '+ encodeURIComponent(share.value));
	}
}

function getPlaylists() {
	var xhttp = new XMLHttpRequest();
	xhttp.onload = function() {
		playlists = JSON.parse(this.responseText);
		log(playlists);
		var playlistElements = '';
		if (playlists.length != []) {
			for (p in playlists) {
				playlistElements += '<button class="add">'+ p +'</button>';
			}
		} else playlistElements = '&nbsp;'+ noplaylists +'&nbsp;';
		dom.playlists.innerHTML = playlistElements;
		dom.playlists.style.display = 'block';
	};
	xhttp.open('GET', 'music.php?pl', true);
	xhttp.send();
}

function loadPlaylist(e) {
	if (e.target.className == 'on') return;
	e.target.className = 'on';
	var items = JSON.parse(playlists[e.target.textContent]);
	for (i in items)
		cfg.playlist.push(items[i]);
	buildPlaylist();
}

function savePlaylist() {
	var name = prompt(exportdlg)
	if (name) name = name.replace(/[\\\/:*?"<>|]/g, ' ');
	if (name) {
		for (pl in playlists)
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
			for (i in items)
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

function add(id, next) {
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
		i++;
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
	
	title.textContent = getSong(path) + getArtist(path);
	fillShare(path);
}

function toggle(e) {
	var button = (e.target.tagName.toLowerCase() == 'u' ? e.target.parentNode : e.target);
	switch(button.id) {
		case 'playlistbtn':
			if (cfg.locked) return;
			dom.playlists.style.display = 'none';
			dom.afteroptions.style.display = 'none';	// Continue
		case 'share':
			if (button.className == 'on') {
				dom.options.className = dom.options.className.replace(' '+ button.id, '');
				button.className = '';
			} else {
				dom.options.className += ' '+ button.id;
				button.className = 'on';
			}
			return;
		case 'stopplayback':
		case 'repeatplaylist':
		case 'playlibrary':
		case 'randomlibrary':
			if (!cfg.locked) {
				cfg.after = button.id;
				dom.afteroptions.style.display = 'none';
				menu('after');
			}
			return;
		case 'lock':
			return toggleLock();
		case 'crossfade':
			if (!audio[1]) {
				audio[1] = new Audio();
				prepAudio(audio[1]);
			}
			fade = null;	// Continue
		default:
			if (!cfg.locked) {
				cfg[button.id] ^= true;
				button.className = (cfg[button.id] ? 'on' : '');
			}
		}
}

function toggleLock() {
	if (!password()) return;
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
				getPlaylists();
				break;
			case dom.afteroptions:
				dom.stopplayback.className = (cfg.after == 'stopplayback' ? 'on' : '');
				dom.repeatplaylist.className = (cfg.after == 'repeatplaylist' ? 'on' : '');
				dom.playlibrary.className = (cfg.after == 'playlibrary' ? 'on' : '');
				dom.randomlibrary.className = (cfg.after == 'randomlibrary' ? 'on' : '');
				el.style.display = 'block';
		}
	} else el.style.display = 'none';
}

function clearPlaylist() {
	if (cfg.playlist.length > 0 && confirm(clearplaylistdlg)) {
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
	if (cfg.playlist.length > 7) {
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
			f.className = 'folder'+ (f.className.indexOf('dim') != -1 ? ' dim' : '');
	});
	
	if (clear != '') {
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
						f.className = 'folder open filtered'+ (f.className.indexOf('dim') != -1 ? ' dim' : '');
					} else f.className = 'folder filtered'+ (f.className.indexOf('dim') != -1 ? ' dim' : '');
				}
				
				for (var p = f.parentNode; p && p !== dom.tree; p = p.parentNode) {
					if (p.style.display != '')
						p.style.display = '';
					if (p.className.indexOf('folder') != -1)
						p.className = 'folder open'+
							(p.className.indexOf('filtered') != -1 ? ' filtered' : '')
							+' parent'
							+ (p.className.indexOf('dim') != -1 ? ' dim' : '');
				}
			}
		});
	}
	
	keyNav(null, 'down');
}

function setFilter(f) {
	if (typeof f === 'string')
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
	
	if (e.which == 27) {	// esc
		e.preventDefault();
		clearFilter();
		return;
	} else if (el == dom.filter) return false;

	
	switch (e.keyCode) {
		case 90:	// z
			zoom();
			break;
		case 61:	// = Firefox
		case 187:	// =
			e.preventDefault();
			audio[current].currentTime += 5;
			break;
		case 173:	// - Firefox
		case 189:	// -
			e.preventDefault();
			audio[current].currentTime -= 5;
			break;
		case 48:	// 0
			stop();
			break;
		case 32:	// space
			e.preventDefault();
			e.target.blur();
			playPause();
			break;
		case 219:	// [
			previous();
			break;
		case 221:	// ]
			next(e);
			break;
		case 69:	// e
			dom.enqueue.click();
			break;
		case 82:	// r
			dom.random.click();
			break;
		case 79:	// o
			dom.crossfade.click();
			break;
		case 80:	// p
			dom.playlistbtn.click();
			break;
		case 68:	// d
			if (!onlinepls || url.length > 1) return;
			if (dom.options.className.indexOf('playlist') == -1 )
				dom.playlistbtn.click();
			menu('load');
			break;
		case 86:	// v
			if (onlinepls) savePlaylist();
			break;
		case 73:	// i
			importPlaylist();
			break;
		case 88:	// x
			exportPlaylist();
			break;
		case 65:	// a
			if (dom.options.className.indexOf('playlist') == -1 )
				dom.playlistbtn.click();
			menu('after');
			break;
		case 83:	// s
			dom.share.click();
			break;
		case 76:	// l
			dom.lock.click();
			break;
		case 67:	// c
			if (!cfg.locked) clearPlaylist();
			break;
		case 70:	// f
			e.preventDefault();
			dom.filter.focus();
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
		case 37:	// LeftArrow
			e.preventDefault();
			keyNav(el, 'left');
			break;
		case 39:	// RightArrow
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
			return false;
	}
}, false);
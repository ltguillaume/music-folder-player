<?php
	error_reporting(0);

	header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
	header('Cache-Control: post-check=0, pre-check=0', false);
	header('Pragma: no-cache');

	$ini = parse_ini_file('music.defaults.ini', true, INI_SCANNER_RAW);
	if (file_exists('music.ini'))
		$ini = ini_merge($ini, parse_ini_file('music.ini', true, INI_SCANNER_RAW));

	$cfg = $ini['server'];
	$ext = explode(',', $cfg['ext_songs'] .','. $cfg['ext_images']);
	$img = explode(',', $cfg['ext_images']);

	if (isset($_GET['lng']))
		$lngcode = $_GET['lng'];
	else {
		$langs = explode(',', $_SERVER['HTTP_ACCEPT_LANGUAGE']);
		foreach($langs as $lang) {
			$lngcode = substr($lang, 0, 2);
			if (file_exists('music.lang.'. $lngcode .'.ini'))
				break;
		}
	}

	$lng = parse_ini_file('music.lang.en.ini', true, INI_SCANNER_RAW);
	$lngfile = 'music.lang.'. $lngcode .'.ini';
	if ($lngcode != 'en' && file_exists($lngfile))
		$lng = ini_merge($lng, parse_ini_file($lngfile, true, INI_SCANNER_RAW));

	if (isset($_GET['dl']) && !in_array('..', explode('/', $_GET['dl']))) {
		$dl = urldecode(trim($_GET['dl'], '/'));
		if (is_dir($dl)) {
			if (!chdir($dl)) die('Could not open folder: '. $dl);
			return_zip($dl, ['.'], false);
		} elseif (file_exists($dl)) {
			header('Content-Disposition: attachment; filename="'. basename($dl) .'"');
			header('Content-Length: '. filesize($dl));
			header('Content-Type: '. mime_content_type($dl));
			readfile($dl);
			exit;
		} else die('File not found: '. $dl);
	} elseif (isset($_GET['dlpl'])) {
		$plname = urldecode($_GET['dlpl']);
		$plfile = $cfg['playlistdir'] .'/'. $plname .'.mfp.json';
		if (!file_exists($plfile)) die('Playlist not found: '. $plfile . PHP_EOL);
		$pl = json_decode(json_decode(file_get_contents($plfile)));
		if (is_object($pl)) $pl = $pl->playlist;
		$files = array();
		$filenames = '';
		foreach($pl as $song) {
			$path = $cfg['root'] .'/'. $song->path;
			if (!file_exists($path)) die('Song not found: '. $path . PHP_EOL);
			array_push($files, $path);
			$filenames .= basename($song->path) ."\r\n";
		}
		$m3u = sys_get_temp_dir() .'/'. $plname .'.m3u';
		if (!file_put_contents($m3u, $filenames)) $m3u = false;
		return_zip($plname, $files, $m3u);
	} elseif (isset($_GET['pl'])) {
		$playlists = array();
		if (is_dir($cfg['playlistdir'])) {
			$scan = scandir($cfg['playlistdir']);
			foreach ($scan as $f)
				if (substr($f, -8) == 'mfp.json')
					$playlists[substr($f, 0, -9)] = json_decode(file_get_contents($cfg['playlistdir'] .'/'. $f));
		}
		die(json_encode($playlists));
	}

	$pl = json_decode(file_get_contents('php://input'), true);
	if (isset($pl['name'])) {
		if ($_SERVER['REQUEST_METHOD'] == 'DELETE') {
			if (chdir($cfg['playlistdir']))
				foreach (glob($pl['name'] .'.mfp.*') as $f)
					unlink($f);
			exit;
		}
		$name = $cfg['playlistdir'] .'/'. $pl['name'] .'.mfp.json';
		if (!is_dir($cfg['playlistdir'])) mkdir($cfg['playlistdir']);
		if (file_exists($name)) rename($name, $name .'.'. time());
		die(file_put_contents($name, json_encode($pl['songs'])));
	}

	header('Content-Type: application/javascript; charset=utf-8');

	if (!isset($_GET['reload'])) {
		echo 'const ext_images = '. json_encode($img) .';'. PHP_EOL;
		foreach($ini['client'] as $key => $value)
			echo (stristr($key, '.') ? '' : 'const ') . $key .'='. $value .';'. PHP_EOL;
		foreach($lng['elements'] as $key => $value)
			echo 'lng(dom.'. $key .',"'. $value .'");'. PHP_EOL;
		foreach($lng['tooltips'] as $key => $value)
			echo 'lng(dom.'. $key .',"'. $value .'",1);'. PHP_EOL;
		foreach($lng['strings'] as $key => $value)
			echo 'str[\''. $key .'\']="'. $value .'";'. PHP_EOL;
	}

	$dir = $cfg['root'];
	if (isset($_GET['play']) && !in_array('..', explode('/', $_GET['play']))) {
		$dir = trim($_GET['play'], '/');
		if (!file_exists($dir) || $dir == $cfg['root'])
			die('const root="'. $cfg['root'] .'/";'. PHP_EOL .'var library={"'. $lng['strings']['notfound'] .'":""}');
		if (!is_dir($dir)) {
			$files = array();
			$files[$dir] = '';	// Add file
			$scan = scandir(dirname($dir));	// Scan parent folder for cover
			foreach ($scan as $f) {
				$ext = strtolower(substr($f, strrpos($f, '.') + 1));
				if (in_array($ext, $img)) {
					$files[$f] = '';
					break;
				}
			}
			echo 'const root="";'. PHP_EOL .'var library={"\/":'. json_encode($files) .'};';
			exit;
		}
	}

	$lib_path = $cfg['playlistdir'] .'/library.json';
	if (!$cfg['cache'] || isset($_GET['play']) || isset($_GET['reload']) || !file_exists($lib_path)) {
		$lib = json_encode(tree($dir, 0));
		if ($cfg['cache'] && !isset($_GET['play'])) {
			if (!is_dir($cfg['playlistdir'])) mkdir($cfg['playlistdir']);
			file_put_contents($lib_path, $lib);
		}
	} else $lib = file_get_contents($lib_path);

	echo (isset($_GET['reload']) ? '' : 'const root="'. $dir .'/";'). PHP_EOL .'var library='. $lib;

	function ini_merge($ini, $usr) {
		foreach ($usr as $k => $v)
			if (is_array($v))
				$ini[$k] = ini_merge($ini[$k], $usr[$k]);
			else
				$ini[$k] = $v;
		return $ini;
	}

	function tree($dir, $depth) {
		$scan = scandir($dir);
		$files = array();
		$tree = array();
		$hasmusic = false;

		foreach ($scan as $f) {
			if (substr($f, 0, 1) == '.')
				continue;
			if (is_dir("$dir/$f")) {
				if ($depth < $GLOBALS['cfg']['maxdepth']) {
					$subfolder = tree("$dir/$f", $depth + 1);
					if ($subfolder)
						$tree[$f] = $subfolder;
				}
			} else {
					$ext = strtolower(substr($f, strrpos($f, '.') + 1));
					if (in_array($ext, $GLOBALS['ext'])) {
						$files[$f] = '';
						if (!in_array($ext, $GLOBALS['img']))
							$hasmusic = true;
					}
			}
		}

		if ($hasmusic)
			$tree['/'] = $files;
		if (count((array) $tree) > 0)
			return $tree;
		else
			return false;
	}

	function return_zip($name, $paths, $pl) {
		$list_path = tempnam(sys_get_temp_dir(), 'mfp_');
		$list = fopen($list_path, 'w');
		if (substr(php_uname(), 0, 7) == 'Windows') {
			foreach($paths as $path) fwrite($list, ($pl ? './' : '') . $path ."\r\n");
			$cmd = '7z a dummy -tzip -mx1 -so -i@'. escapeshellarg($list_path);
		} else {
			foreach($paths as $path) fwrite($list, $path ."\n");
			$cmd = 'zip - -0 '. ($pl ? '-j' : '-r') .' -@ <'. escapeshellarg($list_path);
		}
		if ($pl) fwrite($list, $pl);
		fclose($list);
		$descriptorspec = array(array('pipe', 'r'), array('pipe', 'w'), array('pipe', 'a'));
		$zip_proc = proc_open($cmd, $descriptorspec, $pipes);
		if (!$zip_proc) die('Error creating zip');
		header('Content-type: application/zip');
		header('Content-disposition: attachment; filename="'. basename($name) .'.zip"');
		$err = fread($pipes[2], 8192);
		fpassthru($pipes[1]);
		fclose($pipes[2]);
		fclose($pipes[1]);
		fclose($pipes[0]);
		$res = proc_close($zip_proc);
		if ($res != 0) {
			error_log('zip error ('. $res .'): '. $err . PHP_EOL);
			http_response_code(500);
		}
		if ($pl) unlink($pl);
		unlink($list_path);
		exit;
	}
?>
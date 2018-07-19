<?php
	$root = 'library';	// Music folder path, relative to this file
	$maxdepth = 10;		// Maximum recursive folder depth
	$ext = array('jpg','png','aac','fla','flac','m4a','mp3','mp4','ogg','opus','wav');
	$img = array('jpg','png');
	
	if (isset($_GET['dl']) && !in_array('..', explode('/', $_GET['dl']))) {
		$dl = urldecode(trim($_GET['dl'], '/'));
		if (is_dir($dl)) {
			chdir(urldecode($dl));
			$fp = popen('zip -0 -j - *', 'r');	// Or 'zip -0 -r - .' for recursive
			header('Content-type: application/zip');
			header('Content-disposition: attachment; filename="'. basename($dl) .'.zip"');
			fpassthru($fp);
			pclose($fp);
			exit;
		} elseif (file_exists($dl)) {
			header('Content-type: '. mime_content_type($dl));
			header('Content-Disposition: attachment; filename="'. basename($dl) .'"');
			readfile($dl);
			exit;
		} else die('File not found');
	}

	header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
	header('Cache-Control: post-check=0, pre-check=0', false);
	header('Pragma: no-cache');
	header('Content-Type: application/javascript; charset=utf-8');

	$dir = $root;
	if (isset($_GET['play']) && !in_array('..', explode('/', $_GET['play']))) {
		$dir = trim($_GET['play'], '/');
		if (!is_dir($dir)) {
			$files = array();
			$files[$dir] = '';	// Add file
			$scan = scandir(dirname($dir));	// Scan parent folder for cover
			foreach ($scan as $f) {
				$ext = strtolower(substr($f, strrpos($f, '.') + 1));
				if (in_array($ext, $GLOBALS['img'])) {
					$files[$f] = '';
					break;
				}
			}
			echo 'var root=""; var library={"\/":'. json_encode($files) .'};';
			exit;
		}
	}
	
	echo 'var root="'. $dir .'/"; var library='. json_encode(tree($dir, 0));

	function tree($dir, $depth) {
		$scan = scandir($dir);
		$files = array();
		$tree = array();
		$hasmusic = false;
		
		foreach ($scan as $f) {
			if (substr($f, 0, 1) == '.')
				continue;
			if (is_dir("$dir/$f")) {
				if ($depth < $GLOBALS['maxdepth']) {
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
?>
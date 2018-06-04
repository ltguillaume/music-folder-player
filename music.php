<?php
	$dir = 'library';	// Music folder path, relative to this file
	$maxdepth = 10;		// Maximum recursive folder depth
	$ext = array('aac','fla','flac','m4a','mp3','mp4','ogg','opus','wav','jpg','png');
	
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

	header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
	header("Cache-Control: post-check=0, pre-check=0", false);
	header("Pragma: no-cache");
	header("Content-Type: application/javascript; charset=utf-8");
?>
var library=<?php
	if (isset($_GET['root']) && !in_array('..', explode('/', $_GET['root']))) {
		$root = trim($_GET['root'], '/');
		if (!is_dir($root)) {
			$files = new stdClass();
			$files->{$root} = '';
			$scan = scandir(dirname($root));
			foreach ($scan as $f) {
				$ext = strtolower(substr($f, strrpos($f, '.') + 1));
				if ($ext == 'jpg' || $ext == 'png') {
					$files->{$f} = '';
					break;
				}
			}
			echo '{"\/":'. json_encode($files) .'}';
			echo ";\nvar dir='';";
			exit;
		} else
			$dir = $root;
	}
	
	function tree($dir, $depth) {
		$scan = scandir($dir);
		$files = array();
		$tree = array();
		
		foreach ($scan as $f) {
			if (substr($f, 0, 1) == '.')
				continue;
			if (is_dir("$dir/$f")) {
				if ($depth < $GLOBALS['maxdepth']) {
					$subfolder = tree("$dir/$f", $depth + 1);
					if ($subfolder)
						$tree[$f] = $subfolder;
				}
			} elseif (in_array(strtolower(substr($f, strrpos($f, '.') + 1)), $GLOBALS['ext']))
					$files[$f] = '';
		}
		
		if (count((array) $files) > 0)
			$tree['/'] = $files;
		if (count((array) $tree) > 0)
			return $tree;
		else
			return false;
	}
	
	$timeBefore = microtime(true);
	echo json_encode(tree($dir, 0));
?>;
var loadtime=<?=(microtime(true) - $timeBefore)?>;
var dir='<?=$dir?>/';
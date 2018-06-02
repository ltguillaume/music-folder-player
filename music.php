var library=<?php
	header("content-type: application/javascript; charset=utf-8");
	$dir = 'library';
	$ext = array('aac','fla','flac','m4a','mp3','mp4','ogg','opus','wav','jpg','png');
	
//	if (isset($_GET['root']) && !in_array('..', explode('/', $_GET['root'])))
//		$dir .= '/'. $_GET['root'];
	
	function tree($dir, $depth) {
		$scan = scandir($dir);
		$files = new stdClass();
		$tree = new stdClass();
		
		foreach ($scan as $f) {
			if (substr($f, 0, 1) == '.')
				continue;
			if (is_dir("$dir/$f")) {
				if ($depth < 10) {
					$subfolder = tree("$dir/$f", $depth + 1);
					if ($subfolder)
						$tree->{$f} = $subfolder;
				}
			} elseif (in_array(strtolower(substr($f, strrpos($f, '.') + 1)), $GLOBALS['ext']))
					$files->{$f} = '';
		}
		
		if (count((array) $files) > 0)
			$tree->{'/'} = $files;
		if (count((array) $tree) > 0)
			return $tree;
		else
			return false;
	}
	echo json_encode(tree($dir, 0));
?>;
var dir='<?=$dir?>/';
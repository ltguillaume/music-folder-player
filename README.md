# Music Folder Player
An elegant HTML5 web folder player for parties and/or private music collections

## Overview
- Rebuilds the tree of known music files for a specified folder
- Click to play directly, while keeping the playlist intact
- Enable "Enqueue" mode and click to add to bottom of playlist
- Filter the library to quickly find songs
- Automatically continue playing when playlist is exhausted (continue from last song, or shuffle)
- Shuffle without repeating already played songs
- Do not add the same song twice
- Do not add already played songs to playlist (optional)
- Click on cover image to zoom
- Click on song or folder name to find in library
- Save playlist and configuration to browser's Local Storage

## List of hotkeys
Hotkey | Command
:---: |---
Space | Play/pause
0 | Stop playback (time to 0:00)
\- | Skip backward
\+ | Skip forward
E | Toggle enqueue
S | Toggle shuffle
C | Clear playlist
F | Focus library filter
Esc | Reset library filter

![Screenshot](SCREENSHOT.png)

## Installation
1. Put all `music.*` files into a folder on your web server
2. Optionally rename `music.htm` to `index.html`
3. Edit `music.php` so that the variable `$dir` corresponds with your music folder
4. Edit the variables at the top of `music.js`

## Credits
- Parts of this little project are heavily based on the excellent [HTML5 Music Player](https://github.com/GM-Script-Writer-62850/HTML5-Music-Player) by [GM-Script-Writer-62850](https://github.com/GM-Script-Writer-62850)
- The [Foundation icon font](https://zurb.com/playground/foundation-icon-fonts-3) is used

All credits are due, as well as my sincere thanks!

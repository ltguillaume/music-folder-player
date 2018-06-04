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
- Download a song or zipped folder (only tested on ArchLinux)
- Share a song or folder link
- Try sharing link directly to WhatsApp on mobile devices (optional)
- Save playlist and configuration to browser's Local Storage
- Design should be fully responsive on CSS3-compatible browser

## List of hotkeys
Hotkey | Command
:---: |---
0 | Stop playback (time to 0:00)
Space | Play/pause
\- | Play previous
\+ | Play next
E | Toggle enqueue
R | Toggle random
S | Toggle share dialog
C | Clear playlist
F | Focus library filter
Esc | Reset library filter

![Screenshot](SCREENSHOT.png)

## Installation
1. Put all `music.*` files into a folder on your web server
2. Have zip present on your web server
3. Optionally rename `music.htm` to `index.html`
4. Edit `music.php` so that the variable `$dir` corresponds with your music folder
5. Edit the variables at the top of `music.js`

## Credits
- Parts of this little project are heavily based on the excellent [HTML5 Music Player](https://github.com/GM-Script-Writer-62850/HTML5-Music-Player) by [GM-Script-Writer-62850](https://github.com/GM-Script-Writer-62850)
- The [Foundation icon font](https://zurb.com/playground/foundation-icon-fonts-3) is used

All credits are due, as well as my sincere thanks!

# Music Folder Player
An elegant HTML5 web folder player for parties and/or private music collections. It does not use a database (so it's alway up-to-date), but can easily handle folders with 25,000 songs or more. It has no dependencies other than PHP and installation costs less than 2 minutes. The design should be fully responsive on CSS3-compatible browsers.

![Screenshot](SCREENSHOT.png)

## Overview
#### Playback
- Rebuilds the tree of known music files for a specified folder
- Click to play directly keeps the rest of the playlist intact
- Click on cover image to zoom (full size, click again for 300x300px)
- Click on song or folder name to find in library
- Filter the library to quickly find songs
#### Playlist
- Enable "Enqueue" mode to add songs to the bottom of the playlist
- Drag and drop to change the playlist order or remove a song
- Automatically continue playing from library when playlist is exhausted (continuing from last song, or at random)
- Random playback will prevent choosing already played songs
- Click on a song to play directly
- Right-click a song to find in library
- Playlist and configuration will be saved to the browser's Local Storage if possible.
#### Library
- Right-click a folder to add all its songs to the playlist
- Click a song to play or enqueue (when "Enqueue" mode is enabled)
- Right-click a song to play next (enqueue right after currently playing song)
#### Parties
- Password lock the playlist and playlist controls (only enqueue and play/pause work)
- Tip: use [OpenKiosk](openkiosk.mozdevgroup.com) and disable _Set inactive terminal_
- Prevent adding a song if it's already queued up
- Do not add already played songs to playlist (optional setting in music.js)
#### Sharing
- Download a song or zipped folder (only tested on a Linux server)
- Share a song or folder link
- Import/export the playlist
- Share links directly to WhatsApp (optional)

## List of hotkeys
Hotkey | Command
:---: |---
Z | Zoom cover image
O | Stop playback (time to 0:00)
P or Space | Play/pause
\[ | Play previous
\] | Play next
\- | Jump back 5s
\+ | Jump forward 5s
E | Toggle enqueue
R | Toggle random
X | Toggle crossfade
S | Toggle share dialog
L | Lock/unlock playlist and playback controls
C | Clear playlist
F | Focus library filter
Esc | Reset library filter

## Installation
1. Put all `music.*` files into a folder on your web server
2. Have zip present on your web server
3. Optionally rename `music.htm` to `index.html`
4. Edit `music.php` so that the variable `$root` corresponds with your music folder
5. Edit the variables at the top of `music.js`

## Credits
- Parts of this little project are heavily based on the excellent [HTML5 Music Player](https://github.com/GM-Script-Writer-62850/HTML5-Music-Player) by [GM-Script-Writer-62850](https://github.com/GM-Script-Writer-62850)
- The [Foundation icon font](https://zurb.com/playground/foundation-icon-fonts-3) is used
- Album art placeholder is based on a [design by CmdRobot](http://fav.me/d7kpm65)

All credits are due, as well as my sincere thanks!
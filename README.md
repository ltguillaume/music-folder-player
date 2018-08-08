# Music Folder Player
An elegant HTML5 web folder player for parties and/or private music collections, with a playlist system that all players should have had. It does not use a database (so it's alway up-to-date), but can easily handle folders with 25,000 songs or more. It has no dependencies other than PHP and installation costs less than 2 minutes. The design should be fully responsive on CSS3-compatible browsers.

![Screenshot](SCREENSHOT.png)

## Overview
#### Player
- Rebuilds the tree of a specified folder, showing only supported music files
- Suggested folder structure: `Artist - (Year) Album/Track - Title.ext` (i.e. filename should contains track title, direct parent folder should contain artist and album title)
- Clicking to play a song directly will keep the rest of the playlist intact
- Click on cover image to zoom (full size, click again for 300x300px)
- Click on song or folder name to find it in the library
#### Playlist
- Drag and drop to change the playlist order or drag to bin to remove a song
- Random playback will prevent choosing already played songs (unless "Play next" is chosen)
- Click on a song to play directly
- Right-click (long-press) a song to find it in the library
- Choose how to continue when the playlist is exhausted:
	- Stop playback
	- Repeat the playlist
	- Continue from last song's position in library
	- Randomly select unplayed songs from the library
- Playlist and configuration will be saved to the browser's Local Storage if possible
- Load/save online playlists
- Import/export playlists from/to a local file
#### Library
- Filter the library to quickly find songs
- Click a song to play (or enqueue when "Enqueue" mode is enabled)
- Right-click (long-press) a song to play it next
- Right-click (long-press) a folder to add all its songs to the playlist
- Use arrow keys to traverse the library tree, Enter to play/enqueue, or Shift-Enter to play next
#### Parties
- Password lock the playlist and playlist controls (allowing only Enqueue, Play next, Play/pause and Share)
- Tip: use [OpenKiosk](http://openkiosk.mozdevgroup.com) and disable _Set inactive terminal_
- Prevents adding a song if it's already queued up
- Do not add previously played songs to playlist (optional setting in music.js)
#### Sharing
- Download a song or zipped folder (only tested on a Linux server)
- Share a song or folder link
- Share links directly to WhatsApp (optional)

## List of hotkeys
Hotkey | Command
:---: |---
Z | Zoom cover image (full size, 300px)
0 | Stop playback (time to 0:00)
Space | Play/pause
\[ | Play previous
\] | Play next
\- | Jump back 5s
\+ | Jump forward 5s
E | Toggle "Enqueue songs on click"
R | Toggle "Randomize upcoming playlist items"
O | Toggle "Crossfade between songs"
P | Toggle "Playlist options"
S | Toggle "Share or download current song or folder"
L | Toggle "Lock playlist and playback controls"
D | Load playlist: Add songs from saved playlist
V | Save playlist: Save playlist online
I | Import playlist: Add songs from exported playlist
X | Export current playlist to file
A | Define action after last playlist item
C | Clear playlist
F | Focus library filter
Esc | Reset library filter
Arrow keys | Navigate library tree
Enter | Play/Add to playlist
Shift-Enter | Play song next/Add folder to playlist

## Installation
1. Put `music.*` into a folder on your web server
2. For online playlists, make sure the user (e.g. `http`) used by PHP has write permissions for the folder `music.pls` (or disable online playlists in `music.js`)
3. For downloading folders, install zip on your server
4. Edit `music.php` so that the variable `$root` corresponds with your music folder, relative to the folder with `music.*` (you could create a symbolic link here to a folder elsewhere).
5. Edit the variables at the top of `music.js`
6. Optionally rename `music.htm` to `index.html`

## Credits
- Parts of this little project are heavily based on the excellent [HTML5 Music Player](https://github.com/GM-Script-Writer-62850/HTML5-Music-Player) by [GM-Script-Writer-62850](https://github.com/GM-Script-Writer-62850)
- The [Foundation icon font](https://zurb.com/playground/foundation-icon-fonts-3) is used
- Album art placeholder is based on a [design by CmdRobot](http://fav.me/d7kpm65)

All credits are due, as well as my sincere thanks!
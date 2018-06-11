# Music Folder Player
An elegant HTML5 web folder player for parties and/or private music collections. It does not use a database (so it's alway up-to-date), but can easily handle folders with 25,000 songs or more. It has no dependencies other than PHP and installation costs less than 2 minutes. The design should be fully responsive on CSS3-compatible browsers.

## Overview
#### Playback
- Rebuilds the tree of known music files for a specified folder
- Click to play directly, while keeping the playlist intact
- Click on cover image to zoom
- Click on song or folder name to find in library
- Filter the library to quickly find songs
#### Playlist
- Enable "Enqueue" mode to add songs to the bottom of the playlist
- Drag and drop to change the playlist order or remove a song
- Automatically continue playing from library when playlist is exhausted (continuing from last song, or at random)
- Random playback will prevent choosing already played songs
- Playlist and configuration will be saved to the browser's Local Storage if possible.
#### Parties
- Password lock the playlist and playlist controls (only enqueue and play/pause work)
- Tip: use [OpenKiosk](openkiosk.mozdevgroup.com) and disable _Set inactive terminal_
- Prevent adding a song if it's already queued up
- Do not add already played songs to playlist (optional)
#### Sharing
- Download a song or zipped folder (only tested on a Linux server)
- Share a song or folder link
- Import/export the playlist
- Share links directly to WhatsApp (optional)


## List of hotkeys
Hotkey | Command
:---: |---
O | Stop playback (time to 0:00)
P or Space | Play/pause
\[ | Play previous
\] | Play next
\- | Jump back 5s
\+ | Jump forward 5s
E | Toggle enqueue
R | Toggle random
S | Toggle share dialog
L | Lock/unlock playlist and playback controls
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
- Album art placeholder is based on a [design by CmdRobot](http://fav.me/d7kpm65)

All credits are due, as well as my sincere thanks!
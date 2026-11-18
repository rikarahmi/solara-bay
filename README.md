# solara-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rikarahmi/solara-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rikarahmi/solara-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solara Bay** — an open-world crime game in the spirit of GTA 6, set in a sunset coastal city of its own. You are Dario Solis, a driver new in town, working five jobs for fixer Lena Marlowe: steal a car and bring it to Coral Plaza, run a package to Marina Row before the sun drops, get two stars of heat and lose them, haul a crate from Harbor Yard to Lighthouse Point, and finally outrun a four-star manhunt to the lighthouse lookout.

Explore the city on foot and by car. AI traffic cruises the road grid, pedestrians wander the sidewalks, parked cars can be stolen, and the Bay PD answers a wanted level (up to 5 stars) with chasing police cars. Combat is a punch up close and a shot at range. The HUD shows cash, wanted stars, health, speed, a mission objective with a compass arrow and distance, a timer, and a live minimap with traffic, police and the mission target. Start, pause, win and lose screens included, and progress saves to localStorage so you can continue later.

Controls: WASD / arrows to walk and drive · E enter or leave a car · F punch · Click shoot · Shift run · Mouse look · P pause · M mute · R restart mission. Sound and music are fully synthesised in WebAudio — engine hum, sirens, gunshots, chimes and a sunset pad — with no audio files and no network requests. The game is plain static files under `game/` (three.js vendored as `game/vendor/three.module.min.js`): open `index.html` in any desktop browser and play offline.

## Run it

```sh
node serve.ts
# open http://localhost:8080 in a desktop browser
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

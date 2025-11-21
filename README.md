# Map Path Finding — Korteste vej finder

Dette repository indeholder en lille Node/Express-backend og en simpel frontend (Leaflet) til at finde ruter på et vejnet hentet fra OpenStreetMap.

Kort oversigt
- `app.js` — Express-server, bygger graf (fra `storkbh_graph_name.json` eller via Overpass) og eksponerer `/api/route`.
- `public/index.html` — simpel frontend hvor du klikker to punkter for at få en rute.
- `test/test_dijkstra.js` — simple enhedstest for Dijkstra-varianterne.
- `bench/benchmark.js` — micro-benchmark for at sammenligne to Dijkstra-modes.

Krav
- Node.js (anbefalet v16+)
- Internetforbindelse første gang (for at hente vejdata fra Overpass API hvis `storkbh_graph_name.json` ikke findes)

Installation

1. Åbn en terminal i projektmappen `Map_Path_Finding_Exam`.
2. Installer afhængigheder:

```bash
npm install
```

Start applikationen

Serveren starter kun når du kører `app.js` direkte. Standardport er 8080, men du kan overstyre med miljøvariablen `PORT`.

```bash
# kør direkte
node app.js

# eller med port override
PORT=8080 node app.js

# alternativt (hvis du bruger nodemon) i dev
npx nodemon app.js
```

Bemærk: Første gang serveren starter og `storkbh_graph_name.json` ikke findes, henter den data fra Overpass API og gemmer grafen lokalt.

Frontend
- Åbn: http://localhost:8889 (eller den port du valgte)
- Klik to steder på kortet for at sætte start og slut.
- Vælg mode i dropdown:
  - `Udeluk...` (mode=`exclude`) — udelukker veje hvis navn matcher de angivne substrings (case-insensitivt) og minimerer geodetisk afstand.
  - `Minimer samlede længde af vejnavne` (mode=`shortestName`) — bruger længden af vejnavne som vægt og minimerer den samlede navnelængde.
- Du kan angive en komma-separeret liste af substrings i input-feltet for at sende `excludeNames` til serveren.

API

POST /api/route

Eksempel JSON-body:

```json
{
  "startLat": 55.676,
  "startLng": 12.568,
  "endLat": 55.68,
  "endLng": 12.57,
  "mode": "exclude",
  "excludeNames": ["amager"]
}
```

Response indeholder bl.a.: `path` (node id'er som "lat,lon"), `edges` (fra/to/distance/name), `visitedNodes` (array) og beregningstid `durationMs`.

Tests og benchmark

Kør enhedstests (enkeltstående script):

```bash
node test/test_dijkstra.js
# eller via npm
npm run test
```

Kør micro-benchmark:

```bash
node bench/benchmark.js
# eller via npm
npm run bench
```

Noter
- Hvis du har en allerede kørende server (nodemon eller lign.) der binder porten, stop den før du kører testskripter, ellers kan `require('./app')` forsøge at starte serveren og konflikte.
- Data i `storkbh_graph_name.json` kan være stor; slet filen for at tvinge en ny hentning fra Overpass.

Fejlfinding
- Hvis port er i brug: find processen og stop den, eller start serveren med en anden port.
- Hvis Overpass ikke svarer: vent eller reducer timeout i `fetchOSMRoads()` (kun aktuelt når graf skal hentes fra netværk).

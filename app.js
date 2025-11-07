const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());


const GRAPH_FILE = 'storkbh_graph.json';

// Haversine til afstand i meter
function haversine(lat1, lon1, lat2, lon2){
  const R = 6371e3;
  const φ1 = lat1*Math.PI/180;
  const φ2 = lat2*Math.PI/180;
  const Δφ = (lat2-lat1)*Math.PI/180;
  const Δλ = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

// Hent OSM veje (primære og sekundære) fra Storkøbenhavn
async function fetchOSMRoads() {
  console.log('Henter data fra Overpass API...');
  const query = `
    [out:json][timeout:2000];
    way["highway"]["highway"~"primary|secondary|tertiary|residential"](55.55,12.45,55.75,12.65);
    out geom;
  `;
  const res = await axios.get('https://overpass-api.de/api/interpreter', { params: { data: query }});
  return res.data.elements;
}

// Byg graf fra OSM-data
function buildGraph(osmWays){
  const graph = {};
  const nodeCoords = {};

  osmWays.forEach(way=>{
    const nodes = way.geometry;
    for(let i=0;i<nodes.length;i++){
      const {lat, lon} = nodes[i];
      const nodeId = `${lat},${lon}`;
      nodeCoords[nodeId] = {lat, lon};
      if(!graph[nodeId]) graph[nodeId] = {};

      if(i>0){
        const prev = nodes[i-1];
        const prevId = `${prev.lat},${prev.lon}`;
        const dist = haversine(lat, lon, prev.lat, prev.lon);
        graph[nodeId][prevId] = dist;
        graph[prevId][nodeId] = dist;
      }
    }
  });

  return {graph, nodeCoords};
}

// Find nærmeste node i grafen
function findNearestNode(lat, lng, nodeCoords){
  let nearest = null;
  let minDist = Infinity;
  for(let node in nodeCoords){
    const n = nodeCoords[node];
    const d = haversine(lat, lng, n.lat, n.lon);
    if(d < minDist){
      minDist = d;
      nearest = node;
    }
  }
  return nearest;
}

// Depth-First Search
function dfs(start, end, graph){
  const stack = [start];
  const visited = new Set();
  const cameFrom = {};
  const visitedNodes = new Set();

  while(stack.length > 0){
    const current = stack.pop();
    visitedNodes.add(current);

    if(current === end){
      let path = [];
      let temp = current;
      while(temp){
        path.unshift(temp);
        temp = cameFrom[temp];
      }
      return {path, visitedNodes:[...visitedNodes]};
    }

    if(visited.has(current)) continue;
    visited.add(current);

    for(let neighbor in graph[current]){
      if(!visited.has(neighbor)){
        stack.push(neighbor);
        if(!cameFrom[neighbor]) cameFrom[neighbor] = current;
      }
    }
  }
  return null;
}

// Simplified A* (heuristik = luftlinje)
function aStar(start, end, graph){
  const openSet = [start];
  const cameFrom = {};
  const gScore = {};
  const fScore = {};
  const visitedNodes = new Set();

  for(let node in graph){
    gScore[node] = Infinity;
    fScore[node] = Infinity;
  }
  gScore[start] = 0;
  fScore[start] = 0;

  while(openSet.length>0){
    let current = openSet.reduce((a,b)=>fScore[a]<fScore[b]?a:b);
    visitedNodes.add(current);

    if(current===end){
      let path = [];
      let temp = current;
      while(temp){
        path.unshift(temp);
        temp = cameFrom[temp];
      }
      return {path, visitedNodes:[...visitedNodes]};
    }

    openSet.splice(openSet.indexOf(current),1);

    for(let neighbor in graph[current]){
      let tentativeG = gScore[current]+graph[current][neighbor];
      if(tentativeG<gScore[neighbor]){
        cameFrom[neighbor]=current;
        gScore[neighbor]=tentativeG;
        fScore[neighbor]=tentativeG;
        if(!openSet.includes(neighbor)) openSet.push(neighbor);
      }
    }
  }
  return null;
}

function dijkstra(start, end, graph){
  const distances = {};
  const previous = {};
  const visitedNodes = new Set();
  const pq = new Map(); // simpel priority queue med Map

  // Initialiser
  for(let node in graph){
    distances[node] = Infinity;
    previous[node] = null;
  }
  distances[start] = 0;
  pq.set(start, 0);

  while(pq.size > 0){
    // find node med lavest distance
    let current = [...pq.entries()].reduce((a,b)=>a[1]<b[1]?a:b)[0];
    pq.delete(current);
    visitedNodes.add(current);

    if(current === end){
      let path = [];
      let temp = current;
      while(temp){
        path.unshift(temp);
        temp = previous[temp];
      }
      return {path, visitedNodes:[...visitedNodes]};
    }

    for(let neighbor in graph[current]){
      const weight = graph[current][neighbor] || 1; // vægt = 1 hvis ikke defineret
      const alt = distances[current] + weight;
      if(alt < distances[neighbor]){
        distances[neighbor] = alt;
        previous[neighbor] = current;
        pq.set(neighbor, alt);
      }
    }
  }

  return null; // ingen sti fundet
}

let graphData = null;

// Load graf fra fil eller hent fra Overpass
async function loadGraph() {
  if(fs.existsSync(GRAPH_FILE)){
    console.log('Loader graf fra fil...');
    graphData = JSON.parse(fs.readFileSync(GRAPH_FILE));
  } else {
    const osmWays = await fetchOSMRoads();
    graphData = buildGraph(osmWays);
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(graphData));
    console.log('Graf gemt lokalt.');
  }
}

// API endpoint
app.post('/api/route', async (req,res)=>{
  if(!graphData) await loadGraph();

  const {startLat, startLng, endLat, endLng, algorithm} = req.body;

  const startNode = findNearestNode(startLat, startLng, graphData.nodeCoords);
  const endNode = findNearestNode(endLat, endLng, graphData.nodeCoords);

  if(!startNode || !endNode){
    return res.json({error: 'Klik for langt fra veje i grafen.'});
  }

  const startTime = Date.now(); // start tid

  let result;
if(algorithm === 'dfs'){
  result = dfs(startNode, endNode, graphData.graph);
} else if(algorithm === 'dijkstra'){
  result = dijkstra(startNode, endNode, graphData.graph);
} else {
  result = aStar(startNode, endNode, graphData.graph);
}

  const endTime = Date.now(); // slut tid
  const durationMs = endTime - startTime;

  if(result && result.path){
    // Beregn distance i km
    let totalDist = 0;
    const pathNodes = result.path.map(n => n.split(',').map(Number));
    for(let i=0; i<pathNodes.length-1; i++){
      totalDist += haversine(pathNodes[i][0], pathNodes[i][1], pathNodes[i+1][0], pathNodes[i+1][1]);
    }
    totalDist = (totalDist/1000).toFixed(2); // km
    result.distanceKm = totalDist;
    result.durationMs = durationMs;
  }

  res.json(result);
});

// Serve frontend
app.use(express.static('public'));
app.get('/', (req,res)=>{
  res.sendFile(__dirname+'/public/index.html');
});


const PORT = 8080;

app.listen(PORT, ()=>console.log(`Server kører på http://localhost:`, PORT));

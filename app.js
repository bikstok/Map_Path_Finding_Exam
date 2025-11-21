const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

const GRAPH_FILE = 'storkbh_graph_name.json';

// Haversine distance
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

// Find nearest node
function findNearestNode(lat,lng,nodeCoords){
  let nearest = null;
  let minDist = Infinity;
  for(let node in nodeCoords){
    const n = nodeCoords[node];
    const d = haversine(lat,lng,n.lat,n.lon);
    if(d<minDist){
      minDist = d;
      nearest = node;
    }
  }
  return nearest;
}

// Dijkstra
// Dijkstra med unikke vejnavne
function dijkstra(start, end, graph){
  const distances = {};
  const previous = {};
  const visitedNodes = new Set();
  const pq = new Map();

  for(let node in graph){
    distances[node] = Infinity;
    previous[node] = null;
  }
  distances[start] = 0;
  pq.set(start, 0);

  while(pq.size > 0){
    let current = [...pq.entries()].reduce((a,b)=>a[1]<b[1]?a:b)[0];
    pq.delete(current);
    visitedNodes.add(current);

    if(current === end){
      let path = [];
      let edges = [];
      let temp = current;
      const seenNames = new Set(); // til at tracke allerede tilføjede vejnavne

      while(temp){
        const prev = previous[temp];
        if(prev){
          const edge = graph[prev][temp];
          // Tilføj kun hvis vejnavnet ikke er set før
          if(edge.name && !seenNames.has(edge.name)){
            edges.unshift({
              from: prev,
              to: temp,
              distance: edge.distance,
              name: edge.name
            });
            seenNames.add(edge.name);
          }
        }
        path.unshift(temp);
        temp = prev;
      }
      return { path, edges, visitedNodes:[...visitedNodes] };
    }

    for(let neighbor in graph[current]){
      const edge = graph[current][neighbor];

      if(edge.name && edge.name.toLowerCase().includes("amager")) continue;

      const alt = distances[current] + edge.distance;
      if(alt < distances[neighbor]){
        distances[neighbor] = alt;
        previous[neighbor] = current;
        pq.set(neighbor, alt);
      }
    }
  }
  return null;
}


// Fetch OSM roads with names
async function fetchOSMRoads(){
  console.log('Henter data fra Overpass API...');
  const query = `
    [out:json][timeout:300];
    way["highway"]["name"]["highway"~"primary|secondary|tertiary|residential"](55.55,12.45,55.75,12.65);
    out geom;
  `;
  const res = await axios.get('https://overpass-api.de/api/interpreter',{params:{data:query}});
  return res.data.elements.map(way => ({
    id: way.id,
    nodes: way.geometry,
    name: way.tags?.name || 'Uden navn'
  }));
}

// Build graph
function buildGraph(osmWays){
  const graph = {};
  const nodeCoords = {};

  osmWays.forEach(way => {
    const nodes = way.nodes;
    const name = way.name;

    for(let i=0;i<nodes.length;i++){
      const {lat, lon} = nodes[i];
      const nodeId = `${lat},${lon}`;
      nodeCoords[nodeId] = {lat, lon};
      if(!graph[nodeId]) graph[nodeId] = {};

      if(i>0){
        const prev = nodes[i-1];
        const prevId = `${prev.lat},${prev.lon}`;
        const dist = haversine(lat, lon, prev.lat, prev.lon);
        graph[nodeId][prevId] = { distance: dist, name };
        graph[prevId][nodeId] = { distance: dist, name };
      }
    }
  });

  return { graph, nodeCoords };
}

let graphData = null;

// Load or fetch graph
async function loadGraph(){
  if(fs.existsSync(GRAPH_FILE)){
    console.log('Loader graf fra fil...');
    graphData = JSON.parse(fs.readFileSync(GRAPH_FILE));
  } else {
    const osmWays = await fetchOSMRoads();
    graphData = buildGraph(osmWays);
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(graphData));
    console.log('Graf gemt lokalt med vejnavne.');
  }
}

// API endpoint
app.post('/api/route', async (req,res)=>{
  if(!graphData) await loadGraph();

  const {startLat,startLng,endLat,endLng} = req.body;
  const startNode = findNearestNode(startLat,startLng,graphData.nodeCoords);
  const endNode = findNearestNode(endLat,endLng,graphData.nodeCoords);

  if(!startNode || !endNode) return res.json({error:'Klik for langt fra veje i grafen.'});

  const startTime = Date.now();
  const result = dijkstra(startNode,endNode,graphData.graph);
  const durationMs = Date.now()-startTime;

  if(result && result.path){
    let totalDist = 0;
    const pathNodes = result.path.map(n=>n.split(',').map(Number));
    for(let i=0;i<pathNodes.length-1;i++){
      totalDist += haversine(pathNodes[i][0],pathNodes[i][1],pathNodes[i+1][0],pathNodes[i+1][1]);
    }
    result.distanceKm = (totalDist/1000).toFixed(2);
    result.durationMs = durationMs;
  }

  res.json(result);
});

// Serve frontend
app.use(express.static('public'));
app.get('/',(req,res)=>res.sendFile(__dirname+'/public/index.html'));

const PORT = 8080;
app.listen(PORT,()=>console.log(`Server kører på http://localhost:${PORT}`));

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

const GRAPH_FILE = 'storkbh_graph.json';

// Haversine – afstand i meter
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  
  return (θ * 180 / Math.PI + 360) % 360; // normalize to 0-360
}

// Calculate turn angle and penalty
function getTurnPenalty(fromBearing, toBearing) {
  let angle = toBearing - fromBearing;
  
  // Normalize to -180 to 180
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  
  // Debug logging
  // console.log(`Turn: from ${fromBearing.toFixed(1)}° to ${toBearing.toFixed(1)}° = ${angle.toFixed(1)}° turn`);
  
  // In compass bearings, turning RIGHT means POSITIVE angle change
  // (clockwise rotation increases bearing)
  // Turning LEFT means NEGATIVE angle change
  
  if (angle > 0) {
    // ANY positive angle = right turn (clockwise) - EXTREME preference
    console.log(`  -> RIGHT TURN (preferred!) ${angle.toFixed(1)}°`);
    return 0.00001;
  } else if (angle === 0) {
    // Perfectly straight - massive penalty
    console.log('  -> STRAIGHT (penalty)');
    return 100.0;
  } else if (angle >= -90) {
    // Left turn (negative angle) - extreme penalty
    console.log(`  -> LEFT TURN (huge penalty) ${angle.toFixed(1)}°`);
    return 500000.0;
  } else {
    // Sharp turn or U-turn - insane penalty
    console.log(`  -> U-TURN/SHARP (insane penalty) ${angle.toFixed(1)}°`);
    return 100000.0;
  }
}

// Dijkstra with right turn preference
function dijkstra(start, end, graph, nodeCoords) {
  const distances = {};
  const previous = {};
  const previousBearing = {}; // Track incoming bearing
  const visitedNodes = new Set();
  const pq = new Map();
  
  for (let node in graph) {
    distances[node] = Infinity;
    previous[node] = null;
    previousBearing[node] = null;
  }
  
  distances[start] = 0;
  pq.set(start, 0);

  while (pq.size > 0) {
    let current = [...pq.entries()].reduce((a, b) => a[1] < b[1] ? a : b)[0];
    pq.delete(current);
    visitedNodes.add(current);

    if (current === end) {
      let path = [];
      let temp = current;
      while (temp) {
        path.unshift(temp);
        temp = previous[temp];
      }
      return { path, visitedNodes: [...visitedNodes] };
    }

    const currentCoords = current.split(',').map(Number);
    
    for (let neighbor in graph[current]) {
      const neighborCoords = neighbor.split(',').map(Number);
      const edgeDistance = graph[current][neighbor];
      
      // Calculate bearing from current to neighbor
      const toBearing = calculateBearing(
        currentCoords[0], currentCoords[1],
        neighborCoords[0], neighborCoords[1]
      );
      
      // Calculate turn penalty
      let turnPenalty = 1.0; // Default no penalty for first move
      if (previousBearing[current] !== null) {
        turnPenalty = getTurnPenalty(previousBearing[current], toBearing);
      }
      
      // Combined cost: distance + turn penalty factor
      const alt = distances[current] + (edgeDistance * turnPenalty);
      
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = current;
        previousBearing[neighbor] = toBearing;
        pq.set(neighbor, alt);
      }
    }
  }
  
  return null;
}

// --- Resten som før ---
async function fetchOSMRoads() {
  console.log('Henter data fra Overpass API...');
  const query = `
    [out:json][timeout:2000];
    way["highway"]["highway"~"primary|secondary|tertiary|residential"](55.55,12.45,55.75,12.65);
    out geom;
  `;
  const res = await axios.get('https://overpass-api.de/api/interpreter', { params: { data: query } });
  return res.data.elements;
}

function buildGraph(osmWays) {
  const graph = {};
  const nodeCoords = {};

  osmWays.forEach(way => {
    const nodes = way.geometry;
    for (let i = 0; i < nodes.length; i++) {
      const { lat, lon } = nodes[i];
      const nodeId = `${lat},${lon}`;
      nodeCoords[nodeId] = { lat, lon };
      if (!graph[nodeId]) graph[nodeId] = {};

      if (i > 0) {
        const prev = nodes[i - 1];
        const prevId = `${prev.lat},${prev.lon}`;
        const dist = haversine(lat, lon, prev.lat, prev.lon);
        graph[nodeId][prevId] = dist;
        graph[prevId][nodeId] = dist;
      }
    }
  });

  return { graph, nodeCoords };
}

function findNearestNode(lat, lng, nodeCoords) {
  let nearest = null;
  let minDist = Infinity;
  for (let node in nodeCoords) {
    const n = nodeCoords[node];
    const d = haversine(lat, lng, n.lat, n.lon);
    if (d < minDist) {
      minDist = d;
      nearest = node;
    }
  }
  return nearest;
}

let graphData = null;

async function loadGraph() {
  if (fs.existsSync(GRAPH_FILE)) {
    console.log('Loader graf fra fil...');
    graphData = JSON.parse(fs.readFileSync(GRAPH_FILE));
  } else {
    const osmWays = await fetchOSMRoads();
    graphData = buildGraph(osmWays);
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(graphData));
    console.log('Graf gemt lokalt.');
  }
}

app.post('/api/route', async (req, res) => {
  if (!graphData) await loadGraph();

  const { startLat, startLng, endLat, endLng } = req.body;
  const startNode = findNearestNode(startLat, startLng, graphData.nodeCoords);
  const endNode = findNearestNode(endLat, endLng, graphData.nodeCoords);

  if (!startNode || !endNode) {
    return res.json({ error: 'Klik for langt fra veje i grafen.' });
  }

  const startTime = Date.now();
  const result = dijkstra(startNode, endNode, graphData.graph, graphData.nodeCoords);
  const endTime = Date.now();
  const durationMs = endTime - startTime;

  if (result && result.path) {
    let totalDist = 0;
    const pathNodes = result.path.map(n => n.split(',').map(Number));
    for (let i = 0; i < pathNodes.length - 1; i++) {
      totalDist += haversine(pathNodes[i][0], pathNodes[i][1], pathNodes[i + 1][0], pathNodes[i + 1][1]);
    }
    totalDist = (totalDist / 1000).toFixed(2);
    result.distanceKm = totalDist;
    result.durationMs = durationMs;
  }

  res.json(result);
});

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = 8080;
app.listen(PORT, () => console.log(`Server kører på http://localhost:${PORT}`));

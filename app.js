const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

const GRAPH_FILE = 'storkbh_graph.json';

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

// Dijkstra
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
      let temp = current;
      while(temp){
        path.unshift(temp);
        temp = previous[temp];
      }
      return {path, visitedNodes:[...visitedNodes]};
    }

    for(let neighbor in graph[current]){
      const alt = distances[current] + graph[current][neighbor];
      if(alt < distances[neighbor]){
        distances[neighbor] = alt;
        previous[neighbor] = current;
        pq.set(neighbor, alt);
      }
    }
  }
  return null;
}

// Find nærmeste node
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

let graphData = null;

// Load graf
async function loadGraph(){
  if(fs.existsSync(GRAPH_FILE)){
    console.log('Loader graf fra fil...');
    graphData = JSON.parse(fs.readFileSync(GRAPH_FILE));
  } else {
    console.log('Ingen graffil fundet. Opret en storkbh_graph.json først.');
  }
}

// API endpoint
app.post('/api/route', async (req,res)=>{
  if(!graphData) await loadGraph();

  const {startLat,startLng,endLat,endLng,algorithm} = req.body;
  const startNode = findNearestNode(startLat,startLng,graphData.nodeCoords);
  const endNode = findNearestNode(endLat,endLng,graphData.nodeCoords);

  if(!startNode || !endNode) return res.json({error:'Klik for langt fra veje i grafen.'});

  const startTime = Date.now();
  let result;
  result = dijkstra(startNode,endNode,graphData.graph);
  

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

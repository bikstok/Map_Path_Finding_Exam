const { dijkstra } = require('../app');

function createGrid(w,h){
  const graph = {};
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const id = `${x},${y}`;
      graph[id] = {};
    }
  }
  function nameFor(x,y){
    // generate a name with variable length
    return `R${x}_${y}` + ( (x+y)%5 === 0 ? ' Long' : '' );
  }
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const id = `${x},${y}`;
      if(x+1 < w){
        const id2 = `${x+1},${y}`;
        graph[id][id2] = { distance:1, name: nameFor(x,y) };
        graph[id2][id] = { distance:1, name: nameFor(x,y) };
      }
      if(y+1 < h){
        const id2 = `${x},${y+1}`;
        graph[id][id2] = { distance:1, name: nameFor(x,y) };
        graph[id2][id] = { distance:1, name: nameFor(x,y) };
      }
    }
  }
  return graph;
}

function benchOnce(graph, from, to, opts){
  const t0 = process.hrtime.bigint();
  const r = dijkstra(from,to,graph,opts);
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0); // nanoseconds
}

function run(){
  const w = 50, h = 40; // 2000 nodes
  console.log(`Building grid ${w}x${h}...`);
  const graph = createGrid(w,h);
  const from = '0,0';
  const to = `${w-1},${h-1}`;

  const runs = 1000;
  let sumExclude = 0n, sumShortest = 0n;
  for(let i=0;i<runs;i++){
    sumExclude += BigInt(benchOnce(graph,from,to,{ mode:'exclude', excludeNames:[] }));
    sumShortest += BigInt(benchOnce(graph,from,to,{ mode:'shortestName' }));
  }
  const avgEx = Number(sumExclude / BigInt(runs));
  const avgSn = Number(sumShortest / BigInt(runs));
  console.log(`Ran ${runs} iterations`);
  console.log(`Average time (exclude / distance weight): ${ (avgEx/1e6).toFixed(3) } ms`);
  console.log(`Average time (shortestName / name-length weight): ${ (avgSn/1e6).toFixed(3) } ms`);
}

run();

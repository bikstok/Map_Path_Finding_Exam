const assert = require('assert');
const { dijkstra } = require('../app');

// Helper to build small graph
function makeTestGraph(){
  const graph = {};
  const nodes = ['A','B','C'];
  nodes.forEach(n=>graph[n] = {});

  // A-B (distance 1) name Main Avenue (length 11)
  graph['A']['B'] = { distance: 1, name: 'Main Avenue' };
  graph['B']['A'] = { distance: 1, name: 'Main Avenue' };

  // B-C (distance 1) name S (length 1)
  graph['B']['C'] = { distance: 1, name: 'S' };
  graph['C']['B'] = { distance: 1, name: 'S' };

  // A-C direct (distance 3) name Long Road (length 9)
  graph['A']['C'] = { distance: 3, name: 'Long Road' };
  graph['C']['A'] = { distance: 3, name: 'Long Road' };

  return graph;
}

function runTests(){
  const graph = makeTestGraph();

  // Test 1: exclude mode with excludeNames ['s'] should skip B-C and pick A->C direct
  const r1 = dijkstra('A','C',graph,{ mode: 'exclude', excludeNames: ['s'] });
  assert(r1, 'Result should not be null');
  assert.deepStrictEqual(r1.path, ['A','C']);
  assert.strictEqual(r1.edges.length, 1);
  assert.strictEqual(r1.edges[0].name, 'Long Road');
  console.log('Test 1 passed: exclude mode with excludeNames works');

  // Test 2: exclude mode with empty excludeNames should pick shortest distance via B
  const r2 = dijkstra('A','C',graph,{ mode: 'exclude', excludeNames: [] });
  assert(r2, 'Result should not be null');
  assert.deepStrictEqual(r2.path, ['A','B','C']);
  assert.strictEqual(r2.edges.length, 2);
  const names2 = r2.edges.map(e=>e.name).sort();
  assert.deepStrictEqual(names2, ['Main Avenue','S']);
  console.log('Test 2 passed: exclude mode without excludes picks shortest distance');

  // Test 3: shortestName mode should pick route minimizing name lengths (A->C direct)
  const r3 = dijkstra('A','C',graph,{ mode: 'shortestName' });
  assert(r3, 'Result should not be null');
  assert.deepStrictEqual(r3.path, ['A','C']);
  assert.strictEqual(r3.edges.length, 1);
  assert.strictEqual(r3.edges[0].name, 'Long Road');
  console.log('Test 3 passed: shortestName mode picks minimal name-length route');

  // Test 4: ensure deduplication of names in shortestName mode (repeat names)
  // create graph where path uses same named street twice
  const g2 = {};
  ['1','2','3','4'].forEach(n=>g2[n]={});
  // 1-2 name "Dup" distance 1, 2-3 name "Dup" distance 1, 3-4 name "Other" distance 1
  g2['1']['2'] = { distance:1, name: 'Dup' };
  g2['2']['1'] = { distance:1, name: 'Dup' };
  g2['2']['3'] = { distance:1, name: 'Dup' };
  g2['3']['2'] = { distance:1, name: 'Dup' };
  g2['3']['4'] = { distance:1, name: 'Other' };
  g2['4']['3'] = { distance:1, name: 'Other' };

  const r4 = dijkstra('1','4',g2,{ mode: 'shortestName' });
  assert(r4, 'Result should not be null');
  // path should be 1-2-3-4
  assert.deepStrictEqual(r4.path, ['1','2','3','4']);
  // edges returned should include 'Dup' only once
  const names4 = r4.edges.map(e=>e.name).filter(Boolean);
  const unique = Array.from(new Set(names4.map(n=>n.toLowerCase())));
  assert.strictEqual(unique.length, 2);
  assert(unique.includes('dup'));
  assert(unique.includes('other'));
  console.log('Test 4 passed: shortestName deduplicates road names');

  console.log('\nAll tests passed');
}

runTests();

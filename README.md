## Ideer

1. En mode hvor man kun må dreje til højre for at finde vej.
2. En mode hvor man kun på kører på veje med kvinde navne.
3. Dikstra alogritme tilføjet.
4. Sorter datastrukur bedre og så DFS bliver mere effektiv.




## Reflections

Efter jeg prøvede hele sjælland så sage den rute fundet besøgte 1 node.
Når du prøver at bruge hele Sjælland som graf, er sandsynligheden for, at dit klik på kortet ikke matcher en node i grafen, enormt høj. Derfor finder algoritmen kun startnoden og “tænker” ruten er fundet – derfor “besøgte 1 node”.

Her er hvorfor det sker og hvordan du kan løse det:

Problemer med store områder

Klik passer ikke til nogen grafnode

Din findNearestNode leder efter den nærmeste node i grafen.

Grafen har måske kun hver 20.-50. vej-node med i JSON, så klik langt fra en node resulterer i meget få forbindelser.

DFS/A* starter på startnoden og kan ikke finde slutnoden, fordi slutnoden er langt fra alle inkluderede graf-noder.

Løsninger
1️⃣ “Snap” klik til nærmeste node mere robust

Sørg for at findNearestNode altid finder den absolut nærmeste node i grafen.

Du kan også definere et max distance, så hvis klik er for langt fra graf, vises fejl i stedet for at returnere 1 node.

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
  if(minDist > 500){ // fx 500 meter
    return null;   // klik for langt fra graf
  }
  return nearest;
}


Hvis startNode eller endNode er null, skal du vise en alert:

if(!startNode || !endNode){
  alert('Klik for langt fra veje i grafen. Prøv tættere på byområde.');
  return;
}

2️⃣ Reducer grafen

For store områder (Sjælland, hele Danmark) bliver grafen sparse, og ruter mellem vilkårlige punkter findes ikke.

Løsning:

Brug kun byer/områder hvor du forventer klik.

Eller lav flere “regioner” og beregn rute kun i region hvor klik sker.

3️⃣ Overvej at filtrere

Hent fx kun primære og sekundære veje i byområder i Sjælland, ellers bliver grafen for stor og diffus.
## Noter til eksamen

Forklar hvorfor jeg har valgt dijkstra og ikke A*, BFS ELLER DFS. Forklar densitet i grafen og hvorfor dijkstra.



## Evaluering af valg af algoritme og datastruktur

Dette dokument opsummerer og vurderer de tekniske valg i projektet: algoritme, datastruktur, kendte begrænsninger og mulige forbedringer.

### Kort resumé
- Algoritme: Dijkstra i to varianter
  - "exclude": minimerer geometrisk afstand og kan udelukke veje hvis navn indeholder bestemte substrings.
  - "shortestName": vægter kanter med længden af vejnavnet (navne-længde) og minimerer summen af disse.
- Datastruktur: adjacency-list repræsenteret som et JavaScript-objekt: nodeId -> { neighborId: { distance, name } }, hvor nodeId er en streng "lat,lon".

### Begrundelse for valg
- Dijkstra er korrekt og relativt enkelt at implementere for vægtede grafer uden negative kanter. Det er et solidt valg til prototyper og undervisning.
- Adjacency-list er en naturlig repræsentation for vejnet, som normalt er sparsomme grafer — det er memory-effektivt og nemt at konstruere fra OSM-data.
- Brug af streng-id'er ("lat,lon") gør det hurtigt at bygge grafen direkte fra OSM-geometri uden ekstra remapping til numeriske id'er.

### Fordele
- Let at forstå, vedligeholde og udvide (fx ændre vægtfunktion eller tilføje nye filtre).
- Ren JavaScript-implementering uden native-afhængigheder — nem at køre lokalt.
- De to modes viser fleksibiliteten i at skifte vægtfunktion uden at ændre den underliggende grafstruktur.

### Begrænsninger og problemer i stor skala
1) Nærmeste-node opslag (findNearestNode)
	- Metoden er O(V) og bliver upraktisk for store grafer. Når grafen dækker store områder (fx hele Sjælland) kan et klik ofte ligge langt fra de tilgængelige grafnoder.
	- Dette forklarer adfærden du observerede: ved meget sparse grafer kan et klik matche en enkelt startnode, mens slutnoden ikke findes tæt nok, så algoritmen kun besøger få noder (fx "besøgte 1 node").

2) Dataudvalg
	- Hvis grafen er for sparsomt udtaget (kun nogle få nodes pr. vej), kan ruter mellem tilfældige punkter ikke findes. At hente meget store områder uden filtrering giver en diffus graf med mange uforbundne eller tyndt forbundne komponenter.

### Praktiske løsningsforslag
- Begræns grafens omfang: hent kun veje i byområder eller brug et viewport-baseret/region-opdelt tilslag, så klik oftere har en nær node.

### Kommentar til 'shortestName' mode
- Mode-idéen er eksperimentel og viser, hvordan vægtfunktionen kan ændres. Praktiske forhold:
  - Vejnavne kan gentage sig — derfor deduplicerer vi visningen af vejnavne, så frontend ikke tegner samme label flere gange.
  - I praksis vil en realistisk ruteoptimering ofte kombinere flere kriterier (afstand, tid, vejtype mv.). Hvis det er ønsket, bør vægtene normaliseres og kombineres i en vægtet sum.

### Test og benchmark
- Der er tilføjet simple unit-tests og et benchmark-script (syntetisk grid) for at sammenligne 'exclude' vs 'shortestName' ydeevne og korrekthed. Disse giver et basalt mål for opførsel og responstider på en lille skala.

### Konklusion
- Til et læringseksempel og hurtig prototyping er Dijkstra + adjacency-list et passende valg: det er enkelt, korrekt og fleksibelt.
- For produktskalering kræves optimeringer: effektiv PQ, numerisk node-indeksering, spatial index og/eller A* for hurtigere søgninger.

Hvis du ønsker, kan jeg implementere en eller flere forbedringer (f.eks. heap-baseret PQ eller A* + KD-tree). Skriv hvad du foretrækker, så laver jeg et konkret forslag og proof-of-concept.
***


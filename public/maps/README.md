# Sahara offline Aluva map

`aluva.osm` contains OpenStreetMap road data within approximately 5 km of central Aluva, Kerala (10.1076, 76.3516). It was exported through the Overpass API for offline use.

OpenStreetMap data is © OpenStreetMap contributors and is available under the Open Database License (ODbL): https://www.openstreetmap.org/copyright

The application reads this local file, extracts walkable highways, builds an in-memory graph, and calculates routes locally with A*. It does not contact a tile server or routing API at runtime.

Map detail update: `scripts/data/aluva-context.osm` contains real OpenStreetMap
buildings, water polygons (including river islands), waterways and green land
areas retrieved from Overpass on 2026-09-06 around Aluva. ODbL attribution
applies. Run `python3 scripts/build-map-context.py` to regenerate the clipped
5 km `aluva-context.geojson` runtime layer.
No runtime Overpass request is used. Buildings are only available where OSM
contributors have mapped them. The existing shelter markers remain demo data.
Leaflet and its CSS are bundled locally; no tile layer or remote basemap is used.

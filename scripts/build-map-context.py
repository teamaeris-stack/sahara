"""Convert packaged real OSM context to GeoJSON, preserving river islands as holes."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from collections import Counter
root = Path(__file__).resolve().parents[1]
osm = ET.parse(root / 'scripts/data/aluva-context.osm').getroot()
nodes = {n.get('id'): [float(n.get('lon')), float(n.get('lat'))] for n in osm.findall('node')}
ways = {w.get('id'): [n.get('ref') for n in w.findall('nd')] for w in osm.findall('way')}
def tags(e): return {t.get('k'): t.get('v') for t in e.findall('tag')}
def rings(parts):
    parts = [list(p) for p in parts if p]
    result = []
    while parts:
        chain = parts.pop()
        while chain[0] != chain[-1]:
            for i,p in enumerate(parts):
                if chain[-1] == p[0]: chain += p[1:]; parts.pop(i); break
                if chain[-1] == p[-1]: chain += p[-2::-1]; parts.pop(i); break
                if chain[0] == p[-1]: chain = p[:-1] + chain; parts.pop(i); break
                if chain[0] == p[0]: chain = p[:0:-1] + chain; parts.pop(i); break
            else: break
        if len(chain)>3 and chain[0]==chain[-1] and all(n in nodes for n in chain): result.append([nodes[n] for n in chain])
    return result
features=[]
def add(geometry, kind, t, id):
    features.append({'type':'Feature','id':id,'properties':{'kind':kind, **{k:v for k,v in t.items() if k in ['name','waterway','landuse','building']}},'geometry':geometry})
# Point in ring for assigning inner rings without an extra dependency.
def inside(p, ring):
    x,y=p; result=False
    for a,b in zip(ring,ring[1:]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: result=not result
    return result
members=set()
for r in osm.findall('relation'):
    t=tags(r)
    if t.get('natural')!='water': continue
    outer=[]; inner=[]
    for m in r.findall('member'):
        if m.get('type')!='way': continue
        ref=m.get('ref'); members.add(ref)
        (inner if m.get('role')=='inner' else outer).append(ways.get(ref,[]))
    holes=rings(inner)
    polys=[[ring]+[h for h in holes if inside(h[0],ring)] for ring in rings(outer)]
    if polys: add({'type':'MultiPolygon','coordinates':polys},'water',t,'r'+r.get('id'))
for w in osm.findall('way'):
    t=tags(w); refs=ways[w.get('id')]
    if not refs or any(n not in nodes for n in refs): continue
    coords=[nodes[n] for n in refs]; closed=len(refs)>3 and refs[0]==refs[-1]
    kind=None
    if t.get('building') and t['building']!='no': kind='building'
    elif t.get('natural')=='water' or t.get('waterway')=='riverbank': kind='water'
    elif t.get('waterway'): kind='waterway'
    elif t.get('landuse') in ['forest','grass','meadow','recreation_ground','orchard','farmland'] or t.get('leisure')=='park': kind='land'
    if not kind or (kind=='water' and w.get('id') in members): continue
    if kind!='waterway' and not closed: continue
    add({'type':'Polygon' if closed and kind!='waterway' else 'LineString','coordinates':[coords] if closed and kind!='waterway' else coords},kind,t,'w'+w.get('id'))
# Clip the display layer to the requested 5 km radius (spherical circle).
from shapely.geometry import shape, mapping, Polygon
from shapely import make_valid
from math import radians, degrees, sin, cos, asin, atan2, pi
lat, lon = radians(10.1076), radians(76.3516)
d = 5000 / 6371000
circle=[]
for i in range(361):
    angle=i*pi/180
    y=asin(sin(lat)*cos(d)+cos(lat)*sin(d)*cos(angle))
    x=lon+atan2(sin(angle)*sin(d)*cos(lat),cos(d)-sin(lat)*sin(y))
    circle.append([degrees(x),degrees(y)])
coverage=Polygon(circle)
clipped=[]
for f in features:
    geom=make_valid(shape(f['geometry'])).intersection(coverage)
    if not geom.is_empty:
        f['geometry']=mapping(geom)
        clipped.append(f)
features=clipped
(root/'public/maps/aluva-context.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
print(dict(Counter(f['properties']['kind'] for f in features)))

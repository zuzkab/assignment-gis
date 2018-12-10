# Application Safe School 
Zuzana Bachárová
FIIT STU 2018

# Overview

Webová aplikácia na výber vhodnej školy pre dieťa na základe kriminality (v meste Chicago).

- Zobrazenie heat mapy pre kriminalitu v Chicagu
- Vyhľadanie škôl s najmenšou kriminalitou v okruhu 1km
- Nájdenie najkratšej cesty z domu do práce s medzizástavkou cez vybranú školu
- Filtrovanie na základe roku kriminálneho činu a type

# Frontend

Frontend aplikácie predstavuje statická HTML stránka realizovaná frameworkom Express. Zobrazenie mapy je realizované Javascriptovou knižnicou MapBox GL. Úlohou frontendu je odosielanie vstupných dát na server a vizualizácia dát na mape prijatých zo servera.

# Backend

Backendová časť aplikácie využíva Node.js server. Na komunikáciu medzo klientom a serverom je využívané Socket.io, ktoré zabezpečuje rýchle a spoľahlivé posielanie správ. 

# Data

Dáta pre projekt boli primárne získané z dvoch zdrojov. 

Prvým zdrojom sú dáta z mapy, ktoré som získala z Open Street Maps pre mesto Chicago a pomocou osm2pgsql ich importovala do vytvorenej Postgres databázy s rozšírením PostGIS.

Druhým zdrojom dát bola stránka [Kaggle](https://www.kaggle.com/currie32/crimes-in-chicago#Chicago_Crimes_2012_to_2017.csv), z ktorej som získala dáta o kriminálnych činoch spáchaných v meste Chicago za roky 2012-2017. Stiahnutý dataset obsahoval približne 1 milión záznamov, ktoré som importovala do novovytvorenej tabuľky criminality v databáze. Z datasetu som vybrala atribúty: id, type (typ trestného činu), year (rok kedy bol čin spáchaný), longtitude a latitude (GPS súradnice miesta činu). 

# Scenáre

V aplikácii som implementovala 3 scenáre, z ktorých každý súvisí s kriminalitou a školami v Chicagu.

## Zobrazenie kriminálnych činov

Prvým scenárom je zobrazenie kriminálnych činov na mape prostredníctvom heatmapy. Pre tento scenár je možné selektovať z kriminálnych činov na základe roku, kedy boli spáchané a ich typu.

![Heatmapa](heatmap.png)

```
SELECT criminality.type, criminality.latitude, criminality.longtitude 
FROM criminality 
WHERE criminality.year=$1 AND criminality.type=$2;
```
Z tabuľky criminality sa na základe vstupov od používateľa (year a type) selektujú kriminálne činy a vyberá sa ich latitude, longtitude a type. Server následne z long a lat vytvára geojson, ktorý odosiela klientovi.

Pre optimalizáciu horeuvedenej query boli vytvorené 3 indexy nakoľko môžu nastať 3 varianty uvedenej query (selektuje sa na základe roku, na základe typu alebo na základe oboch):

```
CREATE INDEX index_criminality ON criminality (year, type);
CREATE INDEX index_type ON criminality (type);
CREATE INDEX index_year ON criminality (year);
```

## Zobrazenie top 100 škôl s najmenším počtom kriminálnych činov v okolí 1km

Druhým scenárom je zobrazenie top 100 škôl s najmenším počtom unesení dieťaťa v okolí 1km. Pri tomto scenári je možné, aby si používateľ zvolil rok, podľa ktorého sa kriminálne činy budú vyhodnocovať. Typ sa v tomto scenári vyberá defaultne "KIDNAPPING", keďže bereime do úvahy bezpečnosť detí pre únosom. 

![Schools](schools.png)

Pri tomto scenári som si ako prvé vytvorila tabuľku schools, do ktorej som vložila záznamy škôl z tabuľky planet_osm_point a planet_osm_polygon. V prípade škôl z tabuľky planet_osm_polygon sa upravila geometria z polygónu na bod vypočítaním centroidu pre daný polygón. 

```
CREATE TABLE schools AS
	SELECT osm_id, name, st_transform(way, 4326) as way
	FROM planet_osm_point
	WHERE amenity='school' AND name!=''
	UNION 
	SELECT osm_id, name, ST_Centroid(st_transform(way, 4326)) as way
	FROM planet_osm_polygon
	WHERE amenity='school' AND name!=''
```

Vzhľadom na to, že tabuľka kriminálnych činov je pomerne rozsiahla a pri tomto scenári je potrebné vedeiť vzdialenosť každej školy s každým kriminálnym činom, vytvorila som tabuľku s_c_distance, ktorá obsahuje záznamy škôl, kriminálnych činov a ich vzdialeností.

```
CREATE TABLE s_c_distance AS
	select schools.osm_id, criminality.year, ST_DistanceSphere(schools.way, criminality.way_transform)
	from schools, criminality
	where criminality.type='KIDNAPPING'
```

Pre omptimalizácie query boli vytvorené 3 indexy nad tabuľkou schools a s_c_distance:

```
CREATE INDEX index_schools ON schools (name)
CREATE INDEX dist_index ON s_c_distance (year, sc_distancesphere)
CREATE INDEX dist_index_woy ON s_c_distance (sc_distancesphere)
```
V samotnej query sa vyberajú školy pričom sa vyberá počet kriminalnych činov z tabuľky s_c_distance v rádiuse 1km.

```
SELECT schools.name as name, ST_AsGeoJSON(schools.way) as way
FROM schools
WHERE osm_id in (
	SELECT osm_id
	FROM s_c_distance
	WHERE st_distancesphere < 1000
	GROUP BY (osm_id, year)
	HAVING year=2012 
	ORDER BY count(*)
	LIMIT 100
)
```

## Vyhľadanie ceste z domu do práce cez školu

V poslednom scenári sa vyhľadáva najkratšia cesta z domu do práce cez vybranú školu. Používateľ zadá názov ulice pre domov, prácu a názov školy. 

![Route](route.png)

Ako prvé som si vytvorila tabuľku ways, ktorá obsahuje všetky cesty spolu s ich vypočítanou dĺžkou. Do tabuľky boli pridané stĺpce source a target, ktoré sú potrebné pre vytvorenie topológie. Tá bola vytvorená rozšírením pg_routing.

```
CREATE TABLE ways AS
	SELECT osm_id, name, way, ST_Length(way) as length
	FROM planet_osm_roads2
	
ALTER TABLE ways
ADD COLUMN way_transform geometry;

UPDATE ways
SET way_transform = st_transform(ways.way, 4326);
	
ALTER TABLE ways ADD COLUMN "source" integer;
ALTER TABLE ways ADD COLUMN "target" integer;

SELECT pgr_createTopology('ways', 0.00001, 'way', 'osm_id');
```

Nakoľko používateľ zadáva vo vstupe názov školy, bolo potrebné rozšíriť tabuľku schools o údaj, na akej ulici sa škola nachádza. Na základe porovnania vzdialeností školy a ulíc sa vybrala najbližšia ulica, ktorá sa považovala za ulicu školy. 

```
ALTER TABLE schools
ADD COLUMN road integer;

WITH streets as (
	SELECT DISTINCT ON
	    (schools.osm_id) 
	     ways.osm_id as way_id, schools.osm_id as school_id
	FROM schools, ways
	    ORDER BY schools.osm_id, ST_DistanceSphere(schools.way , ways.way_transform)
)

UPDATE schools
SET road = (
	SELECT way_id
	FROM streets
	WHERE school_id = schools.osm_id
)
```

V samotnej query sa následne získava cesta pomocou algoritmu pgr_dijkstra() medzi ulicou domova a školy a následne školy a práce. Na základe názvu školy sa vyberie source uzol s využitím vypočítanej ulice školy v tabuľke schools. Uzly pre ulice domova a práce sa získajú z tauľky ways výberom atribútu source.

```
SELECT ways.name, ST_AsGeoJSON(st_transform(ways.way, 4326)) as way 
FROM pgr_dijkstra('SELECT osm_id as id, source, target, length as cost FROM ways', 
	(SELECT ways.source 
		FROM ways
		WHERE ways.name='Fairview Avenue'
		LIMIT 1), 
	(SELECT ways.source
		FROM ways
		WHERE osm_id=(
			SELECT schools.road as middle_id
			FROM schools
			WHERE schools.name='Guerin Prep High School'
			LIMIT 1)), directed := false) dij 
	JOIN ways ON (dij.edge = ways.osm_id) 
UNION 
SELECT ways.name, ST_AsGeoJSON(st_transform(ways.way, 4326)) as way 
FROM pgr_dijkstra('SELECT osm_id as id, source, target, length as cost FROM ways', 
	(SELECT ways.source
		FROM ways
		WHERE osm_id=(
			SELECT schools.road as middle_id
			FROM schools
			WHERE schools.name='Guerin Prep High School'
			LIMIT 1)), 
	(SELECT ways.source destination_id
		FROM ways
		WHERE ways.name='Eastern Avenue'
		LIMIT 1), directed := false) dij 
    JOIN ways ON (dij.edge = ways.osm_id)	
```

Na optimalizácie horeuvedenej query bol vytovrený index nad tabuľkou ways pre stĺpec name.

```
CREATE INDEX way_index ON ways (name)	
```

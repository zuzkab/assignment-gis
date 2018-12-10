# General course assignment

Build a map-based application, which lets the user see geo-based data on a map and filter/search through it in a meaningfull way. Specify the details and build it in your language of choice. The application should have 3 components:

1. Custom-styled background map, ideally built with [mapbox](http://mapbox.com). Hard-core mode: you can also serve the map tiles yourself using [mapnik](http://mapnik.org/) or similar tool.
2. Local server with [PostGIS](http://postgis.net/) and an API layer that exposes data in a [geojson format](http://geojson.org/).
3. The user-facing application (web, android, ios, your choice..) which calls the API and lets the user see and navigate in the map and shows the geodata. You can (and should) use existing components, such as the Mapbox SDK, or [Leaflet](http://leafletjs.com/).

## Example projects

- Showing nearby landmarks as colored circles, each type of landmark has different circle color and the more interesting the landmark is, the bigger the circle. Landmarks are sorted in a sidebar by distance to the user. It is possible to filter only certain landmark types (e.g., castles).

- Showing bicykle roads on a map. The roads are color-coded based on the road difficulty. The user can see various lists which help her choose an appropriate road, e.g. roads that cross a river, roads that are nearby lakes, roads that pass through multiple countries, etc.

## Data sources

- [Open Street Maps](https://www.openstreetmap.org/)

## My project

Fill in (either in English, or in Slovak):

**Application description**: Webová aplikácia na výber vhodnej školy pre dieťa na základe kriminality (v meste Chicago). 

- Zobrazenie heat mapy pre kriminalitu v Chicagu
- Vyhľadanie škôl s najmenšou kriminalitou v okruhu 1km
- Nájdenie najkratšej cesty z domu do práce s medzizástavkou cez vybranú školu
- filtrovanie na základe roku kriminálneho činu a type

**Data source**: 
- [Open Street Map](https://www.openstreetmap.org/#map=11/41.8338/-87.7320)
- [Kaggle](https://www.kaggle.com/currie32/crimes-in-chicago#Chicago_Crimes_2012_to_2017.csv)

**Technologies used**: 
- Node.js 
- Express
- Socket.io
- Mapbox
- PostGIS

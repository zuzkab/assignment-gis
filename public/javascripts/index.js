$(function(){
    mapboxgl.accessToken = 'pk.eyJ1IjoienV6YW5hYiIsImEiOiJjanA5bm45dnUwcDI5M3FvOHAycGQzNmRoIn0.RtWdagV8vEmHrVH92A2dlA';
    var map = new mapboxgl.Map({
        container: 'map', // container id
        style: 'mapbox://styles/mapbox/streets-v9', // stylesheet location
        center: [-87.623177, 41.881832], // starting position [lng, lat]
        zoom: 9 // starting zoom
    });

    map.addControl(new mapboxgl.NavigationControl());

    //make connection
    var socket = io.connect('http://localhost:3000');

    //buttons and inputs
    var heat_map = $("#heat_map");
    var safe_schools = $("#safe_schools");
    var find_route = $("#find_route");
    var year = $("#year");
    var type = $("#type");
    var home = $("#home");
    var school = $("#school");
    var work = $("#work");

    //Emit message
    heat_map.click(function(){
        console.log("CLIENT HEAT_MAP");
        socket.emit('heat_map', {
            type: type.val(),
            year: year.val()
        });
    });
    safe_schools.click(function(){
        console.log("CLIENT SAFE_SCHOOLS");
        socket.emit('safe_schools', {
            year: year.val()
        });
    });

    find_route.click(function(){
        console.log("CLIENT FIND_ROUTE");
        socket.emit('find_route', {
            home: home.val(),
            school: school.val(),
            work: work.val()
        });
    });

    //Listen on new_message
    socket.on("heat_map", function(data) {
        console.log("CLIENT RECEIVE HEAT_MAP ");

        if (typeof map.getLayer('heat_map') !== 'undefined') {
            map.removeLayer('heat_map');
            map.removeSource('crimes');
        }
        if (typeof map.getLayer('school_points') !== 'undefined') {
            map.removeLayer('school_points');
            map.removeSource('schools');
        }
        if (typeof map.getLayer('find_route') !== 'undefined') {
            map.removeLayer('find_route');
            map.removeSource('s_routes');
        }

        map.addSource('crimes', {
            type: 'geojson',
            data: data.crimes
        });

        map.addLayer({
            id: 'heat_map',
            type: 'heatmap',
            source: 'crimes',
            maxzoom: 24,
            paint: {
                // increase weight as diameter breast height increases
                'heatmap-weight': {
                    property: 'point_count',
                    type: 'exponential',
                    stops: [
                        [1, 0],
                        [62, 1]
                    ]
                },

                // assign color values be applied to points depending on their density
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0, 'rgba(236,222,239,0)',
                    0.2, 'blue',
                    0.5, 'yellow',
                    0.9, 'red'
                ],

                // decrease opacity to transition into the circle layer
                'heatmap-opacity': {
                    default: 1,
                    stops: [
                        [9, 1],
                        [24, 0]
                    ]
                }
            }
        });
    });

    socket.on("safe_schools", function(data) {
        console.log("CLIENT RECEIVE SAFE_SCHOOLS");

        if (typeof map.getLayer('heat_map') !== 'undefined') {
            map.removeLayer('heat_map');
            map.removeSource('crimes');
        }
        if (typeof map.getLayer('school_points') !== 'undefined') {
            map.removeLayer('school_points');
            map.removeSource('schools');
        }
        if (typeof map.getLayer('find_route') !== 'undefined') {
            map.removeLayer('find_route');
            map.removeSource('s_routes');
        }

        map.addSource('schools', {
            type: 'geojson',
            data: data.schools
        });

        console.log(data.schools);

        map.addLayer({
            "id": "school_points",
            "type": "symbol",
            "source": "schools",
            "layout": {
                "icon-image": "college-15"
            },
            "filter": ["==", "$type", "Point"]
        });
    });

    socket.on("find_route", function(data) {
        console.log("CLIENT RECEIVE FIND_ROUTE");

        if (typeof map.getLayer('heat_map') !== 'undefined') {
            map.removeLayer('heat_map');
            map.removeSource('crimes');
        }
        if (typeof map.getLayer('school_points') !== 'undefined') {
            map.removeLayer('school_points');
            map.removeSource('schools');
        }
        if (typeof map.getLayer('find_route') !== 'undefined') {
            map.removeLayer('find_route');
            map.removeSource('s_routes');
        }

        map.addSource('s_routes', {
            type: 'geojson',
            data: data.s_routes
        });

        console.log(data.s_routes);

        map.addLayer({
            "id": "find_route",
            "type": "line",
            "source": "s_routes",
            "layout": {
                "line-join": "round",
                "line-cap": "round"
            },
            "paint": {
                "line-color": "#888",
                "line-width": 8
            }
        });
    });

    map.on('click', 'school_points', function (e) {
        var coordinates = e.features[0].geometry.coordinates.slice();

        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(e.features[0].properties.name)
            .addTo(map);
    });

    map.on('click', 'school_polygons', function (e) {
        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(e.features[0].properties.name)
            .addTo(map);
    });
});
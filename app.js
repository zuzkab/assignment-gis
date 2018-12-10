var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var port = process.env.PORT || 3000;
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require('body-parser');
var pg = require('pg');
var GeoJSON = require('geojson');

var client = new pg.Client({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'postgres',
    password: 'postgres',
    port: 5432
});

server.listen(port, function() {
    console.log('Server listening at port %d', port);
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended : false }));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
    res.render('index')
});

client.connect();

const io = require("socket.io")(server);

//listen on every connection
io.on('connection', function(socket) {
    console.log('New user connected');

    //default username
    socket.username = "PDT";

    //listen on change_username
    socket.on('heat_map', function(data) {
        var geoData;
        const result = [];

        var queryString;
        if (data.type.trim() === 'all' && data.year.trim() === 'all') {
            queryString = {
                name: 'get_crimes',
                text: 'SELECT criminality.type, criminality.latitude, criminality.longtitude FROM criminality'
            };
        } else if (data.type.trim() === 'all') {
            queryString = {
                name: 'get_crimes',
                text: 'SELECT criminality.type, criminality.latitude, criminality.longtitude FROM criminality WHERE criminality.year= $1',
                values: [data.year]
            }
        } else if (data.year.trim() === 'all') {
            queryString = {
                name: 'get_crimes',
                text: 'SELECT criminality.type, criminality.latitude, criminality.longtitude FROM criminality WHERE criminality.type= $1',
                values: [data.type]
            }
        } else {
            queryString = {
                name: 'get_crimes',
                text: 'SELECT criminality.type, criminality.latitude, criminality.longtitude FROM criminality WHERE criminality.year=$1 AND criminality.type=$2',
                values: [data.year, data.type]
            }
        }



        console.log(queryString);
        var query = client.query(queryString);

        //Stream results back one row at a time
        query.on('row', function(row) {
            result.push(row);
        });

        //After all data is returned, close connection and return results
        query.on('end', function() {
          //console.log(result);
          geoData = GeoJSON.parse(result, {Point: ['latitude', 'longtitude'], include: ['type']});
          console.log(geoData);
          console.log("SERVER heat_map");
          io.sockets.emit('heat_map', {crimes: geoData});
        });
});

    socket.on('safe_schools', function(data) {
        console.log("SERVER safe_schools");
        var geoData;

        var queryString;
        if (data.year.trim() === 'all') {
            queryString = {
                name: 'get_crimes1',
                text: 'SELECT schools.name as name, ST_AsGeoJSON(schools.way) as way ' +
                'FROM schools ' +
                'WHERE osm_id in (' +
                'SELECT osm_id ' +
                'FROM s_c_distance ' +
                'WHERE st_distancesphere < 1000 ' +
                'GROUP BY (osm_id) ' +
                'ORDER BY count(*) ' +
                'LIMIT 100' +
                ')'
            }
        } else {
            queryString = {
                name: 'get_crimes2',
                text: 'SELECT schools.name as name, ST_AsGeoJSON(schools.way) as way ' +
                'FROM schools ' +
                'WHERE osm_id in (' +
                'SELECT osm_id ' +
                'FROM s_c_distance ' +
                'WHERE st_distancesphere < 1000 ' +
                'GROUP BY (osm_id, year) ' +
                'HAVING year=$1 ' +
                'ORDER BY count(*) ' +
                'LIMIT 100' +
                ')',
                values: [data.year]
            }
        }

        var elements = [];

        console.log(queryString);
        var query = client.query(queryString);

        //Stream results back one row at a time
        query.on('row', function(row) {
            row.way = JSON.parse(row.way);
            elements.push(row);
            console.log(row);
        });

        //After all data is returned, close connection and return results
        query.on('end', function() {
            //console.log(result);
            geoData = GeoJSON.parse(elements, {GeoJSON: 'way', include: ['name']});
            console.log(geoData);

            io.sockets.emit('safe_schools', {schools: geoData});
        });
    });

    socket.on('find_route', function(data) {
        console.log("SERVER find_route");
        var geoData;
        console.log(data.home);
        console.log(data.school);
        console.log(data.work);

        var queryString = {
            name: 'get_route',
            text:'SELECT ways.name as name, ST_AsGeoJSON(st_transform(ways.way, 4326)) as way ' +
            'FROM pgr_dijkstra(\'SELECT osm_id as id, source, target, length as cost FROM ways\', ' +
            '(SELECT ways.source ' +
            'FROM ways ' +
            'WHERE ways.name=$1 ' +
            'LIMIT 1), ' +
            '(SELECT ways.source ' +
            'FROM ways ' +
            'WHERE osm_id=( ' +
            'SELECT schools.road as middle_id ' +
            'FROM schools ' +
            'WHERE schools.name=$2 ' +
            'LIMIT 1)), directed := false) dij ' +
            'JOIN ways ON (dij.edge = ways.osm_id) ' +
            'UNION ' +
            'SELECT ways.name as name, ST_AsGeoJSON(st_transform(ways.way, 4326)) as way ' +
            'FROM pgr_dijkstra(\'SELECT osm_id as id, source, target, length as cost FROM ways\', ' +
            '(SELECT ways.source ' +
            'FROM ways ' +
            'WHERE osm_id=( ' +
            'SELECT schools.road as middle_id ' +
            'FROM schools ' +
            'WHERE schools.name=$3 ' +
            'LIMIT 1)),  ' +
            '(SELECT ways.source destination_id ' +
            'FROM ways ' +
            'WHERE ways.name=$4 ' +
            'LIMIT 1), directed := false) dij  ' +
            '    JOIN ways ON (dij.edge = ways.osm_id) ',
            values: [data.home, data.school, data.school, data.work]
        };

        var elements = [];

        console.log(queryString);
        var query = client.query(queryString);

        //Stream results back one row at a time
        query.on('row', function(row) {
            console.log(row);
            row.way = JSON.parse(row.way);
            elements.push(row);
            console.log(row);
        });

        //After all data is returned, close connection and return results
        query.on('end', function() {
            //console.log(result);
            geoData = GeoJSON.parse(elements, {GeoJSON: 'way', include: ['name']});
            console.log(geoData);

            io.sockets.emit('find_route', {s_routes: geoData});
        });
    });
});

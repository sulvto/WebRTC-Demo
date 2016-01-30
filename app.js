var socket = require('socket.io');
var express = require('express');
var http = require('http');

var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();
var server = http.createServer(app);

//io(signalingChannel)
var io = socket.listen(server);
server.listen(8000);

var socketList = [];
// socket on
io.on('connection', function (socket) {
    socketList[socketList.length] = socket;
    //console.log(io);
    //console.log(socket);
    console.log("connection");
    socket.broadcast.emit("new", "hello");

    socket.on("id", function (msg) {
        socket.broadcast.emit("id", socket.id);
    });

    socket.on("onicecandidate", function (msg) {
        socket.broadcast.emit("onicecandidate", msg);
    });
    socket.on("pcid", function (msg) {
        socket.broadcast.emit("pcid", msg);
    });

    socket.on("createOffer", function (msg) {
        socket.broadcast.emit("createOffer", msg);
    });

    socket.on("createAnswer", function (msg) {
        socket.broadcast.emit("createAnswer", msg);
    });


});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;

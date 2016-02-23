/**
 * Created by sulvto on 16-1-29.
 */
var socket = require('socket.io');
var express = require('express');
var http = require('http');

var app = express();
var server = http.createServer(app);

var io = socket.listen(server);
server.listen(8000);

// socket on
io.on('connection', function (socket) {
    console.log("connection");
    socket.on('chat message', function (msg) {
        console.log('message: ' + msg);
    });
});

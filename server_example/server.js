// Load required modules
var http        = require("http");
var express     = require("express");
var serveStatic = require('serve-static');
var socketIo    = require("socket.io");
var easyrtc     = require("open-easyrtc");

// Set process name
process.title = "node-easyrtc";

// Port from Render environment variable, fallback to 8080 locally
var PORT = process.env.PORT || 8080;

// Setup Express
var app = express();

// Serve videocall.html as the default page
app.use(serveStatic('static', { 'index': ['videocall.html'] }));

// Serve easyrtc client JS — open-easyrtc serves /easyrtc/ and /socket.io/ automatically
// but we also expose the api folder directly as a fallback
app.use('/easyrtc', serveStatic('../api'));

// Create HTTP server — Render handles HTTPS in front of this
var webServer = http.createServer(app);

// Attach Socket.io with CORS open for Render
var socketServer = socketIo(webServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

easyrtc.setOption("logLevel", "info");

// Start EasyRTC
easyrtc.listen(app, socketServer, null, function(err, rtcRef) {
    console.log("EasyRTC ready");

    rtcRef.events.on("roomCreate", function(appObj, creatorConnectionObj, roomName, roomOptions, callback) {
        console.log("Room created: " + roomName);
        appObj.events.defaultListeners.roomCreate(appObj, creatorConnectionObj, roomName, roomOptions, callback);
    });
});

// Start server
webServer.listen(PORT, function() {
    console.log("Server listening on port " + PORT);
});
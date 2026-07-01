const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // Allows connections from anywhere worldwide
});

// Serve static frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

let activeDevices = {}; 
let offlineDevices = []; 

io.on('connection', (socket) => {
  
  // When a device connects or registers
  socket.on('join-device', (data) => {
    socket.isAdmin = data.isAdmin;
    socket.username = data.username;

    if (data.isAdmin) {
      socket.join('admins-room');
      // Send the newly connected admin the current states
      socket.emit('device-list-update', Object.values(activeDevices));
      socket.emit('offline-list-update', offlineDevices);
    } else {
      // It's a standard playback device
      activeDevices[socket.id] = {
        id: socket.id,
        username: data.username,
        onlineSince: new Date().toLocaleTimeString(),
        connectedAt: Date.now(),
        battery: data.battery || 'Unknown',
        charging: data.charging || false
      };
      // Tell all admins a new target device is active
      io.to('admins-room').emit('device-list-update', Object.values(activeDevices));
    }
  });

  // Track real-time battery changes sent from clients
  socket.on('battery-update', (data) => {
    if (activeDevices[socket.id]) {
      activeDevices[socket.id].battery = data.battery;
      activeDevices[socket.id].charging = data.charging;
      io.to('admins-room').emit('device-list-update', Object.values(activeDevices));
    }
  });

  // Admin triggers a sound execution
  socket.on('execute-sound', (data) => {
    // data payload: { targetId, soundUrl, volume, offset, duration, soundName }
    io.to(data.targetId).emit('play-audio', data);
  });

  // Admin triggers an emergency stop
  socket.on('stop-sound', (data) => {
    io.to(data.targetId).emit('stop-audio');
  });

  // Device disconnects
  socket.on('disconnect', () => {
    if (activeDevices[socket.id]) {
      const dev = activeDevices[socket.id];
      const durationMs = Date.now() - dev.connectedAt;
      const minutes = Math.floor(durationMs / 60000);
      
      offlineDevices.push({
        username: dev.username,
        offlineSince: new Date().toLocaleTimeString(),
        wasOnlineFor: `${minutes} mins`
      });

      delete activeDevices[socket.id];
      
      // Update admins instantly
      io.to('admins-room').emit('device-list-update', Object.values(activeDevices));
      io.to('admins-room').emit('offline-list-update', offlineDevices);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`DSLR Router online on port ${PORT}`));
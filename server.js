const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waiting = null;            // കാത്തിരിക്കുന്ന ഒരാൾ
const partners = new Map();    // socket.id -> partner socket.id

function leave(socket) {
  if (waiting === socket.id) waiting = null;
  const pid = partners.get(socket.id);
  if (pid) {
    partners.delete(socket.id);
    partners.delete(pid);
    io.to(pid).emit('partner-left');
  }
}

io.on('connection', (socket) => {
  socket.on('find', () => {
    leave(socket);
    if (waiting && waiting !== socket.id && io.sockets.sockets.has(waiting)) {
      const other = waiting;
      waiting = null;
      partners.set(socket.id, other);
      partners.set(other, socket.id);
      io.to(socket.id).emit('matched', { initiator: true });
      io.to(other).emit('matched', { initiator: false });
    } else {
      waiting = socket.id;
      socket.emit('waiting');
    }
  });

  // offer / answer / ICE candidates പങ്കാളിക്ക് കൈമാറുന്നു
  socket.on('signal', (data) => {
    const pid = partners.get(socket.id);
    if (pid) io.to(pid).emit('signal', data);
  });

  socket.on('report', () => {
    const pid = partners.get(socket.id);
    console.log(`REPORT: ${socket.id} reported ${pid}`);
    // ഇവിടെ ലോഗ് ചെയ്യുക / ബ്ലോക്ക് ലിസ്റ്റിൽ ചേർക്കുക
  });

  socket.on('leave', () => leave(socket));
  socket.on('disconnect', () => leave(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Running on port ' + PORT));

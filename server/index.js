import express from "express";
import {createServer} from "node:http";
import {Server} from "socket.io";
import { join_lobby, create_lobby, leave_lobby, get_lobby, get_num_ready_players, get_num_players, get_lobby_by_player } from "./lobbies/lobbies.js";
import { find_or_create_session, queue_leave, set_update_player_list_callback } from "./sessions/sessions.js";
import { assign_roles, get_game, get_role_info, setup, start_game, validate_received_user_poi_values, get_player_POIs, set_player_POIs, clearMessageQueue } from "./games/game.js";
import { set_player_ready } from "./lobbies/lobbies.js";
import { MIN_PLAYERS, PHASE_STATES } from "./games/game_globals.js";
import { gameLoop, set_status_bar_update, set_timer_update_callback, set_ids_and_names_callback, winners_update, message_queue_send } from "./games/turns.js";
import { use_ability } from "./games/abilities_system.js";

const app = express();
const server = createServer(app);
export const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

function redirect_user(socket) {
  if (socket.roomCode === "") {
    socket.emit("redirect", "/");
    return;
  }
  if (get_game(socket.roomCode)) {
    const phase = get_game(socket.roomCode).currentState;
    if (phase === PHASE_STATES.GAME_OVER_PHASE) {
      socket.emit("redirect", `/gameover?code=${socket.roomCode}`);
    } else {
      socket.emit("redirect", `/game?code=${socket.roomCode}`);
    }
    return;
  }
  socket.emit("redirect", `/lobby?code=${socket.roomCode}`);
}

io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;
  const result = find_or_create_session(sessionID);
  socket.sessionID = result.sessionId;
  socket.userID = result.userId;
  socket.roomCode = result.code;
  socket.username = result.username;
  if (socket.roomCode !== "" || socket.roomCode) {
    socket.join(socket.roomCode);
  }
  setTimeout(() => redirect_user(socket), 500);
  next();
});

io.on("connection", (socket) => {
  // text chat
  socket.on("send chat msg", ({message}) => {
    console.log('[Room:' + socket.roomCode + ' chat] ' + socket.username + ': ' + message);
    io.in(socket.roomCode).emit("receive chat msg", {username: socket.username, message});
  });

  // POI updates during action phase
  socket.on("client-sent poi update", (POIs, callback) => {
    const allowed_phases = [PHASE_STATES.DISCUSSION_PHASE, PHASE_STATES.ACTION_PHASE];
    let game = get_game(socket.roomCode);
    if (Object.keys(POIs).length === 0) { 
      callback({
        status: 400,
        message: "No POIs provided"
      });
      return;
    }
    if (!game) {
      callback({
        status: 404,
        message: "You are not in a game"
      });
      return;
    }

    if (!allowed_phases.includes(game.currentState)) {
      callback({
        status: 405,
        message: "cannot update point allocation during this phase"
      });

      if (Object.keys(get_player_POIs(game, socket.userID)).length === 0) { 
        callback({
          status: 400,
          message: "No POIs provided"
        });
        return;
      }
      socket.emit("server-sent poi update", get_player_POIs(game, socket.userID));
      return;
    }

    if(!validate_received_user_poi_values(game, socket.userID, POIs)) {
      callback({
        status: 409,
        message: "client POIs not valid"
      });
      socket.emit("server-sent poi update", get_player_POIs(game, socket.userID));
    }
    else {
      callback({
        status: 200,
        message: "POIs OK"
      });
      set_player_POIs(game, socket.userID, POIs);
    }
  });

  socket.on("join", (data, callback) => {
    if (data.code === undefined || data.username === undefined) {
      // this shouldn't happen unless someone is doing something outside the website
      callback({
        status: 400,
        message: "bad packet"
      });
    }
    const result = join_lobby(data.code, data.username, socket.userID);
    if (result.status === 200) {
      socket.join(data.code);
      socket.username = data.username;
      socket.roomCode = data.code;
      updatePlayerList(socket.roomCode); //added this
      socket.emit("session", {
        sessionID: socket.sessionID,
        userID: socket.userID
      });    
    }
    callback(result);
  });

  socket.on("leave", (callback) => {
    socket.leave(socket.roomCode);
    if (get_game(socket.roomCode)) {return;}
    callback(leave_lobby(socket.userID));
    updatePlayerList(socket.roomCode); //added this
    socket.roomCode = "";
  });

  socket.on("disconnect", () => {
    socket.leave(socket.roomCode);
    queue_leave(socket.sessionID);
  });

  socket.on("create", (data, callback) => {
    if (data.username === undefined || socket.userID === null) {
      // this shouldn't happen unless someone is doing something outside the website
      callback({
        status: 400,
        message: "bad packet"
      });
    }

    const result = create_lobby(data.username, socket.userID);
    if (result.status === 200) {
      socket.join(result.code);
      socket.username = data.username;
      socket.roomCode = result.code;
    }
    callback(result);
  });
  
  // socket.emit("lobby code", "socket.roomCode");

  socket.on("player_ready",() => {
    const userID = socket.userID;
    const result = set_player_ready(userID);
    if (result.status === 200) {
      const lobby = get_lobby(socket.roomCode);
      updatePlayerList(socket.roomCode); //added this
      io.in(socket.roomCode).emit("ready_count_updated", { 
        readyCount: get_num_ready_players(socket.roomCode), 
        totalPlayers: Object.keys(lobby).length 
      });
    }
    try_start_game(socket);
  });

  async function try_start_game(socket) {
    if (socket.roomCode === "") {
      return;
    }
    const lobby = get_lobby(socket.roomCode);
    if (!lobby) {
      return;
    }
    const num_players = get_num_players(socket.roomCode);
    if (get_num_ready_players(socket.roomCode) < num_players || num_players < MIN_PLAYERS) {
      // not enough players ready
      return;
    }

    const result = start_game(lobby, socket.roomCode);
    if (result.status !== 200) {
      // notify clients that the game start has failed.
      io.in(socket.roomCode).emit("receive chat msg", {username: "server", message: `failed to start game. \n ${result.message}`});
    }

    let game = get_game(socket.roomCode);
    assign_roles(game);

    // tell clients to start the game
    io.in(socket.roomCode).emit("game_start", {code: socket.roomCode});
    
    // tell each player their role
    // delay telling players thier role so that they have time to load the page
    setTimeout(async () => {
      const sockets = await io.in(socket.roomCode).fetchSockets();
      sockets.forEach(s => {
        s.emit("role_info", get_role_info(game, s.userID));
      });
    }, 1000);
    gameLoop(socket.roomCode);
  }

  socket.on("init ready count", () => {
      const lobby = get_lobby(socket.roomCode);
      io.in(socket.roomCode).emit("ready_count_updated", { 
      readyCount: get_num_ready_players(socket.roomCode), 
      totalPlayers: Object.keys(lobby).length 
    });
  });

  socket.on('request_player_list', () => {
    updatePlayerList(socket.roomCode);
  });

  socket.on("use_ability", (data) => {
    use_ability(socket.roomCode, socket.userID, data);
  });
});

const PORT = process.env.PORT | 4000;
server.listen(PORT, async () => {
  await setup();
  set_timer_update_callback(updateTimer);
  set_ids_and_names_callback(sendIdsAndNames);
  set_status_bar_update(updateStatusBar);
  winners_update(sendWinnersToClient);
  message_queue_send(sendQueuedMessagesToClient);
  console.log(`server running at http://localhost:${PORT}`);
});

export function closeServer() {
  server.close();
}

export function updateTimer(phase, time, start, lobbyCode){
  io.in(lobbyCode).emit("update timer phase", {length: time, name: phase, start});
} 

export function sendIdsAndNames(IDSANDNAMES, lobbyCode){
  io.in(lobbyCode).emit("server-sent poi update", IDSANDNAMES);
} 

function updateStatusBar(lobbyCode, statusBars) {
  io.in(lobbyCode).emit("status_update", statusBars);
}

function sendWinnersToClient(lobbyCode, winners) {
  io.in(lobbyCode).emit("winner_data", winners);
}

//update player lplayer
set_update_player_list_callback(updatePlayerList);
function updatePlayerList(lobbyCode) {
  const lobby = get_lobby(lobbyCode);
  
  if (!lobby || !Object.keys(lobby).length) {
      console.error(`No players in lobby: ${lobbyCode} or lobby does not exist.`);
      return;
  }

  const playerList = Object.values(lobby).map(player => ({
      id: player.id, 
      name: player.username,
      ready: player.ready_state 
  }));

  io.in(lobbyCode).emit('player_list_updated', playerList);
}

// for use with sendQueuedMessagesToClient; time in milliseconds
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send messages from message queue on game object to clients in relevant game.
// Each message has a short delay before being sent.
// Message queue is cleared once all messages have been sent.
function sendQueuedMessagesToClient(lobbyCode) {
  let game = get_game(lobbyCode);
  if(game && game.messageQueue && game.messageQueue.length > 0) {
    for(let message of game.messageQueue) {
      sleep(500).then(() => { io.in(lobbyCode).emit("receive chat msg", {username: "server", message: message}); });
    }
    clearMessageQueue(lobbyCode);
  }
}

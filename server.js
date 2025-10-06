// server.js - The heart of your live game

// 1. SETUP
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const Papa = require('papaparse'); // CSV library

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// --- GAME STATE & LOGIC ---

let gameState = {
    gameId: null, // To identify the current game session
    hostSocketId: null,
    players: {},
    gameInProgress: false,
    fullDeck: [],
    drawnCards: [],
    boardPool: [],
};

const ALL_CARD_NAMES = [
    '1.webp', '2.webp', '3.webp', '4.webp', '5.webp', '6.webp', '7.webp', '8.webp',
    '9.webp', '10.webp', '11.webp', '12.webp', '13.webp', '14.webp', '15.webp', '16.webp',
    '17.webp', '18.webp', '19.webp', '20.webp', '21.webp', '22.webp', '23.webp', '24.webp',
    '25.webp', '26.webp', '27.webp', '28.webp', '29.webp', '30.webp', '31.webp', '32.webp'
];

// --- HELPER FUNCTIONS ---

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generateBoardPool() {
    try {
        const boardsData = fs.readFileSync('public/boards.json');
        return JSON.parse(boardsData);
    } catch (error) {
        console.error("Error reading or parsing boards.json:", error);
        return [];
    }
}

/** ✨ NEW: Generates a CSV file from the current player data */
function generateCsvForCurrentGame() {
    if (Object.keys(gameState.players).length === 0) {
        return; // Don't generate an empty file
    }
    const playerData = Object.values(gameState.players).map(p => ({
        Nombre: p.name,
        'Numero de Telefono': p.phone,
        'Tablero #': p.board.id + 1,
        Gano: p.won
    }));

    const csv = Papa.unparse(playerData);
    const fileName = `player_log_${gameState.gameId}.csv`;
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
    }
    
    fs.writeFileSync(`logs/${fileName}`, csv, 'utf-8');
    console.log(`Player data saved to ${fileName}`);
}


function resetGame() {
    console.log('Resetting game state.');
    const gameTimestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    gameState = {
        gameId: gameTimestamp,
        hostSocketId: null,
        players: {},
        gameInProgress: false,
        fullDeck: shuffle([...ALL_CARD_NAMES]),
        drawnCards: [],
        boardPool: generateBoardPool(),
    };
}

resetGame();

// 2. REAL-TIME COMMUNICATION
io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);

    socket.on('host:createGame', () => {
        if (gameState.hostSocketId) {
            socket.emit('error:gameInProgress', 'A game is already being hosted.');
            return;
        }
        resetGame();
        gameState.hostSocketId = socket.id;
        gameState.gameInProgress = true;
        console.log(`Game created by host: ${socket.id} with ID: ${gameState.gameId}`);
        io.emit('game:update', gameState);
    });

    socket.on('host:drawCard', () => {
        if (socket.id !== gameState.hostSocketId || gameState.fullDeck.length === 0) return;
        const drawnCard = gameState.fullDeck.pop();
        gameState.drawnCards.push(drawnCard);
        io.emit('game:update', gameState);
    });

    socket.on('player:joinGame', ({ playerName, phoneNumber, boardId }) => {
        if (!gameState.gameInProgress) {
             socket.emit('error:gameNotStarted', 'The game has not started yet.');
             return;
        }
        const chosenBoard = gameState.boardPool.find(b => b.id === boardId);
        gameState.players[socket.id] = {
            id: socket.id,
            name: playerName,
            phone: phoneNumber,
            board: chosenBoard,
            won: 'No' // Initialize win status
        };
        console.log(`Player ${playerName} (${phoneNumber}) joined with board ${boardId}.`);
        generateCsvForCurrentGame(); // Update CSV when a new player joins
        io.emit('game:update', gameState);
    });
    
    socket.on('player:claimWin', () => {
        const player = gameState.players[socket.id];
        if (!player) return;

        const boardCardIds = new Set(player.board.cards.map(c => c.id));
        const drawnCardsSet = new Set(gameState.drawnCards);
        const allCardsMatch = [...boardCardIds].every(cardId => drawnCardsSet.has(cardId));

        if (allCardsMatch) {
            console.log(`Win confirmed for player: ${player.name}`);
            player.won = 'Yes'; // Update win status
            generateCsvForCurrentGame(); // Update CSV with the winner
            io.to(gameState.hostSocketId).emit('game:playerWon', player.name);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (socket.id === gameState.hostSocketId) {
            console.log('Host disconnected. Ending game.');
            resetGame();
            io.emit('game:ended', 'The host has disconnected. The game is over.');
        } else {
            if (gameState.players[socket.id]) {
                delete gameState.players[socket.id];
                generateCsvForCurrentGame(); // Update CSV if a player leaves
                io.emit('game:update', gameState);
            }
        }
    });
    
    socket.emit('game:boardPool', gameState.boardPool);
});

// 3. START THE SERVER
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


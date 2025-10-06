// Import necessary libraries
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve all the files in the 'public' folder
app.use(express.static('public'));

// --- GAME STATE & LOGIC ---

// This object will hold all the information about the current game.
// In a real production app, you might use a database for this.
let gameState = {
    hostSocketId: null,
    players: {}, // Keyed by socket.id
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
const CARDS_PER_BOARD = 16; // Using 4x4 boards for players for faster games.
const NUM_BOARDS_TO_GENERATE = 50; // Generate a pool of 50 boards for players to choose from.

// --- HELPER FUNCTIONS ---

/** Shuffles an array in place */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/** Generates a pool of unique, random boards */
function generateBoardPool() {
    console.log('Generating new board pool...');
    const pool = [];
    for (let i = 0; i < NUM_BOARDS_TO_GENERATE; i++) {
        const shuffledDeck = shuffle([...ALL_CARD_NAMES]);
        const board = shuffledDeck.slice(0, CARDS_PER_BOARD);
        pool.push({ id: i, cards: board });
    }
    return pool;
}

/** Resets the game to its initial state */
function resetGame() {
    console.log('Resetting game state.');
    gameState = {
        hostSocketId: null,
        players: {},
        gameInProgress: false,
        fullDeck: shuffle([...ALL_CARD_NAMES]),
        drawnCards: [],
        boardPool: generateBoardPool(),
    };
}

// Initialize the game state on server start
resetGame();

// 2. REAL-TIME COMMUNICATION
// This runs whenever a new user connects to the server.
io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);

    // --- HOST EVENTS ---
    socket.on('host:createGame', () => {
        // If there's already a host, don't allow another.
        if (gameState.hostSocketId) {
            socket.emit('error:gameInProgress', 'A game is already being hosted.');
            return;
        }
        resetGame(); // Reset the game for the new host
        gameState.hostSocketId = socket.id;
        gameState.gameInProgress = true;
        console.log(`Game created by host: ${socket.id}`);
        // Send the initial (empty) game state to the host
        io.emit('game:update', gameState);
    });

    socket.on('host:drawCard', () => {
        // Only the host can draw cards.
        if (socket.id !== gameState.hostSocketId || gameState.fullDeck.length === 0) {
            return;
        }
        const drawnCard = gameState.fullDeck.pop();
        gameState.drawnCards.push(drawnCard);
        console.log(`Host drew card: ${drawnCard}`);
        // Broadcast the new game state to everyone
        io.emit('game:update', gameState);
    });

    // --- PLAYER EVENTS ---
    socket.on('player:joinGame', ({ playerName, boardId }) => {
        if (!gameState.gameInProgress) {
             socket.emit('error:gameNotStarted', 'The game has not started yet.');
             return;
        }
        const chosenBoard = gameState.boardPool.find(b => b.id === boardId);
        gameState.players[socket.id] = {
            id: socket.id,
            name: playerName,
            board: chosenBoard,
        };
        console.log(`Player ${playerName} joined with board ${boardId}.`);
        // Broadcast the updated state so everyone sees the new player
        io.emit('game:update', gameState);
    });
    
    socket.on('player:claimWin', () => {
        const player = gameState.players[socket.id];
        if (!player) return;

        // Server-side win verification
        const boardCards = new Set(player.board.cards);
        const drawnCardsSet = new Set(gameState.drawnCards);
        let allCardsMatch = true;
        for (const card of boardCards) {
            if (!drawnCardsSet.has(card)) {
                allCardsMatch = false;
                break;
            }
        }

        if (allCardsMatch) {
            console.log(`Win confirmed for player: ${player.name}`);
            // Notify only the host
            io.to(gameState.hostSocketId).emit('game:playerWon', player.name);
        }
    });

    // --- GENERAL EVENTS ---
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // If the disconnected user was the host, end the game.
        if (socket.id === gameState.hostSocketId) {
            console.log('Host disconnected. Ending game.');
            resetGame();
            // Tell everyone the game ended
            io.emit('game:ended', 'The host has disconnected. The game is over.');
        } else {
            // If it was a player, remove them from the list.
            delete gameState.players[socket.id];
            // Broadcast the change.
            io.emit('game:update', gameState);
        }
    });

    // Send the current board pool to the newly connected player
    socket.emit('game:boardPool', gameState.boardPool);
});


// 3. START THE SERVER
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

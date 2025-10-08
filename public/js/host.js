document.addEventListener('DOMContentLoaded', () => {
    // Connect to the server
    const socket = io();

    // Get elements from host.html
    const createGameBtn = document.getElementById('create-game-btn');
    const drawCardBtn = document.getElementById('draw-card-btn');
    const drawnCardDisplay = document.getElementById('drawn-card-display');
    const drawnImageView = document.getElementById('drawn-image-view');
    const drawnCardsView = document.getElementById('drawn-cards-view');
    const playerList = document.getElementById('player-list');

    // --- HOST ACTIONS ---
    createGameBtn.addEventListener('click', () => {
        socket.emit('host:createGame');
        createGameBtn.disabled = true;
        drawCardBtn.disabled = false;
        drawnCardsView.innerHTML = ''; // Clear previous game cards
        playerList.innerHTML = ''; // Clear previous player list
        console.log('Host creating new game...');
    });

    drawCardBtn.addEventListener('click', () => {
        socket.emit('host:drawCard');
    });

    // --- LISTEN FOR SERVER EVENTS ---
    socket.on('connect', () => {
        console.log('Host connected to server!');
    });

    socket.on('game:cardDrawn', (cardId) => {
        // Update the main display
        drawnImageView.src = `/images/Deck/${cardId}`;
        
        // Add the card to the history grid
        const cardCell = document.createElement('div');
        cardCell.classList.add('drawn-card-cell');
        const cardImg = document.createElement('img');
        cardImg.src = `/images/Deck/${cardId}`;
        cardCell.appendChild(cardImg);
        drawnCardsView.appendChild(cardCell);
    });

    socket.on('game:playerJoined', (player) => {
        const playerItem = document.createElement('li');
        playerItem.id = `player-${player.id}`;
        playerItem.textContent = `${player.name} (Tablero #${player.boardId})`;
        playerList.appendChild(playerItem);
    });

    socket.on('game:playerWon', (player) => {
        const playerItem = document.getElementById(`player-${player.id}`);
        if (playerItem) {
            playerItem.innerHTML += ' <strong>- ¡LOTERÍA!</strong>';
            playerItem.style.color = '#ff037e';
        }
    });
    
    socket.on('game:playerLeft', (playerId) => {
        const playerItem = document.getElementById(`player-${playerId}`);
        if (playerItem) {
            playerItem.remove();
        }
    });
});

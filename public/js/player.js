document.addEventListener('DOMContentLoaded', () => {
    // By leaving io() blank, it automatically connects to the domain
    // that the page is being served from.
    const socket = io();

    const screens = {
        join: document.getElementById('join-screen'),
        game: document.getElementById('game-screen')
    };
    const joinForm = document.getElementById('join-form');
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const boardSelect = document.getElementById('board-select');
    
    // Game screen elements
    const chosenBoardName = document.getElementById('chosen-board-name');
    const gameBoardDisplay = document.getElementById('game-board-display');
    const gameBoardImage = document.getElementById('game-board-image');
    const loteriaButton = document.getElementById('loteria-button');
    const markerGrid = document.getElementById('marker-grid');

    let currentBoardData = null;

    // --- SOCKET.IO EVENT LISTENERS ---
    socket.on('connect', () => {
        console.log('Player connected to the server!');
    });

    socket.on('game:state', (state) => {
        if (!state.gameInProgress) {
            alert('Waiting for the host to start a new game.');
            return;
        }

        const availableBoards = state.boards.filter(board => !board.assigned);
        boardSelect.innerHTML = '<option value="">-- Elige un tablero --</option>';
        availableBoards.forEach(board => {
            const option = document.createElement('option');
            option.value = board.id;
            option.textContent = `Tablero #${board.id}`;
            boardSelect.appendChild(option);
        });
    });

    socket.on('game:cardDrawn', (cardId) => {
        if (!currentBoardData) return;

        const cardOnBoard = currentBoardData.cards.find(c => c.id === cardId);
        if (cardOnBoard) {
            const marker = document.querySelector(`.marker[data-row='${cardOnBoard.row}'][data-col='${cardOnBoard.col}']`);
            if (marker) {
                marker.classList.add('marked');
            }
        }
    });

    socket.on('player:joined', (data) => {
        screens.join.style.display = 'none';
        screens.game.style.display = 'flex';
        chosenBoardName.textContent = `Tablero #${data.boardId}`;
    });
    
    socket.on('player:error', (message) => {
        alert(`Error: ${message}`);
    });

    // --- DOM EVENT LISTENERS ---
    boardSelect.addEventListener('change', () => {
        const boardId = boardSelect.value;
        
        // ✨ FIX: Find both preview elements right when they are needed.
        const boardPreview = document.getElementById('board-preview');
        const boardPreviewImage = document.getElementById('board-preview-image');

        if (boardId && boardPreviewImage && boardPreview) {
            boardPreviewImage.src = `/images/boards/T${boardId}.webp`;
            boardPreview.style.display = 'block';
        } else if (boardPreview) {
            boardPreview.style.display = 'none';
        }
    });

    joinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        const boardId = boardSelect.value;

        if (name && phone && boardId) {
            socket.emit('player:join', { name, phone, boardId });
            
            fetch('/boards.json')
                .then(res => res.json())
                .then(boards => {
                    currentBoardData = boards.find(b => b.boardNumber == boardId);
                    if(currentBoardData) {
                        gameBoardImage.src = `/images/boards/T${boardId}.webp`;
                        populateMarkerGrid();
                    }
                });

        } else {
            alert('Por favor, llena todos los campos.');
        }
    });
    
    loteriaButton.addEventListener('click', () => {
        socket.emit('player:loteria');
        loteriaButton.disabled = true;
        loteriaButton.textContent = '¡LOTERÍA GRITADA!';
    });

    function populateMarkerGrid() {
        markerGrid.innerHTML = '';
        if (!currentBoardData) return;
        
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const marker = document.createElement('div');
                marker.classList.add('marker');
                marker.dataset.row = r;
                marker.dataset.col = c;
                markerGrid.appendChild(marker);
            }
        }
    }
});


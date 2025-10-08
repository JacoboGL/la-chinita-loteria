document.addEventListener('DOMContentLoaded', () => {
    // By leaving io() blank, it automatically connects to the domain
    // that the page is being served from.
    const socket = io();
    let currentBoardData = null;

    // --- SOCKET.IO EVENT LISTENERS ---
    socket.on('connect', () => {
        console.log('Player connected to the server!');
    });

    socket.on('game:state', (state) => {
        const boardSelect = document.getElementById('board-select');
        if (!boardSelect) return; // Guard clause

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
        const joinScreen = document.getElementById('join-screen');
        const gameScreen = document.getElementById('game-screen');
        const chosenBoardName = document.getElementById('chosen-board-name');

        if (joinScreen) joinScreen.style.display = 'none';
        if (gameScreen) gameScreen.style.display = 'flex';
        if (chosenBoardName) chosenBoardName.textContent = `Tablero #${data.boardId}`;
    });
    
    socket.on('player:error', (message) => {
        alert(`Error: ${message}`);
    });

    // --- DOM EVENT LISTENERS ---
    const boardSelect = document.getElementById('board-select');
    if (boardSelect) {
        boardSelect.addEventListener('change', () => {
            const boardId = boardSelect.value;
            const boardPreview = document.getElementById('board-preview');
            const boardPreviewImage = document.getElementById('board-preview-image');

            if (boardId && boardPreviewImage && boardPreview) {
                boardPreviewImage.src = `/images/boards/T${boardId}.webp`;
                boardPreview.style.display = 'block';
            } else if (boardPreview) {
                boardPreview.style.display = 'none';
            }
        });
    }

    const joinForm = document.getElementById('join-form');
    if (joinForm) {
        joinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('name');
            const phoneInput = document.getElementById('phone');
            const boardSelectInput = document.getElementById('board-select');

            if (!nameInput || !phoneInput || !boardSelectInput) {
                console.error("Could not find all form inputs!");
                alert('Hubo un error con el formulario. Por favor, refresca la página.');
                return;
            }

            const name = nameInput.value.trim();
            const phone = phoneInput.value.trim();
            const boardId = boardSelectInput.value;

            if (name && phone && boardId) {
                socket.emit('player:join', { name, phone, boardId });
                
                fetch('/boards.json')
                    .then(res => res.json())
                    .then(boards => {
                        currentBoardData = boards.find(b => b.boardNumber == boardId);
                        if (currentBoardData) {
                            const gameBoardImage = document.getElementById('game-board-image');
                            if (gameBoardImage) gameBoardImage.src = `/images/boards/T${boardId}.webp`;
                            populateMarkerGrid();
                        }
                    });

            } else {
                alert('Por favor, llena todos los campos.');
            }
        });
    }
    
    const loteriaButton = document.getElementById('loteria-button');
    if (loteriaButton) {
        loteriaButton.addEventListener('click', () => {
            socket.emit('player:loteria');
            loteriaButton.disabled = true;
            loteriaButton.textContent = '¡LOTERÍA GRITADA!';
        });
    }

    function populateMarkerGrid() {
        const markerGrid = document.getElementById('marker-grid');
        if (!markerGrid) return;

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


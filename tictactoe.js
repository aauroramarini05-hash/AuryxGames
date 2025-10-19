// Tic Tac Toe game script
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const pvpBtn = document.getElementById('pvp-btn');
const pvcBtn = document.getElementById('pvc-btn');
const resetBtn = document.getElementById('reset-btn');

// Game state
let board;
let currentPlayer;
let mode = null; // 'pvp' or 'pvc'
let gameActive = false;

function initBoard() {
  board = Array(9).fill('');
  currentPlayer = 'X';
  gameActive = true;
  boardEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.addEventListener('click', handleCellClick);
    boardEl.appendChild(cell);
  }
  updateStatus(`Turno del giocatore ${currentPlayer}`);
}

function updateStatus(msg) {
  statusEl.textContent = msg;
}

function handleCellClick(e) {
  if (!gameActive) return;
  const index = parseInt(e.target.dataset.index);
  if (board[index] !== '') return;
  makeMove(index, currentPlayer);
  if (checkWin(board, currentPlayer)) {
    updateStatus(`Giocatore ${currentPlayer} ha vinto!`);
    gameActive = false;
    return;
  }
  if (board.every((v) => v !== '')) {
    updateStatus('Pareggio!');
    gameActive = false;
    return;
  }
  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  updateStatus(`Turno del giocatore ${currentPlayer}`);
  if (mode === 'pvc' && currentPlayer === 'O') {
    setTimeout(computerMove, 200);
  }
}

function makeMove(index, player) {
  board[index] = player;
  const cell = boardEl.children[index];
  cell.textContent = player;
  cell.style.cursor = 'default';
}

// Check if a player has won
function checkWin(b, player) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  return lines.some((line) =>
    line.every((index) => b[index] === player)
  );
}

// Computer move using minimax algorithm
function computerMove() {
  // Choose best move for 'O'
  const best = minimax(board.slice(), 'O');
  makeMove(best.index, 'O');
  if (checkWin(board, 'O')) {
    updateStatus('Il computer ha vinto!');
    gameActive = false;
    return;
  }
  if (board.every((v) => v !== '')) {
    updateStatus('Pareggio!');
    gameActive = false;
    return;
  }
  currentPlayer = 'X';
  updateStatus(`Turno del giocatore ${currentPlayer}`);
}

function minimax(newBoard, player) {
  const avail = newBoard.map((v, i) => (v === '' ? i : null)).filter((v) => v !== null);

  // Terminal states
  if (checkWin(newBoard, 'X')) return { score: -10 };
  if (checkWin(newBoard, 'O')) return { score: 10 };
  if (avail.length === 0) return { score: 0 };

  const moves = [];
  for (let i = 0; i < avail.length; i++) {
    const index = avail[i];
    const move = {};
    move.index = index;
    newBoard[index] = player;
    if (player === 'O') {
      const result = minimax(newBoard, 'X');
      move.score = result.score;
    } else {
      const result = minimax(newBoard, 'O');
      move.score = result.score;
    }
    newBoard[index] = '';
    moves.push(move);
  }
  // Choose optimal move
  let bestMove;
  if (player === 'O') {
    let bestScore = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      if (moves[i].score > bestScore) {
        bestScore = moves[i].score;
        bestMove = moves[i];
      }
    }
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < moves.length; i++) {
      if (moves[i].score < bestScore) {
        bestScore = moves[i].score;
        bestMove = moves[i];
      }
    }
  }
  return bestMove;
}

// Event listeners for mode selection
pvpBtn.addEventListener('click', () => {
  mode = 'pvp';
  initBoard();
});

pvcBtn.addEventListener('click', () => {
  mode = 'pvc';
  initBoard();
});

resetBtn.addEventListener('click', () => {
  if (mode) initBoard();
});
// Simple Snake game implementation
// Canvas and context
const canvas = document.getElementById('snake-canvas');
const ctx = canvas.getContext('2d');

// Grid settings
const tileSize = 20;
const tileCountX = canvas.width / tileSize;
const tileCountY = canvas.height / tileSize;

// Game state
let snake = [{ x: Math.floor(tileCountX / 2), y: Math.floor(tileCountY / 2) }];
let velocity = { x: 0, y: 0 };
let apple = spawnApple();
let score = 0;
let gameOver = false;
const scoreEl = document.getElementById('score');
const restartSection = document.querySelector('.restart');
const restartBtn = document.getElementById('restart-btn');

// Spawn a new apple at a random empty location
function spawnApple() {
  let position;
  do {
    position = {
      x: Math.floor(Math.random() * tileCountX),
      y: Math.floor(Math.random() * tileCountY),
    };
  } while (snake.some((seg) => seg.x === position.x && seg.y === position.y));
  return position;
}

// Main game loop
function gameLoop() {
  if (gameOver) return;
  update();
  draw();
  setTimeout(gameLoop, 100);
}

// Update game state
function update() {
  // Move snake
  const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };
  // Wrap around edges
  head.x = (head.x + tileCountX) % tileCountX;
  head.y = (head.y + tileCountY) % tileCountY;

  // Check collision with self
  if (snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
    endGame();
    return;
  }

  snake.unshift(head);
  // Check apple collision
  if (head.x === apple.x && head.y === apple.y) {
    score += 10;
    scoreEl.textContent = score;
    apple = spawnApple();
  } else {
    snake.pop();
  }
}

// Draw everything
function draw() {
  // Clear canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Draw apple
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(apple.x * tileSize, apple.y * tileSize, tileSize, tileSize);
  // Draw snake
  ctx.fillStyle = '#2ecc71';
  snake.forEach((seg, index) => {
    ctx.fillRect(seg.x * tileSize, seg.y * tileSize, tileSize, tileSize);
    // draw eyes on head
    if (index === 0) {
      ctx.fillStyle = '#fff';
      const eyeSize = tileSize / 5;
      const offset = tileSize / 3;
      let eyeX1 = seg.x * tileSize + offset;
      let eyeY1 = seg.y * tileSize + offset;
      let eyeX2 = seg.x * tileSize + tileSize - offset - eyeSize;
      let eyeY2 = eyeY1;
      ctx.fillRect(eyeX1, eyeY1, eyeSize, eyeSize);
      ctx.fillRect(eyeX2, eyeY2, eyeSize, eyeSize);
      ctx.fillStyle = '#2ecc71';
    }
  });
}

// Handle game over
function endGame() {
  gameOver = true;
  restartSection.style.display = 'block';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = '16px Arial';
  ctx.fillText('Punteggio: ' + score, canvas.width / 2, canvas.height / 2 + 20);
}

// Restart game
restartBtn.addEventListener('click', () => {
  snake = [{ x: Math.floor(tileCountX / 2), y: Math.floor(tileCountY / 2) }];
  velocity = { x: 0, y: 0 };
  apple = spawnApple();
  score = 0;
  scoreEl.textContent = score;
  gameOver = false;
  restartSection.style.display = 'none';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  gameLoop();
});

// Handle keyboard input
document.addEventListener('keydown', (e) => {
  const key = e.key;
  // Prevent reversing direction
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      if (velocity.y === 1) break;
      velocity = { x: 0, y: -1 };
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      if (velocity.y === -1) break;
      velocity = { x: 0, y: 1 };
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      if (velocity.x === 1) break;
      velocity = { x: -1, y: 0 };
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      if (velocity.x === -1) break;
      velocity = { x: 1, y: 0 };
      break;
  }
});

// Start the game
gameLoop();
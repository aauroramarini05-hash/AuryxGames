// Memory game implementation
const gridEl = document.getElementById('memory-grid');
const statusMemory = document.getElementById('status');
const restartMemoryBtn = document.getElementById('restart-memory');

// Set of icons or emoji used for cards (8 pairs)
const icons = ['🍎', '⭐', '🐶', '🐱', '🌙', '🏀', '🎵', '🎈'];
let cards = [];
let flippedCards = [];
let matchedCount = 0;
let lockBoard = false;

function shuffle(array) {
  // Fisher–Yates shuffle
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function initMemory() {
  gridEl.innerHTML = '';
  matchedCount = 0;
  flippedCards = [];
  lockBoard = false;
  statusMemory.textContent = 'Abbina tutte le coppie!';
  // Duplicate and shuffle icons
  cards = shuffle(icons.concat(icons)).map((icon) => ({ icon, matched: false }));
  cards.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.index = index;
    cardEl.textContent = '';
    cardEl.addEventListener('click', handleCardClick);
    gridEl.appendChild(cardEl);
  });
}

function handleCardClick(e) {
  if (lockBoard) return;
  const cardEl = e.currentTarget;
  const index = parseInt(cardEl.dataset.index);
  const card = cards[index];
  if (card.matched || flippedCards.includes(index)) return;
  flipCard(cardEl, card.icon);
  flippedCards.push(index);
  if (flippedCards.length === 2) {
    checkMatch();
  }
}

function flipCard(cardEl, icon) {
  cardEl.classList.add('flipped');
  cardEl.textContent = icon;
}

function unflipCard(cardEl) {
  cardEl.classList.remove('flipped');
  cardEl.textContent = '';
}

function checkMatch() {
  lockBoard = true;
  const [i1, i2] = flippedCards;
  const card1 = cards[i1];
  const card2 = cards[i2];
  const el1 = gridEl.children[i1];
  const el2 = gridEl.children[i2];
  if (card1.icon === card2.icon) {
    card1.matched = card2.matched = true;
    matchedCount++;
    flippedCards = [];
    lockBoard = false;
    if (matchedCount === icons.length) {
      statusMemory.textContent = 'Complimenti! Hai trovato tutte le coppie!';
    }
  } else {
    setTimeout(() => {
      unflipCard(el1);
      unflipCard(el2);
      flippedCards = [];
      lockBoard = false;
    }, 800);
  }
}

restartMemoryBtn.addEventListener('click', () => {
  initMemory();
});

// Initialize on load
initMemory();
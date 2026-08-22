
let dictionary = [];
let todayPuzzle = null;
let activeTappedTile = null; // The seed letter currently selected from the bank
let activeGridCell = null;   // The grid cell currently focused for typing

// Track which seed letters have been placed
let seedState = [
  { id: 0, letter: '', used: false, gridRow: null, gridCol: null },
  { id: 1, letter: '', used: false, gridRow: null, gridCol: null },
  { id: 2, letter: '', used: false, gridRow: null, gridCol: null },
  { id: 3, letter: '', used: false, gridRow: null, gridCol: null }
];

async function loadGameData() {
  try {
    // 1. Load dictionary JSON
    const dictResponse = await fetch(window.CONFIG.dictionaryPath);
    dictionary = await dictResponse.json();

    // 2. Fetch Google Sheet CSV
    let sheetRows = [];
    try {
      const sheetResponse = await fetch(window.CONFIG.googleSheetCsvUrl);
      if (sheetResponse.ok) {
        const csvText = await sheetResponse.text();
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        // Parse CSV rows assuming format: Date, Word
        sheetRows = lines.slice(1).map(line => {
          const parts = line.split(',').map(p => p.replace(/"/g, '').trim());
          return { date: parts[0], word: parts[1] };
        });
      }
    } catch (sheetErr) {
      console.warn("Could not load Google Sheet, falling back to default config.", sheetErr);
    }

    // 3. Determine target word
    const targetWord = await getTargetWord(sheetRows);

    // 4. Populate seedState with target letters
    const letters = targetWord.split('');
    seedState.forEach((seed, idx) => {
      seed.letter = letters[idx] || '';
      seed.used = false;
      seed.gridRow = null;
      seed.gridCol = null;
    });

    todayPuzzle = {
      puzzleNumber: window.CONFIG.fallbackPuzzle.puzzleNumber,
      seedWord: targetWord
    };

    // 5. Render tray
    renderSeedBank();
  } catch (err) {
    console.error("Failed to load game data:", err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadGameData();
  setupTutorial();
  initializeInteractions();
  applyAuroTheme();
});

async function getTargetWord(sheetData) {
  const today = new Date();
  const dayOfMonth = today.getDate(); // Returns day of the month (1-31)

  // 1. Special Rule: If today is the 5th of any month, force the word to "AURO"
  if (dayOfMonth === 5) {
    console.log("Special day trigger: Word set to AURO");
    return "AURO";
  }

  // 2. Otherwise, autofill from Google Sheet / Array Index
  try {
    // If you have sheet rows loaded:
    if (sheetData && sheetData.length > 0) {
      const todayString = today.toISOString().split('T')[0];
      const foundRow = sheetData.find(row => row.date === todayString);
      
      if (foundRow && foundRow.word) {
        return foundRow.word.toUpperCase();
      }
    }
  } catch (err) {
    console.warn("Could not fetch sheet word, falling back to default calculation", err);
  }

  // 3. No sheet entry for today either -> deterministically pick a word from
  //    the dictionary based on today's date, so every day still gets a
  //    playable puzzle instead of always defaulting to AURO.
  if (dictionary && dictionary.length > 0) {
    const fourLetterWords = dictionary
      .map(w => w.toUpperCase())
      .filter(w => w.length === 4);

    if (fourLetterWords.length > 0) {
      const seedNumber = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      const index = seedNumber % fourLetterWords.length;
      return fourLetterWords[index];
    }
  }

  // Absolute last resort if dictionary failed to load at all
  return window.CONFIG.fallbackPuzzle.seedWord;
}
function setupTutorial() {
  // Show tutorial on first load (could use localStorage to hide later)
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('tutorial-modal').classList.remove('hidden');

  document.getElementById('close-tutorial-btn').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('tutorial-modal').classList.add('hidden');
  });
}

function renderSeedBank() {
  const bank = document.getElementById('seed-bank');
  bank.innerHTML = '';
  
  seedState.forEach((seed) => {
    const tile = document.createElement('div');
    tile.classList.add('draggable-letter');
    if (seed.used) tile.classList.add('used');
    
    tile.setAttribute('id', `seed-letter-${seed.id}`);
    tile.innerText = seed.letter;
    
    // Select seed tile to place
    tile.addEventListener('click', () => {
      if (seed.used) return; // Can't select if already placed
      
      if (activeTappedTile === seed.id) {
        tile.style.background = 'var(--color-absent)';
        activeTappedTile = null;
      } else {
        // Deselect previous
        if (activeTappedTile !== null) {
          document.getElementById(`seed-letter-${activeTappedTile}`).style.background = 'var(--color-absent)';
        }
        activeTappedTile = seed.id;
        tile.style.background = 'var(--color-correct)'; // Highlight intent to place
      }
    });
    
    bank.appendChild(tile);
  });
}

function initializeInteractions() {
  const cells = Array.from(document.querySelectorAll('.cell:not(.invisible-space)'));
  const keyboardInput = document.getElementById('hidden-keyboard-input');
  const submitBtn = document.getElementById('submit-btn');

  // Handle clicking on the grid
  cells.forEach((cell, idx) => {
    cell.addEventListener('click', () => {
      const r = parseInt(cell.getAttribute('data-row'));
      const c = parseInt(cell.getAttribute('data-col'));

      // 1. If a grid cell WITH a seed letter is clicked, return it to bank
      if (cell.classList.contains('is-seed')) {
        const seedId = parseInt(cell.getAttribute('data-seed-id'));
        seedState[seedId].used = false;
        seedState[seedId].gridRow = null;
        seedState[seedId].gridCol = null;
        
        cell.value = '';
        cell.classList.remove('is-seed');
        cell.removeAttribute('data-seed-id');
        renderSeedBank(); // Refresh tray
        return;
      }

      // 2. If a seed tile is currently selected from the tray, drop it here
      if (activeTappedTile !== null) {
        // Place it
        cell.value = seedState[activeTappedTile].letter;
        cell.classList.add('is-seed');
        cell.setAttribute('data-seed-id', activeTappedTile);
        
        // Update State
        seedState[activeTappedTile].used = true;
        seedState[activeTappedTile].gridRow = r;
        seedState[activeTappedTile].gridCol = c;
        
        activeTappedTile = null;
        renderSeedBank(); // Will grey out the used letter
        return;
      }

      // 3. Otherwise, set focus for regular typing
      cells.forEach(c => c.classList.remove('active-focus'));
      cell.classList.add('active-focus');
      activeGridCell = cell;
      keyboardInput.focus(); // Bring up mobile keyboard
    });
  });

  // Handle invisible typing input
  keyboardInput.addEventListener('input', (e) => {
    if (!activeGridCell) return;
    
    const val = e.target.value.toUpperCase();
    e.target.value = ''; // Clear hidden input immediately

    if (val.match(/[A-Z]/) && !activeGridCell.classList.contains('is-seed')) {
      activeGridCell.value = val;
      
      // Auto-advance to next empty cell
      const currentIndex = cells.indexOf(activeGridCell);
      let nextIndex = currentIndex + 1;
      while (nextIndex < cells.length && cells[nextIndex].classList.contains('is-seed')) {
        nextIndex++;
      }
      
      if (nextIndex < cells.length) {
        cells.forEach(c => c.classList.remove('active-focus'));
        cells[nextIndex].classList.add('active-focus');
        activeGridCell = cells[nextIndex];
      }
    }
  });

  // Handle Backspace for normal typing
  keyboardInput.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && activeGridCell && !activeGridCell.classList.contains('is-seed')) {
      if (activeGridCell.value !== '') {
        activeGridCell.value = '';
      } else {
        // Move back
        const currentIndex = cells.indexOf(activeGridCell);
        let prevIndex = currentIndex - 1;
        while (prevIndex >= 0 && cells[prevIndex].classList.contains('is-seed')) {
          prevIndex--;
        }
        if (prevIndex >= 0) {
          cells.forEach(c => c.classList.remove('active-focus'));
          cells[prevIndex].classList.add('active-focus');
          activeGridCell = cells[prevIndex];
          activeGridCell.value = '';
        }
      }
    }
  });

  submitBtn.addEventListener('click', validateHollowFrame);
}

async function validateHollowFrame() {
  const cells = document.querySelectorAll('.cell:not(.invisible-space)');
  let board = { 0: ["","","",""], 1: ["","","",""], 2: ["","","",""], 3: ["","","",""] };
  let missingInputs = false;

  cells.forEach(cell => {
    const r = parseInt(cell.getAttribute('data-row'));
    const c = parseInt(cell.getAttribute('data-col'));
    const val = cell.value.trim().toUpperCase();
    if (!val) missingInputs = true;
    board[r][c] = val;
  });

  if (missingInputs) {
    alert("Fill all 12 spaces before submitting.");
    return;
  }
  
  // Rule Check: Did they use all 4 seed letters?
  const unusedSeeds = seedState.filter(s => !s.used);
  if (unusedSeeds.length > 0) {
    alert("You must place all 4 seed letters on the board.");
    return;
  }

  let row0Word = board[0].join("");
  let row3Word = board[3].join("");
  let col0Word = board[0][0] + board[1][0] + board[2][0] + board[3][0];
  let col3Word = board[0][3] + board[1][3] + board[2][3] + board[3][3];

  const targetWords = [row0Word, row3Word, col0Word, col3Word];

  // Get current target seed word (reuse today's already-resolved word instead
  // of re-deriving it, which previously ignored the loaded sheet data)
  const currentSeedWord = (todayPuzzle ? todayPuzzle.seedWord : await getTargetWord()).toUpperCase();

  // 🚫 BLOCK SEED WORD DIRECT GUESS
  if (targetWords.includes(currentSeedWord)) {
    alert(`You cannot enter the target seed word (${currentSeedWord}) directly into the grid!`);
    return;
  }

  const unrecognized = targetWords.filter(w => !dictionary.includes(w.toLowerCase()));

  if (unrecognized.length === 0) {
    triggerWinAnimation(cells);
  } else {
    alert(`Not quite right! These aren't valid words: ${unrecognized.join(", ")}`);
  }
}
function triggerWinAnimation(cells) {
  // Staggered Flip cascade
  cells.forEach((cell, i) => {
    setTimeout(() => {
      cell.classList.remove('is-seed'); // Remove seed color styling
      cell.classList.add('win-flip');
    }, i * 150); // 150ms delay per cell
  });

  // Build dynamic share grid based on cell types
  const getEmoji = (r, c) => {
    const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (!cell || cell.classList.contains('invisible-space')) return '⬛';
    return cell.getAttribute('data-seed-id') !== null ? '🟨' : '🟩';
  };

  const row0 = [0,1,2,3].map(c => getEmoji(0, c)).join('');
  const row1 = [0,1,2,3].map(c => getEmoji(1, c)).join('');
  const row2 = [0,1,2,3].map(c => getEmoji(2, c)).join('');
  const row3 = [0,1,2,3].map(c => getEmoji(3, c)).join('');

  const shareText = `The FourWord #${todayPuzzle ? todayPuzzle.puzzleNumber : 1}\n${row0}\n${row1}\n${row2}\n${row3}`;

  // Wait for animation wave to finish, then show popup
  setTimeout(() => {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('win-modal').classList.remove('hidden');
    document.getElementById('win-stats').innerText = `Puzzle #${todayPuzzle ? todayPuzzle.puzzleNumber : 1} Solved!`;
  }, (cells.length * 150) + 600);

  // Wire up share button
  const shareBtn = document.getElementById('share-btn');
  shareBtn.onclick = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      alert("Result copied to clipboard");
    });
  };
}

// Decorative motifs for the auro theme. Purely CSS/SVG/emoji based —
// no third-party photos are pulled in, so this never has a broken-image problem.
const AURO_MOTIFS = ['🎀', '💌', '✨', '🦋', '📻', '🍒', '💗', '🪩'];

function applyAuroTheme() {
  const urlParams = new URLSearchParams(window.location.search);

  // STRICT gate: theme ONLY activates on the exact ?theme=auro query param.
  // (No hostname sniffing, no other param values.)
  const isAuro = urlParams.get('theme') === 'auro';

  if (!isAuro) return;

  document.body.classList.add('auro-theme');

  const field = document.createElement('div');
  field.classList.add('auro-float-field');
  field.setAttribute('aria-hidden', 'true');

  const COUNT = 14;
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('span');
    el.classList.add('auro-float-item');
    el.textContent = AURO_MOTIFS[i % AURO_MOTIFS.length];

    // Randomize placement, size, drift speed, and delay so it reads as a
    // scattered Pinterest moodboard rather than a grid.
    el.style.left = `${Math.random() * 100}%`;
    el.style.top = `${Math.random() * 100}%`;
    el.style.fontSize = `${1.2 + Math.random() * 1.8}rem`;
    el.style.animationDuration = `${8 + Math.random() * 10}s`;
    el.style.animationDelay = `${Math.random() * -12}s`;
    el.style.setProperty('--drift-x', `${(Math.random() * 40 - 20).toFixed(0)}px`);
    el.style.setProperty('--rot', `${(Math.random() * 30 - 15).toFixed(0)}deg`);

    field.appendChild(el);
  }

  document.body.appendChild(field);
}

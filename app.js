// ===== Supabase Setup =====
const SUPABASE_URL = 'https://qdujrhcnlxyxnkfsvuno.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdWpyaGNubHh5eG5rZnN2dW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MTc5MjUsImV4cCI6MjA4NzM5MzkyNX0.M2scPe3eRfHSMjRDAFufNJewyeyZGhs_daMQ1ArZuIg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== State =====
let reservations = {}; // { "00": ["Name1", "Name2"], "07": ["Name3"], ... }

// ===== DOM References =====
const grid = document.getElementById('numberGrid');
const availableCount = document.getElementById('availableCount');
const reservedCount = document.getElementById('reservedCount');

// Reserve modal
const modalOverlay = document.getElementById('modalOverlay');
const modalNumber = document.getElementById('modalNumber');
const nameInput = document.getElementById('nameInput');
const modalError = document.getElementById('modalError');
const btnConfirm = document.getElementById('btnConfirm');
const btnCancel = document.getElementById('btnCancel');
const modalClose = document.getElementById('modalClose');

// Info modal
const infoModalOverlay = document.getElementById('infoModalOverlay');
const infoModalNumber = document.getElementById('infoModalNumber');
const infoModalNames = document.getElementById('infoModalNames');
const btnInfoClose = document.getElementById('btnInfoClose');
const btnAddMore = document.getElementById('btnAddMore');
const infoModalClose = document.getElementById('infoModalClose');

let selectedNumber = null;

// ===== Load Reservations from Supabase =====
async function loadReservations() {
    const { data, error } = await supabase
        .from('reservations')
        .select('number, name')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading reservations:', error);
        return {};
    }

    // Group by number
    const grouped = {};
    data.forEach(row => {
        if (!grouped[row.number]) {
            grouped[row.number] = [];
        }
        grouped[row.number].push(row.name);
    });
    return grouped;
}

// ===== Format Cell Name =====
function formatCellName(names) {
    if (names.length === 1) return names[0];
    return `${names[0]}, ${names.length - 1}+`;
}

// ===== Build Grid =====
function buildGrid() {
    grid.innerHTML = '';
    for (let i = 0; i < 100; i++) {
        const num = String(i).padStart(2, '0');
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.number = num;
        cell.id = `cell-${num}`;

        const numberEl = document.createElement('span');
        numberEl.className = 'cell-number';
        numberEl.textContent = num;

        const nameEl = document.createElement('span');
        nameEl.className = 'cell-name';
        nameEl.textContent = '';

        cell.appendChild(numberEl);
        cell.appendChild(nameEl);

        // Apply reserved state if exists
        if (reservations[num] && reservations[num].length > 0) {
            cell.classList.add('reserved');
            nameEl.textContent = formatCellName(reservations[num]);
        }

        cell.addEventListener('click', () => handleCellClick(num));
        grid.appendChild(cell);
    }
    updateStats();
}

// ===== Cell Click Handler =====
function handleCellClick(num) {
    selectedNumber = num;
    if (reservations[num] && reservations[num].length > 0) {
        // Show info modal with all names
        infoModalNumber.textContent = num;
        renderNamesList(reservations[num]);
        openModal(infoModalOverlay);
    } else {
        // Show reserve modal
        openReserveModal(num);
    }
}

// ===== Open Reserve Modal =====
function openReserveModal(num) {
    selectedNumber = num;
    modalNumber.textContent = num;
    nameInput.value = '';
    modalError.textContent = '';
    openModal(modalOverlay);
    setTimeout(() => nameInput.focus(), 300);
}

// ===== Render Names List =====
function renderNamesList(names) {
    infoModalNames.innerHTML = '';
    names.forEach((name) => {
        const tag = document.createElement('span');
        tag.className = 'name-tag';
        tag.textContent = name;
        infoModalNames.appendChild(tag);
    });
}

// ===== Reserve =====
async function reserveNumber() {
    const name = nameInput.value.trim();
    if (!name) {
        modalError.textContent = 'Please enter your name.';
        nameInput.focus();
        return;
    }

    // Disable button while saving
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Saving...';

    const { error } = await supabase
        .from('reservations')
        .insert({ number: selectedNumber, name: name });

    btnConfirm.disabled = false;
    btnConfirm.textContent = 'Reserve';

    if (error) {
        modalError.textContent = 'Failed to save. Please try again.';
        console.error('Error reserving:', error);
        return;
    }

    // Update local state
    if (!reservations[selectedNumber]) {
        reservations[selectedNumber] = [];
    }
    reservations[selectedNumber].push(name);

    const cell = document.getElementById(`cell-${selectedNumber}`);
    cell.classList.add('reserved', 'just-reserved');
    cell.querySelector('.cell-name').textContent = formatCellName(reservations[selectedNumber]);

    setTimeout(() => cell.classList.remove('just-reserved'), 600);

    closeModal(modalOverlay);
    updateStats();
}

// ===== Stats =====
function updateStats() {
    const reserved = Object.keys(reservations).filter(k => reservations[k].length > 0).length;
    reservedCount.textContent = reserved;
    availableCount.textContent = 100 - reserved;
}

// ===== Modal Helpers =====
function openModal(overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    selectedNumber = null;
}

// ===== Event Listeners =====
btnConfirm.addEventListener('click', reserveNumber);
btnCancel.addEventListener('click', () => closeModal(modalOverlay));
modalClose.addEventListener('click', () => closeModal(modalOverlay));

btnInfoClose.addEventListener('click', () => closeModal(infoModalOverlay));
infoModalClose.addEventListener('click', () => closeModal(infoModalOverlay));

// "Add My Name" from the info modal
btnAddMore.addEventListener('click', () => {
    const num = selectedNumber;
    closeModal(infoModalOverlay);
    setTimeout(() => openReserveModal(num), 200);
});

// Close modals on overlay click
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal(modalOverlay);
});
infoModalOverlay.addEventListener('click', (e) => {
    if (e.target === infoModalOverlay) closeModal(infoModalOverlay);
});

// Enter key to confirm
nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') reserveNumber();
    modalError.textContent = '';
});

// Escape to close
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal(modalOverlay);
        closeModal(infoModalOverlay);
    }
});

// ===== Init =====
async function init() {
    reservations = await loadReservations();
    buildGrid();
}

init();

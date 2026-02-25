// ===== Supabase Setup =====
const SUPABASE_URL = 'https://qdujrhcnlxyxnkfsvuno.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdWpyaGNubHh5eG5rZnN2dW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MTc5MjUsImV4cCI6MjA4NzM5MzkyNX0.M2scPe3eRfHSMjRDAFufNJewyeyZGhs_daMQ1ArZuIg';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== State =====
let reservations = {}; // { "00": "Name1", "07": "Name2", ... }
let reservationOpen = true;

// ===== DOM References =====
const grid = document.getElementById('numberGrid');

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
const infoModalClose = document.getElementById('infoModalClose');

let selectedNumber = null;

// ===== Load Reservations from Supabase =====
async function loadReservations() {
    const { data, error } = await db
        .from('reservations')
        .select('number, name')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading reservations:', error);
        return {};
    }

    // Map by number (single name per number)
    const mapped = {};
    data.forEach(row => {
        mapped[row.number] = row.name;
    });
    return mapped;
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
        if (reservations[num]) {
            cell.classList.add('reserved');
            nameEl.textContent = reservations[num];
        }

        cell.addEventListener('click', () => handleCellClick(num));
        grid.appendChild(cell);
    }
}

// ===== Cell Click Handler =====
function handleCellClick(num) {
    selectedNumber = num;
    if (reservations[num]) {
        // Show info modal
        infoModalNumber.textContent = num;
        infoModalNames.textContent = reservations[num];
        openModal(infoModalOverlay);
    } else if (!reservationOpen) {
        alert('❌ ขณะนี้ปิดรับการจองแล้ว');
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

    // Double-check reservation status from server before inserting
    await loadReservationStatus();
    if (!reservationOpen) {
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'Reserve';
        modalError.textContent = '❌ ขณะนี้ปิดรับการจองแล้ว';
        return;
    }

    const { error } = await db
        .from('reservations')
        .insert({ number: selectedNumber, name: name });

    btnConfirm.disabled = false;
    btnConfirm.textContent = 'Reserve';

    if (error) {
        // Unique constraint violation = someone else reserved it first
        if (error.code === '23505') {
            modalError.textContent = '❌ หมายเลขนี้ถูกจองแล้ว กรุณาเลือกหมายเลขอื่น';
            // Refresh reservations to update the grid
            reservations = await loadReservations();
            buildGrid();
        } else {
            modalError.textContent = 'Failed to save. Please try again.';
            console.error('Error reserving:', error);
        }
        return;
    }

    // Update local state
    reservations[selectedNumber] = name;

    const cell = document.getElementById(`cell-${selectedNumber}`);
    cell.classList.add('reserved', 'just-reserved');
    cell.querySelector('.cell-name').textContent = name;

    setTimeout(() => cell.classList.remove('just-reserved'), 600);

    closeModal(modalOverlay);
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

// ===== Load Reservation Status =====
async function loadReservationStatus() {
    const { data, error } = await db.from('settings').select('value').eq('key', 'reservation_open').single();
    if (!error && data) {
        reservationOpen = data.value === 'true';
    }
}

// ===== Init =====
async function init() {
    reservations = await loadReservations();
    await loadReservationStatus();
    buildGrid();

    // Subscribe to realtime changes
    db.channel('reservations-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservations' }, (payload) => {
            const { number, name } = payload.new;
            if (!reservations[number]) {
                reservations[number] = name;
                const cell = document.getElementById(`cell-${number}`);
                if (cell) {
                    cell.classList.add('reserved', 'just-reserved');
                    cell.querySelector('.cell-name').textContent = name;
                    setTimeout(() => cell.classList.remove('just-reserved'), 600);
                }
            }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reservations' }, async () => {
            reservations = await loadReservations();
            buildGrid();
        })
        .subscribe();

    // Subscribe to settings changes (open/close)
    db.channel('settings-channel')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (payload) => {
            if (payload.new.key === 'reservation_open') {
                reservationOpen = payload.new.value === 'true';
            }
        })
        .subscribe();
}

init();

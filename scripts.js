// scripts.js
// Building selection
const buildings = document.querySelectorAll('.building');
buildings.forEach(building => {
    building.addEventListener('click', () => {
        buildings.forEach(b => b.style.backgroundColor = '#28a745');
        building.style.backgroundColor = '#218838';
    });
});

// Table editing
const checkboxes = document.querySelectorAll('input[type="checkbox"]');
checkboxes.forEach(checkbox => {
    const row = checkbox.closest('tr');
    const laiksCell = row.cells[2];
    const vardsCell = row.cells[3];
    const uzvardsCell = row.cells[4];

    // Initial setup
    if (checkbox.checked) {
        vardsCell.contentEditable = false;
        uzvardsCell.contentEditable = false;
    } else {
        vardsCell.contentEditable = true;
        uzvardsCell.contentEditable = true;
    }

    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            // Available
            laiksCell.innerText = '-';
            vardsCell.innerText = '-';
            uzvardsCell.innerText = '-';
            vardsCell.contentEditable = false;
            uzvardsCell.contentEditable = false;
        } else {
            // Taken
            const now = new Date(2025, 9, 16); // October 16, 2025
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            laiksCell.innerText = `${hours}:${minutes}`;
            vardsCell.innerText = '';
            uzvardsCell.innerText = '';
            vardsCell.contentEditable = true;
            uzvardsCell.contentEditable = true;
            vardsCell.focus();
        }
    });
});
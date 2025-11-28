let db;
let currentBuilding = 'Vecais korpuss';

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function initDB() {
    const config = {
        locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${filename}`
    };
    const SQL = await initSqlJs(config);
    let saved = localStorage.getItem('keydb');
    if (saved) {
        const u8array = new Uint8Array(atob(saved).split('').map(c => c.charCodeAt(0)));
        db = new SQL.Database(u8array);
    } else {
        db = new SQL.Database();
        db.run(`
            CREATE TABLE keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                building TEXT,
                floor INTEGER,
                cabinet TEXT,
                available BOOLEAN DEFAULT 1,
                laiks TEXT DEFAULT '-',
                vards TEXT DEFAULT '-',
                uzvards TEXT DEFAULT '-'
            );
        `);
        const buildings = ['Vecais korpuss', 'Jaunais korpuss', 'Sporta korpuss', 'Tornis'];
        const cabinets = {1: ['1', '2', '3', '4'], 2: ['10', '11']};
        for (let b of buildings) {
            for (let f = 1; f <= 2; f++) {
                for (let c of cabinets[f]) {
                    db.run(`INSERT INTO keys (building, floor, cabinet) VALUES (?, ?, ?);`, [b, f, c]);
                }
            }
        }
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT
        );
    `);

    const stmtCheck = db.prepare('SELECT * FROM users WHERE username = ?');
    stmtCheck.bind(['admin']);
    if (!stmtCheck.step()) {
        const hashed = await hashPassword('password');
        db.run(`INSERT INTO users (username, password) VALUES (?, ?);`, ['admin', hashed]);
    }
    stmtCheck.free();
    saveDB();
}

function saveDB() {
    const data = db.export();
    const base64 = btoa(String.fromCharCode.apply(null, data));
    localStorage.setItem('keydb', base64);
}

function renderTables() {
    const tablesDiv = document.querySelector('.tables');
    tablesDiv.innerHTML = '';
    const floorsRes = db.exec(`SELECT DISTINCT floor FROM keys WHERE building = ? ORDER BY floor;`, [currentBuilding]);
    const floors = floorsRes[0] ? floorsRes[0].values.map(v => v[0]) : [];
    for (let floor of floors) {
        const header = document.createElement('div');
        header.className = 'floor-header';
        header.innerText = `${floor}.stāvs`;
        tablesDiv.appendChild(header);
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        ['Kabinets', 'Pieejamība', 'Laiks', 'Vārds', 'Uzvārds'].forEach(text => {
            const th = document.createElement('th');
            th.innerText = text;
            tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        const rowsRes = db.exec(`SELECT id, cabinet, available, laiks, vards, uzvards FROM keys WHERE building = ? AND floor = ?;`, [currentBuilding, floor]);
        if (rowsRes[0]) {
            rowsRes[0].values.forEach(rowData => {
                const [id, cabinet, available, laiks, vards, uzvards] = rowData;
                const row = document.createElement('tr');
                const tdCab = document.createElement('td');
                tdCab.innerText = cabinet;
                row.appendChild(tdCab);
                const tdAvail = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = !!available;
                tdAvail.appendChild(checkbox);
                row.appendChild(tdAvail);
                const tdLaiks = document.createElement('td');
                tdLaiks.innerText = laiks;
                row.appendChild(tdLaiks);
                const tdVards = document.createElement('td');
                tdVards.innerText = vards;
                tdVards.contentEditable = available ? 'false' : 'true';
                row.appendChild(tdVards);
                const tdUzvards = document.createElement('td');
                tdUzvards.innerText = uzvards;
                tdUzvards.contentEditable = available ? 'false' : 'true';
                row.appendChild(tdUzvards);
                tbody.appendChild(row);
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        db.run(`UPDATE keys SET available=1, laiks='-', vards='-', uzvards='-' WHERE id=?;`, [id]);
                        tdLaiks.innerText = '-';
                        tdVards.innerText = '-';
                        tdVards.contentEditable = 'false';
                        tdUzvards.innerText = '-';
                        tdUzvards.contentEditable = 'false';
                    } else {
                        const now = new Date();
                        const hours = now.getHours().toString().padStart(2, '0');
                        const minutes = now.getMinutes().toString().padStart(2, '0');
                        const timeStr = `${hours}:${minutes}`;
                        db.run(`UPDATE keys SET available=0, laiks=?, vards='', uzvards='' WHERE id=?;`, [timeStr, id]);
                        tdLaiks.innerText = timeStr;
                        tdVards.innerText = '';
                        tdVards.contentEditable = 'true';
                        tdUzvards.innerText = '';
                        tdUzvards.contentEditable = 'true';
                        tdVards.focus();
                    }
                    saveDB();
                });
                [tdVards, tdUzvards].forEach(cell => {
                    cell.addEventListener('blur', () => {
                        const col = cell === tdVards ? 'vards' : 'uzvards';
                        db.run(`UPDATE keys SET ${col}=? WHERE id=?;`, [cell.innerText, id]);
                        saveDB();
                    });
                });
            });
        }
        table.appendChild(tbody);
        tablesDiv.appendChild(table);
    }
}

window.addEventListener('load', async () => {
    await initDB();
    if (document.getElementById('username')) {

        const loginBtn = document.getElementById('login-btn');
        loginBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const hashedPassword = await hashPassword(password);
            const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
            stmt.bind([username, hashedPassword]);
            if (stmt.step()) {
                window.location.href = 'registry.html';
            } else {
                alert('Nepareizs lietotājvārds vai parole!');
            }
            stmt.free();
        });
    } else {

        const buildings = document.querySelectorAll('.building');
        buildings.forEach(building => {
            building.addEventListener('click', () => {
                buildings.forEach(b => b.style.backgroundColor = '#28a745');
                building.style.backgroundColor = '#218838';
                currentBuilding = building.innerText;
                renderTables();
            });
        });

        buildings[0].click();
    }
});
        });
        // Select first building by default
        buildings[0].click();
    }
});

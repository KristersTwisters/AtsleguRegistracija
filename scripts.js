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

        const buildings = ['Vecais korpuss', 'Jaunais korpuss', 'Sporta korpuss', 'Skolas tornis'];

        const cabinetsFloor1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        const cabinetsFloor2 = ['10', '11'];

        for (let b of buildings) {
            for (let c of cabinetsFloor1) {
                db.run(`INSERT INTO keys (building, floor, cabinet) VALUES (?, ?, ?);`, [b, 1, c]);
            }
            for (let c of cabinetsFloor2) {
                db.run(`INSERT INTO keys (building, floor, cabinet) VALUES (?, ?, ?);`, [b, 2, c]);
            }
        }

        db.run(`UPDATE keys SET available=0, laiks='12:25', vards='Jānis', uzvards='Jumis' WHERE building='Vecais korpuss' AND cabinet='2';`);
        db.run(`UPDATE keys SET available=0, laiks='12:40', vards='Kārlis', uzvards='Laimdots' WHERE building='Vecais korpuss' AND cabinet='3';`);
        db.run(`UPDATE keys SET available=0, laiks='13:15', vards='Anna', uzvards='Bērziņa' WHERE building='Vecais korpuss' AND cabinet='7';`);
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
    const floorsRes = db.exec(`SELECT DISTINCT floor FROM keys WHERE building = ? ORDER BY floor`, [currentBuilding]);
    const floors = floorsRes[0] ? floorsRes[0].values.map(v => v[0]) : [];

    for (let floor of floors) {
        const header = document.createElement('div');
        header.className = 'floor-header';
        header.innerText = `${floor}. stāvs`;
        tablesDiv.appendChild(header);

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        ['Kabinets', 'Pieejams', 'Laiks', 'Vārds', 'Uzvārds'].forEach(text => {
            const th = document.createElement('th');
            th.innerText = text;
            tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const rowsRes = db.exec(`SELECT id, cabinet, available, laiks, vards, uzvards FROM keys WHERE building = ? AND floor = ? ORDER BY cabinet`, [currentBuilding, floor]);

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
                tdLaiks.innerText = laiks || '-';
                row.appendChild(tdLaiks);

                const tdVards = document.createElement('td');
                tdVards.innerText = vards || '-';
                tdVards.contentEditable = !available;
                row.appendChild(tdVards);

                const tdUzvards = document.createElement('td');
                tdUzvards.innerText = uzvards || '-';
                tdUzvards.contentEditable = !available;
                row.appendChild(tdUzvards);

                tbody.appendChild(row);

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        db.run(`UPDATE keys SET available=1, laiks='-', vards='-', uzvards='-' WHERE id=?`, [id]);
                        tdLaiks.innerText = '-';
                        tdVards.innerText = '-';
                        tdVards.contentEditable = false;
                        tdUzvards.innerText = '-';
                        tdUzvards.contentEditable = false;
                    } else {
                        const now = new Date();
                        const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
                        db.run(`UPDATE keys SET available=0, laiks=?, vards='', uzvards='' WHERE id=?`, [timeStr, id]);
                        tdLaiks.innerText = timeStr;
                        tdVards.innerText = '';
                        tdVards.contentEditable = true;
                        tdUzvards.innerText = '';
                        tdUzvards.contentEditable = true;
                        tdVards.focus();
                    }
                    saveDB();
                });

                [tdVards, tdUzvards].forEach(cell => {
                    cell.addEventListener('blur', () => {
                        const field = cell === tdVards ? 'vards' : 'uzvards';
                        const value = cell.innerText.trim() || '-';
                        db.run(`UPDATE keys SET ${field}=? WHERE id=?`, [value, id]);
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
        document.getElementById('login-btn').addEventListener('click', async () => {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            if (!username || !password) {
                alert('Lūdzu ievadiet lietotājvārdu un paroli!');
                return;
            }
            const hashed = await hashPassword(password);
            const stmt = db.prepare('SELECT 1 FROM users WHERE username=? AND password=?');
            stmt.bind([username, hashed]);
            if (stmt.step()) {
                window.location.href = 'registry.html';
            } else {
                alert('Nepārzs lietotājvārds vai parole!');
            }
            stmt.free();
        });
    } else {
        const buildings = document.querySelectorAll('.building');
        buildings.forEach(building => {
            building.addEventListener('click', () => {
                document.querySelectorAll('.building').forEach(b => b.style.backgroundColor = '#28a745');
                building.style.backgroundColor = '#218838';
                currentBuilding = building.innerText.trim();
                renderTables();
            });
        });
        if (buildings.length > 0) buildings[0].click();
    }
});

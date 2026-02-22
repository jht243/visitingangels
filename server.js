const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the static frontend files (index.html, styles.css, script.js, assets)
app.use(express.static(path.join(__dirname)));

// --- DATABASE SETUP ---
// This creates a local file named 'waitlist.db' in the project directory
const db = new sqlite3.Database('./waitlist.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create the leads table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            dates_away TEXT,
            message TEXT,
            ab_variant TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error("Error creating table", err.message);
            } else {
                console.log("Leads table ready.");
            }
        });
    }
});

// --- API ENDPOINTS ---

// 1. Submit a new lead (Waitlist Signup)
app.post('/api/waitlist', (req, res) => {
    const { name, email, dates, message, ab_headline_variant } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required.' });
    }

    const sql = `INSERT INTO leads (name, email, dates_away, message, ab_variant) VALUES (?, ?, ?, ?, ?)`;
    const params = [name, email, dates, message, ab_headline_variant || 'Unknown'];

    db.run(sql, params, function (err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Failed to save to waitlist.' });
        }
        res.status(201).json({
            success: true,
            message: 'Successfully added to waitlist',
            leadId: this.lastID
        });
    });
});

// 2. Get Analytics Data (for the Dashboard)
app.get('/api/stats', (req, res) => {
    const stats = {
        totalLeads: 0,
        variants: {},
        recentLeads: []
    };

    // Get total count and ab_variant breakdown
    db.all(`SELECT ab_variant, COUNT(*) as count FROM leads GROUP BY ab_variant`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        rows.forEach(row => {
            stats.variants[row.ab_variant] = row.count;
            stats.totalLeads += row.count;
        });

        // Get 50 most recent leads
        db.all(`SELECT id, name, email, dates_away, message, ab_variant, created_at FROM leads ORDER BY created_at DESC LIMIT 50`, [], (err, leadRows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            stats.recentLeads = leadRows;

            res.json(stats);
        });
    });
});

// --- ROUTES ---

// Serve the Dashboard HTML
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Fallback to index.html for the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Dashboard available at http://localhost:${PORT}/dashboard`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});

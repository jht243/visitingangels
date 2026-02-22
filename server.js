const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const FB_ACCESS_TOKEN = 'EAAKFjuYPZAPABQZCSbu4X02sOpArPgfE5fl65yjxFU4tLNCbPOVBj9n3nqyOXE2rEdFZBPucUMcvzXnYmOa8AWKRer3VMhKbJ0PsS3qDMyU0fRASaQJ22VxBAYagZA47DgZBAZBcBdxJKi3ZCYLNy1LRlTFFHRBD0wMCaZAcOZA6lcc7nZA8aUieZCcUWug1cyqtAZDZD';
const FB_DATASET_ID = '2076938176424726';
const FB_API_VERSION = 'v25.0';

const app = express();
app.set('trust proxy', true);
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

        // --- Send Event to Facebook Conversions API ---
        try {
            // Hash the email for privacy (SHA-256) per FB requirements
            const hashedEmail = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

            const eventPayload = {
                data: [
                    {
                        event_name: "Lead",
                        event_time: Math.floor(Date.now() / 1000),
                        action_source: "website",
                        user_data: {
                            em: [hashedEmail],
                            client_ip_address: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                            client_user_agent: req.headers['user-agent']
                        }
                    }
                ]
            };

            fetch(`https://graph.facebook.com/${FB_API_VERSION}/${FB_DATASET_ID}/events?access_token=${FB_ACCESS_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventPayload)
            })
                .then(fbRes => fbRes.json())
                .then(fbData => console.log('FB Conversions API Response:', fbData))
                .catch(fbErr => console.error('FB Conversions API Error:', fbErr));

        } catch (e) {
            console.error('Failed to prepare FB Event:', e);
        }
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

// 3. Get Facebook Dataset Quality
app.get('/api/fb-quality', async (req, res) => {
    try {
        const fbUrl = `https://graph.facebook.com/${FB_API_VERSION}/dataset_quality?dataset_id=${FB_DATASET_ID}&access_token=${FB_ACCESS_TOKEN}&fields=web`;
        const response = await fetch(fbUrl);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('FB Quality API Error:', err);
        res.status(500).json({ error: 'Failed to fetch FB Quality data' });
    }
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

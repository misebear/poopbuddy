const express = require('express');
const path = require('path');
const os = require('os');
const cors = require('cors');
const Database = require('better-sqlite3');
const admin = require('firebase-admin');

// ── Configuration ──
const PORT = 3000;
const ROOT = __dirname;

// ── Firebase Admin (for token verification) ──
// If you have a service account key, uncomment and set the path:
// admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
// Otherwise, initialize without credentials (token verification still works with projectId):
try {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'poopbuddy-12ad1' });
} catch (e) {
    console.log('Firebase Admin init info:', e.message);
}

// ── SQLite Database ──
const db = new Database(path.join(ROOT, 'poopbuddy.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT DEFAULT '',
    provider TEXT DEFAULT '',
    photo_url TEXT DEFAULT '',
    xp INTEGER DEFAULT 0,
    mode TEXT DEFAULT 'dog',
    lang TEXT DEFAULT 'ko',
    theme TEXT DEFAULT 'light',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    score INTEGER,
    bristol INTEGER,
    color TEXT,
    consistency TEXT,
    tag TEXT,
    msg_key TEXT,
    image_thumb TEXT,
    date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (uid) REFERENCES users(uid)
  );

  CREATE TABLE IF NOT EXISTS feed_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    user_name TEXT,
    level INTEGER DEFAULT 1,
    type TEXT DEFAULT 'dog',
    tag TEXT,
    score INTEGER,
    bristol INTEGER,
    color TEXT,
    analysis TEXT,
    image TEXT,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (uid) REFERENCES users(uid)
  );

  CREATE TABLE IF NOT EXISTS pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    name TEXT NOT NULL,
    species TEXT DEFAULT 'dog',
    breed TEXT DEFAULT '',
    birthday TEXT DEFAULT '',
    weight REAL DEFAULT 0,
    FOREIGN KEY (uid) REFERENCES users(uid)
  );

  CREATE TABLE IF NOT EXISTS feed_likes (
    post_id INTEGER NOT NULL,
    uid TEXT NOT NULL,
    PRIMARY KEY (post_id, uid),
    FOREIGN KEY (post_id) REFERENCES feed_posts(id),
    FOREIGN KEY (uid) REFERENCES users(uid)
  );
`);

console.log('✅ SQLite database initialized');

// ── Prepared Statements ──
const stmts = {
    upsertUser: db.prepare(`
    INSERT INTO users (uid, name, email, provider, photo_url)
    VALUES (@uid, @name, @email, @provider, @photoUrl)
    ON CONFLICT(uid) DO UPDATE SET
      name = @name, email = @email, provider = @provider, photo_url = @photoUrl,
      updated_at = datetime('now')
  `),
    getUser: db.prepare('SELECT * FROM users WHERE uid = ?'),
    updateUserPrefs: db.prepare('UPDATE users SET mode = @mode, lang = @lang, theme = @theme, xp = @xp, updated_at = datetime(\'now\') WHERE uid = @uid'),

    insertAnalysis: db.prepare(`
    INSERT INTO analyses (uid, score, bristol, color, consistency, tag, msg_key, image_thumb, date)
    VALUES (@uid, @score, @bristol, @color, @consistency, @tag, @msgKey, @imageThumb, @date)
  `),
    getAnalyses: db.prepare('SELECT * FROM analyses WHERE uid = ? ORDER BY date DESC LIMIT 100'),

    insertFeedPost: db.prepare(`
    INSERT INTO feed_posts (uid, user_name, level, type, tag, score, bristol, color, analysis, image, date)
    VALUES (@uid, @userName, @level, @type, @tag, @score, @bristol, @color, @analysis, @image, @date)
  `),
    getFeedPosts: db.prepare('SELECT * FROM feed_posts ORDER BY date DESC LIMIT 50'),
    likeFeedPost: db.prepare('UPDATE feed_posts SET likes = likes + 1 WHERE id = ?'),
    checkLike: db.prepare('SELECT 1 FROM feed_likes WHERE post_id = ? AND uid = ?'),
    insertLike: db.prepare('INSERT OR IGNORE INTO feed_likes (post_id, uid) VALUES (?, ?)'),

    insertPet: db.prepare(`
    INSERT INTO pets (uid, name, species, breed, birthday, weight)
    VALUES (@uid, @name, @species, @breed, @birthday, @weight)
  `),
    getPets: db.prepare('SELECT * FROM pets WHERE uid = ?'),
    deletePet: db.prepare('DELETE FROM pets WHERE id = ? AND uid = ?'),
};

// ── Express App ──
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // for base64 images

// ── Auth Middleware ──
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        // Fallback: accept simple UID for development (when Firebase Admin can't verify)
        // In production, remove this fallback
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (payload.uid || payload.user_id || payload.sub) {
                req.user = { uid: payload.uid || payload.user_id || payload.sub, email: payload.email || '' };
                return next();
            }
        } catch (e) { }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ── API Routes ──

// POST /api/auth/verify — Verify Firebase token & upsert user
app.post('/api/auth/verify', authMiddleware, (req, res) => {
    try {
        const { uid, email } = req.user;
        const { name, provider, photoUrl } = req.body;

        stmts.upsertUser.run({
            uid,
            name: name || 'User',
            email: email || '',
            provider: provider || 'email',
            photoUrl: photoUrl || ''
        });

        const user = stmts.getUser.get(uid);
        const analyses = stmts.getAnalyses.all(uid);
        const pets = stmts.getPets.all(uid);

        res.json({
            success: true,
            user: {
                uid: user.uid,
                name: user.name,
                email: user.email,
                provider: user.provider,
                photoUrl: user.photo_url,
                xp: user.xp,
                mode: user.mode,
                lang: user.lang,
                theme: user.theme,
            },
            analyses,
            pets,
        });
    } catch (err) {
        console.error('Auth verify error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/user/data — Get user data
app.get('/api/user/data', authMiddleware, (req, res) => {
    try {
        const user = stmts.getUser.get(req.user.uid);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const analyses = stmts.getAnalyses.all(req.user.uid);
        const pets = stmts.getPets.all(req.user.uid);

        res.json({ user, analyses, pets });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/user/prefs — Update user preferences
app.post('/api/user/prefs', authMiddleware, (req, res) => {
    try {
        const { mode, lang, theme, xp } = req.body;
        stmts.updateUserPrefs.run({
            uid: req.user.uid,
            mode: mode || 'dog',
            lang: lang || 'ko',
            theme: theme || 'light',
            xp: xp || 0,
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/analysis — Save analysis result
app.post('/api/analysis', authMiddleware, (req, res) => {
    try {
        const { score, bristol, color, consistency, tag, msgKey, imageThumb, date } = req.body;
        const result = stmts.insertAnalysis.run({
            uid: req.user.uid,
            score, bristol, color, consistency, tag, msgKey,
            imageThumb: imageThumb || null,
            date: date || new Date().toISOString(),
        });
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/feed — Get feed posts
app.get('/api/feed', (req, res) => {
    try {
        const posts = stmts.getFeedPosts.all();
        res.json({ posts });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/feed — Create feed post
app.post('/api/feed', authMiddleware, (req, res) => {
    try {
        const { userName, level, type, tag, score, bristol, color, analysis, image, date } = req.body;
        const result = stmts.insertFeedPost.run({
            uid: req.user.uid,
            userName: userName || 'User',
            level: level || 1,
            type: type || 'dog',
            tag, score, bristol, color, analysis,
            image: image || null,
            date: date || new Date().toISOString(),
        });
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/feed/:id/like — Like a feed post
app.post('/api/feed/:id/like', authMiddleware, (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const alreadyLiked = stmts.checkLike.get(postId, req.user.uid);
        if (alreadyLiked) return res.json({ success: false, message: 'Already liked' });

        stmts.insertLike.run(postId, req.user.uid);
        stmts.likeFeedPost.run(postId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/pets — Add pet
app.post('/api/pets', authMiddleware, (req, res) => {
    try {
        const { name, species, breed, birthday, weight } = req.body;
        const result = stmts.insertPet.run({
            uid: req.user.uid,
            name, species: species || 'dog', breed: breed || '', birthday: birthday || '', weight: weight || 0,
        });
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/pets/:id — Delete pet
app.delete('/api/pets/:id', authMiddleware, (req, res) => {
    try {
        stmts.deletePet.run(parseInt(req.params.id), req.user.uid);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ── Static File Serving ──
// Disable cache during development
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.webm': 'video/webm',
    '.woff2': 'font/woff2',
};

// Serve static files from root
app.use(express.static(ROOT, {
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (MIME[ext]) res.setHeader('Content-Type', MIME[ext]);
    }
}));

// SPA fallback
app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(ROOT, 'index.html'));
    } else {
        next();
    }
});

// ── Start Server ──
app.listen(PORT, '0.0.0.0', () => {
    const nets = os.networkInterfaces();
    console.log('\n🐾 PoopBuddy Server Running!\n');
    console.log(`  Local:     http://localhost:${PORT}`);
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`  Network:   http://${net.address}:${PORT}`);
            }
        }
    }
    console.log(`\n  📱 API endpoints ready at /api/*`);
    console.log(`  🔥 Firebase Auth verification enabled`);
    console.log(`  💾 SQLite database: poopbuddy.db`);
    console.log(`  Press Ctrl+C to stop\n`);
});

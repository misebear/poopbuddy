require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure upload directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// File upload config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// In-memory data store (replace with DB later)
const dataStore = {
    users: {},      // userId -> { nickname, createdAt }
    analyses: [],   // { id, userId, date, score, bristol, photo, ... }
    feedPosts: [],  // { id, userId, nickname, date, text, photo, ... }
};

// ── API Routes ──

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Upload photo
app.post('/api/upload', upload.array('photos', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }
    const urls = req.files.map(f => ({
        id: path.basename(f.filename, path.extname(f.filename)),
        url: `/uploads/${f.filename}`,
        size: f.size,
        mimetype: f.mimetype
    }));
    res.json({ success: true, files: urls });
});

// Save analysis
app.post('/api/analysis', (req, res) => {
    const { userId, score, bristol, color, pet, key, msgKey, abnormalities, photo } = req.body;
    const record = {
        id: uuidv4(),
        userId: userId || 'anonymous',
        date: new Date().toISOString(),
        score, bristol, color, pet, key, msgKey,
        abnormalities: abnormalities || [],
        photo: photo || null
    };
    dataStore.analyses.push(record);
    // Keep last 1000 analyses
    if (dataStore.analyses.length > 1000) dataStore.analyses = dataStore.analyses.slice(-1000);
    res.json({ success: true, analysis: record });
});

// Get analysis history
app.get('/api/analysis/:userId', (req, res) => {
    const userAnalyses = dataStore.analyses
        .filter(a => a.userId === req.params.userId)
        .slice(-50) // last 50
        .reverse();
    res.json({ analyses: userAnalyses });
});

// Post to community feed
app.post('/api/feed', (req, res) => {
    const { userId, nickname, text, score, bristol, pet, photo } = req.body;
    const post = {
        id: uuidv4(),
        userId: userId || 'anonymous',
        nickname: nickname || '익명',
        date: new Date().toISOString(),
        text, score, bristol, pet,
        photo: photo || null,
        likes: 0,
        comments: []
    };
    dataStore.feedPosts.unshift(post);
    // Keep last 500 posts
    if (dataStore.feedPosts.length > 500) dataStore.feedPosts = dataStore.feedPosts.slice(0, 500);
    res.json({ success: true, post });
});

// Get community feed
app.get('/api/feed', (req, res) => {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const posts = dataStore.feedPosts.slice(page * limit, (page + 1) * limit);
    res.json({ posts, total: dataStore.feedPosts.length, page, limit });
});

// Like a feed post
app.post('/api/feed/:postId/like', (req, res) => {
    const post = dataStore.feedPosts.find(p => p.id === req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    post.likes += 1;
    res.json({ success: true, likes: post.likes });
});

// Comment on feed post
app.post('/api/feed/:postId/comment', (req, res) => {
    const post = dataStore.feedPosts.find(p => p.id === req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = {
        id: uuidv4(),
        userId: req.body.userId || 'anonymous',
        nickname: req.body.nickname || '익명',
        text: req.body.text,
        date: new Date().toISOString()
    };
    post.comments.push(comment);
    res.json({ success: true, comment });
});

// User profile
app.post('/api/user', (req, res) => {
    const { userId, nickname } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    dataStore.users[userId] = { nickname: nickname || '익명', createdAt: new Date().toISOString() };
    res.json({ success: true, user: dataStore.users[userId] });
});

app.get('/api/user/:userId', (req, res) => {
    const user = dataStore.users[req.params.userId];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const analysisCount = dataStore.analyses.filter(a => a.userId === req.params.userId).length;
    res.json({ ...user, analysisCount });
});

// Backup & Restore
app.post('/api/backup', (req, res) => {
    const { userId, data } = req.body;
    if (!userId || !data) return res.status(400).json({ error: 'userId and data required' });
    const backupPath = path.join(uploadsDir, `backup_${userId}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(data));
    res.json({ success: true, message: 'Backup saved' });
});

app.get('/api/backup/:userId', (req, res) => {
    const backupPath = path.join(uploadsDir, `backup_${req.params.userId}.json`);
    if (!fs.existsSync(backupPath)) return res.status(404).json({ error: 'No backup found' });
    const data = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    res.json({ success: true, data });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[Server Error]', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🐾 PoopBuddy Server running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Feed:   http://localhost:${PORT}/api/feed`);
});

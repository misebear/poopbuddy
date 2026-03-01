require('dotenv').config({ path: require('path').join(__dirname, 'server', '.env') });
const express = require('express');
const path = require('path');
const os = require('os');
const cors = require('cors');
const Database = require('better-sqlite3');
const admin = require('firebase-admin');

// ── Configuration ──
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

// ── 공개 API 라우트 (UID 기반 간단 인증) ──
// localStorage 1차 저장 + 서버 동기화용

// 유저 등록/업데이트
app.post('/api/sync/user', (req, res) => {
    try {
        const { uid, name, email, provider, photoUrl, mode, lang, theme, xp } = req.body;
        if (!uid) return res.status(400).json({ error: 'uid 필수' });

        stmts.upsertUser.run({
            uid, name: name || 'User', email: email || '',
            provider: provider || 'local', photoUrl: photoUrl || ''
        });
        if (mode || lang || theme || xp !== undefined) {
            stmts.updateUserPrefs.run({
                uid, mode: mode || 'dog', lang: lang || 'ko',
                theme: theme || 'light', xp: xp || 0
            });
        }
        const user = stmts.getUser.get(uid);
        res.json({ success: true, user });
    } catch (err) {
        console.error('[Sync] User error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// 유저 데이터 전체 조회
app.get('/api/sync/user/:uid', (req, res) => {
    try {
        const user = stmts.getUser.get(req.params.uid);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const analyses = stmts.getAnalyses.all(req.params.uid);
        const pets = stmts.getPets.all(req.params.uid);
        res.json({ success: true, user, analyses, pets });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 분석 결과 저장
app.post('/api/sync/analysis', (req, res) => {
    try {
        const { uid, score, bristol, color, consistency, tag, msgKey, imageThumb, date } = req.body;
        if (!uid) return res.status(400).json({ error: 'uid 필수' });

        const result = stmts.insertAnalysis.run({
            uid, score: score || 0, bristol: bristol || 4, color: color || 'brown',
            consistency: consistency || '', tag: tag || '', msgKey: msgKey || '',
            imageThumb: null, // 이미지 썸네일은 너무 크므로 서버에 저장 안 함
            date: date || new Date().toISOString()
        });
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        console.error('[Sync] Analysis error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// 분석 이력 조회
app.get('/api/sync/analysis/:uid', (req, res) => {
    try {
        const analyses = stmts.getAnalyses.all(req.params.uid);
        res.json({ success: true, analyses });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 피드 게시글 작성
app.post('/api/sync/feed', (req, res) => {
    try {
        const { uid, userName, level, type, tag, score, bristol, color, analysis, date } = req.body;
        if (!uid) return res.status(400).json({ error: 'uid 필수' });

        const result = stmts.insertFeedPost.run({
            uid, userName: userName || 'User', level: level || 1,
            type: type || 'dog', tag: tag || '', score: score || 0,
            bristol: bristol || 4, color: color || 'brown',
            analysis: analysis || '', image: null,
            date: date || new Date().toISOString()
        });
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        console.error('[Sync] Feed error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// 피드 전체 조회 (공개)
app.get('/api/sync/feed', (req, res) => {
    try {
        const posts = stmts.getFeedPosts.all();
        res.json({ success: true, posts });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 피드 좋아요
app.post('/api/sync/feed/:id/like', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const uid = req.body.uid || 'anonymous';
        const alreadyLiked = stmts.checkLike.get(postId, uid);
        if (alreadyLiked) return res.json({ success: false, message: 'Already liked' });

        stmts.insertLike.run(postId, uid);
        stmts.likeFeedPost.run(postId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 펫 추가
app.post('/api/sync/pets', (req, res) => {
    try {
        const { uid, name, species, breed, birthday, weight } = req.body;
        if (!uid || !name) return res.status(400).json({ error: 'uid, name 필수' });

        const result = stmts.insertPet.run({
            uid, name, species: species || 'dog',
            breed: breed || '', birthday: birthday || '', weight: weight || 0
        });
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 펫 목록 조회
app.get('/api/sync/pets/:uid', (req, res) => {
    try {
        const pets = stmts.getPets.all(req.params.uid);
        res.json({ success: true, pets });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 펫 삭제
app.delete('/api/sync/pets/:id', (req, res) => {
    try {
        const uid = req.query.uid || req.body?.uid || '';
        stmts.deletePet.run(parseInt(req.params.id), uid);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ── AI 분석 엔드포인트 (Gemini API 프록시) ──
app.post('/api/ai-analyze', async (req, res) => {
    try {
        const { image, mode, lang, petInfo } = req.body;
        if (!image) {
            return res.status(400).json({ error: '이미지가 필요합니다' });
        }

        // API 키 확인 — 없으면 시뮬레이션 폴백
        if (!GEMINI_API_KEY) {
            console.warn('[AI] GEMINI_API_KEY가 설정되지 않음, 시뮬레이션 모드');
            return res.json({ success: true, simulated: true, result: generateSimulatedResult(mode) });
        }

        // base64 이미지에서 MIME 타입과 데이터 분리
        const base64Match = image.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!base64Match) {
            return res.status(400).json({ error: '잘못된 이미지 형식' });
        }
        const mimeType = base64Match[1];
        const base64Data = base64Match[2];

        // 모드별 분석 대상 설정
        const subjectMap = { dog: 'dog/canine', cat: 'cat/feline', human: 'human' };
        const subject = subjectMap[mode] || 'pet';

        // 펫 정보가 있으면 프롬프트에 포함
        let petContext = '';
        if (petInfo) {
            const parts = [];
            if (petInfo.name) parts.push(`Name: ${petInfo.name}`);
            if (petInfo.breed) parts.push(`Breed: ${petInfo.breed}`);
            if (petInfo.weight) parts.push(`Weight: ${petInfo.weight}kg`);
            if (petInfo.age) parts.push(`Age: ${petInfo.age}`);
            if (parts.length > 0) {
                petContext = `\nPet/Subject Info: ${parts.join(', ')}`;
            }
        }

        // Gemini API 프롬프트 구성
        const prompt = `You are a professional veterinary/medical stool analysis AI for a ${subject}.${petContext}

Analyze this stool photograph carefully and return ONLY a valid JSON object (no markdown, no explanation, no code fence) with these fields:

{
  "isStool": true/false (whether the image actually shows stool/feces),
  "bristolType": 1-7 (Bristol Stool Scale type),
  "color": one of ["brown", "dark_brown", "yellow", "green", "orange", "red", "black", "gray"],
  "consistency": one of ["well_formed", "soft_mushy", "hard_lumpy", "watery", "smooth_soft"],
  "healthScore": 0-100 (overall gut health score),
  "severity": one of ["good", "caution", "warning"],
  "abnormalities": array of detected issues like ["mucus", "blood_fresh", "worms_visible", "undigested_food", "fatty_greasy"] or empty array,
  "advice_ko": "한국어로 된 1-2줄 조언",
  "advice_en": "1-2 line advice in English",
  "advice_ja": "日本語での1-2行のアドバイス",
  "detailedAnalysis": "Brief clinical analysis description in English"
}

Important rules:
- If the image is NOT a stool photo, set isStool=false and healthScore=0
- Be accurate with Bristol Scale classification
- Consider the ${subject}'s typical stool characteristics
- Score 80-100 = healthy, 50-79 = needs attention, 0-49 = concerning
- Detect any abnormalities visible in the image`;

        // Gemini API 호출
        const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
        const requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1024,
                responseMimeType: 'application/json'
            }
        };

        console.log('[AI] Gemini API 호출 중...');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('[AI] Gemini API 오류:', response.status, errText);
            // API 오류 시 시뮬레이션 폴백
            return res.json({ success: true, simulated: true, result: generateSimulatedResult(mode) });
        }

        const data = await response.json();

        // Gemini 응답에서 텍스트 추출
        let resultText = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const parts = data.candidates[0].content.parts;
            resultText = parts.map(p => p.text || '').join('');
        }

        // JSON 파싱 시도
        let aiResult;
        try {
            // Gemini가 가끔 코드 펜스로 감싸서 응답할 수 있으므로 제거
            const cleanText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            aiResult = JSON.parse(cleanText);
        } catch (parseErr) {
            console.error('[AI] JSON 파싱 실패:', parseErr.message, '원본:', resultText);
            return res.json({ success: true, simulated: true, result: generateSimulatedResult(mode) });
        }

        // 결과 검증 및 정규화
        const normalizedResult = {
            isStool: aiResult.isStool !== false,
            bristolType: Math.max(1, Math.min(7, parseInt(aiResult.bristolType) || 4)),
            color: ['brown', 'dark_brown', 'yellow', 'green', 'orange', 'red', 'black', 'gray'].includes(aiResult.color) ? aiResult.color : 'brown',
            consistency: ['well_formed', 'soft_mushy', 'hard_lumpy', 'watery', 'smooth_soft'].includes(aiResult.consistency) ? aiResult.consistency : 'well_formed',
            healthScore: Math.max(0, Math.min(100, parseInt(aiResult.healthScore) || 50)),
            severity: ['good', 'caution', 'warning'].includes(aiResult.severity) ? aiResult.severity : 'caution',
            abnormalities: Array.isArray(aiResult.abnormalities) ? aiResult.abnormalities : [],
            advice_ko: aiResult.advice_ko || '분석 결과를 확인하세요.',
            advice_en: aiResult.advice_en || 'Please review the analysis results.',
            advice_ja: aiResult.advice_ja || '分析結果を確認してください。',
            detailedAnalysis: aiResult.detailedAnalysis || ''
        };

        console.log('[AI] 분석 완료:', JSON.stringify({ score: normalizedResult.healthScore, bristol: normalizedResult.bristolType, severity: normalizedResult.severity }));
        res.json({ success: true, simulated: false, result: normalizedResult });

    } catch (err) {
        console.error('[AI] 서버 오류:', err);
        res.json({ success: true, simulated: true, result: generateSimulatedResult(req.body?.mode || 'dog') });
    }
});

// 시뮬레이션 결과 생성 (AI 분석 실패 시 폴백)
function generateSimulatedResult(mode) {
    const results = [
        { severity: 'good', score: 75 + Math.floor(Math.random() * 20) },
        { severity: 'caution', score: 45 + Math.floor(Math.random() * 20) },
        { severity: 'warning', score: 20 + Math.floor(Math.random() * 20) },
    ];
    const r = results[Math.floor(Math.random() * 3)];
    const bristol = 1 + Math.floor(Math.random() * 7);
    const colors = ['brown', 'dark_brown', 'yellow', 'green', 'orange'];
    const consistencies = ['well_formed', 'soft_mushy', 'hard_lumpy', 'watery', 'smooth_soft'];
    const abnormKeys = ['mucus', 'blood_fresh', 'worms_visible', 'undigested_food', 'fatty_greasy'];
    const abnormalities = Math.random() < 0.35 ? [abnormKeys[Math.floor(Math.random() * abnormKeys.length)]] : [];

    return {
        isStool: true,
        bristolType: bristol,
        color: colors[Math.floor(Math.random() * colors.length)],
        consistency: consistencies[Math.floor(Math.random() * consistencies.length)],
        healthScore: r.score,
        severity: r.severity,
        abnormalities,
        advice_ko: '시뮬레이션 분석 결과입니다. 실제 AI 분석을 위해 서버 설정을 확인하세요.',
        advice_en: 'This is a simulated result. Check server configuration for real AI analysis.',
        advice_ja: 'シミュレーション分析結果です。実際のAI分析にはサーバー設定を確認してください。',
        detailedAnalysis: 'Simulated analysis result'
    };
}

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

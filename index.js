/* ===== PoopBuddy — Main App (Full i18n) ===== */

// ── Global showToast (전역 토스트 함수) ──
function showToast(msg, duration) {
  duration = duration || 2500;
  let t = document.getElementById('pb-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'pb-toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:10px 24px;border-radius:24px;font-size:0.85rem;z-index:9999;transition:opacity 0.3s;pointer-events:none;max-width:90%;text-align:center;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.style.opacity = '0'; }, duration);
}

// ── Kakao SDK 초기화 & 콜백 처리 ──
function ensureKakaoInit() {
  if (window.Kakao && !Kakao.isInitialized()) {
    Kakao.init('7d614af7b2a6e40d9c74c26cca5cf866');
    console.log('[PoopBuddy] Kakao SDK initialized:', Kakao.isInitialized());
  }
  return window.Kakao && Kakao.isInitialized();
}

// 카카오 OAuth 콜백 처리
window.addEventListener('DOMContentLoaded', function () {
  ensureKakaoInit();

  // 1) WebView 내부 리다이렉트 (code 파라미터가 URL에 있을 때)
  var url = new URL(window.location.href);
  var code = url.searchParams.get('code');
  var kakaoState = url.searchParams.get('state');
  if (code && kakaoState === 'kakao_login') {
    window.history.replaceState({}, document.title, url.pathname);
    handleKakaoCallback(code);
  }

  // 2) 딥링크 리다이렉트 (Chrome Custom Tabs → poopbuddy://kakao-callback?code=...)
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('appUrlOpen', function (event) {
      console.log('[PoopBuddy] Deep link:', event.url);
      if (event.url && event.url.indexOf('poopbuddy://kakao-callback') === 0) {
        var deepUrl = new URL(event.url);
        var deepCode = deepUrl.searchParams.get('code');
        if (deepCode) {
          // Chrome Custom Tab 닫기
          if (window.Capacitor.Plugins.Browser) {
            window.Capacitor.Plugins.Browser.close();
          }
          handleKakaoCallback(deepCode);
        }
      }
    });
    console.log('[PoopBuddy] Kakao deep link listener registered');
  }
});

async function handleKakaoCallback(authCode) {
  try {
    showToast('카카오 로그인 처리 중...');

    // 1. auth code → access token 교환 (Kakao REST API)
    var redirectUri = 'poopbuddy://kakao-callback';

    var tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code'
        + '&client_id=43bb4bf552d6376f7709acddff6718b9'
        + '&client_secret=kQB1naBUgAs6K8wvedzj5K7tLhPLinbk'
        + '&redirect_uri=' + encodeURIComponent(redirectUri)
        + '&code=' + authCode,
    });
    var tokenData = await tokenRes.json();
    console.log('[PoopBuddy] Kakao token:', tokenData);

    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed');
    }

    // 2. access token → 사용자 프로필 조회
    var profileRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { 'Authorization': 'Bearer ' + tokenData.access_token },
    });
    var profileData = await profileRes.json();
    console.log('[PoopBuddy] Kakao profile:', profileData);

    var kakaoAccount = profileData.kakao_account || {};
    var profile = kakaoAccount.profile || {};

    // 3. DB에 사용자 정보 저장
    DB.user = {
      name: profile.nickname || 'Kakao User',
      email: kakaoAccount.email || '',
      loggedIn: true,
      provider: 'Kakao',
      photoUrl: profile.thumbnail_image_url || profile.profile_image_url || '',
      kakaoId: profileData.id,
    };
    saveDB('user');
    addXP(50, 'Welcome bonus');

    document.getElementById('loginModal')?.remove();
    showToast('카카오 로그인 완료! 🎉');
    if (typeof render === 'function') render();
    if (typeof updateLoginUI === 'function') updateLoginUI();
  } catch (err) {
    console.error('[PoopBuddy] Kakao login error:', err);
    showToast('카카오 로그인 실패: ' + (err.message || err));
  }
}

// ── AdMob (네이티브 앱 전용) ──
// Capacitor 앱에서만 AdMob 배너를 표시하고, 웹에서는 AdSense를 사용
(function initAdMob() {
  // Capacitor 네이티브 환경인지 확인
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  if (!isNative) return; // 웹에서는 AdSense 사용 → 여기서 종료

  // 네이티브에서는 CSS 기반 AdSense 배너 숨기기
  const adBanner = document.getElementById('adBannerBottom');
  if (adBanner) adBanner.style.display = 'none';

  // Android 상태바 겹침 방지 (JS 기반)
  const navbar = document.getElementById('navbar');
  if (navbar) {
    navbar.style.paddingTop = '28px';
  }

  // @capacitor-community/admob 플러그인 로드
  async function startAdMob() {
    try {
      const AdMob = window.Capacitor.registerPlugin('AdMob');

      // AdMob 초기화
      await AdMob.initialize({
        initializeForTesting: false,
      });
      console.log('[PoopBuddy] AdMob initialized');

      // 배너 광고 표시
      await AdMob.showBanner({
        adId: 'ca-app-pub-9072876824288260/8677568654',
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 60, // bottom nav 높이 고려
      });
      console.log('[PoopBuddy] AdMob banner shown');
    } catch (err) {
      console.warn('[PoopBuddy] AdMob init failed:', err.message || err);
    }
  }

  // DOM이 준비된 후 AdMob 시작
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(startAdMob, 500);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(startAdMob, 500));
  }
})();

// ── State ──
const state = {
  page: 'landing',
  theme: localStorage.getItem('pb-theme') || 'light',
  lang: localStorage.getItem('pb-lang') || 'en',
  mode: 'dog',
  calMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  feedFilter: 'all',
};

// ── Core Data Layer (localStorage persistence) ──
const DB = {
  // Analysis history
  history: JSON.parse(localStorage.getItem('pb-history') || '[]'),
  // Pet profiles
  pets: JSON.parse(localStorage.getItem('pb-pets') || '[]'),
  activePet: localStorage.getItem('pb-active-pet') || null,
  // XP / Level
  xp: parseInt(localStorage.getItem('pb-xp') || '0'),
  // User profile
  user: JSON.parse(localStorage.getItem('pb-user') || '{"name":"","email":"","loggedIn":false}'),
  // Feed posts (user's own + dummy)
  feedPosts: JSON.parse(localStorage.getItem('pb-feed-posts') || '[]'),
  // Friends (user-added)
  friends: JSON.parse(localStorage.getItem('pb-friends') || '[]'),
  // Explored countries
  exploredCountries: JSON.parse(localStorage.getItem('pb-explored') || '[]'),
  // Completed daily challenges
  completedChallenges: JSON.parse(localStorage.getItem('pb-challenges') || '{}'),
  // Completed missions (milestone IDs)
  completedMissions: JSON.parse(localStorage.getItem('pb-missions-done') || '[]'),
};

// ===== Login Logic (Global Scope) =====
function showLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.add('active');
  }
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function handleLogin(provider) {
  // Simulate login delay
  // Note: event is deprecated but works for inline handlers. 
  // Better to use bound function or pass event explicitly, 
  // but for quick inline fix relying on global event is common in legacy style.
  const btn = window.event ? window.event.currentTarget : null;
  const originalText = btn ? btn.innerHTML : '';

  if (btn) {
    btn.innerHTML = '<span class="spinner">⏳</span> Logging in...';
    btn.disabled = true;
  }

  setTimeout(() => {
    // Mock user data
    const mockUser = {
      name: 'Pet Lover',
      email: 'user@example.com',
      avatar: '🐶',
      provider: provider
    };

    DB.user = mockUser;
    localStorage.setItem('pb-user', JSON.stringify(DB.user));

    updateLoginUI();
    closeLoginModal();
    if (typeof showToast === 'function') showToast(`Welcome back, ${mockUser.name}!`);

    if (btn) {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }, 1500);
}

function updateLoginUI() {
  const btnLogin = document.getElementById('btnLogin');
  if (!btnLogin) return;

  if (DB.user && DB.user.name) {
    btnLogin.innerHTML = `${DB.user.avatar || '👤'} ${DB.user.name}`;
    btnLogin.onclick = () => {
      if (confirm('Log out?')) {
        DB.user = { name: "", email: "", loggedIn: false };
        localStorage.removeItem('pb-user');
        updateLoginUI();
        if (typeof showToast === 'function') showToast('Logged out successfully');
      }
    };
  } else {
    btnLogin.innerHTML = 'Login';
    btnLogin.onclick = showLoginModal;
  }
}

function saveDB(key) {
  const map = {
    history: 'pb-history', pets: 'pb-pets', xp: 'pb-xp', user: 'pb-user',
    feedPosts: 'pb-feed-posts', friends: 'pb-friends', exploredCountries: 'pb-explored',
    completedChallenges: 'pb-challenges', completedMissions: 'pb-missions-done', activePet: 'pb-active-pet',
  };
  if (key === 'xp' || key === 'activePet') localStorage.setItem(map[key], DB[key]);
  else localStorage.setItem(map[key], JSON.stringify(DB[key]));
}

function addXP(amount, reason) {
  DB.xp += amount;
  saveDB('xp');
  if (typeof showToast === 'function') showToast(`+${amount} XP${reason ? ' (' + reason + ')' : ''}`);
}
function getLevel() { return Math.floor(DB.xp / 100) + 1; }
function getLevelProgress() { return DB.xp % 100; }

function saveAnalysis(result) {
  DB.history.push(result);
  saveDB('history');
  // Auto-mark on calendar with Bristol type emoji
  const d = new Date(result.date);
  const bristolEmojis = ['⚫', '🟤', '🟫', '🟡', '🟠', '🔴', '💧'];
  const bIdx = Math.max(0, Math.min(6, (parseInt(result.bristol) || 4) - 1));
  CAL_RECORDS[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] = bristolEmojis[bIdx];
}

function getRecentHistory(days) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  return DB.history.filter(h => new Date(h.date) >= cutoff && h.pet === state.mode);
}

function addPet(name, species, breed, birthday, weight) {
  const pet = { id: Date.now().toString(), name, species, breed, birthday, weight, created: new Date().toISOString() };
  DB.pets.push(pet);
  DB.activePet = pet.id;
  saveDB('pets'); saveDB('activePet');
  addXP(20, 'New pet');
  return pet;
}

function getActivePetName() {
  if (!DB.activePet) return typeIcon(state.mode);
  const pet = DB.pets.find(p => p.id === DB.activePet);
  return pet ? pet.name : typeIcon(state.mode);
}

function addFeedPost(analysisResult) {
  const nickname = localStorage.getItem('pb-nickname') || DB.user.name || 'Me';
  const post = {
    id: Date.now(),
    user: nickname,
    level: getLevel(),
    type: state.mode,
    gender: '',
    tag: analysisResult.key,
    views: 0,
    likes: 0,
    comments: 0,
    time: 'now',
    analysis: analysisResult.msgKey,
    score: analysisResult.score,
    bristol: analysisResult.bristol,
    color: analysisResult.colorKey,
    date: new Date().toISOString(),
    isOwn: true,
    image: lastAnalyzedImage || null, // save the poop photo
  };
  DB.feedPosts.unshift(post);
  saveDB('feedPosts');
  addXP(10, 'Feed post');
}

function addFriend(name) {
  if (!name || DB.friends.find(f => f.user === name)) return;
  DB.friends.push({
    user: name, level: 1 + Math.floor(Math.random() * 10),
    status: 'online', pooping: Math.random() > 0.7,
    cheerCount: 0, addedAt: new Date().toISOString(),
  });
  saveDB('friends');
  addXP(5, 'New friend');
}

function exploreCountry(key) {
  if (!DB.exploredCountries.includes(key)) {
    DB.exploredCountries.push(key);
    saveDB('exploredCountries');
  }
}

function completeDailyChallenge() {
  const todayKey = new Date().toDateString();
  if (DB.completedChallenges[todayKey]) return false;
  DB.completedChallenges[todayKey] = true;
  saveDB('completedChallenges');
  addXP(25, 'Daily Challenge');
  return true;
}

// Mission progress calculation (real data)
function getMissionProgress() {
  const todayStr = new Date().toDateString();
  const todayAnalysis = DB.history.filter(h => new Date(h.date).toDateString() === todayStr).length;
  // Streak calculation
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (CAL_RECORDS[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`]) streak++;
    else break;
  }
  const totalLikes = DB.feedPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const petCount = DB.pets.length;
  const countriesExplored = DB.exploredCountries.length;
  return [
    { icon: '📸', key: 'm1', progress: Math.min(todayAnalysis, 1), max: 1, reward: '10 XP' },
    { icon: '🔥', key: 'm2', progress: Math.min(streak, 7), max: 7, reward: '50 XP' },
    { icon: '❤️', key: 'm3', progress: Math.min(totalLikes, 10), max: 10, reward: '30 XP' },
    { icon: '🐾', key: 'm4', progress: Math.min(petCount, 3), max: 3, reward: '40 XP' },
    { icon: '🌍', key: 'm5', progress: Math.min(countriesExplored, 10), max: 10, reward: '50 XP' },
    { icon: '🏆', key: 'm6', progress: Math.min(streak, 30), max: 30, reward: '200 XP' },
  ];
}

// ── i18n — Complete Translations ──
const T = {
  en: {
    // Nav
    home: 'Home', analyze: 'Analyze', feed: 'Feed', calendar: 'Calendar', missions: 'Missions',
    halloffame: 'Hall of Fame', worldmap: 'World Map', login: 'Login', more: 'More',
    // Hero
    heroTitle1: "Your Pet's Health Story", heroTitle2: 'Told by Poop', heroTitle3: '🐾',
    heroLabel: 'AI Health Analysis',
    heroSub: 'One photo. Instant health insights. Track patterns, compare globally, and catch issues early.',
    startBtn: '📸 Analyze Now', learnBtn: 'Explore Feed',
    // Stats
    statUsers: '20,000+', statUsersL: 'Users', statAnalyses: '85,000+', statAnalysesL: 'Analyses',
    statCountries: '42', statCountriesL: 'Countries',
    // Mode
    modeDog: 'Dog', modeCat: 'Cat', modeHuman: 'Human',
    // Features
    feat1T: 'My Pet\'s Health Score', feat1D: 'The best veterinary brain analyzes color, consistency, and shape using the Bristol Stool Scale.',
    feat2T: 'Track Patterns', feat2D: 'Calendar view with streak tracking. Correlate diet with digestive health over time.',
    feat3T: 'Community Feed', feat3D: 'Share (blurred) and vote. Daily Hall of Fame winner gets a reward!',
    feat4T: 'Multi-Pet Profiles', feat4D: 'Manage multiple dogs and cats. Each pet gets its own health dashboard.',
    feat5T: 'Vet-Ready Reports', feat5D: 'Export PDF reports with trend charts to share with your veterinarian.',
    feat6T: 'World Poop Map', feat6D: 'See average gut health scores by country. How does your region compare?',
    // Analyze
    uploadTitle: 'Upload a Poop Photo',
    uploadText: 'Tap to add a photo',
    uploadHint: 'JPG, PNG, HEIC — max 10MB. Photos are auto-blurred for privacy.',
    analyzeBtn: '🔬 Analyze Now',
    analyzing: 'The best vet brain is analyzing...',
    analyzingDesc: 'Our expert veterinary intelligence is checking color, consistency, and shape...',
    shareToFeed: 'Share to Feed', exportPdf: '📋 Export PDF', analyzeAnother: '📸 Analyze Another',
    // Analysis Results
    gutHealth: 'Gut Health', good: 'Good', caution: 'Caution', warning: 'Warning', normal: 'Normal',
    bristol: 'Bristol Type', color: 'Color', consistency: 'Consistency', hydration: 'Hydration',
    hydrationGood: 'Good', hydrationLow: 'Low',
    colorBrown: 'Brown', colorDarkBrown: 'Dark Brown', colorLightBrown: 'Light Brown',
    colorYellowBrown: 'Yellow-Brown', colorGreenBrown: 'Green-Brown',
    consWellFormed: 'Well-formed log', consSoftMushy: 'Soft and mushy',
    consHardLumpy: 'Hard and lumpy', consWatery: 'Watery', consSmoothSoft: 'Smooth and soft',
    analysisGoodMsg: 'Healthy stool! Keep up the good diet.',
    analysisCautionMsg: 'Minor concern detected. Monitor hydration and diet.',
    analysisWarningMsg: 'Possible issue detected. Consider consulting a doctor.',
    dogGood1: 'Your pup\'s tummy is doing great! Perfectly healthy stool 🐾',
    dogGood2: 'Excellent digestion! This is exactly what a healthy dog\'s stool should look like.',
    dogGood3: 'Great job on the diet! Your furry friend\'s gut health is top-notch.',
    dogGood4: 'Tail-wagging results! Digestive health looks wonderful today.',
    dogCaution1: 'Your pup\'s stool shows minor changes. Check their treats and water intake.',
    dogCaution2: 'Slightly off from normal. Did they eat something unusual during walks?',
    dogCaution3: 'Mild digestive change detected. Maintain a regular feeding schedule.',
    dogCaution4: 'Keep an eye on your dog\'s appetite. Mild sign of digestive stress.',
    dogWarning1: 'Concerning signs detected. Please visit your veterinarian soon.',
    dogWarning2: 'Your pup may not be feeling well. A vet visit is recommended.',
    dogWarning3: 'Abnormal stool detected. Stop treats and monitor closely for 24 hours.',
    dogWarning4: 'Signs of digestive distress. If your dog seems lethargic, see a vet today.',
    catGood1: 'Purr-fect litter box report! Your cat\'s digestion looks healthy 😺',
    catGood2: 'Healthy and well-formed. Your feline friend is doing wonderfully.',
    catGood3: 'The litter box tells a happy story! Great gut health.',
    catGood4: 'Excellent feline digestion. Keep up the quality food choices!',
    catCaution1: 'Slight change in your cat\'s stool. Check litter habits and water intake.',
    catCaution2: 'Mild concern. Has your cat been grooming more than usual?',
    catCaution3: 'Minor digestive change. Hairballs or diet switch could be the cause.',
    catCaution4: 'Your cat\'s stool is slightly off. Monitor food intake and litter usage.',
    catWarning1: 'Noticeable issue detected. A vet checkup for your cat is advised.',
    catWarning2: 'Abnormal litter box result. Monitor your cat and call the vet.',
    catWarning3: 'Your cat may have a digestive issue. Avoid new foods and see a vet.',
    catWarning4: 'Concerning signs. Check if your cat is eating and drinking normally.',
    humanGood1: 'Looking healthy! Your digestive system is working perfectly.',
    humanGood2: 'Great gut health! Your fiber and hydration balance is on point.',
    humanGood3: 'Healthy digestion! Keep maintaining your balanced diet.',
    humanGood4: 'Textbook healthy! Your digestive tract is happy.',
    humanCaution1: 'Minor digestive concern. Increase fiber and water intake.',
    humanCaution2: 'Slightly off from ideal. Check your stress levels and recent diet.',
    humanCaution3: 'Mild irregularity detected. Consider adding probiotics.',
    humanCaution4: 'Your gut might be a bit stressed. Try eating more vegetables today.',
    humanWarning1: 'Health concern detected. Consider scheduling a doctor\'s appointment.',
    humanWarning2: 'Abnormal result. Please consult a healthcare professional.',
    humanWarning3: 'Significant concern. Monitor symptoms and see a doctor.',
    humanWarning4: 'Your digestive health needs attention. Don\'t ignore persistent changes.',
    dogAnalysis: 'Dog analysis', catAnalysis: 'Cat analysis', humanAnalysis: 'Human analysis',
    // Feed
    feedTitle: 'Community Feed', feedOnline: 'Online', tapToView: '🔍 Tap to view',
    feedLike: '❤️', feedComment: '💬', feedShare: '↗️',
    views: 'views', filterAll: 'All',
    // Feed Posts
    feed1Analysis: 'Hard lumpy stool — may indicate dehydration',
    feed1Caption: '',
    feed2Analysis: 'Mushy corn-textured — normal after corn intake',
    feed2Caption: "Today it's corn 🌽",
    feed3Analysis: 'Liquid yellow stool — monitor hydration',
    feed3Caption: '',
    feed4Analysis: 'Perfect log shape, healthy brown color',
    feed4Caption: "Luna's morning routine 🐾",
    feed5Analysis: 'Well-formed, consistent size and color',
    feed5Caption: 'My cat is healthy! 😸',
    feed6Analysis: 'Mushy but healthy composition',
    feed6Caption: '',
    // Calendar
    calTitle: 'Bowel Calendar', streak: 'Day Streak 🔥',
    sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
    monthNames: 'January,February,March,April,May,June,July,August,September,October,November,December',
    // Missions
    missionsTitle: 'Missions & Challenges', badgeCollection: 'Badge Collection',
    m1T: 'Daily Logger', m1D: 'Upload a poop photo today',
    m2T: '7-Day Streak', m2D: 'Log poop 7 days in a row',
    m3T: 'Community Love', m3D: 'Get 10 likes on a single post',
    m4T: 'Multi-Pet Master', m4D: 'Register 3 pets',
    m5T: 'Global Explorer', m5D: 'View 10 countries on World Map',
    m6T: '30-Day Legend', m6D: 'Complete a 30-day streak',
    // Hall of Fame
    hofTitle: '🏆 Hall of Fame', hofSub: "Today's most voted poop gets a reward!",
    hof1Desc: 'Perfect morning Bristol Type 4',
    hof2Desc: 'Legendary size — community favorite',
    hof3Desc: 'Golden retriever, golden poop',
    hof4Desc: 'Tiny but healthy',
    hof5Desc: 'Brave share — dehydration alert',
    // World Map
    mapTitle: '🌍 World Poop Map', mapSub: 'Average gut health scores by country',
    mapComingSoon: '🌍 Interactive Map — Coming Soon',
    korea: 'Korea', usa: 'USA', japan: 'Japan', germany: 'Germany', brazil: 'Brazil',
    uk: 'UK', france: 'France', australia: 'Australia', india: 'India', canada: 'Canada',
    vietnam: 'Vietnam', thailand: 'Thailand',
    // Login Modal
    loginTitle: 'Login', loginSub: 'Sign in to track your pet\'s health',
    googleLogin: 'Continue with Google', appleLogin: 'Continue with Apple',
    kakaoLogin: 'Continue with Kakao', naverLogin: 'Continue with Naver',
    orDivider: 'or', emailPlaceholder: 'Email', passwordPlaceholder: 'Password',
    namePlaceholder: 'Name',
    loginBtn: 'Sign In', signupLink: 'Don\'t have an account? Sign Up',
    loginEmailTab: 'Email Login', signupEmailTab: 'Sign Up',
    // Ad
    adSlot: '📢 Ad Space — AdSense',
    // Stats Dashboard
    statsTitle: '📊 Statistics Dashboard', statsWeek: 'This Week', statsTotal: 'Total', statsAvgScore: 'Avg Score',
    statsBestScore: 'Best Score', statsCount: 'Total Logs', statsTimeHeat: 'Time Heatmap',
    statsMorning: 'Morning', statsAfternoon: 'Afternoon', statsEvening: 'Evening', statsNight: 'Night',
    // Leaderboard
    lbTitle: '🏆 Global Leaderboard', lbWeekly: 'Weekly', lbMonthly: 'Monthly', lbAllTime: 'All Time',
    lbRank: 'Rank', lbUser: 'User', lbScore: 'Score', lbStreak: 'Streak',
    // Mini Game
    gameTitle: '🎮 Flappy Poop', gameStart: 'Tap to Start!', gameOver: 'Game Over!',
    gameScore: 'Score', gameBest: 'Best', gameRestart: 'Play Again', gameReward: '+10 XP earned!',
    // Health Tips
    tipTitle: '💡 Daily Health Tip', tipDismiss: 'Got it!',
    tip1: 'Drink at least 8 glasses of water daily for healthy digestion.',
    tip2: 'Fiber-rich foods help maintain regular bowel movements.',
    tip3: 'Regular exercise improves digestive health significantly.',
    tip4: 'Probiotics in yogurt can improve gut bacteria balance.',
    tip5: 'Brown colored stool is typically a sign of good health.',
    // Toilet Rating
    toiletTitle: '🚽 Toilet Ratings', toiletSit: 'Sit 👍', toiletSquat: 'Squat 👎',
    toiletClean: 'Clean', toiletAvg: 'Average', toiletDirty: 'Dirty',
    // Friends
    friendsTitle: '👥 Friends', friendAdd: 'Add Friend', friendCheer: '📣 Cheer!',
    friendStatus: 'Currently pooping 💩', friendSearch: 'Search username...',
    // Daily Challenge
    dcTitle: '🎯 Daily Challenge', dcTimeLeft: 'Time Left', dcReward: 'Bonus Reward',
    dcToday: "Today's Challenge", dcComplete: 'Complete!',
    // World Map Interactive
    mapClickExplore: 'Click a country to explore!', mapUsers: 'Users', mapDiet: 'Popular Diet',
    mapClose: 'Close', mapHealthAvg: 'Health Average',
    mexico: 'Mexico', italy: 'Italy', spain: 'Spain', china: 'China', indonesia: 'Indonesia',
    russia: 'Russia', turkey: 'Turkey', egypt: 'Egypt', nigeria: 'Nigeria', argentina: 'Argentina',
    sweden: 'Sweden', newzealand: 'New Zealand', philippines: 'Philippines', singapore: 'Singapore',
    malaysia: 'Malaysia', peru: 'Peru', chile: 'Chile', colombia: 'Colombia',
    // Potty Log
    pottyLogTitle: '🐾 Potty Log', pottyCalTab: 'Calendar', pottyLogTab: 'Potty Log',
    pottyPee: '💧 Pee', pottyPoo: '💩 Poo', pottyAccident: '⚠️ Accident', pottyNap: '😴 Nap', pottyPlay: '🎾 Play', pottyMeal: '🍽️ Meal',
    pottyLogBtn: 'Log Now', pottyHistory: 'Today\'s Log', pottyStats: 'Statistics',
    pottyNextPrediction: '⏰ Next Predicted', pottyIn: 'in', pottyMinutes: 'min',
    pottyTimerStart: 'Start Timer', pottyTimerStop: 'Stop', pottyTimerReset: 'Reset',
    pottyTotalToday: 'Total Today', pottyPeeCount: 'Pee', pottyPooCount: 'Poo', pottyAccidentCount: 'Accidents',
    pottyAvgInterval: 'Avg Interval', pottyNapCount: 'Naps', pottyPlayCount: 'Play Sessions',
    pottyNoLogs: 'No logs yet today. Start logging!', pottyDeleteConfirm: 'Delete this log entry?',
    pottyStreak: 'Accident-Free Streak', pottyDays: 'days',
    // Settings
    settingsTitle: 'Data Settings', settingsSub: 'Manage your data locally',
    settingsNickname: 'Nickname', settingsNicknameSub: 'Display name shown in feed',
    settingsBackup: 'Backup Data', settingsBackupSub: 'Download all your data as a JSON file.',
    settingsRestore: 'Restore Data', settingsRestoreSub: 'Upload a JSON file to restore your data.',
    settingsReset: 'Reset Data', settingsResetSub: 'Delete all local data.',
    settingsExport: '⬇️ Export', settingsImport: '⬆️ Import', settingsResetBtn: '🗑️ Reset',
  },
  ko: {
    home: '홈', analyze: '분석', feed: '피드', calendar: '캘린더', missions: '미션',
    halloffame: '명예의전당', worldmap: '월드맵', login: '로그인', more: '더보기',
    heroTitle1: '우리 아이 건강,', heroTitle2: '똥이 말해줄게요', heroTitle3: '🐾',
    heroLabel: 'AI 건강 분석',
    heroSub: '사진 한 장이면 충분해요. 색상, 형태, 질감까지 AI가 꼼꼼히 분석해드려요.',
    startBtn: '📸 지금 분석하기', learnBtn: '피드 둘러보기',
    statUsers: '20,000+', statUsersL: '사용자', statAnalyses: '85,000+', statAnalysesL: '분석 건',
    statCountries: '42', statCountriesL: '국가',
    modeDog: '강아지', modeCat: '고양이', modeHuman: '사람',
    feat1T: '우리 아이 건강 점수', feat1D: '최고의 주치의 두뇌가 색상, 질감, 형태를 브리스톨 대변 차트로 꼼꼼히 분석합니다.',
    feat2T: '패턴 추적', feat2D: '캘린더 뷰에서 연속 기록 추적. 식단과 장 건강의 상관관계를 파악하세요.',
    feat3T: '커뮤니티 피드', feat3D: '블러 처리된 사진을 공유하고 투표하세요. 매일 명예의전당 1위에게 리워드!',
    feat4T: '멀티펫 프로필', feat4D: '여러 강아지와 고양이 관리. 각 반려동물 전용 건강 대시보드.',
    feat5T: '수의사 리포트', feat5D: '트렌드 차트가 포함된 PDF 리포트를 수의사에게 공유하세요.',
    feat6T: '월드 똥 맵', feat6D: '국가별 평균 장건강 점수를 확인하세요. 우리나라는 몇 점일까?',
    uploadTitle: '똥 사진 업로드',
    uploadText: '탭하여 사진을 추가하세요',
    uploadHint: 'JPG, PNG, HEIC — 최대 10MB. 사진은 자동으로 블러 처리됩니다.',
    analyzeBtn: '🔬 분석하기',
    analyzing: '최고의 주치의가 분석 중...',
    analyzingDesc: '전문 수의사급 두뇌가 색상, 질감, 형태를 꼼꼼히 확인하고 있어요...',
    shareToFeed: '피드에 공유', exportPdf: '📋 PDF 내보내기', analyzeAnother: '📸 다시 분석하기',
    gutHealth: '장 건강', good: '좋음', caution: '주의', warning: '경고', normal: '보통',
    bristol: '브리스톨 유형', color: '색상', consistency: '질감', hydration: '수분 상태',
    hydrationGood: '양호', hydrationLow: '부족',
    colorBrown: '갈색', colorDarkBrown: '짙은 갈색', colorLightBrown: '밝은 갈색',
    colorYellowBrown: '노란 갈색', colorGreenBrown: '녹색 갈색',
    consWellFormed: '잘 형성된 통나무형', consSoftMushy: '부드럽고 무른 형태',
    consHardLumpy: '딱딱하고 덩어리진 형태', consWatery: '물같은 형태', consSmoothSoft: '매끈하고 부드러운 형태',
    analysisGoodMsg: '건강한 변입니다! 좋은 식단을 유지하세요.',
    analysisCautionMsg: '가벼운 이상이 감지되었습니다. 수분 섭취와 식단을 확인하세요.',
    analysisWarningMsg: '이상이 감지되었습니다. 전문의 상담을 고려하세요.',
    dogGood1: '우리 아이 배변 상태가 아주 좋아요! 건강한 똥이에요 🐾',
    dogGood2: '완벽한 소화 상태! 사료가 잘 맞는 것 같아요.',
    dogGood3: '훌륭해요! 산책 후 이런 변이면 건강 만점이에요.',
    dogGood4: '우리 강아지 장 건강이 최고예요! 계속 이렇게 관리해주세요.',
    dogCaution1: '우리 아이 변에 약간 변화가 있어요. 간식이나 음수량을 체크해주세요.',
    dogCaution2: '산책 중 이상한 걸 주워 먹진 않았나요? 약간 주의가 필요해요.',
    dogCaution3: '가벼운 소화 변화가 감지됐어요. 규칙적인 급여 스케줄을 유지해주세요.',
    dogCaution4: '우리 아이 식욕을 잘 살펴봐주세요. 가벼운 소화 스트레스 징후가 있어요.',
    dogWarning1: '걱정되는 징후가 보여요. 가까운 동물병원 방문을 권해드려요.',
    dogWarning2: '우리 아이가 컨디션이 안 좋을 수 있어요. 수의사 상담이 필요해요.',
    dogWarning3: '비정상적인 변이 감지됐어요. 간식을 중단하고 24시간 관찰해주세요.',
    dogWarning4: '소화 이상 징후예요. 아이가 축 처져 있으면 오늘 중으로 병원에 가세요.',
    catGood1: '화장실 점검 완료! 우리 냥이 소화 상태 완벽해요 😺',
    catGood2: '잘 형성된 건강한 변이에요. 사료가 딱 맞는 것 같아요.',
    catGood3: '모래 상태가 깔끔해요! 장 건강 만점이에요.',
    catGood4: '우리 고양이 소화력 최고! 양질의 사료 선택이 빛을 발해요.',
    catCaution1: '변에 약간 변화가 있어요. 화장실 사용 빈도와 음수량을 확인해주세요.',
    catCaution2: '가벼운 주의 필요. 그루밍을 평소보다 많이 하고 있지 않나요?',
    catCaution3: '가벼운 소화 변화예요. 헤어볼이나 사료 교체가 원인일 수 있어요.',
    catCaution4: '우리 냥이 변이 살짝 달라요. 식사량과 화장실 사용을 관찰해주세요.',
    catWarning1: '이상 징후가 감지됐어요. 동물병원 검진을 추천드려요.',
    catWarning2: '화장실 상태가 걱정돼요. 냥이를 잘 살피고 수의사에게 연락하세요.',
    catWarning3: '소화 문제가 의심돼요. 새로운 간식을 자제하고 병원을 방문해주세요.',
    catWarning4: '걱정되는 상태예요. 밥과 물을 정상적으로 섭취하는지 확인하세요.',
    humanGood1: '건강한 상태예요! 소화 시스템이 잘 작동하고 있어요.',
    humanGood2: '장 건강 최고! 식이섬유와 수분 균형이 완벽해요.',
    humanGood3: '건강한 소화! 균형 잡힌 식단을 계속 유지하세요.',
    humanGood4: '교과서적인 건강한 상태예요! 장이 행복해하고 있어요.',
    humanCaution1: '가벼운 소화 주의가 필요해요. 식이섬유와 수분 섭취를 늘려보세요.',
    humanCaution2: '약간 이상적이지 않아요. 최근 스트레스와 식단을 체크해보세요.',
    humanCaution3: '가벼운 불규칙이 감지됐어요. 유산균 섭취를 고려해보세요.',
    humanCaution4: '장이 약간 피곤할 수 있어요. 오늘은 채소를 더 드세요.',
    humanWarning1: '건강 주의가 감지됐어요. 병원 방문을 고려해주세요.',
    humanWarning2: '비정상적인 결과예요. 전문의 상담을 받아보세요.',
    humanWarning3: '상당한 주의가 필요해요. 증상을 관찰하고 의사와 상담하세요.',
    humanWarning4: '소화 건강에 주의가 필요해요. 지속적인 변화를 무시하지 마세요.',
    dogAnalysis: '강아지 분석', catAnalysis: '고양이 분석', humanAnalysis: '사람 분석',
    feedTitle: '커뮤니티 피드', feedOnline: '접속 중', tapToView: '🔍 탭하여 보기',
    feedLike: '❤️', feedComment: '💬', feedShare: '↗️',
    views: '조회', filterAll: '전체',
    feed1Analysis: '딱딱하고 덩어리진 변 — 탈수 가능성',
    feed1Caption: '',
    feed2Analysis: '옥수수 섞인 무른 변 — 옥수수 섭취 후 정상',
    feed2Caption: '오늘은 옥수수 🌽',
    feed3Analysis: '노란 액체성 변 — 수분 섭취 확인 필요',
    feed3Caption: '',
    feed4Analysis: '완벽한 통나무형, 건강한 갈색',
    feed4Caption: '루나의 아침 루틴 🐾',
    feed5Analysis: '잘 형성된 변, 일관된 크기와 색상',
    feed5Caption: '우리 고양이 건강해요! 😸',
    feed6Analysis: '무르지만 건강한 구성',
    feed6Caption: '',
    calTitle: '배변 캘린더', streak: '일 연속 기록 🔥',
    sun: '일', mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토',
    monthNames: '1월,2월,3월,4월,5월,6월,7월,8월,9월,10월,11월,12월',
    missionsTitle: '미션 & 챌린지', badgeCollection: '배지 컬렉션',
    m1T: '오늘의 기록', m1D: '오늘 똥 사진 업로드하기',
    m2T: '7일 연속', m2D: '7일 연속 기록하기',
    m3T: '커뮤니티 사랑', m3D: '게시글 하나에 좋아요 10개 받기',
    m4T: '멀티펫 마스터', m4D: '반려동물 3마리 등록하기',
    m5T: '글로벌 탐험가', m5D: '월드맵에서 10개 나라 확인하기',
    m6T: '30일 전설', m6D: '30일 연속 기록 달성하기',
    hofTitle: '🏆 명예의전당', hofSub: '오늘 가장 많은 투표를 받은 똥에게 리워드!',
    hof1Desc: '완벽한 아침 브리스톨 4형',
    hof2Desc: '전설적 크기 — 커뮤니티 인기',
    hof3Desc: '골든 리트리버, 골든 똥',
    hof4Desc: '작지만 건강해요',
    hof5Desc: '용감한 공유 — 탈수 주의보',
    mapTitle: '🌍 월드 똥 맵', mapSub: '국가별 평균 장건강 점수',
    mapComingSoon: '🌍 인터랙티브 지도 — 곧 출시',
    korea: '한국', usa: '미국', japan: '일본', germany: '독일', brazil: '브라질',
    uk: '영국', france: '프랑스', australia: '호주', india: '인도', canada: '캐나다',
    vietnam: '베트남', thailand: '태국',
    loginTitle: '로그인', loginSub: '반려동물 건강 추적을 시작하세요',
    googleLogin: 'Google로 로그인', appleLogin: 'Apple로 로그인',
    kakaoLogin: '카카오로 로그인', naverLogin: '네이버로 로그인',
    orDivider: '또는', emailPlaceholder: '이메일', passwordPlaceholder: '비밀번호',
    namePlaceholder: '이름',
    loginBtn: '로그인', signupLink: '계정이 없으신가요? 회원가입',
    loginEmailTab: '이메일 로그인', signupEmailTab: '회원가입',
    adSlot: '📢 광고 공간 — 애드센스',
    statsTitle: '📊 통계 대시보드', statsWeek: '이번 주', statsTotal: '전체', statsAvgScore: '평균 점수',
    statsBestScore: '최고 점수', statsCount: '총 기록', statsTimeHeat: '시간대 히트맵',
    statsMorning: '아침', statsAfternoon: '오후', statsEvening: '저녁', statsNight: '밤',
    lbTitle: '🏆 글로벌 리더보드', lbWeekly: '주간', lbMonthly: '월간', lbAllTime: '전체',
    lbRank: '순위', lbUser: '사용자', lbScore: '점수', lbStreak: '연속',
    gameTitle: '🎮 플래피 똥', gameStart: '탭하여 시작!', gameOver: '게임 오버!',
    gameScore: '점수', gameBest: '최고', gameRestart: '다시 하기', gameReward: '+10 XP 획득!',
    tipTitle: '💡 오늘의 건강 팁', tipDismiss: '확인!',
    tip1: '건강한 소화를 위해 하루 8잔 이상의 물을 드세요.',
    tip2: '식이섬유가 풍부한 음식은 규칙적인 배변에 도움을 줍니다.',
    tip3: '규칙적인 운동은 소화 건강을 크게 개선합니다.',
    tip4: '요거트의 유산균은 장내 균형을 개선합니다.',
    tip5: '갈색 변은 건강한 상태의 신호입니다.',
    toiletTitle: '🚽 화장실 평가', toiletSit: 'Sit 👍', toiletSquat: 'Squat 👎',
    toiletClean: '깨끗', toiletAvg: '보통', toiletDirty: '더러움',
    friendsTitle: '👥 친구', friendAdd: '친구 추가', friendCheer: '📣 응원!',
    friendStatus: '지금 화장실 중 💩', friendSearch: '사용자명 검색...',
    dcTitle: '🎯 일일 챌린지', dcTimeLeft: '남은 시간', dcReward: '보너스 보상',
    dcToday: '오늘의 챌린지', dcComplete: '완료!',
    mapClickExplore: '국가를 클릭하여 탐험하세요!', mapUsers: '사용자', mapDiet: '인기 식단',
    mapClose: '닫기', mapHealthAvg: '건강 평균',
    mexico: '멕시코', italy: '이탈리아', spain: '스페인', china: '중국', indonesia: '인도네시아',
    russia: '러시아', turkey: '튀르키예', egypt: '이집트', nigeria: '나이지리아', argentina: '아르헨티나',
    sweden: '스웨덴', newzealand: '뉴질랜드', philippines: '필리핀', singapore: '싱가포르',
    malaysia: '말레이시아', peru: '페루', chile: '칠레', colombia: '콜롬비아',
    // Potty Log
    pottyLogTitle: '🐾 배변 기록', pottyCalTab: '캘린더', pottyLogTab: '배변 기록',
    pottyPee: '💧 소변', pottyPoo: '💩 대변', pottyAccident: '⚠️ 실수', pottyNap: '😴 낮잠', pottyPlay: '🎾 놀이', pottyMeal: '🍽️ 식사',
    pottyLogBtn: '기록하기', pottyHistory: '오늘의 기록', pottyStats: '통계',
    pottyNextPrediction: '⏰ 다음 예측', pottyIn: '', pottyMinutes: '분 후',
    pottyTimerStart: '타이머 시작', pottyTimerStop: '중지', pottyTimerReset: '초기화',
    pottyTotalToday: '오늘 합계', pottyPeeCount: '소변', pottyPooCount: '대변', pottyAccidentCount: '실수',
    pottyAvgInterval: '평균 간격', pottyNapCount: '낮잠', pottyPlayCount: '놀이',
    pottyNoLogs: '아직 기록이 없습니다. 기록을 시작하세요!', pottyDeleteConfirm: '이 기록을 삭제할까요?',
    pottyStreak: '무사고 연속', pottyDays: '일',
    // Settings
    settingsTitle: '데이터 설정', settingsSub: '데이터를 로컬에서 관리하세요',
    settingsNickname: '닉네임', settingsNicknameSub: '피드에 표시되는 이름',
    settingsBackup: '데이터 백업', settingsBackupSub: '모든 데이터를 JSON 파일로 다운로드합니다.',
    settingsRestore: '데이터 복원', settingsRestoreSub: 'JSON 파일을 업로드하여 데이터를 복원합니다.',
    settingsReset: '데이터 초기화', settingsResetSub: '모든 로컬 데이터를 삭제합니다.',
    settingsExport: '⬇️ 내보내기', settingsImport: '⬆️ 가져오기', settingsResetBtn: '🗑️ 초기화',
  },
  ja: {
    home: 'ホーム', analyze: '分析', feed: 'フィード', calendar: 'カレンダー', missions: 'ミッション',
    halloffame: '殿堂入り', worldmap: 'ワールドマップ', login: 'ログイン', more: 'もっと',
    heroTitle1: 'うちの子の健康、', heroTitle2: 'うんちが教えてくれる', heroTitle3: '🐾',
    heroLabel: 'AI 健康分析',
    heroSub: '写真1枚でOK。色・形・質感までAIが丁寧に分析します。',
    startBtn: '📸 今すぐ分析', learnBtn: 'フィードを見る',
    statUsers: '20,000+', statUsersL: 'ユーザー', statAnalyses: '85,000+', statAnalysesL: '分析件数',
    statCountries: '42', statCountriesL: '国',
    modeDog: '犬', modeCat: '猫', modeHuman: '人間',
    feat1T: 'うちの子の健康スコア', feat1D: '最高の主治医の頭脳が色、質感、形状をブリストルスケールで丁寧に分析します。',
    feat2T: 'パターン追跡', feat2D: 'カレンダービューで連続記録追跡。食事と消化の相関関係を把握。',
    feat3T: 'コミュニティフィード', feat3D: 'ぼかし処理写真を共有して投票。毎日の殿堂1位にリワード！',
    feat4T: 'マルチペットプロフィール', feat4D: '複数の犬と猫を管理。各ペット専用の健康ダッシュボード。',
    feat5T: '獣医レポート', feat5D: 'トレンドチャート付きPDFレポートを獣医と共有。',
    feat6T: 'ワールドうんちマップ', feat6D: '国別の平均腸健康スコアを確認。あなたの地域は何点？',
    uploadTitle: 'うんち写真アップロード',
    uploadText: 'ドラッグ＆ドロップまたはタップ',
    uploadHint: 'JPG, PNG, HEIC — 最大10MB。写真は自動的にぼかし処理されます。',
    analyzeBtn: '🔬 分析する',
    analyzing: '最高の主治医が分析中...',
    analyzingDesc: '専門獣医レベルの頭脳が色、質感、形状を丁寧に確認しています...',
    shareToFeed: 'フィードに共有', exportPdf: '📋 PDF出力', analyzeAnother: '📸 再分析',
    gutHealth: '腸の健康', good: '良好', caution: '注意', warning: '警告', normal: '普通',
    bristol: 'ブリストルタイプ', color: '色', consistency: '質感', hydration: '水分状態',
    hydrationGood: '良好', hydrationLow: '不足',
    colorBrown: '茶色', colorDarkBrown: '濃い茶色', colorLightBrown: '薄い茶色',
    colorYellowBrown: '黄色がかった茶色', colorGreenBrown: '緑がかった茶色',
    consWellFormed: 'よく形成された丸太型', consSoftMushy: '柔らかくてどろどろ',
    consHardLumpy: '硬くてゴロゴロ', consWatery: '水状', consSmoothSoft: '滑らかで柔らかい',
    analysisGoodMsg: '健康な便です！良い食事を続けてください。',
    analysisCautionMsg: '軽度の異常が検出されました。水分摂取と食事を確認してください。',
    analysisWarningMsg: '異常が検出されました。獣医への相談をお勧めします。',
    dogAnalysis: '犬の分析', catAnalysis: '猫の分析', humanAnalysis: '人間の分析',
    feedTitle: 'コミュニティフィード', feedOnline: 'オンライン', tapToView: '🔍 タップで表示',
    feedLike: '❤️', feedComment: '💬', feedShare: '↗️',
    views: '閲覧', filterAll: '全て',
    feed1Analysis: '硬くゴロゴロした便 — 脱水の可能性',
    feed1Caption: '',
    feed2Analysis: 'コーン混じりの柔らかい便 — コーン摂取後は正常',
    feed2Caption: '今日はコーン 🌽',
    feed3Analysis: '黄色い液状便 — 水分摂取を確認',
    feed3Caption: '',
    feed4Analysis: '完璧な丸太型、健康的な茶色',
    feed4Caption: 'ルナの朝のルーティン 🐾',
    feed5Analysis: 'よく形成された便、一貫したサイズと色',
    feed5Caption: 'うちの猫は健康です！😸',
    feed6Analysis: '柔らかいが健康的な構成',
    feed6Caption: '',
    calTitle: '排便カレンダー', streak: '日連続記録 🔥',
    sun: '日', mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土',
    monthNames: '1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月',
    missionsTitle: 'ミッション＆チャレンジ', badgeCollection: 'バッジコレクション',
    m1T: '今日の記録', m1D: '今日うんち写真をアップロード',
    m2T: '7日連続', m2D: '7日連続で記録する',
    m3T: 'コミュニティ愛', m3D: '投稿1つにいいね10個を獲得',
    m4T: 'マルチペットマスター', m4D: 'ペット3匹を登録する',
    m5T: 'グローバル探検家', m5D: 'ワールドマップで10か国を確認',
    m6T: '30日伝説', m6D: '30日連続記録を達成',
    hofTitle: '🏆 殿堂入り', hofSub: '今日最も投票されたうんちにリワード！',
    hof1Desc: '完璧な朝のブリストル4型',
    hof2Desc: '伝説的サイズ — コミュニティ人気',
    hof3Desc: 'ゴールデンレトリバー、ゴールデンうんち',
    hof4Desc: '小さいけど健康',
    hof5Desc: '勇気ある共有 — 脱水注意報',
    mapTitle: '🌍 ワールドうんちマップ', mapSub: '国別平均腸健康スコア',
    mapComingSoon: '🌍 インタラクティブマップ — 近日公開',
    korea: '韓国', usa: 'アメリカ', japan: '日本', germany: 'ドイツ', brazil: 'ブラジル',
    uk: 'イギリス', france: 'フランス', australia: 'オーストラリア', india: 'インド', canada: 'カナダ',
    vietnam: 'ベトナム', thailand: 'タイ',
    loginTitle: 'ログイン', loginSub: 'ペットの健康管理を始めましょう',
    googleLogin: 'Googleでログイン', appleLogin: 'Appleでログイン',
    kakaoLogin: 'Kakaoでログイン', naverLogin: 'Naverでログイン',
    orDivider: 'または', emailPlaceholder: 'メールアドレス', passwordPlaceholder: 'パスワード',
    namePlaceholder: '名前',
    loginBtn: 'ログイン', signupLink: 'アカウントをお持ちでないですか？新規登録',
    loginEmailTab: 'メールログイン', signupEmailTab: '新規登録',
    adSlot: '📢 広告スペース — AdSense',
    statsTitle: '📊 統計ダッシュボード', statsWeek: '今週', statsTotal: '全体', statsAvgScore: '平均スコア',
    statsBestScore: '最高スコア', statsCount: '合計記録', statsTimeHeat: '時間帯ヒートマップ',
    statsMorning: '朝', statsAfternoon: '午後', statsEvening: '夕方', statsNight: '夜',
    lbTitle: '🏆 グローバルリーダーボード', lbWeekly: '週間', lbMonthly: '月間', lbAllTime: '全期間',
    lbRank: '順位', lbUser: 'ユーザー', lbScore: 'スコア', lbStreak: '連続',
    gameTitle: '🎮 フラッピーうんち', gameStart: 'タップして開始！', gameOver: 'ゲームオーバー！',
    gameScore: 'スコア', gameBest: '最高', gameRestart: 'もう一度', gameReward: '+10 XP獲得！',
    tipTitle: '💡 今日の健康ヒント', tipDismiss: '了解！',
    tip1: '健康な消化のために毎日8杯以上の水を飲みましょう。',
    tip2: '食物繊維が豊富な食品は規則的な排便に役立ちます。',
    tip3: '定期的な運動は消化の健康を大幅に改善します。',
    tip4: 'ヨーグルトの乳酸菌は腸内バランスを改善します。',
    tip5: '茶色の便は健康のサインです。',
    toiletTitle: '🚽 トイレ評価', toiletSit: 'Sit 👍', toiletSquat: 'Squat 👎',
    toiletClean: '清潔', toiletAvg: '普通', toiletDirty: '汚い',
    friendsTitle: '👥 友達', friendAdd: '友達追加', friendCheer: '📣 応援！',
    friendStatus: 'トイレ中 💩', friendSearch: 'ユーザー名検索...',
    dcTitle: '🎯 デイリーチャレンジ', dcTimeLeft: '残り時間', dcReward: 'ボーナス報酬',
    dcToday: '今日のチャレンジ', dcComplete: '完了！',
    mapClickExplore: '国をクリックして探検！', mapUsers: 'ユーザー', mapDiet: '人気食事',
    mapClose: '閉じる', mapHealthAvg: '健康平均',
    mexico: 'メキシコ', italy: 'イタリア', spain: 'スペイン', china: '中国', indonesia: 'インドネシア',
    russia: 'ロシア', turkey: 'トルコ', egypt: 'エジプト', nigeria: 'ナイジェリア', argentina: 'アルゼンチン',
    sweden: 'スウェーデン', newzealand: 'ニュージーランド', philippines: 'フィリピン', singapore: 'シンガポール',
    malaysia: 'マレーシア', peru: 'ペルー', chile: 'チリ', colombia: 'コロンビア',
    // Potty Log
    pottyLogTitle: '🐾 トイレ記録', pottyCalTab: 'カレンダー', pottyLogTab: 'トイレ記録',
    pottyPee: '💧 おしっこ', pottyPoo: '💩 うんち', pottyAccident: '⚠️ 事故', pottyNap: '😴 昼寝', pottyPlay: '🎾 遊び', pottyMeal: '🍽️ 食事',
    pottyLogBtn: '記録する', pottyHistory: '今日の記録', pottyStats: '統計',
    pottyNextPrediction: '⏰ 次の予測', pottyIn: '', pottyMinutes: '分後',
    pottyTimerStart: 'タイマー開始', pottyTimerStop: '停止', pottyTimerReset: 'リセット',
    pottyTotalToday: '今日の合計', pottyPeeCount: 'おしっこ', pottyPooCount: 'うんち', pottyAccidentCount: '事故',
    pottyAvgInterval: '平均間隔', pottyNapCount: '昼寝', pottyPlayCount: '遊び',
    pottyNoLogs: 'まだ記録がありません。記録を始めましょう！', pottyDeleteConfirm: 'この記録を削除しますか？',
    pottyStreak: '無事故連続', pottyDays: '日',
    // Settings
    settingsTitle: 'データ設定', settingsSub: 'データをローカルで管理',
    settingsNickname: 'ニックネーム', settingsNicknameSub: 'フィードに表示される名前',
    settingsBackup: 'データバックアップ', settingsBackupSub: 'すべてのデータをJSONファイルでダウンロード。',
    settingsRestore: 'データ復元', settingsRestoreSub: 'JSONファイルをアップロードしてデータを復元。',
    settingsReset: 'データリセット', settingsResetSub: 'すべてのローカルデータを削除します。',
    settingsExport: '⬇️ エクスポート', settingsImport: '⬆️ インポート', settingsResetBtn: '🗑️ リセット',
  }
};
function t(key) { return (T[state.lang] || T.en)[key] || T.en[key] || key; }

// ── Data ──
const BLUR_GRADIENTS = [
  'linear-gradient(135deg, #8B7355 0%, #A0896A 25%, #6B5B45 50%, #C4A882 75%, #7B6845 100%)',
  'linear-gradient(160deg, #9B8B6E 0%, #7A6A4E 30%, #BBA888 60%, #6D5D42 100%)',
  'linear-gradient(120deg, #A89070 0%, #887058 35%, #C8B090 65%, #786848 100%)',
  'linear-gradient(145deg, #6B8B5E 0%, #8BA878 30%, #5A7A4E 55%, #A0C090 100%)',
  'linear-gradient(130deg, #B09878 0%, #907858 25%, #D0B898 55%, #806848 100%)',
  'linear-gradient(155deg, #9A8A68 0%, #BA9A78 40%, #7A6A48 70%, #AA9A70 100%)',
];
const FEED_DATA = [
  { id: 1, user: 'Pooper_4443', level: 35, gender: 'M', type: 'dog', tag: 'warning', views: 298, likes: 4, comments: 3, time: '10h', bg: 0 },
  { id: 2, user: '남고딩', level: 2, type: 'human', gender: 'M', tag: 'normal', views: 285, likes: 0, comments: 3, time: '12h', bg: 1 },
  { id: 3, user: '똥꾼_9287', level: 1, type: 'human', gender: 'F', tag: 'caution', views: 134, likes: 0, comments: 1, time: '12h', bg: 2 },
  { id: 4, user: 'Luna_Mom', level: 8, type: 'dog', gender: 'F', tag: 'good', views: 502, likes: 142, comments: 18, time: '17h', bg: 3 },
  { id: 5, user: 'CatDad99', level: 5, type: 'cat', gender: 'M', tag: 'good', views: 89, likes: 12, comments: 4, time: '6h', bg: 4 },
  { id: 6, user: '똥꾼_5328', level: 5, type: 'human', gender: 'M', tag: 'good', views: 32, likes: 0, comments: 0, time: '2h', bg: 5 },
];

const MISSIONS_DATA = [
  { icon: '📸', key: 'm1', progress: 1, max: 1, reward: '10 XP' },
  { icon: '🔥', key: 'm2', progress: 3, max: 7, reward: '50 XP' },
  { icon: '❤️', key: 'm3', progress: 4, max: 10, reward: '30 XP' },
  { icon: '🐕', key: 'm4', progress: 1, max: 3, reward: '40 XP' },
  { icon: '🌍', key: 'm5', progress: 2, max: 10, reward: '25 XP' },
  { icon: '📅', key: 'm6', progress: 3, max: 30, reward: '200 XP' },
];
const BADGES = ['💩', '🔥', '⭐', '🏆', '👑', '💎', '🌈', '🎯', '🦴', '🐾', '❤️', '🌍'];

const HOF_DATA = [
  { rank: 1, user: 'Luna_Mom', type: 'dog', votes: 142, tag: 'good', descKey: 'hof1Desc' },
  { rank: 2, user: '똥꾼_3782', type: 'human', votes: 98, tag: 'caution', descKey: 'hof2Desc' },
  { rank: 3, user: 'Bark_King', type: 'dog', votes: 76, tag: 'good', descKey: 'hof3Desc' },
  { rank: 4, user: 'MeowPoop', type: 'cat', votes: 45, tag: 'normal', descKey: 'hof4Desc' },
  { rank: 5, user: '똥꾼_4443', type: 'human', votes: 38, tag: 'warning', descKey: 'hof5Desc' },
];

const WORLD_DATA = [
  { flag: '🇰🇷', key: 'korea', score: 72, users: 4800, diet: 'Kimchi & Rice' },
  { flag: '🇺🇸', key: 'usa', score: 65, users: 3200, diet: 'Fast food & Fiber' },
  { flag: '🇯🇵', key: 'japan', score: 78, users: 2900, diet: 'Fish & Fermented' },
  { flag: '🇩🇪', key: 'germany', score: 70, users: 1500, diet: 'Bread & Sausage' },
  { flag: '🇧🇷', key: 'brazil', score: 62, users: 1200, diet: 'Beans & Rice' },
  { flag: '🇬🇧', key: 'uk', score: 68, users: 1800, diet: 'Tea & Toast' },
  { flag: '🇫🇷', key: 'france', score: 71, users: 1100, diet: 'Cheese & Wine' },
  { flag: '🇦🇺', key: 'australia', score: 74, users: 900, diet: 'Vegemite & BBQ' },
  { flag: '🇮🇳', key: 'india', score: 58, users: 2100, diet: 'Curry & Lentils' },
  { flag: '🇨🇦', key: 'canada', score: 69, users: 800, diet: 'Maple & Poutine' },
  { flag: '🇻🇳', key: 'vietnam', score: 60, users: 950, diet: 'Pho & Herbs' },
  { flag: '🇹🇭', key: 'thailand', score: 63, users: 870, diet: 'Spicy & Rice' },
  { flag: '🇲🇽', key: 'mexico', score: 61, users: 750, diet: 'Tacos & Beans' },
  { flag: '🇮🇹', key: 'italy', score: 73, users: 680, diet: 'Pasta & Olive oil' },
  { flag: '🇪🇸', key: 'spain', score: 72, users: 620, diet: 'Tapas & Paella' },
  { flag: '🇨🇳', key: 'china', score: 67, users: 3500, diet: 'Rice & Dim sum' },
  { flag: '🇮🇩', key: 'indonesia', score: 59, users: 1300, diet: 'Nasi goreng' },
  { flag: '🇷🇺', key: 'russia', score: 64, users: 500, diet: 'Borscht & Bread' },
  { flag: '🇹🇷', key: 'turkey', score: 66, users: 480, diet: 'Kebab & Yogurt' },
  { flag: '🇪🇬', key: 'egypt', score: 55, users: 320, diet: 'Falafel & Bread' },
  { flag: '🇳🇬', key: 'nigeria', score: 52, users: 280, diet: 'Jollof & Fufu' },
  { flag: '🇦🇷', key: 'argentina', score: 63, users: 420, diet: 'Steak & Mate' },
  { flag: '🇸🇪', key: 'sweden', score: 76, users: 380, diet: 'Meatballs & Rye' },
  { flag: '🇳🇿', key: 'newzealand', score: 75, users: 290, diet: 'Lamb & Kiwi' },
  { flag: '🇵🇭', key: 'philippines', score: 57, users: 650, diet: 'Adobo & Rice' },
  { flag: '🇸🇬', key: 'singapore', score: 74, users: 410, diet: 'Laksa & Chili' },
  { flag: '🇲🇾', key: 'malaysia', score: 62, users: 530, diet: 'Nasi Lemak' },
  { flag: '🇵🇪', key: 'peru', score: 60, users: 210, diet: 'Ceviche & Quinoa' },
  { flag: '🇨🇱', key: 'chile', score: 64, users: 190, diet: 'Empanada & Wine' },
  { flag: '🇨🇴', key: 'colombia', score: 61, users: 230, diet: 'Bandeja Paisa' },
];

const LEADERBOARD_DATA = [
  { rank: 1, user: 'Luna_Mom', score: 9850, streak: 45, change: 0 },
  { rank: 2, user: 'PoopKing_KR', score: 8720, streak: 32, change: 2 },
  { rank: 3, user: 'Bark_King', score: 7900, streak: 28, change: -1 },
  { rank: 4, user: 'CatDad99', score: 6540, streak: 21, change: 1 },
  { rank: 5, user: '똥꾼_3782', score: 5890, streak: 19, change: -2 },
  { rank: 6, user: 'HealthyPup', score: 5200, streak: 15, change: 3 },
  { rank: 7, user: 'MeowPoop', score: 4800, streak: 14, change: 0 },
  { rank: 8, user: '남고딩', score: 4100, streak: 11, change: 1 },
];

const FRIENDS_DATA = [
  { user: 'Luna_Mom', status: 'online', pooping: true, level: 8 },
  { user: 'CatDad99', status: 'online', pooping: false, level: 5 },
  { user: 'Bark_King', status: 'offline', pooping: false, level: 12 },
  { user: '똥꾼_3782', status: 'online', pooping: true, level: 7 },
];

const DAILY_CHALLENGES = [
  { icon: '🌅', task: 'Log before 8 AM', reward: '20 XP', taskKo: '오전 8시 전에 기록', taskJa: '午前8時前に記録' },
  { icon: '💧', task: 'Drink 2L water today', reward: '15 XP', taskKo: '오늘 물 2L 마시기', taskJa: '今日水2L飲む' },
  { icon: '🥗', task: 'Eat 3 servings of vegetables', reward: '25 XP', taskKo: '채소 3인분 먹기', taskJa: '野菜3人分食べる' },
];

const TOILET_RATINGS = [
  { name: 'Starbucks Gangnam', rating: 4.2, clean: 'toiletClean', votes: 89, sitPct: 92, distance: '120m' },
  { name: 'Seoul Station', rating: 3.1, clean: 'toiletAvg', votes: 245, sitPct: 58, distance: '350m' },
  { name: 'Lotte Mall', rating: 4.7, clean: 'toiletClean', votes: 167, sitPct: 97, distance: '500m' },
  { name: 'Coex Mall', rating: 4.5, clean: 'toiletClean', votes: 203, sitPct: 94, distance: '800m' },
  { name: 'Hongdae Street', rating: 2.8, clean: 'toiletDirty', votes: 312, sitPct: 45, distance: '200m' },
  { name: 'Gangnam Station', rating: 3.5, clean: 'toiletAvg', votes: 178, sitPct: 62, distance: '450m' },
];

// Calendar mock records
const CAL_RECORDS = {};
(() => {
  const bristolEmojis = ['⚫', '🟤', '🟫', '🟡', '🟠', '🔴', '💧'];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    CAL_RECORDS[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] = bristolEmojis[Math.floor(Math.random() * 5) + 1];
  }
})();

// ── Demo Data Loader (call from console: loadDemoData()) ──
function loadDemoData() {
  const bristolEmojis = ['⚫', '🟤', '🟫', '🟡', '🟠', '🔴', '💧'];
  const analysisKeys = ['resultHealthy', 'resultModerate', 'resultConcern', 'resultDehydration'];
  const colorKeys = ['colorBrown', 'colorDarkBrown', 'colorGreen', 'colorYellow'];

  // 1. Analysis History (30 days of data)
  DB.history = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    d.setHours(7 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
    const bristol = Math.floor(Math.random() * 5) + 2; // types 2-6
    const score = bristol === 4 ? 80 + Math.floor(Math.random() * 20) : bristol === 3 || bristol === 5 ? 50 + Math.floor(Math.random() * 30) : 20 + Math.floor(Math.random() * 30);
    DB.history.push({
      date: d.toISOString(),
      pet: 'dog',
      score: score,
      bristol: bristol,
      colorKey: colorKeys[Math.floor(Math.random() * colorKeys.length)],
      msgKey: analysisKeys[Math.floor(Math.random() * analysisKeys.length)],
      key: 'tag' + Math.floor(Math.random() * 5),
    });
    // Mark calendar
    CAL_RECORDS[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] = bristolEmojis[bristol - 1];
    // Second analysis some days for cat
    if (i % 3 === 0) {
      const d2 = new Date(d); d2.setHours(d2.getHours() + 4);
      const b2 = Math.floor(Math.random() * 4) + 3;
      DB.history.push({ date: d2.toISOString(), pet: 'cat', score: 60 + Math.floor(Math.random() * 35), bristol: b2, colorKey: 'colorBrown', msgKey: 'resultHealthy', key: 'tagCat' });
    }
  }
  saveDB('history');

  // 2. Pets
  DB.pets = [
    { id: '1', name: '멉멉이', species: 'dog', breed: '푸들', birthday: '2022-03-15', weight: '5.2', created: new Date().toISOString() },
    { id: '2', name: '나비', species: 'cat', breed: '러시안블루', birthday: '2023-01-10', weight: '4.1', created: new Date().toISOString() },
    { id: '3', name: '초코', species: 'dog', breed: '시바이누', birthday: '2021-08-20', weight: '8.5', created: new Date().toISOString() },
  ];
  DB.activePet = '1';
  saveDB('pets'); saveDB('activePet');

  // 3. Feed Posts
  const feedAuthors = ['보미맘', '포메마루', '고양이 집사', '닥스훈트맘', '퍼그러버'];
  DB.feedPosts = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    DB.feedPosts.push({
      id: Date.now() - i * 100000,
      author: feedAuthors[i % feedAuthors.length],
      gender: ['M', 'F'][Math.floor(Math.random() * 2)],
      tag: 'tag' + (i % 5),
      views: 50 + Math.floor(Math.random() * 500),
      likes: 5 + Math.floor(Math.random() * 100),
      comments: Math.floor(Math.random() * 20),
      time: `${i}h ago`,
      analysis: analysisKeys[i % analysisKeys.length],
      score: 50 + Math.floor(Math.random() * 50),
      bristol: 2 + Math.floor(Math.random() * 5),
      color: colorKeys[i % colorKeys.length],
      date: d.toISOString(),
      isOwn: i < 2,
      image: null,
    });
  }
  saveDB('feedPosts');

  // 4. XP & Level
  DB.xp = 450;
  saveDB('xp');

  // 5. Potty Logs
  const pottyTypes = ['pee', 'poo', 'meal', 'play', 'nap'];
  const logs = [];
  const today = new Date();
  for (let i = 0; i < 8; i++) {
    const t = new Date(today);
    t.setHours(6 + i * 2, Math.floor(Math.random() * 60));
    logs.push({ type: pottyTypes[i % pottyTypes.length], time: t.toISOString() });
  }
  POTTY_LOGS.length = 0;
  logs.forEach(l => POTTY_LOGS.push(l));
  localStorage.setItem('pb-potty-logs', JSON.stringify(POTTY_LOGS));

  // 6. Explored Countries
  DB.exploredCountries = ['kr', 'jp', 'us', 'de', 'br'];
  saveDB('exploredCountries');

  // 7. User
  DB.user = { name: 'DemoUser', email: 'demo@poopbuddy.com', loggedIn: true };
  saveDB('user');

  console.log('✅ Demo data loaded! Refreshing...');
  render();
  showToast('✅ 데모 데이터 로드 완료!');
}

// ── Router ──
function navigate(page) {
  state.page = page;
  document.getElementById('navLinks').classList.remove('open');
  history.pushState({ page }, '', '#' + page);
  updateNavActive();
  render();
}
window.addEventListener('popstate', (e) => {
  state.page = (e.state && e.state.page) || 'landing';
  updateNavActive();
  render();
});
function updateNavActive() {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === state.page));
  document.querySelectorAll('.bottom-nav-item').forEach(l => l.classList.toggle('active', l.dataset.page === state.page));
}

// ── Helpers ──
const typeIcon = m => ({ dog: '🐕', cat: '🐱', human: '👤' })[m] || '🐕';

// ── Page: Landing ──
function renderLanding() {
  // Mode-specific SVG mascots
  const mascots = {
    dog: `<svg viewBox="0 0 160 160" width="140" height="140" style="margin:0 auto">
      <ellipse cx="80" cy="110" rx="50" ry="40" fill="#F5E6D3" stroke="#D4C0A8" stroke-width="2"/>
      <circle cx="80" cy="65" r="38" fill="#F5E6D3" stroke="#D4C0A8" stroke-width="2"/>
      <ellipse cx="48" cy="40" rx="16" ry="23" fill="#E8D5C0" stroke="#D4C0A8" stroke-width="2" transform="rotate(-15 48 40)"/>
      <ellipse cx="112" cy="40" rx="16" ry="23" fill="#E8D5C0" stroke="#D4C0A8" stroke-width="2" transform="rotate(15 112 40)"/>
      <circle cx="67" cy="60" r="5" fill="#3D3225"/><circle cx="93" cy="60" r="5" fill="#3D3225"/>
      <circle cx="69" cy="58" r="2" fill="white"/><circle cx="95" cy="58" r="2" fill="white"/>
      <ellipse cx="80" cy="73" rx="5" ry="3.5" fill="#3D3225"/>
      <path d="M73 78 Q80 84 87 78" stroke="#3D3225" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="57" cy="72" rx="7" ry="4" fill="#FFB5B5" opacity="0.5"/>
      <ellipse cx="103" cy="72" rx="7" ry="4" fill="#FFB5B5" opacity="0.5"/>
      <path d="M125 100 Q140 82 148 96 Q152 105 143 110" stroke="#D4C0A8" stroke-width="3" fill="#F5E6D3"/>
      <ellipse cx="58" cy="145" rx="11" ry="7" fill="#E8D5C0" stroke="#D4C0A8" stroke-width="1.5"/>
      <ellipse cx="102" cy="145" rx="11" ry="7" fill="#E8D5C0" stroke="#D4C0A8" stroke-width="1.5"/>
    </svg>`,
    cat: `<svg viewBox="0 0 160 160" width="140" height="140" style="margin:0 auto">
      <ellipse cx="80" cy="110" rx="45" ry="38" fill="#E8E0D8" stroke="#C4B8AC" stroke-width="2"/>
      <circle cx="80" cy="65" r="36" fill="#E8E0D8" stroke="#C4B8AC" stroke-width="2"/>
      <polygon points="50,40 38,10 60,35" fill="#E8E0D8" stroke="#C4B8AC" stroke-width="2"/>
      <polygon points="110,40 122,10 100,35" fill="#E8E0D8" stroke="#C4B8AC" stroke-width="2"/>
      <polygon points="50,38 42,18 58,34" fill="#F5C6C6" stroke="none"/>
      <polygon points="110,38 118,18 102,34" fill="#F5C6C6" stroke="none"/>
      <ellipse cx="67" cy="60" rx="6" ry="7" fill="#6B8E5A"/><ellipse cx="93" cy="60" rx="6" ry="7" fill="#6B8E5A"/>
      <ellipse cx="67" cy="60" rx="3" ry="6" fill="#2D2D2D"/><ellipse cx="93" cy="60" rx="3" ry="6" fill="#2D2D2D"/>
      <circle cx="65" cy="57" r="1.5" fill="white"/><circle cx="91" cy="57" r="1.5" fill="white"/>
      <ellipse cx="80" cy="72" rx="4" ry="3" fill="#F5A0A0"/>
      <path d="M76 75 L80 78 L84 75" stroke="#C4B8AC" stroke-width="1" fill="none"/>
      <line x1="45" y1="68" x2="62" y2="70" stroke="#C4B8AC" stroke-width="1"/>
      <line x1="45" y1="74" x2="62" y2="73" stroke="#C4B8AC" stroke-width="1"/>
      <line x1="115" y1="68" x2="98" y2="70" stroke="#C4B8AC" stroke-width="1"/>
      <line x1="115" y1="74" x2="98" y2="73" stroke="#C4B8AC" stroke-width="1"/>
      <ellipse cx="55" cy="67" rx="6" ry="3.5" fill="#FFB5B5" opacity="0.4"/>
      <ellipse cx="105" cy="67" rx="6" ry="3.5" fill="#FFB5B5" opacity="0.4"/>
      <path d="M125 105 Q140 95 145 110 Q148 120 138 118 Q130 115 128 108" stroke="#C4B8AC" stroke-width="2.5" fill="#E8E0D8"/>
      <ellipse cx="58" cy="143" rx="10" ry="6" fill="#DDD5CD" stroke="#C4B8AC" stroke-width="1.5"/>
      <ellipse cx="102" cy="143" rx="10" ry="6" fill="#DDD5CD" stroke="#C4B8AC" stroke-width="1.5"/>
    </svg>`,
    human: `<svg viewBox="0 0 160 160" width="140" height="140" style="margin:0 auto">
      <ellipse cx="80" cy="120" rx="35" ry="32" fill="#7ECF8B" stroke="#5BB89A" stroke-width="2"/>
      <circle cx="80" cy="60" r="35" fill="#FFDCB5" stroke="#E8C9A0" stroke-width="2"/>
      <path d="M50 45 Q50 20 80 18 Q110 20 110 45" fill="#6B4423" stroke="#5A3A1E" stroke-width="1.5"/>
      <circle cx="68" cy="55" r="4" fill="#3D3225"/><circle cx="92" cy="55" r="4" fill="#3D3225"/>
      <circle cx="70" cy="53" r="1.5" fill="white"/><circle cx="94" cy="53" r="1.5" fill="white"/>
      <path d="M73 70 Q80 76 87 70" stroke="#E8836B" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="58" cy="65" rx="6" ry="4" fill="#FFB5B5" opacity="0.4"/>
      <ellipse cx="102" cy="65" rx="6" ry="4" fill="#FFB5B5" opacity="0.4"/>
      <line x1="52" y1="115" x2="40" y2="150" stroke="#5BB89A" stroke-width="4" stroke-linecap="round"/>
      <line x1="108" y1="115" x2="120" y2="150" stroke="#5BB89A" stroke-width="4" stroke-linecap="round"/>
      <text x="70" y="130" font-size="20">💩</text>
    </svg>`
  };

  // Mode-specific hero subtitles
  const modeSubtitles = {
    dog: { en: "One poop photo reveals your pup's hidden health signs", ko: "사진 한 장으로 우리 강아지 건강 신호를 읽어보세요", ja: "ワンちゃんの健康サインをAIが読み取ります" },
    cat: { en: "Decode your kitty's gut health in seconds", ko: "고양이 장 건강, AI가 몇 초 만에 분석해요", ja: "ネコちゃんの腸の健康を数秒で分析" },
    human: { en: "Your gut talks. We translate.", ko: "당신의 장이 보내는 신호, 우리가 읽어드려요", ja: "あなたの腸が語る健康サインを翻訳します" }
  };
  const heroSub = (modeSubtitles[state.mode] || modeSubtitles.dog)[state.lang] || (modeSubtitles[state.mode] || modeSubtitles.dog).en;

  return `<div class="page">
    <div class="hero">
      <div class="hero-mascot">
        ${mascots[state.mode] || mascots.dog}
      </div>
      <div class="hero-label" style="display:inline-block;padding:6px 16px;border-radius:20px;background:linear-gradient(135deg,var(--accent-mint-light),var(--accent-lavender-light));font-size:0.8rem;font-weight:700;color:var(--accent-mint);letter-spacing:0.5px;margin-bottom:12px">${t('heroLabel')}</div>
      <h1 class="hero-title" style="line-height:1.2">${t('heroTitle1')}<br><span style="background:linear-gradient(135deg,var(--accent-mint),var(--accent-lavender));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${t('heroTitle2')}</span> ${t('heroTitle3')}</h1>
      <p class="hero-subtitle" style="max-width:360px;margin:12px auto 0;line-height:1.6;font-size:0.95rem">${heroSub}</p>
      <div class="hero-cta">
        <button class="btn-primary" onclick="navigate('analyze')">${t('startBtn')}</button>
        <button class="btn-secondary" onclick="navigate('feed')">${t('learnBtn')}</button>
      </div>
    </div>
    <div class="mode-selector">
      ${['dog', 'cat', 'human'].map(m => {
    const modeIcons = {
      dog: `<svg viewBox="0 0 80 80" width="64" height="64">
            <ellipse cx="40" cy="52" rx="22" ry="18" fill="#F5E6D3" stroke="#D4C0A8" stroke-width="1.5"/>
            <ellipse cx="40" cy="35" rx="18" ry="16" fill="#F5E6D3" stroke="#D4C0A8" stroke-width="1.5"/>
            <path d="M22 28c-6-12-14-8-12-2s6 12 12 10" fill="#E8D5BF" stroke="#D4C0A8" stroke-width="1"/>
            <path d="M58 28c6-12 14-8 12-2s-6 12-12 10" fill="#E8D5BF" stroke="#D4C0A8" stroke-width="1"/>
            <circle cx="34" cy="33" r="2.5" fill="#5D4037"/>
            <circle cx="46" cy="33" r="2.5" fill="#5D4037"/>
            <circle cx="33" cy="32" r="0.8" fill="#fff"/>
            <circle cx="45" cy="32" r="0.8" fill="#fff"/>
            <ellipse cx="40" cy="38" rx="3" ry="2" fill="#8B6F5E"/>
            <path d="M37 41c1.5 2 4.5 2 6 0" stroke="#8B6F5E" stroke-width="1" fill="none" stroke-linecap="round"/>
            <circle cx="28" cy="38" r="4" fill="#FFB5B5" opacity="0.4"/>
            <circle cx="52" cy="38" r="4" fill="#FFB5B5" opacity="0.4"/>
          </svg>`,
      cat: `<svg viewBox="0 0 80 80" width="64" height="64">
            <ellipse cx="40" cy="52" rx="20" ry="16" fill="#FFE0B2" stroke="#E6C990" stroke-width="1.5"/>
            <ellipse cx="40" cy="36" rx="18" ry="16" fill="#FFE0B2" stroke="#E6C990" stroke-width="1.5"/>
            <path d="M22 26L18 10l14 12z" fill="#FFE0B2" stroke="#E6C990" stroke-width="1.2"/>
            <path d="M58 26L62 10l-14 12z" fill="#FFE0B2" stroke="#E6C990" stroke-width="1.2"/>
            <path d="M21 12l2 5" stroke="#FFB74D" stroke-width="1.5"/>
            <path d="M59 12l-2 5" stroke="#FFB74D" stroke-width="1.5"/>
            <circle cx="34" cy="34" r="2.5" fill="#5D4037"/>
            <circle cx="46" cy="34" r="2.5" fill="#5D4037"/>
            <circle cx="33" cy="33" r="0.8" fill="#fff"/>
            <circle cx="45" cy="33" r="0.8" fill="#fff"/>
            <ellipse cx="40" cy="39" rx="2.5" ry="1.5" fill="#F48FB1"/>
            <path d="M37 41c1.5 2 4.5 2 6 0" stroke="#D4868C" stroke-width="1" fill="none" stroke-linecap="round"/>
            <line x1="18" y1="36" x2="28" y2="38" stroke="#D4C0A8" stroke-width="0.8"/>
            <line x1="18" y1="40" x2="28" y2="40" stroke="#D4C0A8" stroke-width="0.8"/>
            <line x1="62" y1="36" x2="52" y2="38" stroke="#D4C0A8" stroke-width="0.8"/>
            <line x1="62" y1="40" x2="52" y2="40" stroke="#D4C0A8" stroke-width="0.8"/>
            <circle cx="28" cy="40" r="4" fill="#FFB5B5" opacity="0.4"/>
            <circle cx="52" cy="40" r="4" fill="#FFB5B5" opacity="0.4"/>
          </svg>`,
      human: `<svg viewBox="0 0 80 80" width="64" height="64">
            <ellipse cx="40" cy="52" rx="22" ry="18" fill="#FCEBD5" stroke="#E6C990" stroke-width="1.5"/>
            <ellipse cx="40" cy="34" rx="17" ry="16" fill="#FCEBD5" stroke="#E6C990" stroke-width="1.5"/>
            <path d="M23 30c0-14 10-20 17-20s17 6 17 20" fill="#8B6F5E" stroke="#6D5545" stroke-width="1"/>
            <circle cx="34" cy="34" r="2.2" fill="#5D4037"/>
            <circle cx="46" cy="34" r="2.2" fill="#5D4037"/>
            <circle cx="33" cy="33" r="0.7" fill="#fff"/>
            <circle cx="45" cy="33" r="0.7" fill="#fff"/>
            <path d="M37 40c1.5 1.5 4.5 1.5 6 0" stroke="#D4868C" stroke-width="1.2" fill="none" stroke-linecap="round"/>
            <circle cx="28" cy="38" r="4" fill="#FFB5B5" opacity="0.4"/>
            <circle cx="52" cy="38" r="4" fill="#FFB5B5" opacity="0.4"/>
          </svg>`
    };
    return `
        <div class="mode-card ${state.mode === m ? 'active' : ''}" onclick="state.mode='${m}';render()">
          <div class="mode-icon">${modeIcons[m]}</div>
          <div class="mode-label">${t('mode' + m.charAt(0).toUpperCase() + m.slice(1))}</div>
        </div>`;
  }).join('')}
    </div>
    <div class="features-grid">
      ${(() => {
      const lastAnalysis = DB.history.filter(h => h.pet === state.mode).slice(-1)[0];
      const healthScore = lastAnalysis ? lastAnalysis.score : null;
      const streak = (() => { let s = 0; const today = new Date(); for (let i = 0; i < 60; i++) { const d = new Date(today); d.setDate(d.getDate() - i); if (CAL_RECORDS[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`]) s++; else break; } return s; })();
      const weekRecords = (() => { let c = 0; const today = new Date(); for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(d.getDate() - i); if (CAL_RECORDS[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`]) c++; } return c; })();
      const recentPosts = (DB.feedPosts || []).slice(0, 3);
      const pets = DB.pets || [];
      const recentReports = DB.history.filter(h => h.pet === state.mode).slice(-3).reverse();
      const topCountries = [{ flag: '🇯🇵', name: 'Japan', score: 82 }, { flag: '🇰🇷', name: 'Korea', score: 78 }, { flag: '🇺🇸', name: 'USA', score: 75 }];

      return [
        // 1. Health Score
        `<div class="card feature-card" onclick="navigate('analyze')" style="cursor:pointer">
            <div class="feature-icon"><svg viewBox="0 0 40 40" width="36" height="36"><rect x="6" y="8" width="28" height="24" rx="3" fill="#E8F5E9" stroke="#5BB89A" stroke-width="1.5"/><circle cx="20" cy="20" r="5" fill="none" stroke="#5BB89A" stroke-width="1.5"/><circle cx="20" cy="20" r="1.5" fill="#5BB89A"/></svg></div>
            <div class="feature-title">${t('feat1T')}</div>
            <div class="feature-live" style="margin-top:8px;font-size:0.85rem;color:var(--text-secondary)">
              ${healthScore !== null ? `<span style="font-size:1.6rem;font-weight:800;color:${healthScore >= 70 ? 'var(--accent-mint)' : healthScore >= 40 ? 'var(--accent-peach)' : 'var(--accent-coral)'}">${healthScore}</span><span style="font-size:0.8rem;color:var(--text-muted)"> /100</span>` : `<span style="color:var(--text-muted);font-size:0.8rem">${state.lang === 'ko' ? '분석 기록 없음' : 'No data yet'}</span>`}
            </div>
          </div>`,
        // 2. Pattern Tracking
        `<div class="card feature-card" onclick="navigate('calendar')" style="cursor:pointer">
            <div class="feature-icon"><svg viewBox="0 0 40 40" width="36" height="36"><rect x="6" y="8" width="28" height="26" rx="3" fill="#FFF8E1" stroke="#D4A853" stroke-width="1.5"/><line x1="6" y1="16" x2="34" y2="16" stroke="#D4A853" stroke-width="1.5"/><circle cx="20" cy="25" r="3" fill="#5BB89A"/></svg></div>
            <div class="feature-title">${t('feat2T')}</div>
            <div class="feature-live" style="margin-top:8px;display:flex;gap:12px;font-size:0.8rem">
              <span style="color:var(--accent-mint);font-weight:700">🔥 ${streak}${state.lang === 'ko' ? '일 ' : ' days'}</span>
              <span style="color:var(--text-muted)">${state.lang === 'ko' ? '이번주' : 'この週'} ${weekRecords}/7</span>
            </div>
          </div>`,
        // 3. Community Feed
        `<div class="card feature-card" onclick="navigate('feed')" style="cursor:pointer">
            <div class="feature-icon"><svg viewBox="0 0 40 40" width="36" height="36"><path d="M8 10h24M8 18h18M8 26h21" stroke="#8B7355" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="26" r="4" fill="#FFB5B5" stroke="#D4868C" stroke-width="1.2"/></svg></div>
            <div class="feature-title">${t('feat3T')}</div>
            <div class="feature-live" style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">
              ${recentPosts.length > 0 ? recentPosts.map(p => `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">• ${p.author || 'User'}: ${(p.analysis || '').slice(0, 20)}...</div>`).join('') : (state.lang === 'ko' ? '아직 글이 없어요' : 'No posts yet')}
            </div>
          </div>`,
        // 4. Multi-pet Profile
        `<div class="card feature-card" onclick="navigate('more')" style="cursor:pointer">
            <div class="feature-icon"><svg viewBox="0 0 40 40" width="36" height="36"><circle cx="14" cy="14" r="4" fill="#F5E6D3" stroke="#D4C0A8" stroke-width="1.5"/><circle cx="26" cy="14" r="4" fill="#F5E6D3" stroke="#D4C0A8" stroke-width="1.5"/><circle cx="14" cy="26" r="4" fill="#F5E6D3" stroke="#D4C0A8" stroke-width="1.5"/><circle cx="26" cy="26" r="4" fill="#F5E6D3" stroke="#D4C0A8" stroke-width="1.5"/><circle cx="20" cy="20" r="2.5" fill="#D4C0A8"/></svg></div>
            <div class="feature-title">${t('feat4T')}</div>
            <div class="feature-live" style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">
              ${pets.length > 0 ? pets.map(p => `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg-secondary);padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:600">${p.species === 'dog' ? '🐶' : p.species === 'cat' ? '🐱' : '👤'} ${p.name}</span>`).join('') : `<span style="color:var(--text-muted);font-size:0.8rem">${state.lang === 'ko' ? '등록된 반려동물 없음' : 'No pets registered'}</span>`}
            </div>
          </div>`,
        // 5. Vet Report
        `<div class="card feature-card" onclick="navigate('stats')" style="cursor:pointer">
            <div class="feature-icon"><svg viewBox="0 0 40 40" width="36" height="36"><rect x="8" y="6" width="24" height="28" rx="2" fill="#E3F2FD" stroke="#6DA9D2" stroke-width="1.5"/><line x1="13" y1="14" x2="27" y2="14" stroke="#6DA9D2" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="20" x2="24" y2="20" stroke="#6DA9D2" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="26" x2="26" y2="26" stroke="#6DA9D2" stroke-width="1.5" stroke-linecap="round"/></svg></div>
            <div class="feature-title">${t('feat5T')}</div>
            <div class="feature-live" style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">
              ${recentReports.length > 0 ? recentReports.map(r => `<div style="margin-bottom:2px">• ${new Date(r.date).toLocaleDateString()} — ${r.score}점</div>`).join('') : (state.lang === 'ko' ? '리포트 없음' : 'No reports')}
            </div>
          </div>`,
        // 6. World Poop Map
        `<div class="card feature-card" onclick="navigate('worldmap')" style="cursor:pointer">
            <div class="feature-icon"><svg viewBox="0 0 40 40" width="36" height="36"><circle cx="20" cy="20" r="14" fill="#E3F2FD" stroke="#6DA9D2" stroke-width="1.5"/><path d="M8 15c5-2 8 3 12 1s5-4 12-2" stroke="#6DA9D2" stroke-width="1.3" fill="none"/><path d="M7 23c6 2 8-3 13-1s6 3 13 0" stroke="#6DA9D2" stroke-width="1.3" fill="none"/></svg></div>
            <div class="feature-title">${t('feat6T')}</div>
            <div class="feature-live" style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">
              ${topCountries.map((c, i) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span>${c.flag}</span><span style="flex:1">${c.name}</span><span style="font-weight:700;color:var(--accent-mint)">${c.score}</span></div>`).join('')}
            </div>
          </div>`,
      ].join('');
    })()}
    </div>
    <div class="ad-infeed" style="margin-top:24px">${t('adSlot')}</div>
  </div>`;
}

// ── Page: Analyze ──
function renderAnalyze() {
  return `<div class="page"><div class="analyze-container">
    <h1 class="section-title">${t('uploadTitle')}</h1>
    <div class="pet-select" style="display:flex;gap:8px;flex-wrap:nowrap;">
      ${['dog', 'cat', 'human'].map(m => `
        <button class="pet-btn ${state.mode === m ? 'active' : ''}" onclick="state.mode='${m}';render()" style="flex:1;min-width:0;white-space:nowrap;font-size:0.85rem;padding:8px 6px;">${typeIcon(m)} ${t('mode' + m.charAt(0).toUpperCase() + m.slice(1)).replace(/^[^\s]+\s/, '')}</button>`).join('')}
    </div>
    <div class="upload-zone" id="uploadZone" onclick="showPhotoPickerPopup()">
      <input type="file" accept="image/*" class="upload-input" id="fileInput" onchange="handleFileSelect(event)" style="display:none">
      <input type="file" accept="image/*" capture="environment" class="upload-input" id="cameraInput" onchange="handleFileSelect(event)" style="display:none">
      <div class="upload-icon">📸</div>
      <div class="upload-text">${t('uploadText')}</div>
      <div class="upload-hint">${t('uploadHint')}</div>
    </div>
    <img class="preview-img" id="previewImg">
    <div class="analyze-btn-wrap">
      <button class="btn-primary" id="analyzeBtn" onclick="runAnalysis()" style="display:none">${t('analyzeBtn')}</button>
    </div>
    <div class="analysis-result" id="analysisResult"></div>
  </div></div>
  <div class="loading-overlay" id="loadingOverlay">
    <div class="loading-content"><div class="loading-spinner">🐾</div>
    <div class="loading-text">${t('analyzing')}</div>
    <div style="color:var(--text-secondary);font-size:0.85rem;margin-top:8px">${t('analyzingDesc')}</div></div>
  </div>
  <!-- Photo picker popup -->
  <div id="photoPickerPopup" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:9999;align-items:center;justify-content:center;">
    <div style="background:var(--card-bg);border-radius:16px;padding:24px;margin:20px;max-width:320px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:20px;">📸 사진 추가</div>
      <button onclick="pickFromGallery()" style="width:100%;padding:14px;margin-bottom:10px;border:none;border-radius:12px;background:var(--accent);color:#fff;font-size:1rem;font-weight:600;cursor:pointer;">🖼️ 갤러리에서 선택</button>
      <button onclick="pickFromCamera()" style="width:100%;padding:14px;margin-bottom:10px;border:none;border-radius:12px;background:var(--primary);color:#fff;font-size:1rem;font-weight:600;cursor:pointer;">📷 사진 촬영</button>
      <button onclick="closePhotoPickerPopup()" style="width:100%;padding:12px;border:none;border-radius:12px;background:var(--card-bg);color:var(--text-secondary);font-size:0.95rem;cursor:pointer;border:1px solid var(--border);">취소</button>
    </div>
  </div>`;
}

// ── Page: Feed ──
function renderFeed() {
  const online = 14 + Math.floor(Math.random() * 20);

  // Merge user's own posts with dummy data
  const ownPosts = DB.feedPosts.map(p => ({
    ...p, bg: Math.floor(Math.random() * 9),
    feedCaption: `Score: ${p.score} · Bristol Type ${p.bristol}`,
    feedAnalysis: t(p.analysis || p.msgKey || 'analysisGoodMsg'),
  }));
  const allPosts = [...ownPosts, ...FEED_DATA];

  const filtered = state.feedFilter === 'all' ? allPosts
    : state.feedFilter === 'M' || state.feedFilter === 'F' ? allPosts.filter(p => p.gender === state.feedFilter)
      : allPosts.filter(p => p.type === state.feedFilter);

  return `<div class="page">
    <div class="feed-header">
      <h1 class="section-title">${t('feedTitle')}</h1>
      <div class="online-count"><div class="online-dot"></div>${online} ${t('feedOnline')}</div>
    </div>
    <div class="feed-filters">
      ${[['all', t('filterAll')], ['dog', '🐕'], ['cat', '🐱'], ['human', '👤'], ['M', '♂'], ['F', '♀']].map(([f, label]) => `
        <button class="filter-btn ${state.feedFilter === f ? 'active' : ''}" onclick="state.feedFilter='${f}';render()">${label}</button>`).join('')}
    </div>
    <div class="feed-grid" style="margin-top:16px">
      ${filtered.map((p, i) => {
    const isOwn = p.isOwn;
    const caption = isOwn ? p.feedCaption : (t('feed' + p.id + 'Caption') || '');
    const analysis = isOwn ? p.feedAnalysis : t('feed' + p.id + 'Analysis');
    const timeStr = isOwn ? new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : p.time;
    return `
        ${i === 3 ? `<div class="ad-infeed">${t('adSlot')}</div>` : ''}
        <div class="card feed-card" ${isOwn ? 'style="border-left:3px solid var(--accent)"' : ''}>
          ${p.image ? `<img src="${p.image}" style="width:100%;border-radius:12px 12px 0 0;display:none;max-height:300px;object-fit:cover" class="feed-photo">` : ''}
          <div class="feed-blur" style="--blur-bg:${BLUR_GRADIENTS[p.bg || 0]}" onclick="this.style.display='none';var photo=this.parentElement.querySelector('.feed-photo');if(photo)photo.style.display='block'">
            <div class="poop-shapes">
              <span style="left:${15 + (p.id || 0) * 12}%;top:${20 + (p.id || 0) * 8}%">💩</span>
              <span style="left:${55 - (p.id || 0) * 5}%;top:${45 + (p.id || 0) * 3}%">💩</span>
              <span style="left:${30 + (p.id || 0) * 7}%;top:${65 - (p.id || 0) * 4}%">💩</span>
            </div>
            <div class="feed-blur-emoji">${isOwn ? '⭐' : '💩'}</div>
            <div class="feed-blur-text">${t('tapToView')}<br><small style="opacity:0.6">${typeIcon(p.type)}</small></div>
          </div>
          <div class="feed-meta">
            <div class="feed-user">
              <div class="feed-avatar">${typeIcon(p.type)}</div>
              <span class="feed-username">${p.user}${isOwn ? ' ⭐' : ''}</span>
              <span class="feed-level">Lv.${p.level}</span>
              <span class="tag tag-${p.tag}" style="margin-left:auto">${t(p.tag)}</span>
            </div>
            ${caption ? `<div style="font-size:0.9rem">${caption}</div>` : ''}
            <div class="feed-analysis">${analysis}</div>
            <div class="feed-actions">
              <span class="feed-action" onclick="likeFeedPost(${p.id})">${t('feedLike')} <span>${p.likes}</span></span>
              <span class="feed-action">${t('feedComment')} ${p.comments}</span>
              <span class="feed-action">${t('feedShare')}</span>
              <span style="margin-left:auto;font-size:0.75rem;color:var(--text-muted)">${p.views || 0} ${t('views')} · ${timeStr}</span>
            </div>
          </div>
        </div>`;
  }).join('')}
    </div>
  </div>`;
}
function likeFeedPost(postId) {
  const post = DB.feedPosts.find(p => p.id === postId);
  if (post) { post.likes = (post.likes || 0) + 1; saveDB('feedPosts'); }
  render();
}

// ── Potty Log Data ──
const POTTY_LOGS = JSON.parse(localStorage.getItem('pb-potty-logs') || '[]');
let pottyTimerInterval = null;
let pottyTimerSeconds = 0;
let pottyTimerRunning = false;
if (!state.calTab) state.calTab = 'calendar';

function savePottyLogs() { localStorage.setItem('pb-potty-logs', JSON.stringify(POTTY_LOGS)); }

function addPottyLog(type) {
  const now = new Date();
  POTTY_LOGS.push({ type, time: now.toISOString(), pet: state.mode });
  savePottyLogs();
  showToast(`${t('potty' + type.charAt(0).toUpperCase() + type.slice(1))} logged!`);
  render();
}

function deletePottyLog(idx) {
  POTTY_LOGS.splice(idx, 1);
  savePottyLogs();
  render();
}

function getTodayLogs() {
  const todayStr = new Date().toDateString();
  return POTTY_LOGS.filter(l => new Date(l.time).toDateString() === todayStr && l.pet === state.mode);
}

function getPottyStats() {
  const logs = getTodayLogs();
  const pee = logs.filter(l => l.type === 'pee').length;
  const poo = logs.filter(l => l.type === 'poo').length;
  const accident = logs.filter(l => l.type === 'accident').length;
  const nap = logs.filter(l => l.type === 'nap').length;
  const play = logs.filter(l => l.type === 'play').length;

  // Average interval between pee/poo events
  const pottyEvents = logs.filter(l => ['pee', 'poo'].includes(l.type)).sort((a, b) => new Date(a.time) - new Date(b.time));
  let avgInterval = 0;
  if (pottyEvents.length > 1) {
    let totalMinutes = 0;
    for (let i = 1; i < pottyEvents.length; i++) {
      totalMinutes += (new Date(pottyEvents[i].time) - new Date(pottyEvents[i - 1].time)) / 60000;
    }
    avgInterval = Math.round(totalMinutes / (pottyEvents.length - 1));
  }

  // Predict next potty time
  let predictedMinutes = null;
  if (pottyEvents.length > 0 && avgInterval > 0) {
    const lastEvent = new Date(pottyEvents[pottyEvents.length - 1].time);
    const predictedTime = new Date(lastEvent.getTime() + avgInterval * 60000);
    const now = new Date();
    predictedMinutes = Math.max(0, Math.round((predictedTime - now) / 60000));
  }

  // Accident-free streak (count consecutive days without accidents)
  let accidentFreeStreak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dayStr = d.toDateString();
    const dayLogs = POTTY_LOGS.filter(l => new Date(l.time).toDateString() === dayStr && l.pet === state.mode);
    if (dayLogs.some(l => l.type === 'accident')) break;
    if (dayLogs.length > 0 || i === 0) accidentFreeStreak++;
  }

  return { pee, poo, accident, nap, play, avgInterval, predictedMinutes, accidentFreeStreak, total: pee + poo };
}

function togglePottyTimer() {
  if (pottyTimerRunning) {
    clearInterval(pottyTimerInterval);
    pottyTimerRunning = false;
  } else {
    pottyTimerRunning = true;
    pottyTimerInterval = setInterval(() => {
      pottyTimerSeconds++;
      const el = document.getElementById('pottyTimerDisplay');
      if (el) {
        const m = Math.floor(pottyTimerSeconds / 60);
        const s = pottyTimerSeconds % 60;
        el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }, 1000);
  }
  render();
}

function resetPottyTimer() {
  clearInterval(pottyTimerInterval);
  pottyTimerRunning = false;
  pottyTimerSeconds = 0;
  render();
}

function formatPottyTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const pottyTypeEmojis = { pee: '💧', poo: '💩', accident: '⚠️', nap: '😴', play: '🎾', meal: '🍽️' };

// ── Page: Calendar (with Potty Log tab) ──
function renderCalendar() {
  const { calYear: y, calMonth: m } = state;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const months = t('monthNames').split(',');
  const days = [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')];

  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (CAL_RECORDS[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`]) streak++; else break;
  }

  let cells = days.map(d => `<div class="cal-day-name">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) cells += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${m}-${d}`;
    const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
    const rec = CAL_RECORDS[key];
    cells += `<div class="cal-day ${isToday ? 'today' : ''} ${rec ? 'has-record' : ''}" onclick="toggleRecord(${y},${m},${d})">
      <span>${d}</span><span class="cal-emoji">${rec || ''}</span></div>`;
  }

  // ── Potty Log Tab Content ──
  const stats = getPottyStats();
  const todayLogs = getTodayLogs();
  const timerM = Math.floor(pottyTimerSeconds / 60);
  const timerS = pottyTimerSeconds % 60;
  const timerDisplay = `${String(timerM).padStart(2, '0')}:${String(timerS).padStart(2, '0')}`;

  const logsHTML = todayLogs.length === 0
    ? `<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.9rem">${t('pottyNoLogs')}</div>`
    : todayLogs.slice().reverse().map((log, i) => {
      const realIdx = todayLogs.length - 1 - i;
      const globalIdx = POTTY_LOGS.indexOf(log);
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid var(--border);transition:all 0.2s">
          <span style="font-size:1.3rem">${pottyTypeEmojis[log.type] || '📝'}</span>
          <div style="flex:1">
            <div style="font-weight:600;font-size:0.9rem">${t('potty' + log.type.charAt(0).toUpperCase() + log.type.slice(1))}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${formatPottyTime(log.time)}</div>
          </div>
          <button onclick="deletePottyLog(${globalIdx})" style="background:none;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;padding:4px 8px">✕</button>
        </div>`;
    }).join('');

  const predictionHTML = stats.predictedMinutes !== null
    ? `<div style="background:linear-gradient(135deg,rgba(126,207,139,0.1),rgba(126,207,139,0.02));border:1px solid rgba(126,207,139,0.3);border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:4px">${t('pottyNextPrediction')}</div>
        <div style="font-size:2rem;font-weight:800;color:var(--accent)">${t('pottyIn')} ${stats.predictedMinutes} ${t('pottyMinutes')}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">${t('pottyAvgInterval')}: ${stats.avgInterval} min</div>
      </div>`
    : '';

  const calendarContent = `
    <div class="cal-header">
      <button class="btn-icon" onclick="state.calMonth--;if(state.calMonth<0){state.calMonth=11;state.calYear--;}render()">◀</button>
      <div class="cal-month">${months[m]} ${y}</div>
      <button class="btn-icon" onclick="state.calMonth++;if(state.calMonth>11){state.calMonth=0;state.calYear++;}render()">▶</button>
    </div>
    <div class="cal-grid">${cells}</div>
    <div class="streak-card"><div class="streak-num">${streak}</div><div class="streak-label">${t('streak')}</div></div>`;

  const pottyLogContent = `
    <!-- Quick Log Buttons -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
      ${['pee', 'poo', 'accident', 'nap', 'play', 'meal'].map(type => `
        <button onclick="addPottyLog('${type}')" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px;border-radius:12px;border:1px solid var(--border);background:var(--bg-card);cursor:pointer;transition:all 0.2s ease;font-family:var(--font);font-size:0.85rem;color:var(--text-primary)" onmouseover="this.style.transform='scale(1.04)';this.style.borderColor='var(--accent)'" onmouseout="this.style.transform='scale(1)';this.style.borderColor='var(--border)'">
          <span style="font-size:1.5rem">${pottyTypeEmojis[type]}</span>
          ${t('potty' + type.charAt(0).toUpperCase() + type.slice(1)).replace(/^[^\s]+ /, '')}
        </button>`).join('')}
    </div>

    <!-- Today's History (shown right after icons) -->
    <div style="margin-bottom:8px;font-weight:700;font-size:0.95rem">${t('pottyHistory')}</div>
    <div style="background:var(--bg-card);border-radius:12px;border:1px solid var(--border);overflow:hidden;margin-bottom:16px">
      ${logsHTML}
    </div>

    <!-- Timer (only starts when button pressed) -->
    <div style="background:var(--bg-card);border-radius:12px;padding:16px;margin-bottom:16px;text-align:center;border:1px solid var(--border)">
      <div id="pottyTimerDisplay" style="font-size:2.5rem;font-weight:800;font-family:'Courier New',monospace;color:var(--text-primary);margin-bottom:12px">${timerDisplay}</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="btn-primary" onclick="togglePottyTimer()" style="font-size:0.85rem;padding:8px 20px">${pottyTimerRunning ? t('pottyTimerStop') : t('pottyTimerStart')}</button>
        <button class="btn-secondary" onclick="resetPottyTimer()" style="font-size:0.85rem;padding:8px 20px">${t('pottyTimerReset')}</button>
      </div>
    </div>

    <!-- Prediction -->
    ${predictionHTML}

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
      <div style="background:var(--bg-secondary);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.5rem;font-weight:800;color:#42A5F5">${stats.pee}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${t('pottyPeeCount')}</div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.5rem;font-weight:800;color:#8D6E63">${stats.poo}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${t('pottyPooCount')}</div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.5rem;font-weight:800;color:#EF5350">${stats.accident}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${t('pottyAccidentCount')}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
      <div style="background:var(--bg-secondary);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.5rem;font-weight:800;color:#7E57C2">${stats.nap}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${t('pottyNapCount')}</div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.5rem;font-weight:800;color:#66BB6A">${stats.play}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${t('pottyPlayCount')}</div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.5rem;font-weight:800;color:var(--accent)">${stats.accidentFreeStreak}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${t('pottyStreak')}</div>
      </div>
    </div>

    <!-- Accident-free streak banner -->
    ${stats.accidentFreeStreak >= 3 ? `
      <div style="background:linear-gradient(135deg,#4CAF50,#66BB6A);color:#fff;border-radius:12px;padding:14px 16px;margin-bottom:16px;text-align:center;font-weight:600">
        🎉 ${stats.accidentFreeStreak} ${t('pottyDays')} ${t('pottyStreak')}!
      </div>` : ''}`;

  const activeTab = state.calTab || 'calendar';

  return `<div class="page"><div class="calendar-container">
    <h1 class="section-title">${activeTab === 'calendar' ? t('calTitle') : t('pottyLogTitle')}</h1>
    <!-- Tab Switcher -->
    <div style="display:flex;gap:8px;margin-bottom:20px">
      <button class="${activeTab === 'calendar' ? 'btn-primary' : 'btn-secondary'}" onclick="state.calTab='calendar';render()" style="flex:1;font-size:0.85rem;padding:10px;justify-content:center">${t('pottyCalTab')}</button>
      <button class="${activeTab === 'pottylog' ? 'btn-primary' : 'btn-secondary'}" onclick="state.calTab='pottylog';render()" style="flex:1;font-size:0.85rem;padding:10px;justify-content:center">${t('pottyLogTab')}</button>
    </div>
    ${activeTab === 'calendar' ? calendarContent : pottyLogContent}
  </div></div>`;
}

// ── Page: Missions (real progress) ──
function renderMissions() {
  const missions = getMissionProgress();
  // Calculate earned badges based on missions
  const earnedCount = missions.filter(m => m.progress >= m.max).length;
  return `<div class="page">
    <h1 class="section-title">${t('missionsTitle')}</h1>
    <!-- XP Level Bar -->
    <div class="card" style="padding:16px;margin-bottom:20px;text-align:center">
      <div style="font-size:0.85rem;color:var(--text-muted)">Level ${getLevel()} · ${DB.xp} XP</div>
      <div style="background:var(--bg-secondary);border-radius:20px;height:10px;margin-top:8px;overflow:hidden">
        <div style="background:linear-gradient(90deg,var(--accent),var(--accent-mint));height:100%;border-radius:20px;width:${getLevelProgress()}%;transition:width 0.5s"></div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${getLevelProgress()}/100 XP to Level ${getLevel() + 1}</div>
    </div>
    <div class="missions-grid">
      ${missions.map(m => {
    const pct = Math.min(100, Math.round((m.progress / m.max) * 100));
    const done = m.progress >= m.max;
    return `
        <div class="card mission-card" style="${done ? 'border-left:3px solid #4CAF50' : ''}">
          <div class="mission-icon">${done ? '✅' : m.icon}</div>
          <div class="mission-info">
            <div class="mission-title">${t(m.key + 'T')}</div>
            <div class="mission-desc">${t(m.key + 'D')} (${m.progress}/${m.max})</div>
            <div class="mission-progress"><div class="mission-bar" style="width:${pct}%;${done ? 'background:#4CAF50' : ''}"></div></div>
          </div>
          <div class="mission-reward">${m.reward}</div>
        </div>`;
  }).join('')}
    </div>
    <div class="badges-section">
      <h2 class="section-title" style="font-size:1.2rem">${t('badgeCollection')}</h2>
      <div class="badges-grid">${BADGES.map((b, i) => {
    const badgeNames = state.lang === 'ko' ? ['첫 분석', '3일 연속', '별 수집가', '챔피언', '왕관', '다이아', '무지개', '목표 달성', '뼈다귀', '발자국', '사랑꾼', '세계인'] : state.lang === 'ja' ? ['初分析', '3日連続', 'スター', 'チャンピ', '王冠', 'ダイヤ', '虹', '達成', '骨', '足跡', '愛', '世界'] : ['1st Scan', '3-Day', 'Star', 'Champ', 'Crown', 'Diamond', 'Rainbow', 'Target', 'Bone', 'Paw', 'Love', 'Globe'];
    return `<div class="badge-item ${i < earnedCount + 2 ? 'earned' : 'locked'}" style="flex-direction:column;gap:4px"><span style="font-size:1.6rem">${b}</span><span style="font-size:0.6rem;color:var(--text-muted);white-space:nowrap">${badgeNames[i] || ''}</span></div>`;
  }).join('')}</div>
    </div>
    <div class="ad-infeed" style="margin-top:24px">${t('adSlot')}</div>
  </div>`;
}

// ── Page: Hall of Fame ──
function renderHallOfFame() {
  // Calculate my ranking
  const myAnalysisCount = DB.history.filter(h => h.pet === state.mode).length;
  const myLevel = getLevel();
  const myVotes = myAnalysisCount * 3 + myLevel * 5;
  let myRank = 1;
  HOF_DATA.forEach(h => { if (h.votes > myVotes) myRank++; });
  const myName = DB.user.name || (state.lang === 'ko' ? '나' : 'Me');
  const rankEmoji = myRank <= 1 ? '🥇' : myRank <= 2 ? '🥈' : myRank <= 3 ? '🥉' : '🏅';
  const rankLabel = state.lang === 'ko' ? '나의 현재 순위' : state.lang === 'ja' ? '現在の順位' : 'My Current Ranking';

  return `<div class="page">
    <!-- My Ranking Banner -->
    <div class="card" style="padding:16px 20px;margin-bottom:20px;background:linear-gradient(135deg,var(--accent-mint-light),var(--accent-lavender-light));border:2px solid var(--accent-mint);text-align:center">
      <div style="font-size:0.8rem;color:var(--text-secondary);font-weight:600;margin-bottom:8px">${rankLabel}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:12px">
        <span style="font-size:2.2rem">${rankEmoji}</span>
        <div>
          <div style="font-size:2rem;font-weight:900;color:var(--accent-mint)">#${myRank}</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${myName} · Lv.${myLevel} · ❤️ ${myVotes}</div>
        </div>
      </div>
    </div>
    <div class="hof-crown">
      <div class="hof-crown-emoji">👑</div>
      <div class="hof-title">${t('hofTitle')}</div>
      <div class="hof-subtitle">${t('hofSub')}</div>
    </div>
    <div class="hof-grid">
      ${HOF_DATA.map(h => `
        <div class="card hof-card">
          <div class="hof-rank ${['', 'gold', 'silver', 'bronze'][h.rank] || ''}">#${h.rank}</div>
          <div class="feed-avatar">${typeIcon(h.type)}</div>
          <div class="hof-info">
            <div style="font-weight:700">${h.user}</div>
            <div style="font-size:0.85rem;color:var(--text-secondary)">${t(h.descKey)}</div>
          </div>
          <div><span class="tag tag-${h.tag}">${t(h.tag)}</span>
          <div class="hof-votes" style="margin-top:4px">❤️ ${h.votes}</div></div>
        </div>`).join('')}
    </div>
  </div>`;
}

// ── Page: World Map (Interactive) ──
function renderWorldMap() {
  const scoreColor = s => s >= 75 ? '#4CAF50' : s >= 65 ? '#7ECF8B' : s >= 55 ? '#FFC107' : '#FF5722';
  const sorted = [...WORLD_DATA].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  return `<div class="page"><div class="worldmap-container">
    <h1 class="section-title">${t('mapTitle')}</h1>
    <p class="section-desc">${t('mapSub')}</p>
    <p style="color:var(--accent-mint);font-size:0.9rem;margin-bottom:16px">${t('mapClickExplore')}</p>
    <div class="map-visual">
      <div class="map-top3">
        ${top3.map((c, i) => `<div class="map-top-card" style="border-left:4px solid ${scoreColor(c.score)}">
          <span class="map-top-rank">${['🥇', '🥈', '🥉'][i]}</span>
          <span class="map-top-flag">${c.flag}</span>
          <span class="map-top-name">${t(c.key)}</span>
          <span class="map-top-score" style="color:${scoreColor(c.score)}">${c.score}</span>
        </div>`).join('')}
      </div>
    </div>
    <div class="map-emoji-grid">
      ${WORLD_DATA.map(c => `
        <div class="map-country card" onclick="showCountryDetail('${c.key}')" style="cursor:pointer;border-bottom:3px solid ${scoreColor(c.score)}">
          <div class="map-flag">${c.flag}</div>
          <div class="map-name">${t(c.key)}</div>
          <div class="map-score" style="color:${scoreColor(c.score)}">${c.score}/100</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">${c.users.toLocaleString()} ${t('mapUsers')}</div>
        </div>`).join('')}
    </div>
  </div></div>`;
}

function showCountryDetail(key) {
  exploreCountry(key);
  const c = WORLD_DATA.find(w => w.key === key);
  if (!c) return;
  const existing = document.getElementById('countryModal');
  if (existing) existing.remove();
  const scoreColor = s => s >= 75 ? '#4CAF50' : s >= 65 ? '#7ECF8B' : s >= 55 ? '#FFC107' : '#FF5722';
  const modal = document.createElement('div');
  modal.id = 'countryModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:var(--radius-xl);padding:32px;max-width:380px;width:90%;text-align:center">
      <div style="font-size:4rem">${c.flag}</div>
      <h2 style="margin:8px 0">${t(c.key)}</h2>
      <div style="font-size:2.5rem;font-weight:800;color:${scoreColor(c.score)}">${c.score}<span style="font-size:1rem;font-weight:400">/100</span></div>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin:8px 0">${t('mapHealthAvg')}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0">
        <div class="result-item"><div class="result-item-label">${t('mapUsers')}</div><div class="result-item-value">${c.users.toLocaleString()}</div></div>
        <div class="result-item"><div class="result-item-label">${t('mapDiet')}</div><div class="result-item-value">${c.diet}</div></div>
      </div>
      <button class="btn-primary" onclick="document.getElementById('countryModal').remove()" style="width:100%">${t('mapClose')}</button>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ── Page: Stats Dashboard (Real Data from Analysis History) ──
function renderStats() {
  const recent7 = getRecentHistory(7);
  const recent30 = getRecentHistory(30);
  const allHistory = DB.history.filter(h => h.pet === state.mode);

  // Calculate real data with fallbacks
  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dayStr = d.toDateString();
    const dayEntries = allHistory.filter(h => new Date(h.date).toDateString() === dayStr);
    weekData.push(dayEntries.length > 0 ? Math.round(dayEntries.reduce((s, h) => s + h.score, 0) / dayEntries.length) : 0);
  }
  const monthData = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dayStr = d.toDateString();
    const dayEntries = allHistory.filter(h => new Date(h.date).toDateString() === dayStr);
    monthData.push(dayEntries.length > 0 ? Math.round(dayEntries.reduce((s, h) => s + h.score, 0) / dayEntries.length) : 0);
  }

  const validWeek = weekData.filter(v => v > 0);
  const avgScore = validWeek.length > 0 ? Math.round(validWeek.reduce((a, b) => a + b) / validWeek.length) : 0;
  const bestScore = validWeek.length > 0 ? Math.max(...validWeek) : 0;
  const totalCount = allHistory.length;

  // Bristol distribution from real data
  const bristolDist = [0, 0, 0, 0, 0, 0, 0];
  allHistory.forEach(h => { if (h.bristol >= 1 && h.bristol <= 7) bristolDist[h.bristol - 1]++; });

  // Time-of-day distribution
  const timeData = [0, 0, 0, 0]; // morning, afternoon, evening, night
  allHistory.forEach(h => {
    const hr = new Date(h.date).getHours();
    if (hr >= 6 && hr < 12) timeData[0]++;
    else if (hr >= 12 && hr < 18) timeData[1]++;
    else if (hr >= 18 && hr < 22) timeData[2]++;
    else timeData[3]++;
  });

  // Potty Log stats integration
  const pottyStats = getPottyStats();

  const days = [t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat'), t('sun')];
  const times = [t('statsMorning'), t('statsAfternoon'), t('statsEvening'), t('statsNight')];
  const noDataMsg = state.lang === 'ko' ? '분석 기록이 없습니다. 분석을 시작하세요!' : state.lang === 'ja' ? '分析記録がありません。分析を始めましょう！' : 'No analysis records yet. Start analyzing!';

  return `<div class="page">
    <h1 class="section-title">${t('statsTitle')}</h1>
    <div class="stats-summary-grid">
      <div class="card stats-summary-card"><div class="stats-num" style="color:var(--accent-mint)">${avgScore || '—'}</div><div class="stats-label">${t('statsAvgScore')}</div></div>
      <div class="card stats-summary-card"><div class="stats-num" style="color:var(--accent-peach)">${bestScore || '—'}</div><div class="stats-label">${t('statsBestScore')}</div></div>
      <div class="card stats-summary-card"><div class="stats-num" style="color:var(--accent-lavender)">${totalCount}</div><div class="stats-label">${t('statsCount')}</div></div>
    </div>
    <!-- Level & XP -->
    <div class="card" style="padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><span style="font-weight:800;font-size:1.2rem">Lv.${getLevel()}</span> <span style="color:var(--text-muted)">· ${DB.xp} XP</span></div>
        <div style="font-size:0.8rem;color:var(--text-muted)">${getLevelProgress()}/100 → Lv.${getLevel() + 1}</div>
      </div>
      <div style="background:var(--bg-secondary);border-radius:20px;height:8px;margin-top:8px;overflow:hidden">
        <div style="background:linear-gradient(90deg,var(--accent),var(--accent-mint));height:100%;border-radius:20px;width:${getLevelProgress()}%"></div>
      </div>
    </div>
    ${totalCount === 0 ? `<div class="card" style="padding:32px;text-align:center;color:var(--text-muted)">${noDataMsg}</div>` : ''}
    <!-- Trend Line Chart -->
    <div class="card chart-card">
      <h3 class="chart-title">📈 Health Trend (30 Days)</h3>
      <canvas id="trendCanvas" width="700" height="220" style="width:100%;height:220px"></canvas>
    </div>
    <!-- Weekly Bar Chart -->
    <div class="card chart-card">
      <h3 class="chart-title">${t('statsWeek')}</h3>
      <div class="bar-chart">
        ${weekData.map((v, i) => `<div class="bar-col">
          <span class="bar-val">${v || '·'}</span>
          <div class="bar-fill" style="height:${Math.max(v * 1.1, 2)}px;${v === 0 ? 'opacity:0.2' : ''}"></div>
          <span class="bar-label">${days[i]}</span>
        </div>`).join('')}
      </div>
    </div>
    <!-- Bristol Distribution -->
    <div class="card chart-card">
      <h3 class="chart-title">💩 Bristol Scale Distribution</h3>
      <canvas id="bristolCanvas" width="700" height="200" style="width:100%;height:200px"></canvas>
      <div class="bristol-legend">
        ${bristolDist.map((v, i) => `<div class="bristol-item"><span class="bristol-type">Type ${i + 1}</span><span class="bristol-count">${v}</span></div>`).join('')}
      </div>
    </div>
    <!-- Potty Log Summary -->
    <div class="card chart-card">
      <h3 class="chart-title">🐾 ${t('pottyLogTitle')} ${t('pottyStats')}</h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <div style="text-align:center;padding:12px"><div style="font-size:1.4rem;font-weight:800;color:#42A5F5">${pottyStats.pee}</div><div style="font-size:0.75rem;color:var(--text-muted)">${t('pottyPeeCount')}</div></div>
        <div style="text-align:center;padding:12px"><div style="font-size:1.4rem;font-weight:800;color:#8D6E63">${pottyStats.poo}</div><div style="font-size:0.75rem;color:var(--text-muted)">${t('pottyPooCount')}</div></div>
        <div style="text-align:center;padding:12px"><div style="font-size:1.4rem;font-weight:800;color:var(--accent)">${pottyStats.accidentFreeStreak}d</div><div style="font-size:0.75rem;color:var(--text-muted)">${t('pottyStreak')}</div></div>
      </div>
    </div>
    <!-- Time Heatmap -->
    <div class="card chart-card">
      <h3 class="chart-title">${t('statsTimeHeat')}</h3>
      <div class="time-heatmap">
        ${timeData.map((v, i) => `<div class="heatmap-cell" style="background:rgba(126,207,179,${Math.max(v / Math.max(...timeData, 1), 0.1)})">
          <div class="heatmap-num">${v}</div>
          <div class="heatmap-label">${times[i]}</div>
        </div>`).join('')}
      </div>
    </div>
    <div class="ad-infeed" style="margin-top:24px">${t('adSlot')}</div>
  </div>`;
}

function initStatsCharts() {
  const allHistory = DB.history.filter(h => h.pet === state.mode);
  // Compute 30-day trend data from real history
  const monthData = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dayStr = d.toDateString();
    const dayEntries = allHistory.filter(h => new Date(h.date).toDateString() === dayStr);
    monthData.push(dayEntries.length > 0 ? Math.round(dayEntries.reduce((s, h) => s + h.score, 0) / dayEntries.length) : 0);
  }
  // Bristol distribution from real history
  const bristolDist = [0, 0, 0, 0, 0, 0, 0];
  allHistory.forEach(h => { if (h.bristol >= 1 && h.bristol <= 7) bristolDist[h.bristol - 1]++; });

  // Trend Line Chart
  const trendCanvas = document.getElementById('trendCanvas');
  if (trendCanvas) {
    const ctx = trendCanvas.getContext('2d');
    const w = trendCanvas.width, h = trendCanvas.height;
    const data = monthData.length > 0 ? monthData : [0];
    const validData = data.filter(v => v > 0);
    if (validData.length === 0) {
      ctx.fillStyle = 'rgba(150,150,150,0.3)'; ctx.font = '14px Outfit'; ctx.textAlign = 'center';
      ctx.fillText('No data yet — analyze to see trends!', w / 2, h / 2);
      return;
    }
    const pad = { t: 20, r: 20, b: 30, l: 40 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
    const minV = 0, maxV = 100;
    const xStep = cw / (data.length - 1 || 1);
    // Grid lines
    ctx.strokeStyle = 'rgba(150,150,150,0.15)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad.t + (ch / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillStyle = 'rgba(150,150,150,0.5)'; ctx.font = '10px Outfit'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxV - (maxV - minV) / 5 * i), pad.l - 6, y + 4);
    }
    // Target line at 75
    ctx.strokeStyle = 'rgba(255,193,7,0.5)'; ctx.setLineDash([5, 5]);
    const targetY = pad.t + ch - ((75 - minV) / (maxV - minV)) * ch;
    ctx.beginPath(); ctx.moveTo(pad.l, targetY); ctx.lineTo(w - pad.r, targetY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,193,7,0.7)'; ctx.font = '9px Outfit'; ctx.textAlign = 'left';
    ctx.fillText('Target: 75', w - pad.r + 2, targetY - 4);
    // Fill area (only non-zero segments)
    const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
    grad.addColorStop(0, 'rgba(126,207,179,0.3)'); grad.addColorStop(1, 'rgba(126,207,179,0.01)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(pad.l, h - pad.b);
    data.forEach((v, i) => { const x = pad.l + i * xStep; const y = v > 0 ? pad.t + ch - ((v - minV) / (maxV - minV)) * ch : h - pad.b; ctx.lineTo(x, y); });
    ctx.lineTo(pad.l + (data.length - 1) * xStep, h - pad.b); ctx.closePath(); ctx.fill();
    // Line
    ctx.strokeStyle = '#7ECF8B'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath();
    let started = false;
    data.forEach((v, i) => {
      if (v === 0) { started = false; return; }
      const x = pad.l + i * xStep; const y = pad.t + ch - ((v - minV) / (maxV - minV)) * ch;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Dots
    data.forEach((v, i) => {
      if (v === 0) return;
      if (i % 5 === 0 || i === data.length - 1 || data.filter(d => d > 0).length <= 7) {
        const x = pad.l + i * xStep, y = pad.t + ch - ((v - minV) / (maxV - minV)) * ch;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7ECF8B'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(150,150,150,0.6)'; ctx.font = '9px Outfit'; ctx.textAlign = 'center'; ctx.fillText(v, x, y - 8);
      }
    });
  }
  // Bristol Distribution Chart
  const bristolCanvas = document.getElementById('bristolCanvas');
  if (bristolCanvas) {
    const ctx = bristolCanvas.getContext('2d');
    const w = bristolCanvas.width, h = bristolCanvas.height;
    const dist = bristolDist;
    const colors = ['#FF6B6B', '#FFA07A', '#FFD700', '#7ECF8B', '#4CAF50', '#FFC107', '#FF5722'];
    const pad = { t: 15, r: 20, b: 35, l: 40 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
    const maxVal = Math.max(...dist, 1);
    const barW = cw / 7 * 0.6, gap = cw / 7;
    dist.forEach((v, i) => {
      const barH = Math.max((v / maxVal) * ch, v > 0 ? 4 : 1);
      const x = pad.l + i * gap + (gap - barW) / 2;
      const y = pad.t + ch - barH;
      const g = ctx.createLinearGradient(x, y + barH, x, y);
      g.addColorStop(0, colors[i]); g.addColorStop(1, colors[i] + '88');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
      ctx.fill();
      // Value on top
      ctx.fillStyle = 'rgba(150,150,150,0.7)'; ctx.font = 'bold 11px Outfit'; ctx.textAlign = 'center';
      ctx.fillText(v, x + barW / 2, y - 5);
      // Label
      ctx.fillStyle = 'rgba(150,150,150,0.6)'; ctx.font = '10px Outfit';
      ctx.fillText('Type ' + (i + 1), x + barW / 2, pad.t + ch + 16);
    });
  }
}

// ── Page: Leaderboard (with user data) ──
function renderLeaderboard() {
  // Insert user's own entry into leaderboard based on XP
  const userName = DB.user.name || 'You';
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (CAL_RECORDS[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`]) streak++; else break;
  }
  const userEntry = { user: `⭐ ${userName}`, score: DB.xp, streak, change: DB.history.length, isUser: true };
  const combined = [...LEADERBOARD_DATA.map(l => ({ ...l })), userEntry]
    .sort((a, b) => b.score - a.score)
    .map((l, i) => ({ ...l, rank: i + 1 }));

  return `<div class="page">
    <h1 class="section-title">${t('lbTitle')}</h1>
    <div class="feed-filters" style="margin-bottom:20px">
      <button class="filter-btn active">${t('lbWeekly')}</button>
      <button class="filter-btn">${t('lbMonthly')}</button>
      <button class="filter-btn">${t('lbAllTime')}</button>
    </div>
    <div class="missions-grid">
      ${combined.map(l => `
        <div class="card" style="display:flex;align-items:center;gap:16px;padding:16px;${l.isUser ? 'border:2px solid var(--accent);background:var(--bg-card)' : ''}">
          <div class="hof-rank ${['', 'gold', 'silver', 'bronze'][l.rank] || ''}" style="min-width:40px;text-align:center;font-size:1.3rem;font-weight:800">#${l.rank}</div>
          <div style="flex:1">
            <div style="font-weight:700">${l.user}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary)">${l.streak} ${t('lbStreak')} 🔥</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800;color:${l.isUser ? 'var(--accent)' : 'var(--accent-mint)'}">${l.score.toLocaleString()}</div>
            <div style="font-size:0.75rem;color:${l.change > 0 ? '#4CAF50' : l.change < 0 ? '#FF5722' : 'var(--text-muted)'}">
              ${l.change > 0 ? '↑' + l.change : l.change < 0 ? '↓' + Math.abs(l.change) : '—'}
            </div>
          </div>
        </div>`).join('')}
    </div>
  </div>`;
}

// ── Page: Mini Game (Snowcat Style) ──
let flappyPetImg = null;
let flappyPetType = localStorage.getItem('pb-flappy-pet-type') || 'dog';
let _flappyAnimId = null; // Track animation frame globally to avoid duplicates
(function loadFlappyPet() {
  const saved = localStorage.getItem('pb-flappy-pet');
  if (saved) {
    const img = new Image();
    img.onload = () => { flappyPetImg = img; };
    img.src = saved;
  }
})();

function renderMiniGame() {
  const isKo = state.lang === 'ko';
  const isJa = state.lang === 'ja';
  const dogLabel = isKo ? '🐕 강아지 사진' : isJa ? '🐕 犬の写真' : '🐕 Dog Photo';
  const catLabel = isKo ? '🐱 고양이 사진' : isJa ? '🐱 猫の写真' : '🐱 Cat Photo';
  const defLabel = isKo ? '💩 기본' : isJa ? '💩 初期化' : '💩 Reset';
  const modeLabel = flappyPetType === 'cat'
    ? (isKo ? '🐱 고양이 모드' : isJa ? '🐱 猫モード' : '🐱 Cat Mode')
    : (isKo ? '🐕 강아지 모드' : isJa ? '🐕 犬モード' : '🐕 Dog Mode');
  return `<div class="page" style="text-align:center">
    <h1 class="section-title">${isKo ? '🎮 플래피 펫' : isJa ? '🎮 フラッピーペット' : '🎮 Flappy Pet'}</h1>
    <div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;flex-wrap:wrap">
      <button class="btn-secondary btn-sm" onclick="document.getElementById('dogPhotoInput').click()" style="cursor:pointer">${dogLabel}</button>
      <button class="btn-secondary btn-sm" onclick="document.getElementById('catPhotoInput').click()" style="cursor:pointer">${catLabel}</button>
      <button class="btn-secondary btn-sm" onclick="resetFlappyPet()" style="cursor:pointer">${defLabel}</button>
      <input type="file" id="dogPhotoInput" accept="image/*" style="display:none" onchange="loadFlappyPetPhoto(this,'dog')">
      <input type="file" id="catPhotoInput" accept="image/*" style="display:none" onchange="loadFlappyPetPhoto(this,'cat')">
    </div>
    <div style="font-size:0.85rem;margin-bottom:8px;color:var(--text-secondary)">
      ${modeLabel}${flappyPetImg ? ` · <span style="color:var(--accent)">✅ ${isKo ? '사진 적용됨' : isJa ? '写真適用中' : 'Photo active'}</span>` : ''}
    </div>
    <div class="card" style="padding:0;overflow:hidden;max-width:400px;margin:0 auto;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12)">
      <canvas id="gameCanvas" width="400" height="560" style="width:100%;display:block;cursor:pointer"></canvas>
    </div>
    <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:12px">${t('gameStart')}</p>
    <div id="gameHighScore" style="margin-top:8px;font-size:0.95rem;color:var(--text-muted)">🏆 ${isKo ? '최고점' : isJa ? 'ベスト' : 'Best'}: ${localStorage.getItem('pb-flappy-best') || 0}</div>
  </div>`;
}

function loadFlappyPetPhoto(input, type) {
  const file = input.files && input.files[0];
  if (!file) return;
  flappyPetType = type;
  localStorage.setItem('pb-flappy-pet-type', type);
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      // Resize to 120x120 square, NO circular clip — keep full opaque square
      const c = document.createElement('canvas');
      c.width = 120; c.height = 120;
      const cx = c.getContext('2d');
      // Fill white background first for full opacity
      cx.fillStyle = '#FFFFFF';
      cx.fillRect(0, 0, 120, 120);
      // Draw the image covering the entire square
      const srcW = img.naturalWidth, srcH = img.naturalHeight;
      const scale = Math.max(120 / srcW, 120 / srcH);
      const sw = srcW * scale, sh = srcH * scale;
      cx.drawImage(img, (120 - sw) / 2, (120 - sh) / 2, sw, sh);
      const dataUrl = c.toDataURL('image/png');
      localStorage.setItem('pb-flappy-pet', dataUrl);
      const petImg = new Image();
      petImg.onload = () => {
        flappyPetImg = petImg;
        render(); // This re-renders page and calls initFlappyPoop
      };
      petImg.src = dataUrl;
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function resetFlappyPet() {
  flappyPetImg = null;
  flappyPetType = 'dog';
  localStorage.removeItem('pb-flappy-pet');
  localStorage.setItem('pb-flappy-pet-type', 'dog');
  render();
}

function initFlappyPoop() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Cancel any previous animation loop
  if (_flappyAnimId) { cancelAnimationFrame(_flappyAnimId); _flappyAnimId = null; }

  // Game state
  let gameState = 'idle';
  let bird = { x: 90, y: H / 2, vy: 0, r: 24 };
  let pipes = [];
  let items = []; // Collectible items
  let score = 0;
  let best = parseInt(localStorage.getItem('pb-flappy-best') || '0');
  let frame = 0;
  let groundX = 0;
  let jumpFrame = 0;
  let itemScore = 0; // Bonus from items

  const GRAVITY = 0.42;
  const FLAP = -7.0;
  const PIPE_W = 54;
  const PIPE_GAP = 155;
  const PIPE_SPEED = 3.2;
  const GROUND_H = 60;
  const LINE_CLR = '#333'; // Snowcat thick outline color
  const LINE_W = 2.5;       // Snowcat outline width

  // Read pet type EACH frame via function (not const)
  function petIsCat() { return flappyPetType === 'cat'; }

  // ── Spawn pipe ──
  function spawnPipe() {
    const minY = 90;
    const maxY = H - GROUND_H - PIPE_GAP - 90;
    const topH = minY + Math.random() * (maxY - minY);
    pipes.push({ x: W + 20, topH, scored: false });
  }

  // ── Spawn collectible item ──
  function spawnItem() {
    const yMin = 100, yMax = H - GROUND_H - 100;
    const y = yMin + Math.random() * (yMax - yMin);
    items.push({
      x: W + 60 + Math.random() * 100,
      y: y,
      collected: false,
      type: petIsCat() ? (Math.random() > 0.5 ? 'fish' : 'yarn') : (Math.random() > 0.5 ? 'bone' : 'ball')
    });
  }

  // ═══════════════════════════════════════════════════
  // DRAWING FUNCTIONS — True Snowcat Style:
  // - Thick black outlines (2-3px)
  // - White/cream fills
  // - Minimal detail, hand-drawn doodle look
  // - No gradients, no shadows, no glow effects
  // ═══════════════════════════════════════════════════

  function drawBg() {
    // Simple flat cream/white background — Snowcat style
    ctx.fillStyle = '#FFFDF5';
    ctx.fillRect(0, 0, W, H - GROUND_H);

    // Simple hand-drawn clouds (just outlines + white fill)
    const cloudSeeds = [[70, 65, 40], [230, 45, 50], [380, 80, 35]];
    cloudSeeds.forEach(([baseX, cy, sz]) => {
      const cx = ((baseX - (frame * 0.2) % (W + 120)) + W + 120) % (W + 120) - 60;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = LINE_CLR;
      ctx.lineWidth = LINE_W;
      // Snowcat cloud: 3 overlapping circles
      ctx.beginPath();
      ctx.arc(cx, cy, sz * 0.45, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - sz * 0.35, cy + 3, sz * 0.35, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + sz * 0.3, cy + 2, sz * 0.38, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });

    // Tiny doodle elements floating (hand-drawn feel)
    ctx.fillStyle = LINE_CLR;
    ctx.font = '10px serif';
    ctx.textAlign = 'center';
    const doodleY1 = 120 + Math.sin(frame * 0.02) * 5;
    const doodleY2 = 160 + Math.sin(frame * 0.025 + 1) * 5;
    const dx1 = ((150 - frame * 0.15) % (W + 40) + W + 40) % (W + 40) - 20;
    const dx2 = ((320 - frame * 0.1) % (W + 40) + W + 40) % (W + 40) - 20;
    ctx.fillText('~', dx1, doodleY1);
    ctx.fillText('·', dx2, doodleY2);
  }

  function drawGround() {
    // Ground line
    ctx.strokeStyle = LINE_CLR;
    ctx.lineWidth = LINE_W;
    ctx.beginPath();
    ctx.moveTo(0, H - GROUND_H);
    ctx.lineTo(W, H - GROUND_H);
    ctx.stroke();

    // Ground fill — light beige
    ctx.fillStyle = '#F5EDD8';
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);

    // Snowcat-style grass tufts — simple hand-drawn strokes
    ctx.strokeStyle = LINE_CLR;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < W; i += 22) {
      const gx = ((i - groundX % 22) + W) % W;
      ctx.beginPath();
      ctx.moveTo(gx, H - GROUND_H);
      ctx.lineTo(gx + 3, H - GROUND_H - 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx + 5, H - GROUND_H);
      ctx.lineTo(gx + 8, H - GROUND_H - 6);
      ctx.stroke();
    }
  }

  // ── Draw obstacles: Snowcat line-art style ──
  function drawPipe(p) {
    const capH = 18;
    const capExtra = 6;
    const topH = p.topH;
    const botY = topH + PIPE_GAP;

    ctx.strokeStyle = LINE_CLR;
    ctx.lineWidth = LINE_W;

    if (petIsCat()) {
      // CAT TOWER — Snowcat style: simple post with platforms
      ctx.fillStyle = '#FFFDF5';
      // Top post
      ctx.fillRect(p.x + 12, 0, PIPE_W - 24, topH - capH);
      ctx.strokeRect(p.x + 12, 0, PIPE_W - 24, topH - capH);
      // Rope lines on post
      ctx.lineWidth = 1;
      for (let ry = 8; ry < topH - capH; ry += 10) {
        ctx.beginPath();
        ctx.moveTo(p.x + 12, ry);
        ctx.lineTo(p.x + PIPE_W - 12, ry);
        ctx.stroke();
      }
      ctx.lineWidth = LINE_W;
      // Top platform
      ctx.fillStyle = '#FFFDF5';
      ctx.beginPath();
      ctx.roundRect(p.x - capExtra, topH - capH, PIPE_W + capExtra * 2, capH, 4);
      ctx.fill(); ctx.stroke();

      // Bottom post
      ctx.fillStyle = '#FFFDF5';
      ctx.fillRect(p.x + 12, botY + capH, PIPE_W - 24, H - GROUND_H - botY - capH);
      ctx.strokeRect(p.x + 12, botY + capH, PIPE_W - 24, H - GROUND_H - botY - capH);
      ctx.lineWidth = 1;
      for (let ry = botY + capH + 8; ry < H - GROUND_H; ry += 10) {
        ctx.beginPath();
        ctx.moveTo(p.x + 12, ry);
        ctx.lineTo(p.x + PIPE_W - 12, ry);
        ctx.stroke();
      }
      ctx.lineWidth = LINE_W;
      // Bottom platform
      ctx.fillStyle = '#FFFDF5';
      ctx.beginPath();
      ctx.roundRect(p.x - capExtra, botY, PIPE_W + capExtra * 2, capH, 4);
      ctx.fill(); ctx.stroke();

      // Tiny cat sitting on platform (Snowcat doodle)
      const catY = botY - 2;
      ctx.fillStyle = '#FFFDF5';
      ctx.strokeStyle = LINE_CLR;
      ctx.lineWidth = 1.5;
      // Cat body (small circle)
      ctx.beginPath(); ctx.arc(p.x + PIPE_W / 2, catY - 8, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Cat ears
      ctx.beginPath();
      ctx.moveTo(p.x + PIPE_W / 2 - 5, catY - 12);
      ctx.lineTo(p.x + PIPE_W / 2 - 3, catY - 18);
      ctx.lineTo(p.x + PIPE_W / 2 - 1, catY - 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x + PIPE_W / 2 + 1, catY - 12);
      ctx.lineTo(p.x + PIPE_W / 2 + 3, catY - 18);
      ctx.lineTo(p.x + PIPE_W / 2 + 5, catY - 12);
      ctx.stroke();
      // Cat eyes (dots)
      ctx.fillStyle = LINE_CLR;
      ctx.beginPath(); ctx.arc(p.x + PIPE_W / 2 - 2, catY - 9, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + PIPE_W / 2 + 2, catY - 9, 1, 0, Math.PI * 2); ctx.fill();

    } else {
      // DOG OBSTACLES — Snowcat style: simple bone/hydrant outlines
      ctx.fillStyle = '#FFFDF5';

      // Top: bone column
      ctx.fillRect(p.x + 14, 0, PIPE_W - 28, topH - capH);
      ctx.strokeRect(p.x + 14, 0, PIPE_W - 28, topH - capH);
      // Bone knobs at end
      ctx.beginPath();
      ctx.arc(p.x + 14, topH - capH, 8, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x + PIPE_W - 14, topH - capH, 8, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Cap
      ctx.beginPath();
      ctx.roundRect(p.x - capExtra, topH - capH, PIPE_W + capExtra * 2, capH, 4);
      ctx.fill(); ctx.stroke();

      // Bottom: fire hydrant shape
      // Hydrant body
      const hydX = p.x + 8, hydW = PIPE_W - 16;
      ctx.beginPath();
      ctx.roundRect(hydX, botY + capH, hydW, H - GROUND_H - botY - capH - 5, [6, 6, 2, 2]);
      ctx.fill(); ctx.stroke();
      // Hydrant cap
      ctx.beginPath();
      ctx.roundRect(p.x - capExtra, botY, PIPE_W + capExtra * 2, capH, [6, 6, 0, 0]);
      ctx.fill(); ctx.stroke();
      // Side nozzles (simple lines)
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hydX - 5, botY + capH + 18);
      ctx.lineTo(hydX, botY + capH + 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hydX + hydW, botY + capH + 18);
      ctx.lineTo(hydX + hydW + 5, botY + capH + 18);
      ctx.stroke();
      // Bolt dots
      ctx.lineWidth = LINE_W;
      ctx.fillStyle = LINE_CLR;
      ctx.beginPath(); ctx.arc(p.x + PIPE_W / 2, botY + capH + 14, 2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.lineWidth = LINE_W;
  }

  // ── Draw collectible items ──
  function drawItems() {
    items.forEach(item => {
      if (item.collected) return;
      const bob = Math.sin(frame * 0.08 + item.x * 0.01) * 4;
      const ix = item.x, iy = item.y + bob;

      ctx.save();
      ctx.translate(ix, iy);
      ctx.strokeStyle = LINE_CLR;
      ctx.fillStyle = '#FFFDF5';
      ctx.lineWidth = 2;

      if (item.type === 'fish') {
        // Simple fish outline — Snowcat style
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Tail
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(17, -6);
        ctx.lineTo(17, 6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Eye
        ctx.fillStyle = LINE_CLR;
        ctx.beginPath(); ctx.arc(-4, -2, 1.5, 0, Math.PI * 2); ctx.fill();
      } else if (item.type === 'yarn') {
        // Yarn ball — circle with cross lines
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, 6, 0.3, 2.8); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 4, 1.5, 4.5); ctx.stroke();
        // Trailing string
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(7, 5);
        ctx.quadraticCurveTo(14, 12, 10, 18);
        ctx.stroke();
      } else if (item.type === 'bone') {
        // Bone — Snowcat style
        ctx.beginPath();
        ctx.roundRect(-10, -4, 20, 8, 3);
        ctx.fill(); ctx.stroke();
        // Knobs
        ctx.beginPath(); ctx.arc(-10, -3, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(-10, 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(10, -3, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(10, 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (item.type === 'ball') {
        // Tennis ball
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Seam lines
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-3, 0, 6, -0.8, 0.8); ctx.stroke();
        ctx.beginPath(); ctx.arc(3, 0, 6, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke();
      }
      ctx.restore();
    });
  }

  // ── Draw character — True Snowcat style ──
  function drawBird() {
    ctx.save();
    ctx.globalAlpha = 1; // FORCE fully opaque
    ctx.translate(bird.x, bird.y);

    const angle = Math.max(-0.35, Math.min(bird.vy * 0.04, 0.9));
    ctx.rotate(angle);

    // Jump squash/stretch
    let sx = 1, sy = 1;
    if (jumpFrame > 0) {
      const t = jumpFrame / 10;
      sx = 1 - t * 0.25;
      sy = 1 + t * 0.3;
      jumpFrame--;
    } else if (bird.vy > 3) {
      sx = 1 + Math.min(bird.vy * 0.015, 0.12);
      sy = 1 - Math.min(bird.vy * 0.015, 0.1);
    }
    ctx.scale(sx, sy);

    const r = bird.r;

    if (flappyPetImg) {
      // ══ Custom photo — FULLY OPAQUE, thick black border ══
      // White backing circle (ensures no transparency)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
      ctx.fill();

      // Black outline circle (Snowcat style thick border)
      ctx.strokeStyle = LINE_CLR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
      ctx.stroke();

      // Draw photo inside circle clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      // globalAlpha = 1 already set above
      ctx.drawImage(flappyPetImg, -r, -r, r * 2, r * 2);
      ctx.restore();

      // Snowcat-style ears on top of photo
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = LINE_CLR;
      ctx.lineWidth = 2.5;
      if (petIsCat()) {
        // Pointed ears
        ctx.beginPath();
        ctx.moveTo(-r * 0.55, -r * 0.55);
        ctx.lineTo(-r * 0.35, -r * 1.35);
        ctx.lineTo(-r * 0.05, -r * 0.6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.55, -r * 0.55);
        ctx.lineTo(r * 0.35, -r * 1.35);
        ctx.lineTo(r * 0.05, -r * 0.6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        // Floppy dog ears
        ctx.beginPath();
        ctx.ellipse(-r * 0.65, -r * 0.1, r * 0.3, r * 0.55, -0.3, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(r * 0.65, -r * 0.1, r * 0.3, r * 0.55, 0.3, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }

    } else {
      // ══ Default Snowcat-style character (thick black outlines on white) ══
      ctx.fillStyle = '#FFFDF5';
      ctx.strokeStyle = LINE_CLR;
      ctx.lineWidth = LINE_W;

      if (petIsCat()) {
        // ── Snowcat cat: round body, triangle ears, dot eyes, whiskers ──
        // Body
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Left ear
        ctx.beginPath();
        ctx.moveTo(-r * 0.55, -r * 0.5);
        ctx.lineTo(-r * 0.35, -r * 1.35);
        ctx.lineTo(0, -r * 0.55);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Right ear
        ctx.beginPath();
        ctx.moveTo(r * 0.55, -r * 0.5);
        ctx.lineTo(r * 0.35, -r * 1.35);
        ctx.lineTo(0, -r * 0.55);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Eyes (Snowcat = simple dots)
        ctx.fillStyle = LINE_CLR;
        ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.08, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.08, 2.5, 0, Math.PI * 2); ctx.fill();
        // Nose (tiny inverted triangle)
        ctx.beginPath();
        ctx.moveTo(0, r * 0.08);
        ctx.lineTo(-3, r * 0.2);
        ctx.lineTo(3, r * 0.2);
        ctx.closePath();
        ctx.fill();
        // Mouth (simple W)
        ctx.strokeStyle = LINE_CLR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.15, r * 0.28);
        ctx.lineTo(0, r * 0.38);
        ctx.lineTo(r * 0.15, r * 0.28);
        ctx.stroke();
        // Whiskers (3 lines each side)
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-r * 0.35, r * 0.1); ctx.lineTo(-r * 1.0, -r * 0.05); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.35, r * 0.2); ctx.lineTo(-r * 1.0, r * 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.35, r * 0.3); ctx.lineTo(-r * 1.0, r * 0.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.35, r * 0.1); ctx.lineTo(r * 1.0, -r * 0.05); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.35, r * 0.2); ctx.lineTo(r * 1.0, r * 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.35, r * 0.3); ctx.lineTo(r * 1.0, r * 0.4); ctx.stroke();
        // Tail (curved line behind body)
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r * 0.7, r * 0.3);
        ctx.quadraticCurveTo(r * 1.3, -r * 0.2, r * 1.1, -r * 0.7);
        ctx.stroke();

      } else {
        // ── Snowcat dog: blob body, floppy ears, dot eyes, tongue ──
        // Floppy ears (drawn first, behind body)
        ctx.beginPath();
        ctx.ellipse(-r * 0.7, -r * 0.05, r * 0.3, r * 0.6, -0.2, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(r * 0.7, -r * 0.05, r * 0.3, r * 0.6, 0.2, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Body
        ctx.fillStyle = '#FFFDF5';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Eyes
        ctx.fillStyle = LINE_CLR;
        ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.12, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.12, 2.5, 0, Math.PI * 2); ctx.fill();
        // Nose
        ctx.beginPath();
        ctx.ellipse(0, r * 0.1, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Mouth
        ctx.strokeStyle = LINE_CLR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, r * 0.18);
        ctx.quadraticCurveTo(0, r * 0.3, r * 0.1, r * 0.18);
        ctx.stroke();
        // Tongue
        ctx.fillStyle = '#FFFDF5';
        ctx.strokeStyle = LINE_CLR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.38, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Tail
        ctx.lineWidth = 2;
        ctx.strokeStyle = LINE_CLR;
        ctx.beginPath();
        ctx.moveTo(r * 0.75, r * 0.2);
        ctx.quadraticCurveTo(r * 1.4, -r * 0.3, r * 1.2, -r * 0.8);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawScore() {
    ctx.save();
    ctx.font = 'bold 44px Outfit';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#FFFDF5';
    ctx.lineWidth = 6;
    ctx.strokeText(score + itemScore, W / 2, 55);
    ctx.fillStyle = LINE_CLR;
    ctx.fillText(score + itemScore, W / 2, 55);
    ctx.restore();
  }

  function drawIdleScreen() {
    drawBg();
    drawGround();

    bird.y = H / 2 - 30 + Math.sin(frame * 0.04) * 16;
    drawBird();

    // Title — Snowcat-style hand-drawn text
    ctx.font = 'bold 28px Outfit';
    ctx.textAlign = 'center';
    ctx.fillStyle = LINE_CLR;
    const title = petIsCat()
      ? (state.lang === 'ko' ? '플래피 냥이' : state.lang === 'ja' ? 'フラッピーにゃん' : 'Flappy Cat')
      : (state.lang === 'ko' ? '플래피 멍이' : state.lang === 'ja' ? 'フラッピーわん' : 'Flappy Dog');
    ctx.fillText(title, W / 2, 75);

    // Small doodle under title
    ctx.font = '18px serif';
    ctx.fillText(petIsCat() ? '🐱' : '🐕', W / 2, 100);

    // Tap hint
    ctx.font = '15px Outfit';
    ctx.fillStyle = '#999';
    const tapText = state.lang === 'ko' ? '탭해서 시작!' : state.lang === 'ja' ? 'タップして開始！' : 'Tap to Start!';
    ctx.fillText(tapText, W / 2, H / 2 + 60);

    // Bouncing hand
    const arrowY = H / 2 + 82 + Math.sin(frame * 0.07) * 6;
    ctx.font = '20px serif';
    ctx.fillStyle = LINE_CLR;
    ctx.fillText('☝', W / 2, arrowY);
  }

  function drawGameOver() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(255,253,245,0.85)';
    ctx.fillRect(0, 0, W, H);

    // Panel border (Snowcat hand-drawn rectangle)
    const pw = 250, ph = 200;
    const px = (W - pw) / 2, py = (H - ph) / 2 - 20;
    ctx.fillStyle = '#FFFDF5';
    ctx.strokeStyle = LINE_CLR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 12);
    ctx.fill(); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = LINE_CLR;
    ctx.font = 'bold 24px Outfit';
    ctx.fillText('Game Over', W / 2, py + 40);

    // Sad face doodle
    ctx.font = '28px serif';
    ctx.fillText(petIsCat() ? '😿' : '🐶', W / 2, py + 72);

    ctx.font = '14px Outfit';
    ctx.fillStyle = '#999';
    ctx.fillText(state.lang === 'ko' ? '점수' : state.lang === 'ja' ? 'スコア' : 'Score', W / 2, py + 100);
    ctx.font = 'bold 36px Outfit';
    ctx.fillStyle = LINE_CLR;
    ctx.fillText(score + itemScore, W / 2, py + 135);

    ctx.font = '12px Outfit';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`🏆 ${state.lang === 'ko' ? '최고' : state.lang === 'ja' ? 'ベスト' : 'Best'}: ${best}`, W / 2, py + 160);

    if (itemScore > 0) {
      ctx.font = '11px Outfit';
      ctx.fillStyle = '#888';
      ctx.fillText(`(${state.lang === 'ko' ? '아이템 보너스' : 'Item bonus'}: +${itemScore})`, W / 2, py + 178);
    }

    ctx.font = '13px Outfit';
    ctx.fillStyle = '#999';
    ctx.fillText(state.lang === 'ko' ? '탭해서 다시 시작' : state.lang === 'ja' ? 'タップして再開' : 'Tap to Restart', W / 2, py + ph + 25);
  }

  function collides() {
    if (bird.y + bird.r >= H - GROUND_H) return true;
    if (bird.y - bird.r <= 0) return true;
    for (const p of pipes) {
      if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W) {
        if (bird.y - bird.r < p.topH || bird.y + bird.r > p.topH + PIPE_GAP) {
          return true;
        }
      }
    }
    return false;
  }

  function checkItemCollision() {
    items.forEach(item => {
      if (item.collected) return;
      const dx = bird.x - item.x;
      const dy = bird.y - item.y;
      if (Math.sqrt(dx * dx + dy * dy) < bird.r + 14) {
        item.collected = true;
        itemScore += 2; // Each item = +2 bonus points
      }
    });
  }

  function update() {
    frame++;
    if (gameState === 'idle') {
      groundX += 1;
      return;
    }
    if (gameState !== 'playing') return;

    bird.vy += GRAVITY;
    bird.y += bird.vy;
    groundX += PIPE_SPEED;

    pipes.forEach(p => { p.x -= PIPE_SPEED; });
    pipes.forEach(p => {
      if (!p.scored && p.x + PIPE_W < bird.x) {
        p.scored = true;
        score++;
      }
    });
    pipes = pipes.filter(p => p.x + PIPE_W + 20 > 0);
    if (pipes.length === 0 || pipes[pipes.length - 1].x < W - 210) {
      spawnPipe();
    }

    // Move and spawn items
    items.forEach(item => { item.x -= PIPE_SPEED; });
    items = items.filter(item => item.x > -30);
    // Spawn items periodically (every ~150 frames)
    if (frame % 150 === 0 || (items.filter(i => !i.collected).length === 0 && frame % 80 === 0)) {
      spawnItem();
    }

    checkItemCollision();

    if (collides()) {
      gameState = 'over';
      const totalScore = score + itemScore;
      if (totalScore > best) {
        best = totalScore;
        localStorage.setItem('pb-flappy-best', best);
      }
      addXP(Math.min(totalScore, 20), 'Flappy Pet');
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Ensure fully opaque every frame
    ctx.globalAlpha = 1;
    if (gameState === 'idle') {
      drawIdleScreen();
    } else {
      drawBg();
      pipes.forEach(drawPipe);
      drawItems();
      drawGround();
      drawBird();
      drawScore();
      if (gameState === 'over') drawGameOver();
    }
  }

  function loop() {
    update();
    draw();
    _flappyAnimId = requestAnimationFrame(loop);
  }

  function flap() {
    if (gameState === 'idle') {
      gameState = 'playing';
      bird = { x: 90, y: H / 2, vy: FLAP, r: 24 };
      pipes = [];
      items = [];
      score = 0;
      itemScore = 0;
      frame = 0;
      jumpFrame = 10;
      spawnPipe();
      spawnItem();
    } else if (gameState === 'playing') {
      bird.vy = FLAP;
      jumpFrame = 10;
    } else if (gameState === 'over') {
      gameState = 'idle';
    }
  }

  canvas.addEventListener('click', flap);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, { passive: false });
  document.addEventListener('keydown', e => {
    if (state.page === 'game' && (e.code === 'Space' || e.code === 'ArrowUp')) {
      e.preventDefault();
      flap();
    }
  });

  loop();
}







function renderMore() {
  const tipIdx = Math.floor(Date.now() / 86400000) % 5 + 1;
  const challengeIdx = Math.floor(Date.now() / 86400000) % DAILY_CHALLENGES.length;
  const dc = DAILY_CHALLENGES[challengeIdx];
  const dcTask = state.lang === 'ko' ? dc.taskKo : state.lang === 'ja' ? dc.taskJa : dc.task;
  const hrs = 23 - new Date().getHours();
  const mins = 59 - new Date().getMinutes();
  const todayKey = new Date().toDateString();
  const challengeDone = DB.completedChallenges[todayKey];

  // Merge friends: user-added + dummy (FRIENDS_DATA)
  const allFriends = [...DB.friends, ...FRIENDS_DATA];

  return `<div class="page">
    <!-- Pet Profile -->
    ${DB.pets.length > 0 ? `
    <div class="card" style="padding:16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:2rem">${typeIcon(state.mode)}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:1.1rem">${getActivePetName()}</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">Lv.${getLevel()} · ${DB.xp} XP</div>
        </div>
        <button class="btn-secondary btn-sm" onclick="showAddPetModal()">➕</button>
      </div>
      ${DB.pets.length > 1 ? `<div style="display:flex;gap:8px;margin-top:12px;overflow-x:auto">
        ${DB.pets.map(p => `<button class="${p.id === DB.activePet ? 'btn-primary' : 'btn-secondary'}" style="font-size:0.8rem;padding:6px 12px;white-space:nowrap" onclick="DB.activePet='${p.id}';state.mode='${p.species}';saveDB('activePet');render()">${p.name}</button>`).join('')}
      </div>` : ''}
    </div>` : `
    <div class="card" style="padding:20px;text-align:center;margin-bottom:16px">
      <div style="font-size:2rem;margin-bottom:8px">🐾</div>
      <div style="font-weight:600;margin-bottom:8px">${state.lang === 'ko' ? '반려동물을 등록하세요!' : 'Register your pet!'}</div>
      <button class="btn-primary" onclick="showAddPetModal()" style="font-size:0.85rem">➕ ${state.lang === 'ko' ? '펫 등록' : 'Add Pet'}</button>
    </div>`}
    <!-- Daily Challenge -->
    <div class="card dc-card">
      <div class="dc-header">
        <h2 class="dc-title">${t('dcTitle')}</h2>
        <div class="dc-timer"><span class="dc-timer-label">${t('dcTimeLeft')}</span><span class="dc-timer-value">${hrs}h ${mins}m</span></div>
      </div>
      <div class="dc-body">
        <span class="dc-icon">${dc.icon}</span>
        <div class="dc-info">
          <div class="dc-task">${dcTask}</div>
          <div class="dc-reward">${t('dcReward')}: <strong>${dc.reward}</strong></div>
          <div class="dc-progress-wrap"><div class="dc-progress-bar" style="width:${challengeDone ? 100 : 35}%"></div></div>
        </div>
        <button class="btn-primary dc-complete-btn" ${challengeDone ? 'disabled style="opacity:0.5;cursor:default"' : ''} onclick="if(completeDailyChallenge()){render()}">${challengeDone ? '✅ ' + t('dcComplete') : t('dcComplete')}</button>
      </div>
    </div>
    <!-- Health Tip -->
    <div class="card tip-card">
      <div class="tip-icon">💡</div>
      <div class="tip-content">
        <h3 class="tip-title">${t('tipTitle')}</h3>
        <p class="tip-text">${t('tip' + tipIdx)}</p>
      </div>
    </div>
    <!-- Friends -->
    <div class="section-block">
      <div class="section-header">
        <h2 class="section-title-sm">${t('friendsTitle')}</h2>
        <button class="btn-secondary btn-sm" onclick="showAddFriendDialog()">${t('friendAdd')}</button>
      </div>
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" id="friendSearchInput" placeholder="${t('friendSearch')}" oninput="filterFriends(this.value)">
      </div>
      <div class="friends-list" id="friendsList">
        ${allFriends.map(f => `
          <div class="card friend-card" data-name="${f.user.toLowerCase()}">
            <div class="friend-avatar ${f.status}">${f.level > 8 ? '👑' : '🐕'}</div>
            <div class="friend-info">
              <div class="friend-name">${f.user} <span class="friend-level">Lv.${f.level}</span></div>
              <div class="friend-status ${f.pooping ? 'pooping' : ''}">${f.pooping ? t('friendStatus') : (f.status === 'online' ? '🟢 Online' : '⚫ Offline')}</div>
            </div>
            <button class="btn-cheer" onclick="cheerFriend('${f.user}')">${t('friendCheer')}</button>
          </div>`).join('')}
      </div>
    </div>
    <!-- Toilet Ratings -->
    <div class="section-block">
      <div class="section-header">
        <h2 class="section-title-sm">${t('toiletTitle')}</h2>
      </div>
      <div class="search-bar">
        <span class="search-icon">📍</span>
        <input type="text" class="search-input" id="toiletSearchInput" placeholder="Search nearby toilets..." oninput="filterToilets(this.value)">
      </div>
      <div class="toilet-list" id="toiletList">
        ${TOILET_RATINGS.map(tr => `
          <div class="card toilet-card" data-name="${tr.name.toLowerCase()}">
            <div class="toilet-emoji">🚽</div>
            <div class="toilet-info">
              <div class="toilet-name">${tr.name}</div>
              <div class="toilet-meta">
                <span class="toilet-stars">${'⭐'.repeat(Math.round(tr.rating))}</span>
                <span class="toilet-rating">${tr.rating}</span>
                <span class="toilet-clean-tag">${t(tr.clean)}</span>
              </div>
              <div class="toilet-distance">${tr.distance || '350m'} away · ${tr.votes} votes</div>
            </div>
            <div class="toilet-sit-pct">
              <div class="sit-circle">
                <svg width="44" height="44"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent-mint)" stroke-width="3" stroke-dasharray="${tr.sitPct * 1.13} 113" stroke-linecap="round" transform="rotate(-90 22 22)"/></svg>
                <span class="sit-pct-num">${tr.sitPct}%</span>
              </div>
              <div class="sit-label">${t('toiletSit')}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>
    <div class="ad-infeed" style="margin-top:24px">${t('adSlot')}</div>
  </div>`;
}

function showAddPetModal() {
  const isKo = state.lang === 'ko';
  const modal = document.createElement('div');
  modal.id = 'addPetModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:var(--radius-xl);padding:28px;max-width:380px;width:90%;position:relative">
      <button onclick="document.getElementById('addPetModal').remove()" style="position:absolute;top:12px;right:16px;background:none;font-size:1.2rem;color:var(--text-muted)">✕</button>
      <h3 style="margin-bottom:16px">🐾 ${isKo ? '펫 등록' : 'Add Pet'}</h3>
      <input id="petName" placeholder="${isKo ? '이름' : 'Name'}" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;font-family:var(--font);background:var(--bg-secondary);color:var(--text-primary);box-sizing:border-box">
      <select id="petSpecies" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;font-family:var(--font);background:var(--bg-secondary);color:var(--text-primary)">
        <option value="dog">🐕 ${isKo ? '강아지' : 'Dog'}</option>
        <option value="cat">🐱 ${isKo ? '고양이' : 'Cat'}</option>
        <option value="human">👤 ${isKo ? '사람' : 'Human'}</option>
      </select>
      <input id="petBreed" placeholder="${isKo ? '품종' : 'Breed'}" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;font-family:var(--font);background:var(--bg-secondary);color:var(--text-primary);box-sizing:border-box">
      <input id="petWeight" type="number" placeholder="${isKo ? '몸무게 (kg)' : 'Weight (kg)'}" style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:16px;font-family:var(--font);background:var(--bg-secondary);color:var(--text-primary);box-sizing:border-box">
      <button class="btn-primary" style="width:100%;justify-content:center" onclick="
        const name=document.getElementById('petName').value;
        if(!name){alert('${isKo ? '이름을 입력하세요' : 'Enter a name'}');return;}
        addPet(name,document.getElementById('petSpecies').value,document.getElementById('petBreed').value,'',document.getElementById('petWeight').value);
        document.getElementById('addPetModal').remove();
        render();
      ">${isKo ? '등록' : 'Register'}</button>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function showAddFriendDialog() {
  const name = prompt(state.lang === 'ko' ? '친구 이름을 입력하세요:' : 'Enter friend name:');
  if (name) { addFriend(name); render(); }
}

// Friend & Toilet Search Filters
function filterFriends(q) {
  const items = document.querySelectorAll('#friendsList .friend-card');
  items.forEach(el => { el.style.display = el.dataset.name.includes(q.toLowerCase()) ? '' : 'none'; });
}
function filterToilets(q) {
  const items = document.querySelectorAll('#toiletList .toilet-card');
  items.forEach(el => { el.style.display = el.dataset.name.includes(q.toLowerCase()) ? '' : 'none'; });
}
function cheerFriend(name) {
  const f = DB.friends.find(fr => fr.user === name);
  if (f) { f.cheerCount = (f.cheerCount || 0) + 1; saveDB('friends'); }
  showToast(`📣 Cheer sent to ${name}!`);
  addXP(2, 'Cheer');
}

// ── PDF Export (i18n + real data) ── renders as in-app overlay
function exportPDF() {
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const recent = getRecentHistory(7);
  const isKo = state.lang === 'ko';
  const isJa = state.lang === 'ja';

  const L = {
    title: isKo ? '🐾 PoopBuddy 건강 리포트' : isJa ? '🐾 PoopBuddy 健康レポート' : '🐾 PoopBuddy Health Report',
    generated: isKo ? '생성일' : isJa ? '作成日' : 'Generated',
    overallScore: isKo ? '종합 건강 점수' : isJa ? '総合健康スコア' : 'Overall Health Score',
    weekly: isKo ? '📊 최근 7일 요약' : isJa ? '📊 直近7日間サマリー' : '📊 Weekly Summary',
    date: isKo ? '날짜' : isJa ? '日付' : 'Date',
    score: isKo ? '점수' : isJa ? 'スコア' : 'Score',
    bristol: 'Bristol',
    color: isKo ? '색상' : isJa ? '色' : 'Color',
    recommendations: isKo ? '💡 추천 사항' : isJa ? '💡 推奨事項' : '💡 Recommendations',
    rec1: isKo ? '충분한 수분 섭취 — 하루 8잔 이상' : isJa ? '十分な水分摂取 — 1日8杯以上' : 'Maintain hydration — drink at least 8 glasses of water daily',
    rec2: isKo ? '식이섬유 및 프로바이오틱스 섭취 권장' : isJa ? '食物繊維とプロバイオティクスの摂取を推奨' : 'Consider adding probiotics for improved gut flora balance',
    rec3: isKo ? '규칙적인 식사 시간 유지' : isJa ? '規則正しい食事時間を維持' : 'Maintain regular meal schedules for consistent bowel patterns',
    rec4: isKo ? '아침 배변이 더 높은 점수와 연관' : isJa ? '朝の排便がより高いスコアと関連' : 'Morning bowel movements are associated with better scores',
    vetNotes: isKo ? '📋 수의사 참고사항' : isJa ? '📋 獣医師へのメモ' : '📋 Notes for Veterinarian',
    petMode: isKo ? '모드' : isJa ? 'モード' : 'Pet Mode',
    period: isKo ? '분석 기간: 최근 7일' : isJa ? '分析期間: 直近7日間' : 'Analysis Period: Last 7 days',
    avgScore: isKo ? '평균 점수' : isJa ? '平均スコア' : 'Avg Score',
    noAlarm: isKo ? '특이 패턴 없음. 일관된 변 상태 관찰됨.' : isJa ? '異常パターンなし。一貫した便の状態が観察されました。' : 'No alarming patterns detected. Consistent stool quality observed.',
    noData: isKo ? '기록 없음 — 분석을 시작하세요!' : isJa ? '記録なし — 分析を始めましょう！' : 'No records yet — start analyzing!',
    close: isKo ? '닫기' : isJa ? '閉じる' : 'Close',
  };

  const avgScore = recent.length > 0 ? Math.round(recent.reduce((s, h) => s + h.score, 0) / recent.length) : 0;
  const rows = recent.length > 0
    ? recent.slice(-7).map(h => {
      const d = new Date(h.date);
      return `<tr><td>${d.toLocaleDateString()}</td><td>${h.score}</td><td>Type ${h.bristol}</td><td>${t(h.colorKey || 'colorBrown')}</td></tr>`;
    }).join('')
    : `<tr><td colspan="4" style="text-align:center;color:#999">${L.noData}</td></tr>`;

  // Remove existing overlay if any
  const existing = document.getElementById('pdfOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pdfOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:10000;overflow-y:auto;-webkit-overflow-scrolling:touch';
  overlay.innerHTML = `
    <div style="position:sticky;top:0;background:white;z-index:1;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee">
      <button onclick="document.getElementById('pdfOverlay').remove()" style="background:var(--accent-mint);color:white;border:none;padding:10px 24px;border-radius:24px;font-size:0.95rem;font-weight:600;cursor:pointer">← ${L.close}</button>
      <span style="font-weight:600;font-size:0.95rem">📋 ${isKo ? '건강 리포트' : isJa ? '健康レポート' : 'Health Report'}</span>
    </div>
    <div style="font-family:Arial,sans-serif;padding:20px;color:#333;max-width:700px;margin:0 auto">
      <h1 style="color:#7ECF8B;border-bottom:3px solid #7ECF8B;padding-bottom:10px;font-size:1.3rem">${L.title}</h1>
      <p>${L.generated}: ${dateStr}</p>
      <div style="text-align:center;padding:20px;background:#f8f8f8;border-radius:12px;margin:20px 0">
        <div style="font-size:48px;font-weight:800;color:#7ECF8B">${avgScore || '—'}</div>
        <div>${L.overallScore}</div>
      </div>
      <h2 style="font-size:1.1rem">${L.weekly}</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><th style="padding:8px;border:1px solid #ddd;background:#f0f0f0;font-size:0.85rem">${L.date}</th><th style="padding:8px;border:1px solid #ddd;background:#f0f0f0;font-size:0.85rem">${L.score}</th><th style="padding:8px;border:1px solid #ddd;background:#f0f0f0;font-size:0.85rem">${L.bristol}</th><th style="padding:8px;border:1px solid #ddd;background:#f0f0f0;font-size:0.85rem">${L.color}</th></tr>
        ${rows.replace(/<td>/g, '<td style="padding:8px;border:1px solid #ddd;font-size:0.85rem">')}
      </table>
      <h2 style="font-size:1.1rem">${L.recommendations}</h2>
      <ul style="line-height:1.8"><li>${L.rec1}</li><li>${L.rec2}</li><li>${L.rec3}</li><li>${L.rec4}</li></ul>
      <h2 style="font-size:1.1rem">${L.vetNotes}</h2>
      <p>${L.petMode}: ${state.mode} | ${L.period} | ${L.avgScore}: ${avgScore}/100</p>
      <p>${L.noAlarm}</p>
      <div style="margin-top:40px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#999;text-align:center">Generated by PoopBuddy · ${dateStr} · poopbuddy.app</div>
    </div>`;
  document.body.appendChild(overlay);
}

// ── Render ──
const pages = { landing: renderLanding, analyze: renderAnalyze, feed: renderFeed, calendar: renderCalendar, missions: renderMissions, halloffame: renderHallOfFame, worldmap: renderWorldMap, stats: renderStats, leaderboard: renderLeaderboard, game: renderMiniGame, more: renderMore };
// ── Firebase Auth Integration ──
let firebaseApp = null;
let firebaseAuth = null;
let currentFirebaseUser = null;
const API_BASE = ''; // same origin

function initFirebase() {
  if (firebaseApp) return;
  try {
    if (window.__FIREBASE_CONFIG__ && window.__FIREBASE_CONFIG__.apiKey !== 'YOUR_API_KEY') {
      firebaseApp = firebase.initializeApp(window.__FIREBASE_CONFIG__);
      firebaseAuth = firebase.auth();

      // Handle redirect result (for Android WebView sign-in)
      firebaseAuth.getRedirectResult().then((result) => {
        if (result && result.user) {
          addXP(50, 'Welcome bonus');
          document.getElementById('loginModal')?.remove();
          showToast(state.lang === 'ko' ? 'Google 로그인 완료!' : 'Google login successful!');
        }
      }).catch((err) => {
        if (err.code && err.code !== 'auth/redirect-cancelled-by-user') {
          console.error('Redirect sign-in error:', err);
        }
      });

      // Listen for auth state changes
      firebaseAuth.onAuthStateChanged(async (user) => {
        currentFirebaseUser = user;
        if (user) {
          // User is signed in
          DB.user = {
            name: user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            loggedIn: true,
            provider: user.providerData[0]?.providerId || 'email',
            photoUrl: user.photoURL || '',
            uid: user.uid,
          };
          saveDB('user');

          // Sync with server
          try {
            const token = await user.getIdToken();
            const resp = await fetch(API_BASE + '/api/auth/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
              body: JSON.stringify({
                name: DB.user.name,
                provider: DB.user.provider,
                photoUrl: DB.user.photoUrl || '',
              })
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data.user && data.user.xp) {
                DB.xp = Math.max(DB.xp, data.user.xp);
                saveDB('xp');
              }
            }
          } catch (e) {
            console.log('Server sync skipped:', e.message);
          }
        } else {
          // User signed out
          DB.user = { name: '', email: '', loggedIn: false, provider: '', photoUrl: '', uid: '' };
          saveDB('user');
          currentFirebaseUser = null;
        }
        render();
      });

      console.log('🔥 Firebase Auth initialized');
    } else {
      console.log('⚠️ Firebase config not set — using local-only mode');
    }
  } catch (e) {
    console.error('Firebase init error:', e);
  }
}

// Helper: get auth token
async function getAuthToken() {
  if (currentFirebaseUser) {
    return await currentFirebaseUser.getIdToken();
  }
  return null;
}

// Helper: API call with auth
async function apiCall(method, path, body) {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(API_BASE + path, opts);
  return resp.json();
}

function showLoginModal() {
  const existing = document.getElementById('loginModal');
  if (existing) existing.remove();
  const isLoggedIn = DB.user.loggedIn;
  const modal = document.createElement('div');
  modal.id = 'loginModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease';
  if (isLoggedIn) {
    modal.innerHTML = `
      <div style="background:var(--bg-card);border-radius:var(--radius-xl);padding:36px;max-width:400px;width:90%;position:relative;text-align:center">
        <button onclick="document.getElementById('loginModal').remove()" style="position:absolute;top:12px;right:16px;background:none;font-size:1.3rem;color:var(--text-muted)">✕</button>
        <div style="font-size:3rem;margin-bottom:12px">${DB.user.photoUrl ? `<img src="${DB.user.photoUrl}" style="width:64px;height:64px;border-radius:50%;object-fit:cover">` : typeIcon(state.mode)}</div>
        <h2 style="margin-bottom:4px">${DB.user.name}</h2>
        <p style="color:var(--text-secondary);font-size:0.9rem">${DB.user.email || ''}</p>
        ${DB.user.provider ? `<p style="color:var(--text-muted);font-size:0.8rem;margin-top:4px">via ${DB.user.provider}</p>` : ''}
        <div style="margin:16px 0;padding:12px;background:var(--bg-secondary);border-radius:12px">
          <div style="font-weight:800;font-size:1.2rem">Lv.${getLevel()} · ${DB.xp} XP</div>
          <div style="background:var(--bg-card);border-radius:20px;height:8px;margin-top:8px;overflow:hidden">
            <div style="background:linear-gradient(90deg,var(--accent),var(--accent-mint));height:100%;border-radius:20px;width:${getLevelProgress()}%"></div>
          </div>
        </div>
        <p style="font-size:0.85rem;color:var(--text-muted)">📊 ${DB.history.length} analyses · 🐾 ${DB.pets.length} pets · 👥 ${DB.friends.length} friends</p>
        <button class="btn-secondary" style="width:100%;justify-content:center;margin-top:16px" onclick="firebaseLogout()">🚶 Logout</button>
      </div>`;
  } else {
    const btnStyle = 'width:100%;padding:13px 16px;border:none;border-radius:12px;font-size:0.95rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:8px;transition:transform 0.1s,box-shadow 0.2s;';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border-radius:var(--radius-xl);padding:32px;max-width:400px;width:90%;position:relative;max-height:90vh;overflow-y:auto">
        <button onclick="document.getElementById('loginModal').remove()" style="position:absolute;top:12px;right:16px;background:none;font-size:1.3rem;color:var(--text-muted);cursor:pointer;z-index:1">✕</button>
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:2.5rem;margin-bottom:8px">🐾</div>
          <h2 style="margin-bottom:4px;font-size:1.3rem">${t('loginTitle')}</h2>
          <p style="color:var(--text-secondary);font-size:0.85rem">${t('loginSub')}</p>
        </div>

        <!-- Social Login Buttons -->
        <button onclick="socialLogin('google')" style="${btnStyle}background:#fff;color:#333;border:1px solid #ddd;">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          ${t('googleLogin')}
        </button>

        <button onclick="socialLogin('kakao')" style="${btnStyle}background:#FEE500;color:#191919;">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.58 2 11c0 2.84 1.87 5.33 4.67 6.74l-1.2 4.46c-.1.36.32.65.63.44l5.23-3.46c.22.02.44.03.67.03 5.5 0 10-3.58 10-8s-4.5-8-10-8z" fill="#191919"/></svg>
          ${t('kakaoLogin')}
        </button>

        <button onclick="socialLogin('naver')" style="${btnStyle}background:#03C75A;color:#fff;">
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M16.27 3H7.73v7.31L4 3H0v18h7.73v-7.31L11.46 21H16.27V3z" fill="#fff" transform="translate(4,3) scale(0.75)"/></svg>
          ${t('naverLogin')}
        </button>

        <!-- Divider -->
        <div style="display:flex;align-items:center;margin:18px 0;gap:12px">
          <div style="flex:1;height:1px;background:var(--border)"></div>
          <span style="color:var(--text-muted);font-size:0.8rem">${t('orDivider')}</span>
          <div style="flex:1;height:1px;background:var(--border)"></div>
        </div>

        <!-- Email/Password Form -->
        <div id="authModeToggle" style="display:flex;gap:8px;margin-bottom:12px">
          <button id="authLoginTab" onclick="switchAuthMode('login')" style="flex:1;padding:8px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-weight:600;cursor:pointer;font-size:0.85rem">${t('loginEmailTab')}</button>
          <button id="authSignupTab" onclick="switchAuthMode('signup')" style="flex:1;padding:8px;border:none;border-radius:8px;background:var(--bg-secondary);color:var(--text-secondary);font-weight:600;cursor:pointer;font-size:0.85rem">${t('signupEmailTab')}</button>
        </div>
        <div id="nameFieldWrap" style="display:none">
          <input type="text" id="loginName" placeholder="${t('namePlaceholder')}" style="width:100%;padding:12px 16px;border:1px solid var(--border);border-radius:12px;font-family:var(--font);margin-bottom:8px;background:var(--bg-secondary);color:var(--text-primary);box-sizing:border-box;font-size:0.95rem">
        </div>
        <input type="email" id="loginEmail" placeholder="${t('emailPlaceholder')}" style="width:100%;padding:12px 16px;border:1px solid var(--border);border-radius:12px;font-family:var(--font);margin-bottom:8px;background:var(--bg-secondary);color:var(--text-primary);box-sizing:border-box;font-size:0.95rem">
        <input type="password" id="loginPassword" placeholder="${t('passwordPlaceholder')}" style="width:100%;padding:12px 16px;border:1px solid var(--border);border-radius:12px;font-family:var(--font);margin-bottom:14px;background:var(--bg-secondary);color:var(--text-primary);box-sizing:border-box;font-size:0.95rem">
        <div id="authError" style="display:none;color:#ff4444;font-size:0.85rem;margin-bottom:10px;text-align:center"></div>
        <button class="btn-primary" style="width:100%;justify-content:center;font-size:1rem;padding:13px" id="loginSubmitBtn">${t('loginBtn')}</button>
      </div>`;
    setTimeout(() => {
      // Auth mode state
      window._authMode = 'login';
      const btn = document.getElementById('loginSubmitBtn');
      if (btn) btn.onclick = () => emailAuth();
    }, 50);
  }
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function switchAuthMode(mode) {
  window._authMode = mode;
  const nameWrap = document.getElementById('nameFieldWrap');
  const loginTab = document.getElementById('authLoginTab');
  const signupTab = document.getElementById('authSignupTab');
  const submitBtn = document.getElementById('loginSubmitBtn');
  if (mode === 'signup') {
    if (nameWrap) nameWrap.style.display = 'block';
    if (loginTab) { loginTab.style.background = 'var(--bg-secondary)'; loginTab.style.color = 'var(--text-secondary)'; }
    if (signupTab) { signupTab.style.background = 'var(--accent)'; signupTab.style.color = '#fff'; }
    if (submitBtn) submitBtn.textContent = state.lang === 'ko' ? '회원가입' : state.lang === 'ja' ? 'アカウント作成' : 'Sign Up';
  } else {
    if (nameWrap) nameWrap.style.display = 'none';
    if (loginTab) { loginTab.style.background = 'var(--accent)'; loginTab.style.color = '#fff'; }
    if (signupTab) { signupTab.style.background = 'var(--bg-secondary)'; signupTab.style.color = 'var(--text-secondary)'; }
    if (submitBtn) submitBtn.textContent = t('loginBtn');
  }
}

async function emailAuth() {
  const email = document.getElementById('loginEmail')?.value;
  const password = document.getElementById('loginPassword')?.value;
  const name = document.getElementById('loginName')?.value;
  const errorEl = document.getElementById('authError');

  if (!email || !password) {
    showAuthError(state.lang === 'ko' ? '이메일과 비밀번호를 입력하세요' : 'Please enter email and password');
    return;
  }

  if (!firebaseAuth) {
    // Fallback: local-only login
    DB.user = { name: name || email.split('@')[0], email, loggedIn: true, provider: 'Email' };
    saveDB('user');
    addXP(50, 'Welcome bonus');
    document.getElementById('loginModal')?.remove();
    showToast(state.lang === 'ko' ? '로그인 완료! (로컬 모드)' : 'Login successful! (local mode)');
    render();
    return;
  }

  try {
    const submitBtn = document.getElementById('loginSubmitBtn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '...'; }

    let userCredential;
    if (window._authMode === 'signup') {
      userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      if (name && userCredential.user) {
        await userCredential.user.updateProfile({ displayName: name });
      }
      showToast(state.lang === 'ko' ? '회원가입 완료!' : 'Account created!');
    } else {
      userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
      showToast(state.lang === 'ko' ? '로그인 완료!' : 'Login successful!');
    }

    addXP(50, 'Welcome bonus');
    document.getElementById('loginModal')?.remove();
  } catch (err) {
    const errorMessages = {
      'auth/email-already-in-use': state.lang === 'ko' ? '이미 사용 중인 이메일입니다' : 'Email already in use',
      'auth/invalid-email': state.lang === 'ko' ? '유효하지 않은 이메일입니다' : 'Invalid email',
      'auth/weak-password': state.lang === 'ko' ? '비밀번호가 너무 짧습니다 (6자 이상)' : 'Password too weak (min 6 chars)',
      'auth/user-not-found': state.lang === 'ko' ? '계정을 찾을 수 없습니다' : 'Account not found',
      'auth/wrong-password': state.lang === 'ko' ? '비밀번호가 틀립니다' : 'Wrong password',
      'auth/invalid-credential': state.lang === 'ko' ? '이메일 또는 비밀번호가 틀립니다' : 'Invalid email or password',
    };
    showAuthError(errorMessages[err.code] || err.message);
    const submitBtn = document.getElementById('loginSubmitBtn');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = window._authMode === 'signup' ? (state.lang === 'ko' ? '회원가입' : 'Sign Up') : t('loginBtn'); }
  }
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 4000); }
}

async function socialLogin(provider) {
  if (!firebaseAuth) {
    // Fallback: local-only login
    const providerNames = { kakao: 'Kakao', google: 'Google', naver: 'Naver', apple: 'Apple' };
    const providerName = providerNames[provider] || provider;

    if (provider === 'kakao' || provider === 'naver') {
      showToast(state.lang === 'ko' ? `${providerName} 로그인은 Firebase 설정 필요` : `${providerName} login requires Firebase setup`);
      return;
    }

    DB.user = { name: providerName + ' User', email: '', loggedIn: true, provider: providerName };
    saveDB('user');
    addXP(50, 'Welcome bonus');
    document.getElementById('loginModal')?.remove();
    showToast(`${providerName} ${state.lang === 'ko' ? '로그인 완료! (로컬 모드)' : 'login successful! (local mode)'}`);
    render();
    return;
  }

  if (provider === 'naver') {
    showToast(state.lang === 'ko' ? '준비 중입니다 (곧 지원 예정)' : 'Coming soon');
    return;
  }

  if (provider === 'kakao') {
    // ── 카카오 로그인: Chrome Custom Tabs → 카카오톡 앱 로그인 지원 ──
    showToast(state.lang === 'ko' ? '카카오 로그인 중...' : 'Signing in with Kakao...');
    var redirectUri = 'poopbuddy://kakao-callback';
    var kakaoOAuthUrl = 'https://kauth.kakao.com/oauth/authorize'
      + '?client_id=43bb4bf552d6376f7709acddff6718b9'
      + '&redirect_uri=' + encodeURIComponent(redirectUri)
      + '&response_type=code'
      + '&state=kakao_login'
      + '&scope=profile_nickname,profile_image,account_email';

    // 네이티브 앱이면 Chrome Custom Tabs로 열기 (카카오톡 앱 로그인 버튼 표시)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
      window.Capacitor.Plugins.Browser.open({ url: kakaoOAuthUrl });
    } else {
      window.location.href = kakaoOAuthUrl;
    }
    return;
  }

  if (provider !== 'google') {
    showToast('Unsupported provider');
    return;
  }

  try {
    const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

    if (isNative) {
      // ── Android: Capacitor 네이티브 Google Sign-In ──
      showToast(state.lang === 'ko' ? 'Google 로그인 중...' : 'Signing in with Google...');

      try {
        // Capacitor.Plugins에서 직접 GoogleAuth 접근 (registerPlugin 사용 불가)
        const GoogleAuth = window.Capacitor.Plugins.GoogleAuth;
        if (!GoogleAuth) {
          throw new Error('GoogleAuth plugin not found in Capacitor.Plugins');
        }

        // 반드시 initialize() 먼저 호출 (Java: loadSignInClient 생성)
        await GoogleAuth.initialize({
          clientId: '1044129754458-t11224vfdcbh4fhcbvn2kc9m50i1im92.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });

        const googleUser = await GoogleAuth.signIn();
        console.log('[PoopBuddy] Google user:', JSON.stringify(googleUser));

        // ID 토큰으로 Firebase 인증
        const idToken = googleUser.authentication?.idToken;
        if (idToken) {
          const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
          await firebaseAuth.signInWithCredential(credential);
        } else {
          // 토큰 없으면 로컬 로그인
          DB.user = {
            name: googleUser.name || googleUser.givenName || googleUser.email || 'Google User',
            email: googleUser.email || '',
            loggedIn: true,
            provider: 'Google',
            photoUrl: googleUser.imageUrl || '',
          };
          saveDB('user');
        }

        addXP(50, 'Welcome bonus');
        document.getElementById('loginModal')?.remove();
        showToast(state.lang === 'ko' ? 'Google 로그인 완료!' : 'Google login successful!');
        render();
      } catch (nativeErr) {
        console.error('[PoopBuddy] Native Google Auth error:', nativeErr);
        showToast(state.lang === 'ko' ? '로그인 실패: ' + (nativeErr?.message || nativeErr) : 'Login failed: ' + (nativeErr?.message || nativeErr));
      }
    } else {
      // ── 웹 브라우저: Firebase popup 사용 ──
      const authProvider = new firebase.auth.GoogleAuthProvider();
      authProvider.addScope('email');
      const result = await firebaseAuth.signInWithPopup(authProvider);
      addXP(50, 'Welcome bonus');
      document.getElementById('loginModal')?.remove();
      showToast(state.lang === 'ko' ? 'Google 로그인 완료!' : 'Google login successful!');
    }
  } catch (err) {
    console.error('Social login error:', err);
    // 사용자 취소는 무시
    const msg = err?.message || err?.toString() || JSON.stringify(err);
    if (msg.includes('cancel') || msg.includes('Cancel') || err?.code === 'auth/popup-closed-by-user') return;
    showToast(state.lang === 'ko' ? '로그인 실패: ' + msg : 'Login failed: ' + msg);
  }
}

async function firebaseLogout() {
  try {
    if (firebaseAuth) {
      await firebaseAuth.signOut();
    }
    DB.user = { name: '', email: '', loggedIn: false, provider: '', photoUrl: '', uid: '' };
    saveDB('user');
    document.getElementById('loginModal')?.remove();
    showToast(state.lang === 'ko' ? '로그아웃 완료' : 'Logged out');
    render();
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// Initialize Firebase on load
initFirebase();

// ── Photo Picker Popup ──
function showPhotoPickerPopup() {
  const popup = document.getElementById('photoPickerPopup');
  if (popup) popup.style.display = 'flex';
}
function closePhotoPickerPopup() {
  const popup = document.getElementById('photoPickerPopup');
  if (popup) popup.style.display = 'none';
}
function pickFromGallery() {
  closePhotoPickerPopup();
  const input = document.getElementById('fileInput');
  if (input) input.click();
}
function pickFromCamera() {
  closePhotoPickerPopup();
  const input = document.getElementById('cameraInput');
  if (input) input.click();
}

// ── Analysis ──
let selectedFile = null;
let lastAnalyzedImage = null; // stores base64 DataURL of last analyzed photo
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  closePhotoPickerPopup(); // Always close popup after selecting
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    lastAnalyzedImage = ev.target.result; // save for feed posts
    const p = document.getElementById('previewImg');
    p.src = ev.target.result; p.style.display = 'block';
    document.getElementById('analyzeBtn').style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
}

// ── Health Database (loaded once) ──
let _healthDB = null;
async function loadHealthDB() {
  if (_healthDB) return _healthDB;
  try {
    const resp = await fetch('/health-db.json');
    _healthDB = await resp.json();
  } catch (e) { console.warn('Health DB load failed:', e); _healthDB = {}; }
  return _healthDB;
}

function getDBText(obj, field) {
  const lang = state.lang;
  if (lang === 'ko' && obj[field + 'Ko']) return obj[field + 'Ko'];
  if (lang === 'ja' && obj[field + 'Ja']) return obj[field + 'Ja'];
  return obj[field] || obj[field + 'Ko'] || '';
}

async function runAnalysis() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('show');
  const db = await loadHealthDB();
  await new Promise(r => setTimeout(r, 1800 + Math.random() * 1200));
  overlay.classList.remove('show');

  // Simulated analysis results (will be replaced by real AI later)
  const results = [
    { key: 'good', score: 75 + Math.floor(Math.random() * 20), emoji: '😊', msgKey: 'analysisGoodMsg' },
    { key: 'caution', score: 45 + Math.floor(Math.random() * 20), emoji: '😐', msgKey: 'analysisCautionMsg' },
    { key: 'warning', score: 20 + Math.floor(Math.random() * 20), emoji: '😟', msgKey: 'analysisWarningMsg' },
  ];
  const r = results[Math.floor(Math.random() * 3)];
  const bristol = 1 + Math.floor(Math.random() * 7);

  // Map to health DB color keys
  const colorDBKeys = ['brown', 'dark_brown', 'yellow', 'green', 'orange', 'red', 'black', 'gray'];
  const colorUIKeys = ['colorBrown', 'colorDarkBrown', 'colorYellowBrown', 'colorGreenBrown', 'colorLightBrown'];
  const consKeys = ['consWellFormed', 'consSoftMushy', 'consHardLumpy', 'consWatery', 'consSmoothSoft'];

  // Pick random color for now; abnormalities with weighted probability
  const colorIdx = Math.floor(Math.random() * colorUIKeys.length);
  const colorKey = colorUIKeys[colorIdx];
  const consKey = consKeys[Math.floor(Math.random() * consKeys.length)];
  const typeKey = state.mode + 'Analysis';

  // Detect simulated color for DB lookup
  const detectedColorDB = ['brown', 'dark_brown', 'yellow', 'green', 'orange'][colorIdx] || 'brown';
  const detectedAbnormalities = [];
  // Randomly detect abnormalities to demo the feature
  const abnormKeys = ['mucus', 'blood_fresh', 'worms_visible', 'undigested_food', 'fatty_greasy'];
  if (Math.random() < 0.35) detectedAbnormalities.push(abnormKeys[Math.floor(Math.random() * abnormKeys.length)]);

  // Build Bristol info from DB
  const bristolDB = db.bristolScale && db.bristolScale[String(bristol)];
  const colorDB = db.colorAnalysis && db.colorAnalysis[detectedColorDB];

  // Build community-style response
  let communityResponse = '';
  if (db.communityResponses && db.communityResponses.templates) {
    const templates = db.communityResponses.templates;
    // Pick relevant template based on detected abnormalities or general
    let template = null;
    if (detectedAbnormalities.includes('mucus')) template = templates.find(t => t.id === 'mucus_response');
    else if (detectedAbnormalities.includes('blood_fresh')) template = templates.find(t => t.id === 'blood_response');
    else if (detectedAbnormalities.includes('worms_visible')) template = templates.find(t => t.id === 'worm_response');
    else if (bristol >= 6) template = templates.find(t => t.id === 'diarrhea_response');
    else if (bristol <= 2) template = templates.find(t => t.id === 'constipation_response');
    else if (state.mode === 'dog') template = templates.find(t => t.id === 'puppy_general');

    if (template) {
      communityResponse = state.lang === 'ko' ? template.response
        : (template.responseEn || template.response);
    }
  }

  // Build abnormality detail cards
  let abnormalityHTML = '';
  detectedAbnormalities.forEach(aKey => {
    const abn = db.abnormalities && db.abnormalities[aKey];
    if (!abn) return;
    const isKo = state.lang === 'ko';
    const urgColors = { low: '#4CAF50', moderate: '#FF9800', high: '#F44336', critical: '#D32F2F' };
    const urgLabels = { low: isKo ? '낮음' : 'Low', moderate: isKo ? '주의' : 'Moderate', high: isKo ? '위험' : 'High', critical: isKo ? '긴급' : 'Critical' };
    const causes = (abn.causes || []).slice(0, 4).map(c =>
      `<li style="margin-bottom:4px"><strong>${isKo ? c.causeKo : c.cause}</strong>: ${isKo ? c.detailKo : c.detail}</li>`
    ).join('');
    abnormalityHTML += `
      <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;margin-top:12px;border-left:4px solid ${urgColors[abn.urgency] || '#FF9800'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h4 style="margin:0;font-size:1rem">${isKo ? abn.nameKo : abn.name}</h4>
          <span style="background:${urgColors[abn.urgency]};color:#fff;padding:2px 10px;border-radius:20px;font-size:0.75rem;font-weight:600">${urgLabels[abn.urgency]}</span>
        </div>
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:8px">${isKo ? abn.descriptionKo : abn.description}</p>
        ${causes ? `<div style="font-size:0.85rem"><strong>${isKo ? '원인' : 'Causes'}:</strong><ul style="margin:4px 0 0 16px;padding:0">${causes}</ul></div>` : ''}
        <p style="font-size:0.85rem;margin-top:8px;color:${urgColors[abn.urgency]};font-weight:600">🏥 ${isKo ? abn.whenToVisitVetKo || '' : abn.whenToVisitVet || ''}</p>
      </div>`;
  });

  // Bristol Scale detail
  let bristolDetailHTML = '';
  if (bristolDB) {
    const isKo = state.lang === 'ko';
    const urgColors = { none: '#4CAF50', low: '#8BC34A', moderate: '#FF9800', high: '#F44336', critical: '#D32F2F' };
    const statusLabels = {
      ideal: isKo ? '최적' : 'Ideal', normal: isKo ? '정상' : 'Normal', healthy: isKo ? '건강' : 'Healthy',
      mild_constipation: isKo ? '경미한 변비' : 'Mild Constipation', severe_constipation: isKo ? '심한 변비' : 'Severe Constipation',
      mild_loose: isKo ? '약간 무름' : 'Slightly Loose', diarrhea: isKo ? '설사' : 'Diarrhea', severe_diarrhea: isKo ? '심한 설사' : 'Severe Diarrhea',
    };
    const remedies = (isKo ? bristolDB.homeRemediesKo : bristolDB.homeRemedies) || [];
    bristolDetailHTML = `
      <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;margin-top:12px">
        <h4 style="margin:0 0 8px 0;font-size:1rem">📊 Bristol Type ${bristol}: ${isKo ? bristolDB.typeKo : bristolDB.type}</h4>
        <div style="display:inline-block;background:${urgColors[bristolDB.urgency]};color:#fff;padding:2px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;margin-bottom:8px">${statusLabels[bristolDB.healthStatus] || bristolDB.healthStatus}</div>
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:8px">${isKo ? bristolDB.descriptionKo : bristolDB.description}</p>
        <p style="font-size:0.85rem;font-weight:600">💬 ${isKo ? bristolDB.adviceKo : bristolDB.advice}</p>
        ${remedies.length > 0 ? `<div style="font-size:0.85rem;margin-top:8px"><strong>${isKo ? '🏠 가정 케어' : '🏠 Home Care'}:</strong> ${remedies.join(', ')}</div>` : ''}
      </div>`;
  }

  // Color analysis detail
  let colorDetailHTML = '';
  if (colorDB) {
    const isKo = state.lang === 'ko';
    colorDetailHTML = `
      <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;margin-top:12px">
        <h4 style="margin:0 0 8px 0;font-size:1rem">
          <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${colorDB.hex};vertical-align:middle;margin-right:6px"></span>
          ${isKo ? colorDB.colorKo : colorDB.color}
        </h4>
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:8px">${isKo ? colorDB.descriptionKo : colorDB.description}</p>
        <p style="font-size:0.85rem">${isKo ? colorDB.adviceKo : colorDB.advice}</p>
      </div>`;
  }

  // Community advice section
  let communityHTML = '';
  if (communityResponse) {
    const isKo = state.lang === 'ko';
    communityHTML = `
      <div style="background:linear-gradient(135deg,rgba(126,207,139,0.08),rgba(126,207,139,0.02));border:1px solid rgba(126,207,139,0.3);border-radius:12px;padding:16px;margin-top:16px">
        <h4 style="margin:0 0 10px 0;font-size:1rem;color:var(--accent)">🐾 ${isKo ? '주치의 조언' : 'Vet Expert Advice'}</h4>
        <p style="font-size:0.9rem;line-height:1.6;color:var(--text-primary)">${communityResponse}</p>
      </div>`;
  }

  // Dietary tips
  let dietHTML = '';
  if (db.dietaryAdvice && (bristol <= 2 || bristol >= 6 || r.key !== 'good')) {
    const isKo = state.lang === 'ko';
    const foods = (db.dietaryAdvice.gutFriendlyFoods || []).slice(0, 3);
    const foodItems = foods.map(f =>
      `<div style="display:flex;align-items:start;gap:8px;margin-bottom:6px">
        <span>🥗</span>
        <div><strong>${isKo ? f.nameKo : f.name}</strong><br><span style="color:var(--text-secondary);font-size:0.8rem">${isKo ? f.benefitKo : f.benefit}</span></div>
      </div>`
    ).join('');
    dietHTML = `
      <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;margin-top:12px">
        <h4 style="margin:0 0 10px 0;font-size:1rem">🍽️ ${isKo ? '추천 식단' : 'Dietary Recommendations'}</h4>
        ${foodItems}
      </div>`;
  }

  // Emergency signs (show if warning level)
  let emergencyHTML = '';
  if (r.key === 'warning' && db.emergencySigns) {
    const isKo = state.lang === 'ko';
    const signs = (db.emergencySigns.signs || []).slice(0, 5).map(s =>
      `<li style="margin-bottom:4px">${isKo ? s.signKo : s.sign}</li>`
    ).join('');
    emergencyHTML = `
      <div style="background:rgba(244,67,54,0.06);border:1px solid rgba(244,67,54,0.3);border-radius:12px;padding:16px;margin-top:12px">
        <h4 style="margin:0 0 8px 0;font-size:1rem;color:#F44336">🚨 ${isKo ? '이런 경우 즉시 병원에 가세요!' : 'Visit Vet Immediately If:'}</h4>
        <ul style="font-size:0.85rem;margin:0 0 0 16px;padding:0">${signs}</ul>
      </div>`;
  }

  // Get active pet profile for personalized diagnosis
  const activePet = DB.pets.find(p => p.id === DB.activePet);
  const petAge = activePet && activePet.birthday ? (() => {
    const bd = new Date(activePet.birthday);
    const now = new Date();
    const months = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
    return { months, years: Math.floor(months / 12) };
  })() : null;

  // Mode-specific diverse messages (pick random from 4 variants)
  const msgVariant = Math.floor(Math.random() * 4) + 1;
  const modeKey = state.mode; // dog, cat, human
  const severityKey = r.key === 'good' ? 'Good' : r.key === 'caution' ? 'Caution' : 'Warning';
  const diverseMsgKey = `${modeKey}${severityKey}${msgVariant}`;
  const diverseMsg = t(diverseMsgKey) || t(r.msgKey);

  // Pet-specific advice based on breed, age, weight
  let petAdviceHTML = '';
  if (activePet && (state.mode === 'dog' || state.mode === 'cat')) {
    const isKo = state.lang === 'ko';
    const species = state.mode === 'dog' ? (isKo ? '강아지' : 'Dog') : (isKo ? '고양이' : 'Cat');
    const breedStr = activePet.breed || (isKo ? '품종 미등록' : 'Breed not set');
    const weightStr = activePet.weight ? `${activePet.weight}kg` : '—';
    const ageStr = petAge ? (petAge.years >= 1 ? `${petAge.years}${isKo ? '세' : 'yr'}` : `${petAge.months}${isKo ? '개월' : 'mo'}`) : '—';

    let ageAdvice = '';
    if (petAge) {
      if (state.mode === 'dog') {
        if (petAge.months < 12) ageAdvice = isKo ? '성장기 강아지는 소화가 예민해요. 퍼피 전용 사료로 소화 부담을 줄여주세요.' : 'Growing puppies have sensitive digestion. Use puppy-specific food.';
        else if (petAge.years >= 7) ageAdvice = isKo ? '노견은 소화 기능이 약해질 수 있어요. 시니어 사료와 관절 영양제를 고려하세요.' : 'Senior dogs may have weaker digestion. Consider senior food and supplements.';
        else ageAdvice = isKo ? '성견 시기에는 규칙적인 급여와 적절한 운동이 장 건강의 핵심이에요.' : 'Regular feeding and exercise are key to adult dog gut health.';
      } else {
        if (petAge.months < 12) ageAdvice = isKo ? '성장기 고양이는 영양 밀도 높은 키튼 사료가 필요해요.' : 'Growing kittens need nutrient-dense kitten food.';
        else if (petAge.years >= 10) ageAdvice = isKo ? '노묘는 신장 건강이 중요해요. 수분 섭취를 충분히 해주세요.' : 'Senior cats need extra hydration for kidney health.';
        else ageAdvice = isKo ? '성묘는 적절한 수분 섭취와 스트레스 관리가 소화 건강에 중요해요.' : 'Adult cats benefit from proper hydration and low-stress environment.';
      }
    }

    let weightAdvice = '';
    if (activePet.weight) {
      const w = parseFloat(activePet.weight);
      if (state.mode === 'dog') {
        if (w < 5) weightAdvice = isKo ? '소형견은 소화관이 짧아 소량 다회 급여가 좋아요.' : 'Small dogs benefit from smaller, more frequent meals.';
        else if (w > 25) weightAdvice = isKo ? '대형견은 위 확장 예방을 위해 식후 바로 격한 운동을 피해주세요.' : 'Large dogs should avoid intense exercise right after meals.';
      } else {
        if (w > 6) weightAdvice = isKo ? '체중이 높은 편이에요. 급여량 조절과 놀이 시간을 늘려보세요.' : 'Weight is on the higher side. Consider portion control and more play time.';
      }
    }

    petAdviceHTML = `
      <div style="background:linear-gradient(135deg,rgba(126,207,179,0.08),rgba(180,136,200,0.08));border:1px solid var(--accent-mint);border-radius:12px;padding:16px;margin-top:12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="font-size:2rem">${state.mode === 'dog' ? '🐕' : '🐱'}</span>
          <div>
            <div style="font-weight:800;font-size:1rem">${activePet.name}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${breedStr} · ${weightStr} · ${ageStr}</div>
          </div>
        </div>
        <div style="font-size:0.85rem;color:var(--text-primary);line-height:1.6">
          <p style="margin:0 0 6px 0">🎯 <strong>${isKo ? `${activePet.name} 맞춤 진단` : `Personalized for ${activePet.name}`}</strong></p>
          ${ageAdvice ? `<p style="margin:0 0 4px 0">📅 ${ageAdvice}</p>` : ''}
          ${weightAdvice ? `<p style="margin:0">⚖️ ${weightAdvice}</p>` : ''}
        </div>
      </div>`;
  }

  document.getElementById('analysisResult').innerHTML = `
    <div class="card">
      <div class="result-header">
        <div class="result-score ${r.key}"><span>${r.score}</span><span style="font-size:0.6rem;font-weight:400">/100</span></div>
        <div class="result-details">
          <h3>${r.emoji} ${t('gutHealth')}: ${t(r.key)}</h3>
          <p>${t(typeKey)} • ${t('bristol')} ${bristol}${activePet ? ` • ${activePet.name}` : ''}</p>
        </div>
      </div>
      <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:16px">${diverseMsg}</p>
      ${petAdviceHTML}
      <div class="result-grid">
        <div class="result-item"><div class="result-item-label">${t('color')}</div><div class="result-item-value">${t(colorKey)}</div></div>
        <div class="result-item"><div class="result-item-label">${t('consistency')}</div><div class="result-item-value">${t(consKey)}</div></div>
        <div class="result-item"><div class="result-item-label">${t('bristol')}</div><div class="result-item-value">Type ${bristol}</div></div>
        <div class="result-item"><div class="result-item-label">${t('hydration')}</div><div class="result-item-value">${r.score > 60 ? t('hydrationGood') : t('hydrationLow')}</div></div>
      </div>
      ${communityHTML}
      ${bristolDetailHTML}
      ${colorDetailHTML}
      ${abnormalityHTML}
      ${dietHTML}
      ${emergencyHTML}
      <div class="result-actions" style="margin-top:20px;display:flex;flex-direction:column;gap:10px">
        <button class="btn-primary" id="shareToFeedBtn" style="width:100%;justify-content:center">${t('shareToFeed')}</button>
        <button class="btn-secondary" onclick="exportPDF()" style="width:100%;justify-content:center">${t('exportPdf')}</button>
        <button class="btn-secondary" onclick="document.getElementById('analysisResult').style.display='none';document.getElementById('previewImg').style.display='none';document.getElementById('analyzeBtn').style.display='none'" style="width:100%;justify-content:center">${t('analyzeAnother')}</button>
      </div>
    </div>`;
  document.getElementById('analysisResult').style.display = 'block';

  // Save analysis to history + calendar + XP
  const analysisRecord = { date: new Date().toISOString(), score: r.score, bristol, color: detectedColorDB, colorKey, consKey, pet: state.mode, key: r.key, msgKey: r.msgKey, abnormalities: detectedAbnormalities };
  saveAnalysis(analysisRecord);
  addXP(15, t('analyze'));

  // Wire up share button
  document.getElementById('shareToFeedBtn').onclick = () => {
    addFeedPost(analysisRecord);
    showToast('✅ ' + t('shareToFeed') + '!');
    setTimeout(() => navigate('feed'), 600);
  };
}

// ── Calendar Toggle ──
function toggleRecord(y, m, d) {
  const key = `${y}-${m}-${d}`;
  const bristolEmojis = ['⚫', '🟤', '🟫', '🟡', '🟠', '🔴', '💧'];
  const cur = CAL_RECORDS[key];
  if (!cur) {
    CAL_RECORDS[key] = '🟡'; // default: Type 4 (healthy)
  } else {
    const idx = bristolEmojis.indexOf(cur);
    if (idx >= 0 && idx < 6) CAL_RECORDS[key] = bristolEmojis[idx + 1];
    else delete CAL_RECORDS[key];
  }
  render();
}


function render() {
  document.getElementById('app').innerHTML = (pages[state.page] || renderLanding)();
  // Update nav text for current language
  document.querySelectorAll('.nav-link').forEach(l => {
    const p = l.dataset.page;
    const map = { landing: 'home', analyze: 'analyze', feed: 'feed', calendar: 'calendar', missions: 'missions', halloffame: 'halloffame', worldmap: 'worldmap', stats: 'statsTitle', leaderboard: 'lbTitle', game: 'gameTitle', more: 'more' };
    if (map[p]) l.textContent = t(map[p]);
  });
  // Update bottom nav text
  const bnavMap = { landing: 'home', analyze: 'analyze', feed: 'feed', calendar: 'calendar', worldmap: 'worldmap', more: 'more' };
  document.querySelectorAll('.bottom-nav-item').forEach(l => {
    const p = l.dataset.page;
    const label = l.querySelector('.bnav-label');
    if (label && bnavMap[p]) label.textContent = t(bnavMap[p]);
  });
  window.scrollTo(0, 0);
  // Update login button / profile avatar
  const loginBtn = document.getElementById('btnLogin');
  if (loginBtn) {
    if (DB.user.loggedIn) {
      if (DB.user.photoUrl) {
        loginBtn.innerHTML = `<img src="${DB.user.photoUrl}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--accent)">`;
      } else {
        const initial = (DB.user.name || 'U').charAt(0).toUpperCase();
        loginBtn.innerHTML = `<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9rem;border:2px solid var(--accent-mint)">${initial}</div>`;
      }
      loginBtn.style.cssText = 'background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center';
    } else {
      loginBtn.textContent = 'Login';
      loginBtn.style.cssText = '';
      loginBtn.className = 'btn-login';
    }
  }
  // Init mini game if on game page
  if (state.page === 'game') initFlappyPoop();
  // Init stats charts if on stats page
  if (state.page === 'stats') setTimeout(initStatsCharts, 50);
}

// ── Flappy Poop Game ──
// ── Sound Effects (AudioContext) ──
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;

  if (type === 'jump') {
    // Cute bouncy "boing" sound
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
    osc.start(now); osc.stop(now + 0.15);
  } else if (type === 'score') {
    // Sparkly coin ding (dual tone)
    [523, 659].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
      osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.2);
    });
  } else if (type === 'die') {
    // Sad descending wobble
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.6);
    lfo.frequency.setValueAtTime(8, now);
    lfoGain.gain.setValueAtTime(20, now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
    lfo.start(now); osc.start(now);
    lfo.stop(now + 0.6); osc.stop(now + 0.6);
  } else if (type === 'swoosh') {
    // Wind swoosh for fast sections
    const bufferSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.1;
    const noise = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    noise.buffer = buffer;
    filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 2;
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
    noise.start(now); noise.stop(now + 0.15);
  }
}


// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  // Theme
  if (state.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  document.getElementById('btnDark').textContent = state.theme === 'dark' ? '☀️' : '🌙';
  // Lang — handled by country selector below

  // Nav
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); });
  });
  // Burger
  document.getElementById('burger').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });
  // Dark mode
  document.getElementById('btnDark').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    if (state.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('pb-theme', state.theme);
    document.getElementById('btnDark').textContent = state.theme === 'dark' ? '☀️' : '🌙';
  });
  // Modal Close
  document.getElementById('modalClose').addEventListener('click', closeLoginModal);
  document.getElementById('loginModal').addEventListener('click', (e) => {
    if (e.target.id === 'loginModal') closeLoginModal();
  });

  // Language — Country Selector
  const COUNTRIES = [
    { code: 'kr', name: 'Korea (한국)', lang: 'ko', langName: '한국어' },
    { code: 'us', name: 'United States', lang: 'en', langName: 'English' },
    { code: 'jp', name: 'Japan (日本)', lang: 'ja', langName: '日本語' },
    { code: 'gb', name: 'United Kingdom', lang: 'en', langName: 'English' },
    { code: 'ca', name: 'Canada', lang: 'en', langName: 'English / Français' },
    { code: 'au', name: 'Australia', lang: 'en', langName: 'English' },
    { code: 'de', name: 'Germany (Deutschland)', lang: 'en', langName: 'Deutsch' },
    { code: 'fr', name: 'France', lang: 'en', langName: 'Français' },
    { code: 'es', name: 'Spain (España)', lang: 'en', langName: 'Español' },
    { code: 'it', name: 'Italy (Italia)', lang: 'en', langName: 'Italiano' },
    { code: 'br', name: 'Brazil (Brasil)', lang: 'en', langName: 'Português' },
    { code: 'pt', name: 'Portugal', lang: 'en', langName: 'Português' },
    { code: 'mx', name: 'Mexico (México)', lang: 'en', langName: 'Español' },
    { code: 'ar', name: 'Argentina', lang: 'en', langName: 'Español' },
    { code: 'cl', name: 'Chile', lang: 'en', langName: 'Español' },
    { code: 'co', name: 'Colombia', lang: 'en', langName: 'Español' },
    { code: 'cn', name: 'China (中国)', lang: 'en', langName: '中文' },
    { code: 'tw', name: 'Taiwan (台灣)', lang: 'en', langName: '中文' },
    { code: 'hk', name: 'Hong Kong (香港)', lang: 'en', langName: '中文 / English' },
    { code: 'in', name: 'India (भारत)', lang: 'en', langName: 'English / हिन्दी' },
    { code: 'id', name: 'Indonesia', lang: 'en', langName: 'Bahasa Indonesia' },
    { code: 'th', name: 'Thailand (ไทย)', lang: 'en', langName: 'ภาษาไทย' },
    { code: 'vn', name: 'Vietnam (Việt Nam)', lang: 'en', langName: 'Tiếng Việt' },
    { code: 'ph', name: 'Philippines', lang: 'en', langName: 'English / Filipino' },
    { code: 'my', name: 'Malaysia', lang: 'en', langName: 'Bahasa Melayu' },
    { code: 'sg', name: 'Singapore', lang: 'en', langName: 'English' },
    { code: 'ru', name: 'Russia (Россия)', lang: 'en', langName: 'Русский' },
    { code: 'ua', name: 'Ukraine (Україна)', lang: 'en', langName: 'Українська' },
    { code: 'pl', name: 'Poland (Polska)', lang: 'en', langName: 'Polski' },
    { code: 'nl', name: 'Netherlands', lang: 'en', langName: 'Nederlands' },
    { code: 'be', name: 'Belgium (België)', lang: 'en', langName: 'Nederlands / Français' },
    { code: 'se', name: 'Sweden (Sverige)', lang: 'en', langName: 'Svenska' },
    { code: 'no', name: 'Norway (Norge)', lang: 'en', langName: 'Norsk' },
    { code: 'dk', name: 'Denmark (Danmark)', lang: 'en', langName: 'Dansk' },
    { code: 'fi', name: 'Finland (Suomi)', lang: 'en', langName: 'Suomi' },
    { code: 'ch', name: 'Switzerland', lang: 'en', langName: 'Deutsch / Français' },
    { code: 'at', name: 'Austria (Österreich)', lang: 'en', langName: 'Deutsch' },
    { code: 'tr', name: 'Turkey (Türkiye)', lang: 'en', langName: 'Türkçe' },
    { code: 'sa', name: 'Saudi Arabia (السعودية)', lang: 'en', langName: 'العربية' },
    { code: 'ae', name: 'UAE (الإمارات)', lang: 'en', langName: 'العربية / English' },
    { code: 'eg', name: 'Egypt (مصر)', lang: 'en', langName: 'العربية' },
    { code: 'il', name: 'Israel (ישראל)', lang: 'en', langName: 'עברית' },
    { code: 'za', name: 'South Africa', lang: 'en', langName: 'English' },
    { code: 'ng', name: 'Nigeria', lang: 'en', langName: 'English' },
    { code: 'ke', name: 'Kenya', lang: 'en', langName: 'English / Kiswahili' },
    { code: 'nz', name: 'New Zealand', lang: 'en', langName: 'English' },
    { code: 'gr', name: 'Greece (Ελλάδα)', lang: 'en', langName: 'Ελληνικά' },
    { code: 'cz', name: 'Czech Republic', lang: 'en', langName: 'Čeština' },
    { code: 'ro', name: 'Romania (România)', lang: 'en', langName: 'Română' },
    { code: 'hu', name: 'Hungary (Magyarország)', lang: 'en', langName: 'Magyar' },
    { code: 'ie', name: 'Ireland', lang: 'en', langName: 'English' },
    { code: 'pe', name: 'Peru (Perú)', lang: 'en', langName: 'Español' },
  ];

  const flagUrl = (code) => `https://flagcdn.com/w80/${code}.png`;

  // Store selected country
  let selectedCountry = localStorage.getItem('pb-country') || 'Korea (한국)';
  const savedCountry = COUNTRIES.find(c => c.name === selectedCountry);
  const btnLang = document.getElementById('btnLang');
  if (savedCountry) {
    state.lang = savedCountry.lang;
    btnLang.innerHTML = `<img src="${flagUrl(savedCountry.code)}" class="btn-lang-flag" alt="${savedCountry.name}">`;
  } else {
    btnLang.innerHTML = `<img src="${flagUrl('kr')}" class="btn-lang-flag" alt="Korea">`;
  }

  const countryModal = document.getElementById('countryModal');
  const countryList = document.getElementById('countryList');
  const countrySearch = document.getElementById('countrySearch');

  function renderCountryList(filter = '') {
    const q = filter.toLowerCase();
    const filtered = COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.langName.toLowerCase().includes(q) || c.code.includes(q)
    );
    countryList.innerHTML = filtered.map(c => `
      <div class="country-item ${c.name === selectedCountry ? 'selected' : ''}" data-name="${c.name}" data-lang="${c.lang}" data-code="${c.code}">
        <img class="country-flag-img" src="${flagUrl(c.code)}" alt="${c.code}" loading="lazy">
        <div class="country-info">
          <div class="country-name">${c.name}</div>
          <div class="country-lang">${c.langName}</div>
        </div>
        ${c.name === selectedCountry ? '<span class="country-check">✓</span>' : ''}
      </div>
    `).join('');

    countryList.querySelectorAll('.country-item').forEach(el => {
      el.addEventListener('click', () => {
        selectedCountry = el.dataset.name;
        state.lang = el.dataset.lang;
        localStorage.setItem('pb-lang', state.lang);
        localStorage.setItem('pb-country', selectedCountry);
        btnLang.innerHTML = `<img src="${flagUrl(el.dataset.code)}" class="btn-lang-flag" alt="${el.dataset.name}">`;
        countryModal.classList.remove('active');
        countrySearch.value = '';
        render();
      });
    });
  }

  btnLang.addEventListener('click', () => {
    countryModal.classList.add('active');
    renderCountryList();
    setTimeout(() => countrySearch.focus(), 100);
  });

  document.getElementById('countryModalClose').addEventListener('click', () => {
    countryModal.classList.remove('active');
    countrySearch.value = '';
  });

  countryModal.addEventListener('click', (e) => {
    if (e.target === countryModal) {
      countryModal.classList.remove('active');
      countrySearch.value = '';
    }
  });

  countrySearch.addEventListener('input', (e) => {
    renderCountryList(e.target.value);
  });
  // Initialize User State
  updateLoginUI();


  // Android hardware back button handler (Capacitor API)
  function handleBackButton() {
    // Priority: close overlays first, then navigate
    const pdfOverlay = document.getElementById('pdfOverlay');
    if (pdfOverlay) { pdfOverlay.remove(); return; }
    const photoPicker = document.getElementById('photoPickerPopup');
    if (photoPicker && photoPicker.style.display === 'flex') { closePhotoPickerPopup(); return; }
    if (photoPicker && photoPicker.style.display === 'flex') { closePhotoPickerPopup(); return; }
    const loginModal = document.getElementById('loginModal');
    if (loginModal && loginModal.classList.contains('active')) { closeLoginModal(); return; }

    // Navigate back to home or exit
    if (state.page !== 'landing') { navigate('landing'); }
  }
  // Capacitor App plugin back button
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('backButton', () => handleBackButton());
  }
  // Fallback: DOM backbutton event (Cordova-style)
  document.addEventListener('backbutton', (e) => { e.preventDefault(); handleBackButton(); }, false);
  // Fallback: popstate for browser back button
  window.addEventListener('popstate', (e) => { e.preventDefault(); handleBackButton(); });

  render();
});
// ── Settings & Data Backup ──
function saveNickname(val) {
  localStorage.setItem('pb-nickname', val.trim());
  // Update existing feed posts with the new nickname
  DB.feedPosts.forEach(p => { if (p.isOwn) p.user = val.trim() || 'Me'; });
  saveDB('feedPosts');
  if (typeof showToast === 'function') showToast(state.lang === 'ko' ? '닉네임이 저장되었습니다!' : 'Nickname saved!');
  render();
}

function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.add('active');
    const nicknameInput = document.getElementById('nicknameInput');
    if (nicknameInput) nicknameInput.value = localStorage.getItem('pb-nickname') || '';
    // Translate settings modal dynamically
    const h3s = modal.querySelectorAll('.settings-info h3');
    const ps = modal.querySelectorAll('.settings-info p');
    const keys = [
      { h: 'settingsNickname', p: 'settingsNicknameSub' },
      { h: 'settingsBackup', p: 'settingsBackupSub' },
      { h: 'settingsRestore', p: 'settingsRestoreSub' },
      { h: 'settingsReset', p: 'settingsResetSub' },
    ];
    keys.forEach((k, i) => {
      if (h3s[i]) h3s[i].textContent = t(k.h);
      if (ps[i]) ps[i].textContent = t(k.p);
    });
    // Translate title
    const loginHeader = modal.querySelector('.login-header');
    if (loginHeader) {
      const h2 = loginHeader.querySelector('h2');
      const p = loginHeader.querySelector('p');
      if (h2) h2.textContent = t('settingsTitle');
      if (p) p.textContent = t('settingsSub');
    }
    // Translate buttons
    const btns = modal.querySelectorAll('.btn-secondary, .btn-danger');
    const btnKeys = ['settingsExport', 'settingsImport', 'settingsResetBtn'];
    btns.forEach((btn, i) => {
      if (btnKeys[i]) btn.textContent = t(btnKeys[i]);
    });
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.remove('active');
}

function exportData() {
  const data = {
    DB: DB,
    localStorage: {
      'pb-theme': localStorage.getItem('pb-theme'),
      'pb-lang': localStorage.getItem('pb-lang'),
    },
    version: '1.0',
    timestamp: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `poopbuddy_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof showToast === 'function') showToast('Backup downloaded! 💾');
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.DB) {
        // Restore DB
        Object.keys(data.DB).forEach(key => {
          DB[key] = data.DB[key];
          if (key === 'xp' || key === 'activePet') localStorage.setItem('pb-' + key, DB[key]);
          else localStorage.setItem('pb-' + key, JSON.stringify(DB[key]));
        });
      }
      if (data.localStorage) {
        Object.keys(data.localStorage).forEach(key => {
          if (data.localStorage[key]) localStorage.setItem(key, data.localStorage[key]);
        });
      }
      alert('Data restored successfully! The app will reload.');
      location.reload();
    } catch (err) {
      alert('Error restoring data: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
    localStorage.clear();
    location.reload();
  }
}

// Event Listeners for Settings
document.addEventListener('DOMContentLoaded', () => {
  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);

  const settingsClose = document.getElementById('settingsClose');
  if (settingsClose) settingsClose.addEventListener('click', closeSettingsModal);

  // Close modal when clicking outside
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });
  }
});
// ── Cross-Tab Sync & Auto-Save Feedback ──
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('pb-')) {
    console.log('Data changed in another tab, syncing...', e.key);
    // Reload to ensure state is fresh. 
    // In a complex app we might merge state, but reload is safest for this architecture.
    location.reload();
  }
});

// Override saveDB to show feedback (optional, but good for UX)
const originalSaveDB = saveDB;
saveDB = function (key) {
  originalSaveDB(key);
  // Show a subtle auto-save indicator if needed, or rely on the implicit speed.
  // For now, we trust localStorage speed.
};

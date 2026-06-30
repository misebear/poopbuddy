param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Web

$AssetRoot = Join-Path $Root 'store-listing'
$LocaleRoot = Join-Path $AssetRoot 'locales'
$Manifest = Join-Path $Root 'config\play-locales.json'
$PlayConfig = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json

$Locales = @{
  'ko-KR' = @{
    Lang = 'ko'; Title = 'PoopBuddy - 반려동물 배변기록'; Short = 'AI 사진 분석으로 반려동물 장건강 점수와 패턴을 확인하세요';
    Feature = 'AI 반려동물 장건강 체크'; Sub = '사진 분석 · 패턴 추적 · 수의사 리포트';
    Release = "v2.4 글로벌 스토어 개선`n- 프리미엄 의료형 스토어 이미지 갱신`n- 한국어/영어/일본어 대표 등록정보 정리`n- 건강 점수, 캘린더, 수의사 공유 리포트 흐름 강화";
    ShotTitles = @('AI 건강 점수', '사진 한 장으로 분석', '배변 캘린더', '주간 패턴 추적', '수의사 공유 리포트', '멀티펫 프로필', '개인정보 보호', '매일 관리 루틴');
    ShotSubs = @('색상, 형태, 위험 신호를 100점으로 정리', 'Bristol Type과 이상 징후를 빠르게 확인', '날짜별 기록으로 반복 신호를 놓치지 않기', '식단, 시간대, 점수 변화를 한눈에', 'PDF/CSV로 병원 상담 자료 준비', '강아지와 고양이를 따로 관리', '사진은 보호자 중심으로 안전하게 관리', '알림과 기록으로 꾸준한 케어');
  };
  'en-US' = @{
    Lang = 'en'; Title = 'PoopBuddy - Pet Stool Tracker'; Short = 'AI photo analysis for pet gut health scores, patterns, and vet-ready reports';
    Feature = 'AI Pet Gut Health Check'; Sub = 'Photo analysis · Pattern tracking · Vet-ready reports';
    Release = "v2.4 global polish`n- Premium medical-style store visuals`n- Korean, English, and Japanese listing sets`n- Stronger health score, calendar, and vet-report flow";
    ShotTitles = @('AI Health Score', 'Analyze One Photo', 'Stool Calendar', 'Weekly Pattern Tracking', 'Vet-Ready Reports', 'Multi-Pet Profiles', 'Privacy First', 'Daily Care Routine');
    ShotSubs = @('Color, shape, and warning signs summarized as a score', 'See Bristol Type and risk signals in seconds', 'Track repeated signals by day', 'Connect diet, timing, and score changes', 'Export PDF/CSV notes for clinic visits', 'Manage dogs and cats separately', 'Keep sensitive photos under your control', 'Use reminders and history for steady care');
  };
  'ja-JP' = @{
    Lang = 'ja'; Title = 'PoopBuddy - ペット排便記録'; Short = 'AI写真分析でペットの腸健康スコア、パターン、獣医向けレポートを確認';
    Feature = 'AIペット腸健康チェック'; Sub = '写真分析 · パターン追跡 · 獣医共有レポート';
    Release = "v2.4 グローバル改善`n- プレミアム医療系ストア画像に刷新`n- 韓国語・英語・日本語の登録情報を整理`n- 健康スコア、カレンダー、獣医レポート導線を強化";
    ShotTitles = @('AI健康スコア', '写真1枚で分析', '排便カレンダー', '週間パターン追跡', '獣医共有レポート', 'マルチペット', 'プライバシー重視', '毎日のケアルーチン');
    ShotSubs = @('色、形、注意サインを100点で整理', 'Bristol Typeとリスクをすばやく確認', '日別記録で変化を見逃さない', '食事、時間帯、スコア変化を確認', 'PDF/CSVで通院相談に備える', '犬と猫を別々に管理', '大切な写真を安全に扱う', '通知と履歴で継続ケア');
  };
}

function New-Dir([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

function New-Brush([string]$Hex) {
  return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($Hex))
}

function New-Pen([string]$Hex, [float]$Width = 1) {
  return [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($Hex), $Width)
}

function New-Font([float]$Size, [int]$Style = 0) {
  $font = [System.Drawing.Font]::new('Malgun Gothic', $Size, [System.Drawing.FontStyle]$Style, [System.Drawing.GraphicsUnit]::Pixel)
  return $font
}

function Add-RoundRect($Graphics, [float]$X, [float]$Y, [float]$W, [float]$H, [float]$R, $Brush, $Pen = $null) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $R * 2
  $path.AddArc($X, $Y, $d, $d, 180, 90)
  $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
  $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
  $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  if ($Brush) { $Graphics.FillPath($Brush, $path) }
  if ($Pen) { $Graphics.DrawPath($Pen, $path) }
  $path.Dispose()
}

function Add-Text($Graphics, [string]$Text, [float]$X, [float]$Y, [float]$W, [float]$H, [float]$Size, [string]$Color, [int]$Style = 0, [string]$Align = 'Near') {
  $font = New-Font $Size $Style
  $brush = New-Brush $Color
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::$Align
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $format.FormatFlags = 0
  $Graphics.DrawString($Text, $font, $brush, [System.Drawing.RectangleF]::new($X, $Y, $W, $H), $format)
  $format.Dispose(); $brush.Dispose(); $font.Dispose()
}

function Add-PhoneMock($Graphics, [float]$X, [float]$Y, [float]$W, [float]$H, $Locale, [int]$ScreenIndex) {
  Add-RoundRect $Graphics $X $Y $W $H 36 (New-Brush '#111827') $null
  Add-RoundRect $Graphics ($X + 12) ($Y + 12) ($W - 24) ($H - 24) 28 (New-Brush '#F8FBF7') $null
  Add-RoundRect $Graphics ($X + $W / 2 - 36) ($Y + 22) 72 16 8 (New-Brush '#111827') $null
  Add-Text $Graphics 'PoopBuddy' ($X + 38) ($Y + 54) ($W - 76) 30 14 '#143A2D' 1 'Center'
  Add-RoundRect $Graphics ($X + 34) ($Y + 95) ($W - 68) 92 18 (New-Brush '#FFFFFF') (New-Pen '#E3E8E4' 1)
  Add-Text $Graphics ($Locale.ShotTitles[$ScreenIndex]) ($X + 52) ($Y + 114) ($W - 104) 24 14 '#2F7D63' 1
  Add-Text $Graphics '86/100' ($X + 54) ($Y + 140) 110 36 30 '#143A2D' 1
  $barBg = New-Brush '#E5EFE9'; $barFg = New-Brush '#2F7D63'
  Add-RoundRect $Graphics ($X + 52) ($Y + 178) ($W - 104) 10 5 $barBg $null
  Add-RoundRect $Graphics ($X + 52) ($Y + 178) (($W - 104) * 0.86) 10 5 $barFg $null
  Add-RoundRect $Graphics ($X + 34) ($Y + 212) ($W - 68) 76 16 (New-Brush '#FFFFFF') (New-Pen '#E3E8E4' 1)
  Add-Text $Graphics 'Bristol Type 4' ($X + 52) ($Y + 232) 170 24 14 '#27342F' 1
  Add-Text $Graphics 'Normal · No visible risk' ($X + 52) ($Y + 258) 210 24 12 '#64746C'
  Add-RoundRect $Graphics ($X + 34) ($Y + 310) ($W - 68) 76 16 (New-Brush '#FFFFFF') (New-Pen '#E3E8E4' 1)
  Add-Text $Graphics 'Pattern tracking' ($X + 52) ($Y + 330) 180 24 14 '#27342F' 1
  Add-Text $Graphics '7-day trend is stable' ($X + 52) ($Y + 356) 210 24 12 '#64746C'
  for ($i = 0; $i -lt 7; $i++) {
    $h = 18 + (($i * 9 + $ScreenIndex * 7) % 42)
    $bx = $X + 48 + ($i * (($W - 110) / 7))
    Add-RoundRect $Graphics $bx ($Y + 438 - $h) 14 $h 7 (New-Brush '#77B89D') $null
  }
  Add-Text $Graphics 'Photo · Calendar · Report' ($X + 38) ($Y + $H - 64) ($W - 76) 22 11 '#7A8880' 0 'Center'
}

function New-FeatureGraphic($LocaleKey, $Locale) {
  $outDir = Join-Path $LocaleRoot $LocaleKey
  New-Dir $outDir
  $bmp = [System.Drawing.Bitmap]::new(1024, 500)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#F6FAF7'))
  $lg = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Rectangle]::new(0,0,1024,500), [System.Drawing.ColorTranslator]::FromHtml('#FFFFFF'), [System.Drawing.ColorTranslator]::FromHtml('#DDEFE7'), 0)
  $g.FillRectangle($lg, 0, 0, 1024, 500); $lg.Dispose()
  Add-RoundRect $g 48 56 66 66 18 (New-Brush '#2F7D63') $null
  Add-Text $g 'PB' 48 72 66 30 20 '#FFFFFF' 1 'Center'
  Add-Text $g 'PoopBuddy' 132 56 300 48 30 '#123529' 1
  Add-Text $g $Locale.Feature 52 142 520 126 48 '#123529' 1
  Add-Text $g $Locale.Sub 56 278 520 40 23 '#4B5C54'
  $labels = @($Locale.ShotTitles[1], $Locale.ShotTitles[3], $Locale.ShotTitles[4])
  for ($i = 0; $i -lt 3; $i++) {
    $x = 56 + $i * 154
    Add-RoundRect $g $x 350 116 72 20 (New-Brush '#E8F3EE') $null
    Add-Text $g $labels[$i] ($x + 8) 374 100 24 13 '#2F7D63' 1 'Center'
  }
  Add-PhoneMock $g 646 34 250 430 $Locale 0
  Add-RoundRect $g 560 286 310 76 18 (New-Brush '#FFFFFF') (New-Pen '#D9E4DE' 1)
  Add-Text $g 'AI analysis' 586 300 140 24 15 '#123529' 1
  Add-Text $g 'Color normal · Shape normal · Risk clear' 586 326 250 24 13 '#5A6B63'
  Add-RoundRect $g 580 380 290 70 18 (New-Brush '#FFFFFF') (New-Pen '#D9E4DE' 1)
  Add-Text $g 'Vet-ready PDF' 604 394 150 24 15 '#123529' 1
  Add-Text $g 'Share trends before a clinic visit' 604 420 230 24 13 '#5A6B63'
  $path = Join-Path $outDir 'feature-graphic-1024x500.png'
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

function New-PhoneScreenshot($LocaleKey, $Locale, [int]$Index) {
  $outDir = Join-Path (Join-Path $LocaleRoot $LocaleKey) 'phone-screenshots'
  New-Dir $outDir
  $bmp = [System.Drawing.Bitmap]::new(1080, 1920)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#F5FAF7'))
  $accent = if ($Index % 3 -eq 0) { '#2F7D63' } elseif ($Index % 3 -eq 1) { '#406C8F' } else { '#7A6AA8' }
  Add-Text $g 'PoopBuddy' 72 58 420 54 42 '#123529' 1
  Add-RoundRect $g 762 50 216 72 24 (New-Brush $accent) $null
  Add-Text $g 'v2.4' 762 66 216 32 26 '#FFFFFF' 1 'Center'
  Add-Text $g $Locale.ShotTitles[$Index] 72 188 880 116 66 '#123529' 1
  Add-Text $g $Locale.ShotSubs[$Index] 76 326 860 76 31 '#4D5F56'
  Add-RoundRect $g 88 460 904 1180 42 (New-Brush '#FFFFFF') (New-Pen '#DAE6DF' 2)
  Add-PhoneMock $g 220 530 640 970 $Locale $Index
  Add-RoundRect $g 104 1672 872 108 30 (New-Brush '#E8F3EE') $null
  Add-Text $g $Locale.Short 146 1700 788 52 29 '#245C49' 1 'Center'
  $path = Join-Path $outDir ("screenshot-{0:D2}.png" -f ($Index + 1))
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

function Write-Listing($LocaleKey, $Locale) {
  $outDir = Join-Path $LocaleRoot $LocaleKey
  New-Dir $outDir
  $description = @"
# $($Locale.Title)

## Short Description
$($Locale.Short)

## Full Description
PoopBuddy is an AI-assisted pet gut-health tracker for dogs and cats.

Record stool photos, review color and shape signals, follow daily patterns on a calendar, and prepare clear reports for caregiver or veterinarian conversations.

Key features
- AI photo analysis with Bristol Type guidance
- 0-100 gut health score
- Calendar and weekly trend tracking
- Vet-ready PDF/CSV report flow
- Multi-pet profile support
- Privacy-first local record management

PoopBuddy is for wellness reference only and does not replace veterinary diagnosis or treatment. If warning signs repeat or symptoms look serious, consult a veterinarian.

## Release Notes
$($Locale.Release)
"@
  Set-Content -LiteralPath (Join-Path $outDir 'STORE_LISTING.md') -Value $description -Encoding UTF8
}

New-Dir $AssetRoot
New-Dir $LocaleRoot
foreach ($entry in $PlayConfig.locales) {
  $localeKey = $entry.playLocale
  $locale = $Locales[$localeKey]
  New-FeatureGraphic $localeKey $locale
  for ($i = 0; $i -lt 8; $i++) { New-PhoneScreenshot $localeKey $locale $i }
  Write-Listing $localeKey $locale
}

$defaultLocaleDir = Join-Path $LocaleRoot 'ko-KR'
Copy-Item -LiteralPath (Join-Path $defaultLocaleDir 'feature-graphic-1024x500.png') -Destination (Join-Path $AssetRoot 'feature-graphic-1024x500.png') -Force
for ($i = 1; $i -le 8; $i++) {
  Copy-Item -LiteralPath (Join-Path $defaultLocaleDir ("phone-screenshots\screenshot-{0:D2}.png" -f $i)) -Destination (Join-Path $AssetRoot ("screenshot-{0:D1}-{1}.png" -f $i, @('home','analyze','calendar','stats','report','profiles','privacy','routine')[$i-1])) -Force
}

$summary = [ordered]@{
  generatedAt = (Get-Date).ToString('s')
  packageName = $PlayConfig.packageName
  versionCode = $PlayConfig.versionCode
  version = $PlayConfig.version
  locales = $PlayConfig.locales.playLocale
  featureGraphics = @($PlayConfig.locales | ForEach-Object { "store-listing/locales/$($_.playLocale)/feature-graphic-1024x500.png" })
  phoneScreenshotsPerLocale = 8
}
$summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $AssetRoot 'asset-manifest-v2.4.json') -Encoding UTF8
Write-Host "Generated PoopBuddy v2.4 store assets under $AssetRoot"

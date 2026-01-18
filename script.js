const canvasLeft = document.getElementById('canvasLeft');
const ctxLeft = canvasLeft.getContext('2d');
const canvasRight = document.getElementById('canvasRight');
const ctxRight = canvasRight.getContext('2d');
const foundCountSpan = document.getElementById('found-count');
const uiOverlay = document.getElementById('ui-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMessage = document.getElementById('overlay-message');

const img = new Image();
// img.src = 'assets/base_image.png';
// img.src = base64Image; // Moved to end of file to fix race condition

let differences = [];
// Game state
let mistakes = [];
let maxMistakes = 5;
let mistakeCount = 0;
let foundDifferences = 0;
let totalDifferences; // Will be set after generation
let chestClickCount = 0; // Prank counter
let playCount = 0; // Play counter


// Heart System
function initHearts() {
    const container = document.getElementById('heart-container');
    if (!container) return;
    container.innerHTML = ''; // Clear existing
    for (let i = 0; i < maxMistakes; i++) {
        const heart = document.createElement('span');
        heart.className = 'heart-icon';
        heart.innerHTML = '❤️'; // Red heart emoji
        container.appendChild(heart);
    }
}

// Chest Interaction Region (Guessing coordinates based on description)
// Chest Interaction Region (Bottom Center - Expanded)
// Updated to be ABOVE navel (Moved down 50px: 0.40 -> 0.46)
// Expanded: Left +10px (~0.015), Right +20px (Total right extension ~0.05) -> x: 0.335, w: 0.365
const chestRegion = { x: 0.335, y: 0.46, w: 0.365, h: 0.20 };

// Sound Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

// --- Randomized Difficulty System ---

// 1. Safe Zones (Approximations based on layout)
// Avoid: Center Character (x: 0.25 - 0.75, y: 0.15 - 0.9)
const ZONES = {
    SKY: { xMin: 0.05, xMax: 0.95, yMin: 0.05, yMax: 0.2 },
    WATER_LEFT: { xMin: 0.05, xMax: 0.25, yMin: 0.3, yMax: 0.5 },
    WATER_RIGHT: { xMin: 0.75, xMax: 0.95, yMin: 0.3, yMax: 0.6 },
    SAND_BOTTOM: { xMin: 0.05, xMax: 0.95, yMin: 0.85, yMax: 0.95 },
    TREE_LEFT: { xMin: 0.05, xMax: 0.25, yMin: 0.05, yMax: 0.4 }, // Palm tree area
};

// 2. Generators by IQ Level
// Returns a single difference config object
function generateDiff(iq) {
    const seed = Math.random();

    // IQ 100: Obvious / Larger Shapes - BLENDED SLIGHTLY
    if (iq === 100) {
        // Options: Large Pebble, Cloud, Navel Shadow (Distinct)
        const type = Math.floor(Math.random() * 3);
        if (type === 0) { // Large Pebble in Sand
            return {
                name: 'pebble_large',
                x: rnd(ZONES.SAND_BOTTOM.xMin, ZONES.SAND_BOTTOM.xMax),
                y: rnd(ZONES.SAND_BOTTOM.yMin, ZONES.SAND_BOTTOM.yMax),
                r: 0.015, type: 'circle', color: 'rgba(139, 69, 19, 0.8)', iq: 100 // Reduced opacity
            };
        } else if (type === 1) { // Cloud Patch
            return {
                name: 'cloud_patch',
                x: rnd(ZONES.SKY.xMin, ZONES.SKY.xMax),
                y: rnd(ZONES.SKY.yMin, ZONES.SKY.yMax),
                w: 0.08, h: 0.04, type: 'ellipse', color: 'rgba(255,255,255,0.4)', iq: 100 // Reduced opacity
            };
        } else { // Navel Shade (Fixed loc, randomized opacity)
            return { name: 'navel_shade_deep', x: 0.49, y: 0.82, r: 0.012, type: 'circle', color: 'rgba(0, 0, 0, 0.25)', iq: 100 }; // Reduced opacity
        }
    }

    // IQ 110: Palm/Greenery or Medium Objects - BLENDED SLIGHTLY
    else if (iq === 110) {
        const type = Math.floor(Math.random() * 3);
        if (type === 0) { // Leaf Extension
            return {
                name: 'leaf_extend',
                x: rnd(ZONES.TREE_LEFT.xMin, ZONES.TREE_LEFT.xMax),
                y: rnd(ZONES.TREE_LEFT.yMin, ZONES.TREE_LEFT.yMax),
                w: 0.04, h: 0.06, type: 'triangle', color: 'rgba(0, 80, 0, 0.35)', iq: 110
            };
        } else if (type === 1) { // Medium Pebble
            return {
                name: 'pebble_medium',
                x: rnd(ZONES.SAND_BOTTOM.xMin, ZONES.SAND_BOTTOM.xMax),
                y: rnd(ZONES.SAND_BOTTOM.yMin, ZONES.SAND_BOTTOM.yMax),
                r: 0.01, type: 'circle', color: 'rgba(160, 82, 45, 0.6)', iq: 110
            };
        } else { // Shell on beach
            return {
                name: 'sea_shell',
                x: rnd(ZONES.SAND_BOTTOM.xMin, ZONES.SAND_BOTTOM.xMax),
                y: rnd(ZONES.SAND_BOTTOM.yMin, ZONES.SAND_BOTTOM.yMax),
                w: 0.02, h: 0.02, type: 'rect', color: 'rgba(255, 228, 181, 0.6)', iq: 110
            };
        }
    }

    // IQ 120: Small adjustments (Water, Sand) - BLENDING IMPROVED
    else if (iq === 120) {
        const type = Math.floor(Math.random() * 3);
        if (type === 0) { // Small Sand Grain (Lighter opacity to blend)
            return {
                name: 'sand_grain',
                x: rnd(ZONES.SAND_BOTTOM.xMin, ZONES.SAND_BOTTOM.xMax),
                y: rnd(ZONES.SAND_BOTTOM.yMin, ZONES.SAND_BOTTOM.yMax),
                r: 0.006, type: 'circle', color: 'rgba(85, 85, 85, 0.3)', iq: 120
            };
        } else if (type === 1) { // Water Dark Spot (Very subtle blue)
            return {
                name: 'water_spot',
                x: rnd(ZONES.WATER_RIGHT.xMin, ZONES.WATER_RIGHT.xMax),
                y: rnd(ZONES.WATER_RIGHT.yMin, ZONES.WATER_RIGHT.yMax),
                w: 0.04, h: 0.01, type: 'ellipse', color: 'rgba(0,0,50,0.1)', iq: 120
            };
        } else { // Palm Trunk Mark (Brown-ish, low alpha)
            return {
                name: 'palm_mark',
                x: 0.1, y: 0.5 + (Math.random() * 0.2),
                w: 0.01, h: 0.03, type: 'rect', color: 'rgba(60,30,0,0.3)', iq: 120
            };
        }
    }

    // IQ 130: Tiny/Faint (Low Contrast - Tone on Tone) - BLENDING IMPROVED
    else if (iq === 130) {
        const type = Math.floor(Math.random() * 2);
        if (type === 0) { // Water Glint (White on Blue, very transparent)
            return {
                name: 'water_glint',
                x: rnd(ZONES.WATER_RIGHT.xMin, ZONES.WATER_RIGHT.xMax),
                y: rnd(ZONES.WATER_RIGHT.yMin, ZONES.WATER_RIGHT.yMax),
                w: 0.03, h: 0.01, type: 'ellipse', color: 'rgba(255, 255, 255, 0.15)', iq: 130
            };
        } else { // Sky Faint Wisp (White on Blue, barely visible)
            return {
                name: 'sky_wisp',
                x: rnd(ZONES.SKY.xMin, ZONES.SKY.xMax),
                y: rnd(ZONES.SKY.yMin, ZONES.SKY.yMax),
                w: 0.05, h: 0.005, type: 'rect', color: 'rgba(255,255,255,0.1)', iq: 130
            };
        }
    }

    // IQ 140: Microscopic / Blending (No high contrast)
    else { // 140
        const type = Math.floor(Math.random() * 2);
        if (type === 0) { // Hair Strand Light (Brown on Dark Hair - blending)
            return { name: 'hair_strand', x: 0.6, y: 0.15, w: 0.01, h: 0.04, type: 'rect', color: 'rgba(150, 100, 50, 0.3)', iq: 140 };
        } else { // Skin Tone Spot (Slightly darker skin tone on skin) 
            return { name: 'sand_micro_grain', x: rnd(ZONES.SAND_BOTTOM.xMin, ZONES.SAND_BOTTOM.xMax), y: rnd(ZONES.SAND_BOTTOM.yMin, ZONES.SAND_BOTTOM.yMax), r: 0.003, type: 'circle', color: '#c2b280', iq: 140 };
        }
    }
}

function rnd(min, max) {
    return Math.random() * (max - min) + min;
}

function checkCollision(newDiff, existingDiffs) {
    // Simple bounding box/circle overlap check
    // We'll normalize everything to a "box" for simplicity vs mixed circle/rect
    // or use distance for circles. Let's use a unified "center + radius" approximation for simplicity
    // or exact shape check. Given the shapes, Bounding Box overlap is safest and easiest.

    const getBounds = (d) => {
        if (d.type === 'circle') {
            return { x: d.x - d.r, y: d.y - d.r, w: d.r * 2, h: d.r * 2 };
        } else if (d.type === 'ellipse') {
            // approx as rect
            return { x: d.x - d.w, y: d.y - d.h, w: d.w * 2, h: d.h * 2 };
        } else {
            // rect, triangle (approx as rect)
            return { x: d.x, y: d.y, w: d.w, h: d.h };
        }
    };

    const b1 = getBounds(newDiff);
    // Add some padding to Ensure meaningful separation
    const PADDING = 0.05; // 5% of screen padding
    b1.x -= PADDING / 2;
    b1.y -= PADDING / 2;
    b1.w += PADDING;
    b1.h += PADDING;

    for (let existing of existingDiffs) {
        const b2 = getBounds(existing);

        // AABB Collision
        if (b1.x < b2.x + b2.w &&
            b1.x + b1.w > b2.x &&
            b1.y < b2.y + b2.h &&
            b1.y + b1.h > b2.y) {
            return true; // Collision
        }
    }
    return false;
}

// Start Loading
if (typeof base64Image !== 'undefined') {
    img.onload = () => {
        // Generate Random Diffs
        generateGameContent();

        // Set canvas size to match image
        canvasLeft.width = img.width;
        canvasLeft.height = img.height;
        canvasRight.width = img.width;
        canvasRight.height = img.height;

        ctxLeft.drawImage(img, 0, 0);
        ctxRight.drawImage(img, 0, 0);

        applyDifferences();

        // Only Setup Listener for RIGHT canvas (User Rule: Left Ignore)
        canvasRight.addEventListener('click', handleClick);

        // Setup Hint Listener
        const mistakeHeader = document.getElementById('mistake-header');
        if (mistakeHeader) {
            mistakeHeader.style.cursor = 'pointer';
            mistakeHeader.title = "ヒントを表示 (残り1つの時のみ)";
            mistakeHeader.addEventListener('click', showHint);
        }

        // Setup Version/Credit Listener
        const correctHeader = document.getElementById('correct-header');
        if (correctHeader) {
            correctHeader.style.cursor = 'pointer';
            correctHeader.addEventListener('click', showVersionInfo);
        }

        // Init Hearts
        initHearts();

        // Debug success (User requested confirmation)
        // alert("画像の読み込みに成功しました"); // Commented out to avoid annoyance after fix, can enable if needed
        console.log("Image loaded successfully:", img.width, "x", img.height);
    };

    img.onerror = (e) => {
        console.error("Image failed to load:", e);
        alert("画像の読み込みに失敗しました。再読み込みしてください。");
    };

    img.src = base64Image;
} else {
    alert("画像データが見つかりません (imageData.js error)");
}

function showHint() {
    // Condition: Only if 1 difference left
    // Condition: Only if 1 difference left
    if (totalDifferences - foundDifferences > 1) {
        // User Request: No message if > 1 remaining
        return;
    }
    if (totalDifferences - foundDifferences !== 1) return;

    // Find the missing one in the ACTIVE differences array
    const missingDiff = differences.find(d => !d.found);
    if (!missingDiff) return;

    // Calculate Center Point
    let cx, cy;
    if (missingDiff.type === 'circle') {
        cx = missingDiff.x; cy = missingDiff.y;
    } else {
        cx = missingDiff.x + (missingDiff.w || 0) / 2;
        cy = missingDiff.y + (missingDiff.h || 0) / 2;
    }

    // Calculate 16-Grid Position (4x4)
    // x, y are 0.0 to 1.0
    // col = 0..3, row = 0..3
    const col = Math.floor(cx * 4);
    const row = Math.floor(cy * 4);

    // Clamp to ensure 0-3 range (in case of 1.0 edge case)
    const validCol = Math.min(Math.max(col, 0), 3);
    const validRow = Math.min(Math.max(row, 0), 3);

    // Formula: (Row * 4) + Col + 1
    // Row 0: 1, 2, 3, 4
    // Row 3: 13, 14, 15, 16
    const gridNum = (validRow * 4) + validCol + 1;

    showTemporaryMessage(`ヒント: エリア ${gridNum}`);
}

function showVersionInfo() {
    showTemporaryMessage(`バージョン : 1.0.4\n制作 : Belleequipe (M.Furuya)\nプレイ回数 : ${playCount}`, 2000, true);
}

function showTemporaryMessage(text, duration = 2000, isPopup = false) {
    const container = document.querySelector('.game-container');

    // Check if hint already exists
    let hintEl = document.getElementById('hint-display');
    if (!hintEl) {
        hintEl = document.createElement('div');
        hintEl.id = 'hint-display';
        hintEl.style.color = '#e74c3c';
        hintEl.style.fontSize = '24px';
        hintEl.style.fontWeight = 'bold';
        hintEl.style.marginBottom = '10px';
        hintEl.style.fontWeight = 'bold';
        hintEl.style.marginBottom = '10px';
        hintEl.style.textAlign = 'center';
        hintEl.style.whiteSpace = 'pre-line'; // Support \n
        if (container) {
            const header = document.querySelector('.game-header');
            if (header) {
                container.insertBefore(hintEl, header);
            } else {
                container.insertBefore(hintEl, container.firstChild);
            }
        } else {
            container.prepend(hintEl);
        }
    }

    // Toggle Popup Class
    if (isPopup) {
        hintEl.classList.add('popup-message');
    } else {
        hintEl.classList.remove('popup-message');
    }

    hintEl.innerText = text;

    // Clear any existing timeout if we spam click (simple debounce visual)
    if (hintEl.timeoutId) clearTimeout(hintEl.timeoutId);

    hintEl.timeoutId = setTimeout(() => {
        hintEl.innerText = "";
        hintEl.classList.remove('popup-message');
    }, duration);
}

function applyDifferences() {
    // Clear previous differences to avoid duplication/stale data
    differences = [];

    const w = canvasRight.width;
    const h = canvasRight.height;

    diffConfigs.forEach((diff, index) => {
        let diffObj = { ...diff, found: false, id: index };

        ctxRight.fillStyle = diff.color;

        if (diff.type === 'circle') {
            const cx = diff.x * w;
            const cy = diff.y * h;
            const r = diff.r * w;
            ctxRight.beginPath();
            ctxRight.arc(cx, cy, r, 0, Math.PI * 2);
            ctxRight.fill();
            diffObj.cx = cx;
            diffObj.cy = cy;
            diffObj.radius = r;
        } else if (diff.type === 'ellipse') {
            const cx = diff.x * w;
            const cy = diff.y * h;
            const rw = diff.w * w;
            const rh = diff.h * h;
            ctxRight.beginPath();
            ctxRight.ellipse(cx, cy, rw, rh, 0, 0, 2 * Math.PI);
            ctxRight.fill();
            diffObj.rx = cx - rw;
            diffObj.ry = cy - rh;
            diffObj.rw = rw * 2;
            diffObj.rh = rh * 2;
        } else if (diff.type === 'rect') {
            const rx = diff.x * w;
            const ry = diff.y * h;
            const rw = diff.w * w;
            const rh = diff.h * h;
            ctxRight.fillRect(rx, ry, rw, rh);
            diffObj.rx = rx;
            diffObj.ry = ry;
            diffObj.rw = rw;
            diffObj.rh = rh;
        } else if (diff.type === 'triangle') {
            const tx = diff.x * w;
            const ty = diff.y * h;
            const tw = diff.w * w;
            const th = diff.h * h;
            ctxRight.beginPath();
            ctxRight.moveTo(tx, ty);
            ctxRight.lineTo(tx + tw, ty + th / 2);
            ctxRight.lineTo(tx, ty + th);
            ctxRight.fill();
            diffObj.rx = tx;
            diffObj.ry = ty;
            diffObj.rw = tw;
            diffObj.rh = th;
        }

        differences.push(diffObj);
    });
}

function handleClick(e) {
    // Allow clicks on either canvas
    // Allow clicks on right canvas only
    if (e.target.id !== 'canvasRight') return;

    if (mistakeCount >= maxMistakes) return; // Game Over state

    if (!audioCtx) {
        audioCtx = new AudioContext();
    } else if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const rect = e.target.getBoundingClientRect();
    const scaleX = e.target.width / rect.width;
    const scaleY = e.target.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    checkClick(x, y, e.target);
}

function checkClick(x, y, targetCanvas) {
    const w = targetCanvas.width;
    const h = targetCanvas.height;

    // Convert click coordinates to normalized (0-1) ratios
    const xRatio = x / w;
    const yRatio = y / h;

    // 1. Check Differences FIRST (Priority)
    let hit = false;
    let hitDiff = null;

    // Increased tolerance greatly to ensure clickability
    const HIT_TOLERANCE_CIRCLE = 40; // Pixels
    const HIT_PADDING_RECT = 30; // Pixels

    for (let diff of differences) {
        if (diff.found) continue;

        if (diff.type === 'circle') {
            const dist = Math.sqrt((x - diff.cx) ** 2 + (y - diff.cy) ** 2);
            // Check distance against radius + Tolerance
            if (dist < diff.radius + HIT_TOLERANCE_CIRCLE) {
                hit = true;
                hitDiff = diff;
                break;
            }
        } else { // Handles ellipse, rect, and text (treated as rect)
            // Rect/Ellipse/Triangle Bounding Box check with Padding
            if (x >= diff.rx - HIT_PADDING_RECT && x <= diff.rx + diff.rw + HIT_PADDING_RECT &&
                y >= diff.ry - HIT_PADDING_RECT && y <= diff.ry + diff.rh + HIT_PADDING_RECT) {
                hit = true;
                hitDiff = diff;
                break;
            }
        }
    }

    if (hit && hitDiff) {
        playPingPong();
        hitDiff.found = true;
        foundDifferences++;
        foundCountSpan.textContent = foundDifferences;

        drawSuccessMarker(ctxLeft, hitDiff);
        drawSuccessMarker(ctxRight, hitDiff);

        if (foundDifferences === totalDifferences) {
            setTimeout(gameComplete, 1000);
        }
        return; // Success - STOP here. Do not check chest, do not count mistake.
    }

    // Check for chest click (Easter egg)
    const chestClick = (
        xRatio >= chestRegion.x &&
        xRatio <= (chestRegion.x + chestRegion.w) &&
        yRatio >= chestRegion.y &&
        yRatio <= (chestRegion.y + chestRegion.h)
    );

    if (chestClick) {
        // Play "Kya" sound but DO NOT count as mistake
        playKya();
        // Shake only the image clicked? or screen?
        if (targetCanvas === canvasLeft) {
            canvasLeft.classList.add('shake');
            setTimeout(() => canvasLeft.classList.remove('shake'), 500);
        } else {
            canvasRight.classList.add('shake');
            setTimeout(() => canvasRight.classList.remove('shake'), 500);
        }

        // Prank Logic
        chestClickCount++;
        if (chestClickCount >= 10) {
            triggerPrank();
            chestClickCount = 0; // Reset immediately to prevent double fire
        }
        return;
    }
    // 3. Mistake (If neither above)
    // Identify heart to remove (from left, so index = mistakeCount)
    const hearts = document.querySelectorAll('.heart-icon');
    if (hearts[mistakeCount]) {
        hearts[mistakeCount].classList.add('lost');
    }

    mistakeCount++;
    if (mistakeCount >= maxMistakes) {
        triggerGameOver();
    } else {
        playBuzz();
        const container = document.querySelector('.game-container');
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 500);
    }
}

function drawSuccessMarker(ctx, diff) {
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (diff.type === 'circle') {
        ctx.arc(diff.cx, diff.cy, diff.radius + 10, 0, Math.PI * 2);
    } else {
        ctx.rect(diff.rx - 5, diff.ry - 5, diff.rw + 10, diff.rh + 10);
    }
    ctx.stroke();

    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 20px Arial';
    let labelX = (diff.type === 'circle') ? diff.cx : diff.rx;
    let labelY = (diff.type === 'circle') ? diff.cy : diff.ry;
    ctx.fillText("IQ " + diff.iq, labelX, labelY - 10);
}

function playPingPong() {
    // Quiz style Ping-Pong (Two tones: High, then Higher)
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    // Tone 1
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(660, now); // E5
    gain1.gain.setValueAtTime(0.1, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Tone 2
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.2); // A5
    gain2.gain.setValueAtTime(0.1, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.6);
}

function playKya() {
    // "Kya" - High pitched short squeak
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';

    // Pitch: Start High, drop slightly (Lowered from 1200->800)
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.1);

    // Envelope: Fast attack, fast decay
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
}

function playBuzz() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function playOldManVoice() {
    const utterance = new SpeechSynthesisUtterance("ヴァリアントに幸あれ〜え");
    utterance.lang = 'ja-JP';

    // Explicitly try to find a Japanese Male voice
    const voices = window.speechSynthesis.getVoices();
    const maleVoice = voices.find(v =>
        v.lang === 'ja-JP' && (v.name.includes('Male') || v.name.includes('Otoya') || v.name.includes('Hattori'))
    );

    if (maleVoice) {
        utterance.voice = maleVoice;
        utterance.pitch = 0.8; // Natural male pitch
    } else {
        // Fallback: Pitch shift current voice down
        utterance.pitch = 0.4;
    }

    utterance.rate = 0.8;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
}

function splitVoice(text) {
    // Not used, but keeping if needed or can remove.
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    return utterance;
}

function playGameOverMelody() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // Notes: A4, G4, F4, E4, D4
    // A=440, G=392, F=349, E=330, D=293
    // Rhythm: 3:1:3:1:2 (relative)
    // Base unit: 0.15s -> 0.45, 0.15, 0.45, 0.15, 0.3

    // Notes: A3, G3, F3, E3, D3 (Octave down)
    // A3=220, G3=196, F3=174, E3=164, D3=146
    // Rhythm: 3:1:3:1:2 (relative)

    const notes = [
        { freq: 220, dur: 0.45 }, // La (3/4)
        { freq: 196, dur: 0.15 }, // So (1/4)
        { freq: 174, dur: 0.45 }, // Fa (3/4)
        { freq: 164, dur: 0.15 }, // Mi (1/4)
        { freq: 146, dur: 0.6 }  // Re (1/2)
    ];

    let time = now;
    notes.forEach(note => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth'; // Trumpet-ish
        osc.frequency.setValueAtTime(note.freq, time);

        // Envelope: Attack (swell) -> Sustain -> Decay
        gain.gain.setValueAtTime(0.005, time); // Reduced base volume
        gain.gain.linearRampToValueAtTime(0.15, time + 0.05); // Attack (reduced max from 0.3)
        gain.gain.linearRampToValueAtTime(0.1, time + note.dur - 0.05); // Sustain (reduced from 0.2)
        gain.gain.linearRampToValueAtTime(0, time + note.dur); // Release

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(time);
        osc.stop(time + note.dur);

        time += note.dur;
    });
}

function triggerGameOver() {
    playGameOverMelody();
    overlayTitle.textContent = "ゲームオーバー";
    overlayMessage.textContent = "5回間違えました... 残念！";
    uiOverlay.classList.remove('hidden');
}

function triggerPrank() {
    const bloodOverlay = document.getElementById('blood-overlay');
    if (!bloodOverlay) return;

    // Show Blood
    bloodOverlay.classList.remove('hidden');

    let isHidden = false;
    const hideOverlay = () => {
        if (!isHidden) {
            bloodOverlay.classList.add('hidden');
            isHidden = true;
        }
    };

    // Wait 1 second before speech
    setTimeout(() => {
        const u = new SpeechSynthesisUtterance("この〜、エロガッパが！");
        u.lang = 'ja-JP';
        u.pitch = 0.6; // Deeper, scary/disgusted tone
        u.rate = 0.8;

        u.onend = () => {
            // Return to game after speaking
            setTimeout(hideOverlay, 500);
        };

        // Error handling for speech
        u.onerror = () => {
            setTimeout(hideOverlay, 500);
        };

        window.speechSynthesis.speak(u);

        // Fallback: Force hide after 4 seconds (1s wait + ~2-3s speech)
        // This ensures the screen doesn't stay red forever on mobile
        setTimeout(hideOverlay, 4000);

    }, 1000);
}

function playThankYou() {
    // New Voice Creation
    const u = new SpeechSynthesisUtterance("すご〜い、ぜんもん正解だね。だ〜い好き！");
    u.lang = 'ja-JP';
    // Trying a different combination for "freshness"
    u.rate = 1.0;
    u.pitch = 1.2;
    window.speechSynthesis.speak(u);
}

function updatePlayCount() {
    const savedCount = localStorage.getItem('playCount');
    playCount = savedCount ? parseInt(savedCount, 10) : 0;

    // Cap at 1,000,000 as requested
    if (playCount < 1000000) {
        playCount++;
    }

    localStorage.setItem('playCount', playCount);
}

function generateGameContent() {
    // Update play count on generation
    updatePlayCount();

    // Logic extracted from img.onload
    diffConfigs = [];
    const MAX_RETRIES = 50;

    [100, 110, 120, 130, 140].forEach(iq => {
        let diff;
        let retries = 0;
        let valid = false;

        while (!valid && retries < MAX_RETRIES) {
            diff = generateDiff(iq);
            if (!checkCollision(diff, diffConfigs)) {
                valid = true;
            }
            retries++;
        }

        if (valid) {
            diffConfigs.push(diff);
        } else {
            diffConfigs.push(diff);
        }
    });
    totalDifferences = diffConfigs.length;
    applyDifferences();
}

function gameComplete() {
    uiOverlay.classList.remove('hidden');
    //const uiOverlay = document.getElementById('ui-overlay');
    playThankYou();
}

function resetGame() {
    // Hide Overlay
    uiOverlay.classList.add('hidden');

    // Reset Counters
    foundDifferences = 0;
    mistakeCount = 0;
    foundCountSpan.textContent = "0";
    chestClickCount = 0; // Reset prank counter too

    // Reset Visuals
    ctxLeft.drawImage(img, 0, 0);
    ctxRight.drawImage(img, 0, 0);

    // Clear any existing Prank overlays if active
    const bloodOverlay = document.getElementById('blood-overlay');
    if (bloodOverlay) bloodOverlay.classList.add('hidden');

    // Reset Hearts
    initHearts();

    // Regenerate Content
    generateGameContent();

    // Resume Audio if needed
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function goToTitle() {
    // Hide Overlay & Game Container
    uiOverlay.classList.add('hidden');
    document.querySelector('.game-container').classList.add('hidden');

    // Show Start Screen
    document.getElementById('start-screen').classList.remove('hidden');

    // Optional: Reset game state in background so it's fresh if they click Start again
    // But allow Start button logic to handle init if possible. 
    // For safety, we can just leave it as is, or call resetGame() silently.
    // Let's call resetGame() to ensure clean state for next run.
    resetGame();
    // Note: resetGame removes 'hidden' from uiOverlay? No, it adds 'hidden'. Good.
}



// --- Start Screen Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    const startBtn = document.getElementById('start-btn');
    const exitBtn = document.getElementById('exit-btn');
    const gameContainer = document.querySelector('.game-container');

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            startScreen.classList.add('hidden');
            gameContainer.classList.remove('hidden');

            // Optional: Resume audio if suspended (browsers block audio until user interaction)
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        });
    }

    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            // Attempt to close
            window.close();
            // Show message if close fails
            alert('ブラウザの「閉じる」ボタンで終了してください。');
        });
    }

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', resetGame);
    }

    const gameOverExitBtn = document.getElementById('game-over-exit-btn');
    if (gameOverExitBtn) {
        gameOverExitBtn.addEventListener('click', goToTitle);
    }


});

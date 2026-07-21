// js/sketch.js

let imageGlobalScale = 1.0; 
let boxes = [];              

let offsetX = 0;             
let isDraggingSpace = false; 
let dragStartX = 0;          
let preDragOffsetX = 0;      
let virtualWidth = 5000;     
let lastFrameTime = 0;       

// 🌿 [잔디 관련 기능 보관 주석]
/*
let spawnRadiusX = 150;      
let spawnRadiusY = 80;       
let minSproutSize = 10;      
let maxSproutSize = 30;      
let growthSpeed = 0.08;      
let sprouts = [];            
*/

let house;
let pebble;

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('canvas-container');
    lastFrameTime = millis();

    house = new HouseChar(width / 2, height / 2 + 50, 0.7);
    pebble = new PebbleChar(width / 2 + 350, height / 2 + 50, 0.85);

    window.receiveExternalImage = function(dataUrl, rawW, rawH, captionText) {
        loadImage(dataUrl, (p5Img) => {
            let baseDim = 350 * imageGlobalScale;
            let finalW = baseDim; let finalH = baseDim;
            if (rawW > rawH) { finalH = baseDim * (rawH / rawW); } 
            else { finalW = baseDim * (rawW / rawH); }

            let nextX = random(200, 400) - offsetX; 
            if (boxes.length > 0) {
                let lastBox = boxes[boxes.length - 1];
                nextX = lastBox.rawX + lastBox.w + random(-50, 200);
            }
            if (nextX > virtualWidth - finalW - 200) { virtualWidth += 600; }
            let nextY = random(120, height - finalH - 150);

            boxes.push({
                rawX: nextX, x: nextX, y: nextY, w: finalW, h: finalH,
                cx: nextX + finalW / 2, cy: nextY + finalH / 2,
                scrollFactor: random(0.6, 1.2), img: p5Img, caption: captionText 
            });
        });
    };

    const popup = document.getElementById('speech-popup');
    const closeBtn = document.getElementById('popup-close-btn');
    if (popup && closeBtn) {
        closeBtn.addEventListener('click', () => { popup.classList.add('hidden'); });
    }
}

function draw() {
    background(255); 

    let isOverUI = mouseX < 340 && mouseY > height - 220; 
    let currentTime = millis();
    let dt = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // 🌿 [잔디 관련 기능 보관 주석] 새싹 타이머 업데이트
    /*
    for (let i = sprouts.length - 1; i >= 0; i--) {
        sprouts[i].update(); 
        if (currentTime - sprouts[i].spawnTime > 20000) { sprouts.splice(i, 1); }
    }
    */

    // 화면 무한 드래그 (조약돌 잡는 중이 아닐 때만 적용)
    if (mouseIsPressed && !isOverUI && !pebble.isDragging) {
        if (!isDraggingSpace) {
            isDraggingSpace = true;
            dragStartX = mouseX; preDragOffsetX = offsetX;
        }
        let deltaX = mouseX - dragStartX;
        offsetX = constrain(preDragOffsetX + deltaX, -(virtualWidth - width), 0);
        let currentDeltaX = offsetX - preDragOffsetX;
        
        house.applyDrag(currentDeltaX);
        preDragOffsetX = offsetX; dragStartX = mouseX;
    } else { isDraggingSpace = false; }

    for (let b of boxes) {
        b.x = b.rawX + offsetX * b.scrollFactor; 
        b.cx = b.x + b.w / 2; b.cy = b.y + b.h / 2;
    }

    let popup = document.getElementById('speech-popup');
    let isHousePopupOpen = popup && !popup.classList.contains('hidden');

    // 캐릭터 업데이트 (pebble에 boxes 정보 전달하여 가림 감지)
    house.update(mouseX, mouseY, isOverUI, isHousePopupOpen, boxes, dt, currentTime);
    pebble.update(mouseX, mouseY, offsetX, boxes);

    // Depth Sorting 렌더 큐
    let renderQueue = [];

    // 박스 추가
    for (let b of boxes) {
        renderQueue.push({
            y: b.y + b.h / 2,
            render: () => {
                push(); noStroke(); 
                if (b.img) { image(b.img, b.x, b.y, b.w, b.h); }
                fill(0, 40); ellipse(b.cx, b.cy, 8, 8); 
                if (b.caption && b.caption.trim() !== "") {
                    fill(51, 51, 51); noStroke(); textSize(13); textAlign(RIGHT, TOP);
                    text(b.caption, b.x + b.w, b.y + b.h + 8); 
                }
                pop();
            }
        });
    }

    // 🌿 [잔디 관련 기능 보관 주석] 새싹 렌더 큐 추가
    // for (let spr of sprouts) { renderQueue.push({ y: spr.y, render: () => { spr.display(); } }); }

    // 캐릭터 렌더 큐 병합 (돌은 y = -99999로 설정되어 있어 이미지보다 무조건 아래 그려집니다)
    renderQueue = renderQueue.concat(house.getRenderItems());
    renderQueue = renderQueue.concat(pebble.getRenderItems());

    // Y축 깊이 정렬 후 순서대로 출력
    renderQueue = renderQueue.filter(item => !isNaN(item.y) && isFinite(item.y));
    renderQueue.sort((a, b) => a.y - b.y);
    for (let item of renderQueue) { item.render(); }

    // 최상단 말풍선 및 가림 감지 '!' 표시 렌더링
    house.drawTopLayer(mouseX, mouseY);
    pebble.drawTopLayer(mouseX, mouseY);
}

function mousePressed() {
    // 1. 조약돌 클릭 감지 (드래그 시작 / 모달 / 가림 '!' 클릭)
    if (pebble.checkPress(mouseX, mouseY)) {
        return false;
    }

    // 2. 집 캐릭터 말풍선 클릭 감지
    if (house.checkBubbleClick(mouseX, mouseY)) {
        let popup = document.getElementById('speech-popup');
        if (popup) popup.classList.remove('hidden');
        return false;
    }

    // 🌿 [잔디 관련 기능 보관 주석] 클릭 시 새싹 스폰
    /*
    let isOverUI = mouseX < 340 && mouseY > height - 220;
    if (!isOverUI) {
        for (let i = 0; i < floor(random(1, 4)); i++) { 
            spawnSprout(house.cx + house.spawnOffsetX, house.cy + house.spawnOffsetY); 
        }
    }
    */
}

function mouseReleased() {
    pebble.checkRelease();
}

// 🌿 [잔디 관련 기능 보관 주석] Sprout 클래스
/*
function spawnSprout(baseX, baseY) {
    let r = random(0, 1); let theta = random(0, TWO_PI);
    let x = baseX + spawnRadiusX * r * cos(theta); let y = baseY + spawnRadiusY * r * sin(theta);
    sprouts.push(new Sprout(x, y, random(minSproutSize, maxSproutSize) * house.charScale));
}

class Sprout {
    constructor(x, y, targetSize) {
        this.x = x; this.y = y; this.targetSize = targetSize; this.currentSize = 0;
        this.spawnTime = millis(); this.type = floor(random(0, 3)); this.rot = random(-0.2, 0.2);
    }
    update() { if (this.currentSize < this.targetSize) this.currentSize += growthSpeed * (this.targetSize - this.currentSize); }
    display() {
        push(); translate(this.x, this.y); rotate(this.rot); stroke(0); strokeWeight(1.5 * house.charScale); fill(255); 
        if (this.type === 0) { beginShape(); vertex(0, 0); bezierVertex(-this.currentSize*0.3, -this.currentSize*0.5, -this.currentSize*0.3, -this.currentSize, 0, -this.currentSize); bezierVertex(this.currentSize*0.3, -this.currentSize, this.currentSize*0.3, -this.currentSize*0.5, 0, 0); endShape(CLOSE); } 
        else if (this.type === 1) { beginShape(); vertex(0, 0); bezierVertex(-this.currentSize*0.4, -this.currentSize*0.4, -this.currentSize*0.5, -this.currentSize*0.8, -this.currentSize*0.3, -this.currentSize*0.9); bezierVertex(-this.currentSize*0.2, -this.currentSize*0.6, -this.currentSize*0.1, -this.currentSize*0.3, 0, 0); endShape(CLOSE); beginShape(); vertex(0, 0); bezierVertex(this.currentSize*0.4, -this.currentSize*0.4, this.currentSize*0.5, -this.currentSize*0.8, this.currentSize*0.3, -this.currentSize*0.9); bezierVertex(this.currentSize*0.2, -this.currentSize*0.6, this.currentSize*0.1, -this.currentSize*0.3, 0, 0); endShape(CLOSE); } 
        else { line(0, 0, 0, -this.currentSize); line(0, 0, -this.currentSize*0.4, -this.currentSize*0.8); line(0, 0, this.currentSize*0.4, -this.currentSize*0.8); }
        pop();
    }
}
*/

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
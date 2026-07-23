// js/sketch.js

let imageGlobalScale = 1.0; 
let boxes = [];              

let offsetX = 0;             
let isDraggingSpace = false; 
let dragStartX = 0;          
let preDragOffsetX = 0;      
let virtualWidth = 5000;     
let lastFrameTime = 0;       

// 🚀 관성(가속도)을 위한 속도 변수 추가
let velocityX = 0;           

let house;
let pebble;
let flipbooks = [];

let clickStartX = 0;
let clickStartY = 0;

// 🔭 스크롤 줌 & 스프링 탄력 변수
let zoomLevel = 1.0;
let targetZoom = 1.0;

function setup() {
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('canvas-container');
    lastFrameTime = millis();

    house = new HouseChar(width / 2, height / 2 + 50, 0.7);
    pebble = new PebbleChar(width / 2 + 350, height / 2 + 50, 0.85);

    // 1. 플립북 데이터(JSON) 로드
    fetch('data/flipbook.json')
        .then(response => response.json())
        .then(data => {
            data.forEach((item) => {
                let fb = new Flipbook(item.x, item.y, 1.2); 
                fb.loadFrames(item.frames);
                
                fb.srcPath = item.frames[0]; 
                fb.caption = item.caption || ""; 
                fb.detailCaption = item.detailCaption || "상세 설명이 없습니다.";
                flipbooks.push(fb); 
                
                if (item.x > virtualWidth - 1000) virtualWidth = item.x + 1500;
            });
        })
        .catch(err => console.error("플립북 연동 실패:", err));

    // 2. 일반 사진 및 캡션 데이터(JSON) 로드
    fetch('data/content.json')
        .then(response => response.json())
        .then(data => {
            data.forEach(item => {
                loadImage(item.imagePath, (p5Img) => {
                    let baseDim = 350 * imageGlobalScale;
                    let finalW = baseDim; let finalH = baseDim;
                    let rawW = p5Img.width; let rawH = p5Img.height;
                    
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
                        scrollFactor: random(0.6, 1.2), 
                        img: p5Img, 
                        caption: item.caption || "",
                        detailCaption: item.detailCaption || "상세 설명이 없습니다.",
                        srcPath: item.imagePath
                    });
                });
            });
        })
        .catch(err => console.error("데이터 연동 실패:", err));

    const popup = document.getElementById('speech-popup');
    const closeBtn = document.getElementById('popup-close-btn');
    if (popup && closeBtn) {
        closeBtn.addEventListener('click', () => { popup.classList.add('hidden'); });
    }
}

// 🔭 마우스 휠 스크롤 시 줌아웃 트리거
function mouseWheel(event) {
    let detailModal = document.getElementById('image-detail-modal');
    let guestbookModal = document.getElementById('guestbookPopup');
    if ((detailModal && detailModal.style.display === 'flex') || 
        (guestbookModal && guestbookModal.style.display === 'flex')) {
        return;
    }

    // 💡 [축소 범위 조절]: 아래의 '0.78' 숫자를 더 낮추면(예: 0.5) 더 많이 축소됩니다!
    targetZoom -= event.delta * 0.0008;
    targetZoom = constrain(targetZoom, 0.1, 1.0);
    return false; 
}

function draw() {
    background(255); 

    let currentTime = millis();
    let dt = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // 스프링 물리: 휠 동작이 멈추면 원래 크기로 복귀
    targetZoom = lerp(targetZoom, 1.0, 0.08);
    zoomLevel = lerp(zoomLevel, targetZoom, 0.3);

    // 🌫️ 화이트 헤이즈 오버레이 투명도 동기화 (최소 줌 제한인 0.78과 연동)
    let hazeEl = document.getElementById('haze-overlay');
    if (hazeEl) {
        let hazeVal = map(zoomLevel, 1.0, 0.1, 0, 0.92);
        hazeEl.style.opacity = hazeVal;
    }

    let detailModal = document.getElementById('image-detail-modal');
    let guestbookModal = document.getElementById('guestbookPopup');
    let isDetailModalOpen = detailModal && detailModal.style.display === 'flex';
    let isGuestbookOpen = guestbookModal && guestbookModal.style.display === 'flex';
    let isOverUI = isDetailModalOpen || isGuestbookOpen;

    // 🚀 [관성 드래그 물리 로직]
    let oldOffsetX = offsetX;

    if (mouseIsPressed && !isOverUI && !pebble.isDragging && abs(zoomLevel - 1.0) < 0.01) {
        if (!isDraggingSpace) {
            isDraggingSpace = true;
            dragStartX = mouseX; 
            preDragOffsetX = offsetX;
            velocityX = 0; // 드래그 시작 시 기존 관성 초기화
        }
        let targetOffset = preDragOffsetX + (mouseX - dragStartX);
        
        // 마우스를 따라가며 실시간 속도를 누적 (관성 생성)
        velocityX = (targetOffset - offsetX) * 0.6; 
        offsetX = targetOffset;
        offsetX = constrain(offsetX, -(virtualWidth - width), 0);
    } else { 
        isDraggingSpace = false;
        
        // 마우스를 떼었을 때 미끄러지는 관성(가속도) 적용
        if (abs(velocityX) > 0.05) {
            offsetX += velocityX;
            // 💡 [마찰력 조절]: 0.88 숫자를 0.95에 가깝게 키우면 마찰력이 줄어들어 더 멀리, 오래 미끄러집니다!
            velocityX *= 0.93; 
            offsetX = constrain(offsetX, -(virtualWidth - width), 0);
        }
    }

    let currentDeltaX = offsetX - oldOffsetX;
    if (abs(currentDeltaX) > 0.001) {
        house.applyDrag(currentDeltaX);
    }

    for (let b of boxes) {
        b.x = b.rawX + offsetX * b.scrollFactor; 
        b.cx = b.x + b.w / 2; b.cy = b.y + b.h / 2;
    }

    // 축소 상태를 고려한 가상의 월드 마우스 좌표 계산
    let worldMouseX = (mouseX - width / 2) / zoomLevel + width / 2;
    let worldMouseY = (mouseY - height / 2) / zoomLevel + height / 2;

    for (let fb of flipbooks) {
        fb.update(worldMouseX, offsetX);
    }

    let allObstacles = [...boxes];
    for (let fb of flipbooks) {
        let fbBox = fb.getCollisionBox(offsetX);
        if (fbBox) allObstacles.push(fbBox);
    }

    let popup = document.getElementById('speech-popup');
    let isHousePopupOpen = popup && !popup.classList.contains('hidden');

    house.update(worldMouseX, worldMouseY, isOverUI, isHousePopupOpen, allObstacles, dt, currentTime);
    pebble.update(worldMouseX, worldMouseY, offsetX, allObstacles);

    // ==========================================
    // 🏛️ 화면 전체 줌 및 공간감 적용 영역 시작
    // ==========================================
    push();
    translate(width / 2, height / 2);
    scale(zoomLevel);
    translate(-width / 2, -height / 2);

    let renderQueue = [];

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

    for (let fb of flipbooks) {
        renderQueue = renderQueue.concat(fb.getRenderItems(offsetX));
    }

    renderQueue = renderQueue.concat(house.getRenderItems());
    renderQueue = renderQueue.concat(pebble.getRenderItems());

    renderQueue = renderQueue.filter(item => !isNaN(item.y) && isFinite(item.y));
    renderQueue.sort((a, b) => a.y - b.y);
    for (let item of renderQueue) { item.render(); }

    house.drawTopLayer(worldMouseX, worldMouseY);
    pebble.drawTopLayer(worldMouseX, worldMouseY);

    pop();
    // ==========================================
    // 🏛️ 줌 영역 끝
    // ==========================================

    // 커스텀 커서 호버 판정
    if (!isOverUI) {
        let isHoveringSomething = false;

        if (house && typeof house.checkBubbleClick === 'function') {
            if (house.checkBubbleClick(worldMouseX, worldMouseY)) {
                isHoveringSomething = true;
            }
        }

        if (pebble && pebble.x !== undefined && pebble.y !== undefined) {
            if (dist(worldMouseX, worldMouseY, pebble.x, pebble.y) < 45) {
                isHoveringSomething = true;
            }
        }

        for (let item of allObstacles) {
            if (worldMouseX >= item.x && worldMouseX <= item.x + item.w &&
                worldMouseY >= item.y && worldMouseY <= item.y + item.h) {
                isHoveringSomething = true;
                break;
            }
        }

        if (typeof window.setCursorHover === 'function') {
            window.setCursorHover(isHoveringSomething);
        }
    }
}

function mousePressed() {
    let detailModal = document.getElementById('image-detail-modal');
    if (detailModal && detailModal.style.display === 'flex') return;

    clickStartX = mouseX;
    clickStartY = mouseY;

    let worldMouseX = (mouseX - width / 2) / zoomLevel + width / 2;
    let worldMouseY = (mouseY - height / 2) / zoomLevel + height / 2;

    if (pebble.checkPress(worldMouseX, worldMouseY)) return false;
    if (house.checkBubbleClick(worldMouseX, worldMouseY)) {
        let popup = document.getElementById('speech-popup');
        if (popup) popup.classList.remove('hidden');
        return false;
    }
}

function mouseReleased() { 
    let detailModal = document.getElementById('image-detail-modal');
    if (detailModal && detailModal.style.display === 'flex') return;

    pebble.checkRelease(); 

    if (dist(clickStartX, clickStartY, mouseX, mouseY) < 5) {
        let worldMouseX = (mouseX - width / 2) / zoomLevel + width / 2;
        let worldMouseY = (mouseY - height / 2) / zoomLevel + height / 2;

        let clickableItems = [];
        
        for (let b of boxes) {
            clickableItems.push({
                x: b.x, y: b.y, w: b.w, h: b.h, depthY: b.y + b.h / 2,
                srcPath: b.srcPath, detailCaption: b.detailCaption
            });
        }
        
        for (let fb of flipbooks) {
            let fbBox = fb.getCollisionBox(offsetX);
            if (fbBox) {
                clickableItems.push({
                    x: fbBox.x, y: fbBox.y, w: fbBox.w, h: fbBox.h, depthY: fbBox.cy,
                    srcPath: fb.srcPath, detailCaption: fb.detailCaption
                });
            }
        }

        clickableItems.sort((a, b) => b.depthY - a.depthY);

        for (let item of clickableItems) {
            if (worldMouseX >= item.x && worldMouseX <= item.x + item.w &&
                worldMouseY >= item.y && worldMouseY <= item.y + item.h) {
                
                if (typeof openImageModal === 'function') {
                    openImageModal(item.srcPath, item.detailCaption);
                }
                break;
            }
        }
    }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
// js/PebbleChar.js

class PebbleChar {
  constructor(x, y, scale = 1.0) {
    this.charScale = scale;
    this.virtualWidthRef = 5000;

    // 위치 데이터 안전 복원
    try {
      const savedData = localStorage.getItem('pebble_position_ratio');
      const savedPos = savedData ? JSON.parse(savedData) : null;
      
      if (savedPos && typeof savedPos.rx === 'number' && typeof savedPos.ry === 'number') {
        this.rawX = savedPos.rx * this.virtualWidthRef;
        this.cy = savedPos.ry * (window.innerHeight || 800);
      } else {
        this.rawX = x;
        this.cy = y;
      }
    } catch (e) {
      this.rawX = x;
      this.cy = y;
    }

    if (this.rawX < -1000 || this.rawX > this.virtualWidthRef + 1000 || isNaN(this.rawX)) {
      this.rawX = x;
    }
    if (this.cy < -500 || this.cy > (window.innerHeight || 1000) + 500 || isNaN(this.cy)) {
      this.cy = y;
    }

    this.cx = this.rawX;

    // 조약돌 규격
    this.w = 120 * this.charScale;
    this.h = 80 * this.charScale;

    // 시선 보간용
    this.lookX = this.cx;
    this.lookY = this.cy;

    // 모션 변수
    this.prevMx = this.cx;
    this.prevMy = this.cy;
    this.energy = 0;
    this.bounceTime = 0;
    this.bounceY = 0;
    this.rotAngle = 0;

    // 드래그 변수
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.liftY = 0;
    this.targetLiftY = 0;
    this.fallVelocity = 0;

    // 사진 가림 여부
    this.isCoveredByBox = false;

    // 기본 말풍선 규격
    this.bw = 55;
    this.bh = 32;
    this.bubbleScale = 1.0;
    this.dotScale = 1.0;

    this.bubbleX = this.cx;
    this.bubbleY = this.cy;
    this.hitX = this.cx;
    this.hitY = this.cy;

    this.renderItems = [];

    // 댓글 데이터 로드
    try {
      const savedComments = localStorage.getItem('pebble_comments');
      this.comments = savedComments ? JSON.parse(savedComments) : [
        { nickname: "주인장", text: "조약돌에 첫 흔적을 남겨보세요!", timestamp: new Date().toISOString() }
      ];
    } catch(e) {
      this.comments = [{ nickname: "주인장", text: "조약돌에 첫 흔적을 남겨보세요!", timestamp: new Date().toISOString() }];
    }
    
    this.initCommentDOM();
  }

  applyDrag(deltaX) { }

  update(mx, my, offsetX = 0, boxes = []) {
    this.renderItems = [];

    if (!this.isDragging) {
      this.cx = this.rawX + offsetX;
    }

    if (this.isDragging) {
      this.cx = mx - this.dragOffsetX;
      this.cy = my - this.dragOffsetY;
      this.rawX = this.cx - offsetX; 
      this.targetLiftY = -35 * this.charScale;
      this.fallVelocity = 0;
    } else {
      if (this.liftY < 0 || this.fallVelocity !== 0) {
        this.fallVelocity += 2.5 * this.charScale;
        this.liftY += this.fallVelocity;

        if (this.liftY >= 0) {
          this.liftY = 0;
          if (abs(this.fallVelocity) > 3) {
            this.fallVelocity = -this.fallVelocity * 0.6;
            this.energy = 1.5;
          } else {
            this.fallVelocity = 0;
          }
        }
      }
      this.targetLiftY = 0;
    }

    if (this.isDragging) {
      this.liftY = lerp(this.liftY, this.targetLiftY, 0.2);
    }

    // 사진에 완전히 가려졌는지 판정
    this.isCoveredByBox = false;
    for (let b of boxes) {
      if (this.cx > b.x && this.cx < b.x + b.w &&
          this.cy > b.y && this.cy < b.y + b.h) {
        this.isCoveredByBox = true;
        break;
      }
    }

    let mSpeed = dist(mx, my, this.prevMx, this.prevMy);
    this.prevMx = mx;
    this.prevMy = my;

    let targetEnergy = map(constrain(mSpeed, 0, 40), 0, 40, 0, 1.0);
    this.energy = lerp(this.energy, targetEnergy, 0.1);

    if (!this.isDragging && this.liftY === 0) {
      this.bounceTime += 0.2 + this.energy * 0.25;
      this.bounceY = -abs(sin(this.bounceTime)) * (4 * this.energy * this.charScale);
      let targetRot = sin(this.bounceTime * 0.8) * (0.2 * this.energy);
      this.rotAngle = lerp(this.rotAngle, targetRot, 0.15);
    } else {
      this.bounceY = 0;
      this.rotAngle = lerp(this.rotAngle, 0, 0.15);
    }

    this.lookX = lerp(this.lookX, mx, 0.08);
    this.lookY = lerp(this.lookY, my, 0.08);

    let totalOffsetY = this.bounceY + this.liftY;
    this.bubbleX = this.cx + (this.w * 0.5);
    this.bubbleY = this.cy + totalOffsetY - (this.h * 0.5);

    this.hitX = this.bubbleX - (20 * this.charScale * this.bubbleScale);
    this.hitY = this.bubbleY + ((-this.bh / 2 - 20) * this.charScale * this.bubbleScale);

    // 돌은 맨 아래 레이어에 렌더링
    this.renderItems.push({
      y: -99999, 
      render: () => {
        this.drawPebbleBody();
      }
    });
  }

  drawPebbleBody() {
    push();
    translate(this.cx, this.cy);

    let s = this.charScale;
    let totalOffsetY = this.bounceY + this.liftY;

    // 1. 🌑 바닥 그림자
    let shadowFactor = map(totalOffsetY, 0, -40 * s, 1.0, 0.4, true);
    let shadowAlpha  = map(totalOffsetY, 0, -40 * s, 40, 10, true);

    noStroke();
    fill(0, shadowAlpha);
    ellipse(12, this.h * 0.4, (this.w * 1.05) * shadowFactor, (this.h * 0.35) * shadowFactor);

    // 💡 2. 조약돌 밑에 '익명의 방명록' 텍스트 레이블 출력
    push();
    noStroke();
    fill(90, 100, 110, 210);
    textSize(11.5 * s);
    textStyle(BOLD);
    textAlign(CENTER, TOP);
    text("익명의 방명록", 0, this.h * 0.52);
    pop();

    // --------------------------------------------------
    // 몸체 트랜스폼 적용
    // --------------------------------------------------
    translate(0, totalOffsetY);
    rotate(this.rotAngle);

    // 3. 🥔 감자처럼 울퉁불퉁한 조약돌 몸통
    noStroke();
    fill(170, 180, 190);

    beginShape();
    vertex(-55 * s, -10 * s); vertex(-45 * s, -35 * s); vertex(-20 * s, -45 * s);
    vertex(15 * s, -40 * s);  vertex(45 * s, -28 * s);  vertex(60 * s, -5 * s);
    vertex(52 * s, 22 * s);   vertex(30 * s, 38 * s);   vertex(-10 * s, 42 * s);
    vertex(-40 * s, 35 * s);  vertex(-58 * s, 15 * s);
    endShape(CLOSE);

    // 눈 연산
    let localTargetX = this.lookX - this.cx;
    let localTargetY = this.lookY - (this.cy + totalOffsetY);
    let angleToTarget = atan2(localTargetY, localTargetX);

    let eyeDist = min(dist(0, 0, localTargetX, localTargetY) * 0.02, 10.0) * s;
    let eyeMoveX = cos(angleToTarget) * eyeDist;
    let eyeMoveY = sin(angleToTarget) * eyeDist;

    let pupilDist = min(dist(0, 0, localTargetX, localTargetY) * 0.04, 13.5) * s;
    let pupilMoveX = cos(angleToTarget) * pupilDist;
    let pupilMoveY = sin(angleToTarget) * pupilDist;

    let eyeR = 15 * s;

    // 왼쪽 눈
    push();
    translate(-16 * s + eyeMoveX, -5 * s + eyeMoveY);
    stroke(0); strokeWeight(s * 2.0); fill(255);
    ellipse(0, 0, eyeR * 2, eyeR * 2);
    noStroke(); fill(0);
    ellipse(pupilMoveX - eyeMoveX, pupilMoveY - eyeMoveY, eyeR * 0.9, eyeR * 1.1);
    pop();

    // 오른쪽 눈
    push();
    translate(16 * s + eyeMoveX, -5 * s + eyeMoveY);
    stroke(0); strokeWeight(s * 2.0); fill(255);
    ellipse(0, 0, eyeR * 2, eyeR * 2);
    noStroke(); fill(0);
    ellipse(pupilMoveX - eyeMoveX, pupilMoveY - eyeMoveY, eyeR * 0.9, eyeR * 1.1);
    pop();

    pop();
  }

  getRenderItems() { return this.renderItems; }

  drawTopLayer(mx, my) {
    if (this.isCoveredByBox) {
      let floatY = sin(frameCount * 0.1) * 6; 
      let exY = this.cy - 40; 
      
      let isHovered = dist(mx, my, this.cx, exY) < 25;
      
      push();
      translate(this.cx, exY + floatY);
      scale(this.charScale * this.bubbleScale);
      
      stroke(0);
      strokeWeight(2.5);
      fill(isHovered ? 200 : 255, isHovered ? 200 : 240, 100); 
      ellipse(0, 0, 36, 36);

      noStroke();
      fill(44, 48, 54);
      textAlign(CENTER, CENTER);
      textSize(22);
      textStyle(BOLD);
      text("!", 0, 1);
      pop();
      return; 
    }

    let hitRadius = (this.bw * 0.6) * this.charScale * this.bubbleScale;
    let isHovered = dist(mx, my, this.hitX, this.hitY) < hitRadius;

    push();
    translate(this.bubbleX, this.bubbleY);
    scale(this.charScale * this.bubbleScale);

    let bw = this.bw; let bh = this.bh; let br = 10; let myOffset = -bh / 2;
    rectMode(CENTER); noStroke();

    let outlineColor = isHovered ? 255 : 0;
    let innerColor   = isHovered ? 0 : 255;
    let dotColor     = isHovered ? 255 : 0;

    fill(outlineColor);
    beginShape(); vertex(-21, -20); vertex(-21, -5); vertex(-5.5, -20); endShape(CLOSE);
    rect(0 - 20, myOffset - 20, bw + 2.5, bh + 2.5, br + 1);

    fill(innerColor);
    beginShape(); vertex(-20, -20.1); vertex(-20, -8); vertex(-8, -20); endShape(CLOSE);
    rect(0 - 20, myOffset - 20, bw, bh, br);

    let dotSpacing = 12; let dotSize = 5 * this.dotScale;
    let dotStep = floor((frameCount / 18) % 4);

    fill(dotColor, (dotStep >= 1) ? 255 : 45); ellipse(-dotSpacing - 20, myOffset - 20, dotSize, dotSize);
    fill(dotColor, (dotStep >= 2) ? 255 : 45); ellipse(0 - 20, myOffset - 20, dotSize, dotSize);
    fill(dotColor, (dotStep >= 3) ? 255 : 45); ellipse(dotSpacing - 20, myOffset - 20, dotSize, dotSize);

    pop();
  }

  checkPress(mx, my) {
    let dToChar = dist(mx, my, this.cx, this.cy);

    if (this.isCoveredByBox) {
      let dToExclamation = dist(mx, my, this.cx, this.cy - 40);
      if (dToChar < this.w * 0.6 || dToExclamation < 30) {
        this.isDragging = true;
        this.dragOffsetX = mx - this.cx;
        this.dragOffsetY = my - this.cy;
        return true;
      }
      return false;
    }

    let hitRadius = (this.bw * 0.6) * this.charScale * this.bubbleScale;
    let dToBubble = dist(mx, my, this.hitX, this.hitY);
    if (dToBubble < hitRadius) {
      this.openCommentModal();
      return true;
    }

    if (dToChar < this.w * 0.6) {
      this.isDragging = true;
      this.dragOffsetX = mx - this.cx;
      this.dragOffsetY = my - this.cy;
      return true;
    }

    return false;
  }

  checkRelease() {
    if (this.isDragging) {
      this.isDragging = false;
      this.fallVelocity = 0;
      this.savePositionRatio();
    }
  }

  savePositionRatio() {
    const ratioX = this.rawX / this.virtualWidthRef;
    const ratioY = this.cy / (window.innerHeight || 800);
    localStorage.setItem('pebble_position_ratio', JSON.stringify({ rx: ratioX, ry: ratioY }));
  }

  initCommentDOM() {
    const closeBtn = document.getElementById('pebble-popup-close-btn');
    const submitBtn = document.getElementById('pebble-comment-submit-btn');
    const input = document.getElementById('pebble-comment-input');
    const nickInput = document.getElementById('pebble-nickname-input');

    if (closeBtn) closeBtn.onclick = () => this.closeCommentModal();
    if (submitBtn) submitBtn.onclick = () => this.addComment();
    
    const handleEnter = (e) => {
      if (e.key === 'Enter') this.addComment();
    };

    if (input) input.onkeypress = handleEnter;
    if (nickInput) nickInput.onkeypress = handleEnter;
  }

  openCommentModal() {
    const modal = document.getElementById('pebble-comment-popup');
    if (modal) {
      this.renderCommentList();
      modal.classList.remove('hidden');
    }
  }

  closeCommentModal() {
    const modal = document.getElementById('pebble-comment-popup');
    if (modal) modal.classList.add('hidden');
  }

  addComment() {
    const input = document.getElementById('pebble-comment-input');
    const nickInput = document.getElementById('pebble-nickname-input');
    
    if (!input || !input.value.trim()) return;

    const nickname = nickInput && nickInput.value.trim() !== '' ? nickInput.value.trim() : '익명';
    const text = input.value.trim();

    const newComment = {
      nickname: nickname,
      text: text,
      timestamp: new Date().toISOString()
    };

    this.comments.unshift(newComment);
    localStorage.setItem('pebble_comments', JSON.stringify(this.comments));
    
    input.value = '';
    this.renderCommentList();
  }

  renderCommentList() {
    const listContainer = document.getElementById('pebble-comment-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    this.comments.forEach(c => {
      const item = document.createElement('div');
      item.className = 'comment-item';
      
      const timeStr = this.formatRelativeTime(c.timestamp);
      const safeNick = this.escapeHTML(c.nickname || '익명');
      const safeText = this.escapeHTML(c.text || '');

      item.innerHTML = `
        <div class="comment-item-header">
          <span>${safeNick}</span>
          <span>${timeStr}</span>
        </div>
        <div class="comment-text">${safeText}</div>
      `;
      listContainer.appendChild(item);
    });
  }

  formatRelativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return '방금 전';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}
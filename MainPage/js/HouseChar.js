// js/HouseChar.js

class HouseChar {
    constructor(x, y, scale) {
        this.charScale = scale;
        this.cx = x; this.cy = y;
        this.lookX = x; this.lookY = y;
        this.baseEasing = 0.005;
        this.currentShear = 0; this.currentAlign = 0;
        this.sitRatio = 0; this.lastMoveTime = millis(); this.sitDelay = 3000;
        this.t = 0;
        
        this.globalBubbleX = 0; this.globalBubbleY = 0;
        this.bubbleScale = 1.0; this.dotScale = 1.0;
        this.smokeParticles = [];
        this.currentDetourDir = 0; this.activeCollidingBox = null;
        
        // 🌿 [잔디 관련 기능 보관 주석]
        // this.spawnAccumulator = 0;
        // this.spawnOffsetX = 0; this.spawnOffsetY = 50; this.sproutsPerSecond = 10;
        
        this.prevMouseX = x; this.prevMouseY = y;
        this.renderItems = [];
    }

    applyDrag(deltaX) {
        this.cx += deltaX;
    }

    update(mx, my, isOverUI, isPopupOpen, boxes, dt, currentTime) {
        this.renderItems = [];
        let mouseSpeed = dist(mx, my, this.prevMouseX, this.prevMouseY);
        if (mouseSpeed > 0.5 && !isOverUI) { this.lastMoveTime = currentTime; }
        this.prevMouseX = mx; this.prevMouseY = my;

        let minBoxDist = Infinity; let targetBox = null; let boxSpeedFactor = 1.0; 
        for (let b of boxes) {
            let closestX = constrain(this.cx, b.x, b.x + b.w); let closestY = constrain(this.cy, b.y, b.y + b.h);
            let dToEdge = dist(this.cx, this.cy, closestX, closestY); let dToCenter = dist(this.cx, this.cy, b.cx, b.cy);
            if (dToCenter < minBoxDist) { minBoxDist = dToCenter; targetBox = b; }
            if (dToEdge < 180) { let factor = map(dToEdge, 0, 180, 0.8, 1.0); if (factor < boxSpeedFactor) { boxSpeedFactor = factor; } }
        }

        let virtualTargetX = mx; let targetY = my - 40 * this.charScale; 
        if (isPopupOpen) { virtualTargetX = this.cx; targetY = this.cy; }

        let actualMoveX = 0; let actualMoveY = 0;
        if (this.sitRatio < 0.15 && !isOverUI && boxes.length > 0) { 
            let stepX = (virtualTargetX - this.cx) * this.baseEasing * boxSpeedFactor; let stepY = (targetY - this.cy) * this.baseEasing * boxSpeedFactor;
            let calculatedStepSpeed = dist(0, 0, stepX, stepY); let charCollisionRadius = 25 * this.charScale; 
            let nextPos = this.calculateFixedDetourPosition(this.cx, this.cy, virtualTargetX, targetY, boxes, charCollisionRadius, calculatedStepSpeed);
            actualMoveX = nextPos.x - this.cx; actualMoveY = nextPos.y - this.cy;
            this.cx = nextPos.x; this.cy = nextPos.y;
        } else if (this.sitRatio < 0.15 && !isOverUI) {
            let prevCx = this.cx; let prevCy = this.cy;
            this.cx = lerp(this.cx, virtualTargetX, this.baseEasing * 8); this.cy = lerp(this.cy, targetY, this.baseEasing * 8);
            actualMoveX = this.cx - prevCx; actualMoveY = this.cy - prevCy;
        }

        let targetDist = dist(this.cx, this.cy, virtualTargetX, targetY);
        let dScale = (targetDist < 0.1) ? 0 : targetDist / 3;
        
        let targetSit = 0.0;
        if (isPopupOpen) { targetSit = 1.0; } 
        else { targetSit = (currentTime - this.lastMoveTime > this.sitDelay || targetDist < 0.8 || isOverUI) ? 1.0 : 0.0; }
        this.sitRatio = lerp(this.sitRatio, targetSit, 0.06); 
        
        let movementSpeed = map(min(dScale, 100), 0, 100, 0.05, 0.25) * boxSpeedFactor;
        if (targetDist < 0.1) movementSpeed = 0;
        this.t += lerp(movementSpeed, 0, this.sitRatio); 

        let motionIntensity = map(min(dScale, 100), 0, 60, 0.5, 0.5);
        let isLeft = mx < this.cx;

        // 🌿 [잔디 관련 기능 보관 주석] 앉았을 때 새싹 자동 생성 비활성화
        /*
        if (this.sitRatio > 0.95 && !isOverUI && !isPopupOpen) { 
            let spawnInterval = 1000 / this.sproutsPerSecond; this.spawnAccumulator += dt; 
            if (this.spawnAccumulator >= spawnInterval) {
                let spawnCount = min(3, floor(this.spawnAccumulator / spawnInterval));
                for (let i = 0; i < spawnCount; i++) { spawnSprout(this.cx + this.spawnOffsetX, this.cy + this.spawnOffsetY); }
                this.spawnAccumulator %= spawnInterval;
            }
        } else { this.spawnAccumulator = 0; }
        */

        let targetAlign = isLeft ? 0 : 1; this.currentAlign = lerp(this.currentAlign, targetAlign, 0.08);
        let baseSwing1 = sin(this.t) * 22 * this.charScale * motionIntensity; let baseSwing2 = -sin(this.t) * 22 * this.charScale * motionIntensity;
        let legSwing1 = lerp(baseSwing1, 0, this.sitRatio); let legSwing2 = lerp(baseSwing2, 0, this.sitRatio);

        let dirToMouseX = 1; let dirToMouseY = 0;
        let moveLen = dist(0, 0, actualMoveX, actualMoveY);
        if (this.activeCollidingBox && moveLen > 0.05) { dirToMouseX = actualMoveX / moveLen; dirToMouseY = actualMoveY / moveLen; } 
        else { let toMouseX = virtualTargetX - this.cx; let toMouseY = targetY - this.cy; let len = dist(0, 0, toMouseX, toMouseY); if (len > 0.05) { dirToMouseX = toMouseX / len; dirToMouseY = toMouseY / len; } }

        let verticalFactor = abs(dirToMouseY); let lateralSpread = lerp(1.0, 0.4, verticalFactor); 
        let frontLeftX = this.cx - 12 * this.charScale * lateralSpread; let frontRightX = this.cx + 22 * this.charScale * lateralSpread;
        let legBaseY = this.cy + 30 * this.charScale;
        if (isNaN(dirToMouseX) || !isFinite(dirToMouseX)) dirToMouseX = isLeft ? -1 : 1; if (isNaN(dirToMouseY) || !isFinite(dirToMouseY)) dirToMouseY = 0;

        let footX1_front = frontLeftX + legSwing1 * dirToMouseX; let footY1_front = legBaseY + 45 * this.charScale + legSwing1 * dirToMouseY - abs(legSwing1) * 0.4;
        let footX2_front = frontRightX + legSwing2 * dirToMouseX; let footY2_front = legBaseY + 45 * this.charScale + legSwing2 * dirToMouseY - abs(legSwing2) * 0.4;

        let sideOriginX = this.cx + 10 * this.charScale; let sideOriginY = this.cy + 60 * this.charScale;
        let dirX = cos(QUARTER_PI); let dirY = sin(QUARTER_PI);

        let footX1_side = sideOriginX + 10 * this.charScale * dirX + legSwing1 * dirToMouseX; let footY1_side = sideOriginY + 10 * this.charScale * dirY + 15 * this.charScale + legSwing1 * dirToMouseY;
        let footX2_side = sideOriginX + 45 * this.charScale * dirX + legSwing2 * dirToMouseX; let footY2_side = sideOriginY + 45 * this.charScale * dirY + 15 * this.charScale + legSwing2 * dirToMouseY;

        let finalFootX1 = lerp(footX1_front, footX1_side, this.currentAlign); let finalFootY1 = lerp(footY1_front, footY1_side, this.currentAlign);
        let finalFootX2 = lerp(footX2_front, footX2_side, this.currentAlign); let finalFootY2 = lerp(footY2_front, footY2_side, this.currentAlign);

        if (isNaN(finalFootX1) || !isFinite(finalFootX1)) finalFootX1 = frontLeftX; if (isNaN(finalFootY1) || !isFinite(finalFootY1)) finalFootY1 = legBaseY + 45 * this.charScale;
        if (isNaN(finalFootX2) || !isFinite(finalFootX2)) finalFootX2 = frontRightX; if (isNaN(finalFootY2) || !isFinite(finalFootY2)) finalFootY2 = legBaseY + 45 * this.charScale;

        let lowestFootY = max(finalFootY1, finalFootY2);
        let w = 70 * this.charScale; let h = 90 * this.charScale; let depth = 80 * this.charScale; let dy = -depth * sin(QUARTER_PI); 

        let targetHouseYSit = isLeft ? (lowestFootY - h/2 + 5 * this.charScale) : (lowestFootY - (h/2 + dy) - 18 * this.charScale);
        let walkBobbing = (abs(sin(this.t * 2)) * 8 * this.charScale * motionIntensity); let breathBobbing = sin(frameCount * 0.04) * 2.5 * this.charScale; 
        let activeBobbing = lerp(walkBobbing, breathBobbing, this.sitRatio);

        let defaultHouseY = this.cy - activeBobbing; let houseY = lerp(defaultHouseY, targetHouseYSit, this.sitRatio);

        let startLegX1 = lerp(frontLeftX, sideOriginX + 10 * this.charScale * dirX, this.currentAlign); let startLegY1 = houseY + 20 * this.charScale;
        let startLegX2 = lerp(frontRightX, sideOriginX + 40 * this.charScale * dirX, this.currentAlign); let startLegY2 = houseY + 20 * this.charScale;

        let finalSitFootX1 = lerp(finalFootX1, startLegX1, this.sitRatio * 0.15); let finalSitFootY1 = finalFootY1; 
        let finalSitFootX2 = lerp(finalFootX2, startLegX2, this.sitRatio * 0.15); let finalSitFootY2 = finalFootY2;

        let targetShear = 0;
        if (dScale > 1) { let maxShear = 0.25; let shearMagnitude = map(min(dScale, 120), 0, 120, 0, maxShear); targetShear = isLeft ? -shearMagnitude : shearMagnitude; }
        targetShear *= (1.0 - this.sitRatio); this.currentShear = lerp(this.currentShear, targetShear, 0.1);

        this.globalBubbleX = this.cx + w * 1.25 + this.currentShear * (-h/2);
        this.globalBubbleY = houseY - h * 0.8 + dy;
        
        let roofH = w / 2;
        let smokeX = this.cx + (2 * this.charScale) + this.currentShear * (-h/2 - roofH/2 + dy * 0.6 - 45 * this.charScale);
        let smokeY = houseY + (-h/2 - roofH/2 + dy * 0.6) - 55 * this.charScale;
        this.updateAndDrawSmoke(smokeX, smokeY, this.charScale);

        this.renderItems.push({ y: lowestFootY - 150, render: () => { push(); stroke(0); strokeWeight(2.5 * this.charScale); line(startLegX1, startLegY1, finalSitFootX1, finalSitFootY1); line(startLegX2, startLegY2, finalSitFootX2, finalSitFootY2); pop(); }});
        this.renderItems.push({ y: finalSitFootY1 - 45 * this.charScale, render: () => this.drawObliqueFoot(finalSitFootX1, finalSitFootY1, this.charScale) });
        this.renderItems.push({ y: finalSitFootY2 - 45 * this.charScale, render: () => this.drawObliqueFoot(finalSitFootX2, finalSitFootY2, this.charScale) });
        this.renderItems.push({ y: lowestFootY, render: () => { this.drawObliqueHouse(this.cx, houseY, this.charScale, isLeft, this.currentShear, this.sitRatio, targetBox, minBoxDist, virtualTargetX, targetY); }});
    }

    getRenderItems() { return this.renderItems; }

    drawTopLayer(mx, my) {
        let isBubbleHovered = dist(mx, my, this.globalBubbleX, this.globalBubbleY) < 40;
        push(); translate(this.globalBubbleX, this.globalBubbleY); scale(this.bubbleScale);
        let bw = 55; let bh = 32; let br = 10; let mby = -bh/2; rectMode(CENTER); noStroke();
        let outlineColor = isBubbleHovered ? 255 : 0; let innerColor = isBubbleHovered ? 0 : 255; let dotColor = isBubbleHovered ? 255 : 0;
        fill(outlineColor); beginShape(); vertex(-1, 0); vertex(-1, 14); vertex(13.5, 0); endShape(CLOSE); rect(0, mby, bw + 2.5, bh + 2.5, br + 1); 
        fill(innerColor); beginShape(); vertex(0, -0.1); vertex(0, 12); vertex(12, 0); endShape(CLOSE); rect(0, mby, bw, bh, br); 
        let dotSpacing = 12; let dotSize = 5 * this.dotScale; let dotStep = floor((frameCount / 18) % 4);
        fill(dotColor, (dotStep >= 1) ? 255 : 45); ellipse(-dotSpacing, mby, dotSize, dotSize); 
        fill(dotColor, (dotStep >= 2) ? 255 : 45); ellipse(0, mby, dotSize, dotSize);          
        fill(dotColor, (dotStep >= 3) ? 255 : 45); ellipse(dotSpacing, mby, dotSize, dotSize); 
        pop();
    }

    checkBubbleClick(mx, my) {
        return dist(mx, my, this.globalBubbleX, this.globalBubbleY) < 40;
    }

    calculateFixedDetourPosition(currentX, currentY, targetX, targetY, obstacleBoxes, charRadius, moveSpeed) { let dirX = targetX - currentX; let dirY = targetY - currentY; let d = dist(0, 0, dirX, dirY); if (d < 1 || moveSpeed <= 0) { this.activeCollidingBox = null; this.currentDetourDir = 0; return { x: currentX, y: currentY }; } dirX /= d; dirY /= d; let nextX = currentX + dirX * moveSpeed; let nextY = currentY + dirY * moveSpeed; let currentlyColliding = false; for (let b of obstacleBoxes) { let minX = b.x - charRadius; let maxX = b.x + b.w + charRadius; let minY = b.y - charRadius; let maxY = b.y + b.h + charRadius; if (nextX > minX && nextX < maxX && nextY > minY && nextY < maxY) { currentlyColliding = true; let overlapLeft = nextX - minX; let overlapRight = maxX - nextX; let overlapTop = nextY - minY; let overlapBottom = maxY - nextY; let minOverlap = min(min(overlapLeft, overlapRight), min(overlapTop, overlapBottom)); if (this.activeCollidingBox !== b || this.currentDetourDir === 0) { this.activeCollidingBox = b; if (minOverlap === overlapLeft || minOverlap === overlapRight) { this.currentDetourDir = (targetY > currentY) ? 1 : -1; } else { this.currentDetourDir = (targetX > currentX) ? 1 : -1; } } if (minOverlap === overlapLeft || minOverlap === overlapRight) { nextX = (minOverlap === overlapLeft) ? minX : maxX; nextY = currentY + this.currentDetourDir * moveSpeed; } else if (minOverlap === overlapTop || minOverlap === overlapBottom) { nextY = (minOverlap === overlapTop) ? minY : maxY; nextX = currentX + this.currentDetourDir * moveSpeed; } break; } } if (!currentlyColliding) { this.activeCollidingBox = null; this.currentDetourDir = 0; } return { x: nextX, y: nextY }; }
    drawObliqueFoot(x, y, s) { push(); translate(x, y); applyMatrix(1, 0, -cos(QUARTER_PI), sin(QUARTER_PI), 0, 0); fill(0); ellipse(0, 0, 25 * s, 15 * s); pop(); }
    updateAndDrawSmoke(spawnX, spawnY, s) { if (frameCount % 25 === 0) { this.smokeParticles.push({ x: spawnX, y: spawnY, size: random(10, 20) * s, vx: random(-0.3, 0.3) * s, vy: random(-0.8, -1.5) * s, alpha: 255 }); } for (let i = this.smokeParticles.length - 1; i >= 0; i--) { let p = this.smokeParticles[i]; p.x += p.vx; p.y += p.vy; p.alpha -= 1.8; p.size += 0.15 * s; push(); translate(p.x, p.y); applyMatrix(1, 0, -cos(QUARTER_PI), sin(QUARTER_PI), 0, 0); fill(200, p.alpha); noStroke(); ellipse(25 * s, 0, p.size * 1.5, p.size); pop(); if (p.alpha <= 0) { this.smokeParticles.splice(i, 1); } } }
    drawObliqueHouse(x, y, s, isLeft, shearX, currentSitRatio, targetBox, minBoxDist, worldTargetX, worldTargetY) {
        push(); translate(x, y); applyMatrix(1, 0, shearX, 1, 0, 0); noStroke(); 
        let w = 70 * s; let h = 90 * s; let depth = 80 * s; let overhang = 13 * s; let roofH = w / 2; let dx = depth * cos(QUARTER_PI); let dy = -depth * sin(QUARTER_PI);
        let rawTargetX = worldTargetX; let rawTargetY = worldTargetY;
        if (targetBox && minBoxDist < 260) { rawTargetX = targetBox.cx; rawTargetY = targetBox.cy; }
        this.lookX = lerp(this.lookX, rawTargetX, 0.08); this.lookY = lerp(this.lookY, rawTargetY, 0.08);
        let localTargetX = this.lookX - x; let localTargetY = this.lookY - y; 
        let targetDistToEye = dist(0, 0, localTargetX, localTargetY); let angleToTarget = (targetDistToEye > 0.1) ? atan2(localTargetY, localTargetX) : (isLeft ? PI : 0); 
        let eyeDist = min(targetDistToEye * 0.02, 10.0) * s; let eyeMoveX = cos(angleToTarget) * eyeDist; let eyeMoveY = sin(angleToTarget) * eyeDist; 
        let pupilDist = min(targetDistToEye * 0.04, 13.5) * s; let pupilMoveX = cos(angleToTarget) * pupilDist; let pupilMoveY = sin(angleToTarget) * pupilDist;
        let randomAngleOffset = map(noise(frameCount * 0.08), 0, 1, -HALF_PI, HALF_PI); let targetDoorAngle = angleToTarget + randomAngleOffset;
        let doorDist = min(targetDistToEye * 0.03, 2.0) * s; let doorMoveX = cos(targetDoorAngle) * doorDist; let doorMoveY = sin(targetDoorAngle) * doorDist;
        fill(220); beginShape(); vertex(w/2, h/2); vertex(w/2 + dx, h/2 + dy); vertex(w/2 + dx, -h/2 + dy); vertex(w/2, -h/2); endShape(CLOSE);
        fill(230, 0, 0); beginShape(); vertex(w/2 + overhang, -h/2 + overhang); vertex(w/2 + overhang + dx, -h/2 + overhang + dy); vertex(dx, -h/2 - roofH + dy); vertex(0, -h/2 - roofH); endShape(CLOSE);
        fill(240); beginShape(); vertex(-w/2, h/2); vertex(w/2, h/2); vertex(w/2, -h/2); vertex(0, -h/2 - roofH); vertex(-w/2, -h/2); endShape(CLOSE);
        stroke(0); strokeWeight(3 * s); line(-w/2 - overhang, -h/2 + overhang, 0, -h/2 - roofH); line(w/2 + overhang, -h/2 + overhang, 0, -h/2 - roofH); noStroke(); 
        fill(0); rect(w/2 - 25 * s + doorMoveX, h/2 - 10 * s + doorMoveY, 8 * s, 5 * s);
        let eyeR = 15 * s; 
        push(); translate(10 * s + eyeMoveX, -20 * s + eyeMoveY); stroke(0); strokeWeight(s * 2.5); fill(255); ellipse(0, 0, eyeR * 2, eyeR * 2); noStroke(); if (isLeft) { fill(0); ellipse(pupilMoveX - eyeMoveX, pupilMoveY - eyeMoveY, eyeR * 0.9, eyeR * 1.1); } if (currentSitRatio > 0.01) { fill(0); let angleSpread = map(currentSitRatio, 0, 1, 0, PI); arc(0, 0, eyeR * 2.1, eyeR * 2.1, PI + HALF_PI - angleSpread, PI + HALF_PI + angleSpread, CHORD); } pop();
        push(); translate(0 + eyeMoveX, 10 * s + eyeMoveY); stroke(0); strokeWeight(s * 2.5); fill(255); ellipse(0, 0, eyeR * 2, eyeR * 2); noStroke(); if (isLeft) { fill(0); ellipse(pupilMoveX - eyeMoveX, pupilMoveY - eyeMoveY, eyeR * 0.9, eyeR * 1.1); } if (currentSitRatio > 0.01) { fill(0); let angleSpread = map(currentSitRatio, 0, 1, 0, PI); arc(0, 0, eyeR * 2.1, eyeR * 2.1, PI + HALF_PI - angleSpread, PI + HALF_PI + angleSpread, CHORD); } pop();
        push(); stroke(0); strokeWeight(s * 2.5); translate(w/2, 0); applyMatrix(1, -1, 0, 1, 0, 0); let winW = 20 * s; let winH = 40 * s; let wX1 = 10 * s; let wX2 = 30 * s; let wY = -5 * s;
        push(); translate(wX1, wY); fill(255); rect(eyeMoveX, eyeMoveY, winW, winH); if (!isLeft) { let winEyeR = 5 * s; fill(0); ellipse(winW/2 + pupilMoveX, winH/2 + pupilMoveY, winEyeR * 2.5, winEyeR * 4); } noStroke(); fill(0); rect(eyeMoveX, eyeMoveY, winW, winH * currentSitRatio); pop();
        push(); stroke(0); strokeWeight(s * 2.5); translate(wX2, wY); fill(255); rect(eyeMoveX, eyeMoveY, winW, winH); if (!isLeft) { let winEyeR = 5 * s; fill(0); ellipse(winW/2 + pupilMoveX, winH/2 + pupilMoveY, winEyeR * 2.5, winEyeR * 4); } noStroke(); fill(0); rect(eyeMoveX, eyeMoveY, winW, winH * currentSitRatio); pop(); pop();
        let chimX = 25 * s; let chimY = -h/2 - roofH/2 + dy*0.6; let chimW = 14 * s; let chimH = 45 * s; noStroke(); fill(230); ellipse(chimX, chimY, chimW, chimW * 0.5); rect(chimX - chimW/2, chimY - chimH, chimW, chimH); ellipse(chimX, chimY - chimH, chimW, chimW * 0.5); fill(150); ellipse(chimX, chimY - chimH, winW * 0.425, winW * 0.2); 
        pop();
    }
}
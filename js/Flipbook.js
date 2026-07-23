class Flipbook {
    constructor(x, y, scale = 1.0) {
        this.rawX = x; 
        this.y = y;
        this.scale = scale;
        this.frames = [];
        this.currentFrame = 0;
    }

    loadFrames(imagePaths) {
        imagePaths.forEach(path => {
            loadImage(path, (img) => {
                this.frames.push(img);
            });
        });
    }

    update(mx, offsetX) {
        if (this.frames.length > 0 && this.frames[0]) {
            let img = this.frames[0];
            let currentWidth = img.width * this.scale;
            
            // 💡 핵심: 화면 스크롤(offsetX)이 반영된 실제 캔버스상의 X 좌표
            let drawX = this.rawX + offsetX; 

            let startX = drawX - currentWidth / 2;
            let endX = drawX + currentWidth / 2;
            
            // 마우스 X 좌표 매핑
            let constrainedMx = constrain(mx, startX, endX);
            let index = floor(map(constrainedMx, startX, endX, 0, this.frames.length));
            
            this.currentFrame = constrain(index, 0, this.frames.length - 1);
        }
    }

    getRenderItems(offsetX) {
        return [{
            y: this.y, 
            render: () => {
                if (this.frames.length > 0 && this.frames[this.currentFrame]) {
                    let img = this.frames[this.currentFrame];
                    push();
                    imageMode(CENTER);
                    let drawX = this.rawX + offsetX; 
                    image(img, drawX, this.y, img.width * this.scale, img.height * this.scale);
                    pop();
                }
            }
        }];
    }

    // 캐릭터가 플립북을 피해갈 수 있도록 충돌 박스 정보를 반환하는 함수
    getCollisionBox(offsetX) {
        if (this.frames.length > 0 && this.frames[0]) {
            let img = this.frames[0];
            let w = img.width * this.scale;
            let h = img.height * this.scale;
            let cx = this.rawX + offsetX;
            let cy = this.y;
            
            return {
                x: cx - w / 2,
                y: cy - h / 2,
                w: w,
                h: h,
                cx: cx,
                cy: cy
            };
        }
        return null;
    }
}
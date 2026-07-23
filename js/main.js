// 방명록 팝업 열기/닫기
function openGuestbookPopup() {
    document.getElementById('guestbookPopup').style.display = 'flex';
}

function closeGuestbookPopup() {
    document.getElementById('guestbookPopup').style.display = 'none';
    document.getElementById('nicknameInput').value = '';
    document.getElementById('commentInput').value = '';
}

// Make.com으로 댓글 쏘기
async function submitComment() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    const comment = document.getElementById('commentInput').value.trim();

    if (!nickname || !comment) {
        alert("닉네임과 댓글을 모두 입력해 주세요!");
        return;
    }

    // 작성하신 Make.com 웹훅 주소
    const webhookUrl = 'https://hook.us2.make.com/m5w1ac79jku4xaptesullimwrs281prx';
    const payload = { nickname: nickname, comment: comment };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("댓글이 성공적으로 전달되었습니다!");
            closeGuestbookPopup();
        } else {
            alert("서버 오류로 전송에 실패했습니다.");
        }
    } catch (error) {
        console.error('전송 에러:', error);
        alert("인터넷 연결 등을 확인해 주세요.");
    }
}

// ================= 사진 상세 보기 모달 제어 =================
function openImageModal(imageSrc, captionText) {
    const modal = document.getElementById('image-detail-modal');
    const imgElem = document.getElementById('detail-modal-img');
    const captionElem = document.getElementById('detail-modal-caption');

    // 클릭한 사진의 경로와 캡션을 모달창에 삽입
    imgElem.src = imageSrc;
    captionElem.innerText = captionText || "설명이 없습니다."; // 캡션이 없으면 기본 텍스트
    
    // 모달창 띄우기
    modal.style.display = 'flex';
}

function closeImageModal() {
    document.getElementById('image-detail-modal').style.display = 'none';
}

// ================= 커스텀 커서 제어 =================
document.addEventListener('DOMContentLoaded', () => {
    const cursor = document.getElementById('custom-cursor');

    // 1. 마우스 이동 추적
    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    });

    // 2. 마우스 클릭 상태 (Active)
    document.addEventListener('mousedown', () => cursor.classList.add('active'));
    document.addEventListener('mouseup', () => cursor.classList.remove('active'));

    // 3. HTML 요소 (버튼, 링크 등) 호버 감지
    const interactiveHTML = document.querySelectorAll('button, a');
    interactiveHTML.forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    });
});

// p5.js(sketch.js)에서 커서 상태를 바꿀 수 있도록 전역 함수 생성
window.setCursorHover = function(isHovering) {
    const cursor = document.getElementById('custom-cursor');
    if (cursor) {
        if (isHovering) cursor.classList.add('hover');
        else cursor.classList.remove('hover');
    }
};
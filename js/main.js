// js/main.js 전체 교체
document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("image-uploader");

    if (fileInput) {
        fileInput.addEventListener("change", (event) => {
            const file = event.target.files[0];
            if (!file) return;

            // 💡 gif 포맷까지 포함하여 마킹 검증
            if (file.type.match("image.*") || file.type === "image/gif") {
                const userCaption = prompt("사진/GIF의 오른쪽 밑에 표시할 캡션을 입력해 주세요:", "") || "";

                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;

                    const imgNode = new Image();
                    imgNode.src = dataUrl;

                    imgNode.onload = () => {
                        const rawW = imgNode.naturalWidth || imgNode.width;
                        const rawH = imgNode.naturalHeight || imgNode.height;

                        if (typeof p5 !== "undefined" && window.receiveExternalImage) {
                            window.receiveExternalImage(dataUrl, rawW, rawH, userCaption);
                        }
                    };
                };
                reader.readAsDataURL(file);
            } else {
                alert("이미지 및 GIF 파일 형식만 업로드할 수 있습니다.");
            }
        });
    }
});
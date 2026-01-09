window.STPhone = window.STPhone || {};
window.STPhone.Apps = window.STPhone.Apps || {};

window.STPhone.Apps.Album = (function() {
    'use strict';

    const css = `
        <style>
            .st-album-app {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%; z-index: 999;
                display: flex; flex-direction: column;
                background: var(--pt-bg-color, #f5f5f7);
                color: var(--pt-text-color, #000);
                font-family: var(--pt-font, -apple-system, sans-serif);
                box-sizing: border-box;
            }
            
            .st-album-header {
                padding: 20px 15px 15px;
                font-size: 28px;
                font-weight: 700;
                flex-shrink: 0;
            }
            
            .st-album-grid {
                flex: 1;
                overflow-y: auto;
                padding: 0 8px 20px;
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                grid-auto-rows: min-content;
                gap: 3px;
                align-content: start;
            }
            
            .st-album-empty {
                grid-column: 1 / -1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 80px 20px;
                color: var(--pt-sub-text, #86868b);
            }
            .st-album-empty-icon {
                font-size: 64px;
                margin-bottom: 15px;
                opacity: 0.5;
            }
            
            .st-album-thumb {
                width: 100%;
                padding-bottom: 100%;
                background-size: cover;
                background-position: center;
                cursor: pointer;
                transition: opacity 0.2s;
                position: relative;
            }
            .st-album-thumb:hover {
                opacity: 0.8;
            }
            
            .st-album-viewer {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0,0,0,0.95);
                display: flex; flex-direction: column;
                z-index: 1000;
            }
            
            .st-album-viewer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                color: white;
                flex-shrink: 0;
            }
            
            .st-album-viewer-close {
                font-size: 24px;
                cursor: pointer;
                padding: 5px 10px;
            }
            
            .st-album-viewer-actions {
                display: flex;
                gap: 10px;
            }
            
            .st-album-viewer-btn {
                background: rgba(255,255,255,0.15);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
            }
            .st-album-viewer-btn:hover {
                background: rgba(255,255,255,0.25);
            }
            .st-album-viewer-btn.delete {
                background: rgba(255,59,48,0.8);
            }
            .st-album-viewer-btn.delete:hover {
                background: rgba(255,59,48,1);
            }
            
            .st-album-viewer-image {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 10px;
                overflow: hidden;
            }
            .st-album-viewer-image img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                border-radius: 10px;
            }
            
            .st-album-viewer-info {
                padding: 15px;
                color: #aaa;
                font-size: 12px;
                text-align: center;
                flex-shrink: 0;
            }
            .st-album-viewer-prompt {
                color: white;
                font-size: 14px;
                margin-bottom: 5px;
            }
        </style>
    `;

    let photos = [];

    function getStorageKey() {
        const context = window.SillyTavern && window.SillyTavern.getContext 
            ? window.SillyTavern.getContext() 
            : null;
        
        if (!context || !context.chatId) {
            return null;
        }
        
        return 'st_phone_album_' + context.chatId;
    }

    function loadPhotos() {
        const key = getStorageKey();
        if (!key) {
            photos = [];
            return;
        }

        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                photos = JSON.parse(saved);
            } else {
                photos = [];
            }
        } catch (e) {
            photos = [];
        }
    }

    function savePhotos() {
        const key = getStorageKey();
        if (!key) return;

        try {
            localStorage.setItem(key, JSON.stringify(photos));
        } catch (e) {
            if (e.name === 'QuotaExceededError' && photos.length > 1) {
                photos.pop();
                savePhotos();
            }
        }
    }

    function addPhoto(photoData) {
        loadPhotos();
        
        const exists = photos.some(p => p.url === photoData.url);
        if (exists) return false;

        photos.unshift(photoData);
        
        if (photos.length > 50) {
            photos = photos.slice(0, 50);
        }

        savePhotos();
        return true;
    }

    function deletePhoto(index) {
        if (index >= 0 && index < photos.length) {
            photos.splice(index, 1);
            savePhotos();
            return true;
        }
        return false;
    }

    function open() {
        loadPhotos();
        
        const $screen = window.STPhone.UI.getContentElement();
        if (!$screen || !$screen.length) return;
        $screen.empty();

        let gridContent = '';
        if (photos.length === 0) {
            gridContent = `
                <div class="st-album-empty">
                    <div class="st-album-empty-icon">🖼️</div>
                    <div>앨범이 비어있습니다</div>
                    <div style="font-size:12px;margin-top:5px;">카메라로 사진을 찍어보세요</div>
                </div>
            `;
        } else {
            photos.forEach((photo, index) => {
                gridContent += `
                    <div class="st-album-thumb" 
                         data-index="${index}" 
                         style="background-image: url('${photo.url}');"
                         title="${photo.prompt || ''}">
                    </div>
                `;
            });
        }

        const html = `
            ${css}
            <div class="st-album-app">
                <div class="st-album-header">앨범</div>
                <div class="st-album-grid">
                    ${gridContent}
                </div>
            </div>
        `;

        $screen.append(html);
        attachListeners();
    }

    function attachListeners() {
        $('.st-album-thumb').off('click').on('click', function() {
            const index = parseInt($(this).data('index'));
            openViewer(index);
        });
    }

    function openViewer(index) {
        const photo = photos[index];
        if (!photo) return;

        const date = new Date(photo.timestamp);
        const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

        const viewerHtml = `
            <div class="st-album-viewer" id="st-album-viewer">
                <div class="st-album-viewer-header">
                    <div class="st-album-viewer-close" id="st-viewer-close">✕</div>
                    <div class="st-album-viewer-actions">
                        <button class="st-album-viewer-btn" id="st-viewer-phone-bg">📱 폰 배경</button>
                        <button class="st-album-viewer-btn delete" id="st-viewer-delete">🗑️</button>
                    </div>
                </div>
                <div class="st-album-viewer-image">
                    <img src="${photo.url}" alt="${photo.prompt || '사진'}">
                </div>
                <div class="st-album-viewer-info">
                    <div class="st-album-viewer-prompt">${photo.prompt || '(설명 없음)'}</div>
                    <div>${dateStr}</div>
                </div>
            </div>
        `;

        $('.st-album-app').append(viewerHtml);

        $('#st-viewer-close').on('click', function() {
            $('#st-album-viewer').remove();
        });

        $('#st-viewer-phone-bg').on('click', function() {
            $('.st-phone-screen').css({
                'background': `url("${photo.url}")`,
                'background-size': 'cover',
                'background-position': 'center'
            });
            toastr.success("📱 폰 배경화면으로 설정되었습니다!");
        });

        $('#st-viewer-delete').on('click', function() {
            if (confirm('이 사진을 삭제하시겠습니까?')) {
                deletePhoto(index);
                $('#st-album-viewer').remove();
                open();
                toastr.info("🗑️ 사진이 삭제되었습니다.");
            }
        });
    }

    function getPhotoCount() {
        loadPhotos();
        return photos.length;
    }

    return { 
        open,
        addPhoto,
        deletePhoto,
        getPhotoCount
    };
})();

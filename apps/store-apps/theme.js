window.STPhone = window.STPhone || {};
window.STPhone.Apps = window.STPhone.Apps || {};

window.STPhone.Apps.Theme = (function() {
    'use strict';

    const STORAGE_KEY = 'st_phone_theme_settings';

    // 기본 테마 설정
    const DEFAULT_THEME = {
        // === 폰 프레임 (케이스) ===
        frame: {
            color: '#2c2c2c',           // 프레임 색상
            borderColor: '#555',         // 테두리 색상
            thickness: 10,               // 두께 (px)
            radius: 55,                  // 모서리 둥글기
            shadow: 'default',           // 그림자 스타일: default, glow, none
            glowColor: '#007aff'         // 글로우 색상 (shadow가 glow일 때)
        },

        // === 전체 폰 UI ===
        phone: {
            bgColor: '#1e1e2f',          // 홈 배경색
            bgImage: '',                  // 홈 배경이미지 (base64 또는 URL)
            bgGradient: 'linear-gradient(135deg, #1e1e2f 0%, #2a2a40 100%)',
            notchColor: '#000000',        // 노치 색상
            homeBarColor: 'rgba(255,255,255,0.4)',  // 하단 홈바 색상
            font: '-apple-system, sans-serif',
            accentColor: '#007aff',       // 강조색
            iconSize: 65,                 // 앱 아이콘 크기
            iconRadius: 16                // 앱 아이콘 둥글기
        },

        // === 메시지 앱 ===
        messages: {
            bgColor: '',                  // 채팅방 배경색 (비우면 phone.bgColor 따름)
            bgImage: '',                  // 채팅방 배경이미지
            myBubbleColor: '#007aff',     // 내 말풍선 색상
            myBubbleTextColor: '#ffffff', // 내 말풍선 글자색
            theirBubbleColor: '#e5e5ea',  // 상대 말풍선 색상
            theirBubbleTextColor: '#000000', // 상대 말풍선 글자색
            bubbleMaxWidth: 75,           // 말풍선 최대 너비 (%)
            bubbleRadius: 18,             // 말풍선 둥글기
            fontSize: 15,                 // 글자 크기
            timestampColor: '#8e8e93'     // 타임스탬프 색상
        },

        // === 앱 공통 UI ===
        apps: {
            headerBg: 'rgba(255,255,255,0.9)',      // 앱 헤더 배경
            headerTextColor: '#000000',             // 앱 헤더 글자색
            listBg: '#ffffff',                      // 리스트 배경
            listTextColor: '#000000',               // 리스트 글자색
            listSubTextColor: '#86868b',            // 리스트 보조 글자색
            listBorderColor: '#e5e5e5',             // 리스트 구분선
            isDarkMode: false                       // 다크모드 여부
        },

        // === 앱 아이콘 커스터마이징 ===
        icons: {
            phone: '',      // 전화 앱 아이콘 이미지
            messages: '',   // 메시지 앱 아이콘 이미지
            contacts: '',   // 연락처 앱 아이콘 이미지
            camera: '',     // 카메라 앱 아이콘 이미지
            album: '',      // 앨범 앱 아이콘 이미지
            settings: '',   // 설정 앱 아이콘 이미지
            store: ''       // 스토어 앱 아이콘 이미지
        }
    };

    // 프리셋 테마들
    const PRESET_THEMES = {
        light: {
            name: '☀️ 라이트',
            theme: { ...DEFAULT_THEME }
        },
        dark: {
            name: '🌙 다크',
            theme: {
                frame: { color: '#1c1c1e', borderColor: '#333', thickness: 10, radius: 55, shadow: 'default', glowColor: '#007aff' },
                phone: { bgColor: '#000000', bgImage: '', bgGradient: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)', notchColor: '#000', homeBarColor: 'rgba(255,255,255,0.3)', font: '-apple-system, sans-serif', accentColor: '#0a84ff', iconSize: 65, iconRadius: 16 },
                messages: { bgColor: '#000000', bgImage: '', myBubbleColor: '#0a84ff', myBubbleTextColor: '#ffffff', theirBubbleColor: '#2c2c2e', theirBubbleTextColor: '#ffffff', bubbleMaxWidth: 75, bubbleRadius: 18, fontSize: 15, timestampColor: '#8e8e93' },
                apps: { headerBg: 'rgba(28,28,30,0.95)', headerTextColor: '#ffffff', listBg: '#1c1c1e', listTextColor: '#ffffff', listSubTextColor: '#98989e', listBorderColor: '#38383a', isDarkMode: true },
                icons: { phone: '', messages: '', contacts: '', camera: '', album: '', settings: '', store: '' }
            }
        },
        neon: {
            name: '💜 네온',
            theme: {
                frame: { color: '#0d0d0d', borderColor: '#ff00ff', thickness: 10, radius: 55, shadow: 'glow', glowColor: '#ff00ff' },
                phone: { bgColor: '#0a0a0a', bgImage: '', bgGradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 100%)', notchColor: '#000', homeBarColor: 'rgba(255,0,255,0.5)', font: '-apple-system, sans-serif', accentColor: '#ff00ff', iconSize: 65, iconRadius: 16 },
                messages: { bgColor: '#0a0a0a', bgImage: '', myBubbleColor: '#ff00ff', myBubbleTextColor: '#ffffff', theirBubbleColor: '#1a1a2e', theirBubbleTextColor: '#ff88ff', bubbleMaxWidth: 75, bubbleRadius: 18, fontSize: 15, timestampColor: '#ff88ff' },
                apps: { headerBg: 'rgba(10,10,10,0.95)', headerTextColor: '#ff00ff', listBg: '#0d0d1a', listTextColor: '#ffffff', listSubTextColor: '#ff88ff', listBorderColor: '#2a0a3e', isDarkMode: true },
                icons: { phone: '', messages: '', contacts: '', camera: '', album: '', settings: '', store: '' }
            }
        },
        ocean: {
            name: '🌊 오션',
            theme: {
                frame: { color: '#1a3a4a', borderColor: '#2dd4bf', thickness: 10, radius: 55, shadow: 'glow', glowColor: '#2dd4bf' },
                phone: { bgColor: '#0c2233', bgImage: '', bgGradient: 'linear-gradient(135deg, #0c2233 0%, #1a4a5a 100%)', notchColor: '#0a1a2a', homeBarColor: 'rgba(45,212,191,0.5)', font: '-apple-system, sans-serif', accentColor: '#2dd4bf', iconSize: 65, iconRadius: 16 },
                messages: { bgColor: '#0c2233', bgImage: '', myBubbleColor: '#2dd4bf', myBubbleTextColor: '#000000', theirBubbleColor: '#1a3a4a', theirBubbleTextColor: '#ffffff', bubbleMaxWidth: 75, bubbleRadius: 18, fontSize: 15, timestampColor: '#5eead4' },
                apps: { headerBg: 'rgba(12,34,51,0.95)', headerTextColor: '#2dd4bf', listBg: '#0f2a3a', listTextColor: '#ffffff', listSubTextColor: '#5eead4', listBorderColor: '#1a4a5a', isDarkMode: true },
                icons: { phone: '', messages: '', contacts: '', camera: '', album: '', settings: '', store: '' }
            }
        },
        rose: {
            name: '🌸 로즈',
            theme: {
                frame: { color: '#4a2a3a', borderColor: '#f472b6', thickness: 10, radius: 55, shadow: 'glow', glowColor: '#f472b6' },
                phone: { bgColor: '#2a1a2a', bgImage: '', bgGradient: 'linear-gradient(135deg, #2a1a2a 0%, #4a2a4a 100%)', notchColor: '#1a0a1a', homeBarColor: 'rgba(244,114,182,0.5)', font: '-apple-system, sans-serif', accentColor: '#f472b6', iconSize: 65, iconRadius: 16 },
                messages: { bgColor: '#2a1a2a', bgImage: '', myBubbleColor: '#f472b6', myBubbleTextColor: '#ffffff', theirBubbleColor: '#3a2a3a', theirBubbleTextColor: '#fda4af', bubbleMaxWidth: 75, bubbleRadius: 18, fontSize: 15, timestampColor: '#fda4af' },
                apps: { headerBg: 'rgba(42,26,42,0.95)', headerTextColor: '#f472b6', listBg: '#2a1a2a', listTextColor: '#ffffff', listSubTextColor: '#fda4af', listBorderColor: '#4a2a4a', isDarkMode: true },
                icons: { phone: '', messages: '', contacts: '', camera: '', album: '', settings: '', store: '' }
            }
        }
    };

    let currentTheme = null;
    let currentEditSection = 'frame'; // 현재 편집 중인 섹션

    // ===== IndexedDB 설정 (용량 제한 없음!) =====
    const DB_NAME = 'STPhoneThemeDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'themes';
    let db = null;

    function openDB() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            request.onupgradeneeded = (e) => {
                const database = e.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }

    async function saveToIndexedDB(data) {
        try {
            const database = await openDB();
            return new Promise((resolve, reject) => {
                const tx = database.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const request = store.put({ id: 'currentTheme', data: data });

                tx.oncomplete = () => {
                    console.log('🎨 [Theme] IndexedDB transaction complete');
                    resolve(true);
                };

                tx.onerror = (e) => {
                    console.error('🎨 [Theme] IndexedDB transaction error:', e);
                    reject(tx.error);
                };

                request.onerror = (e) => {
                    console.error('🎨 [Theme] IndexedDB put error:', e);
                    reject(request.error);
                };
            });
        } catch (e) {
            console.error('🎨 [Theme] saveToIndexedDB error:', e);
            throw e;
        }
    }

    async function loadFromIndexedDB() {
        try {
            const database = await openDB();
            return new Promise((resolve) => {
                const tx = database.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.get('currentTheme');
                request.onsuccess = () => {
                    const result = request.result?.data || null;
                    if (result) {
                        console.log('🎨 [Theme] Loaded from IndexedDB');
                    }
                    resolve(result);
                };
                request.onerror = () => resolve(null);
            });
        } catch (e) {
            console.error('🎨 [Theme] loadFromIndexedDB error:', e);
            return null;
        }
    }

    async function init() {
        // 테마 앱이 설치되어 있을 때만 테마 로드 및 적용
        const globalApps = JSON.parse(localStorage.getItem('st_phone_global_installed_apps') || '[]');
        if (!globalApps.includes('theme')) {
            console.log('🎨 [Theme] Theme app not installed, skipping');
            return;
        }
        
        await loadTheme();
        applyTheme();
        console.log('🎨 [ST Phone] Theme App Initialized');
    }

    async function loadTheme() {
        try {
            // IndexedDB에서 먼저 로드 시도
            let saved = await loadFromIndexedDB();

            // IndexedDB에 없으면 localStorage에서 마이그레이션
            if (!saved) {
                const legacySaved = localStorage.getItem(STORAGE_KEY);
                if (legacySaved) {
                    saved = JSON.parse(legacySaved);
                    // IndexedDB로 마이그레이션
                    await saveToIndexedDB(saved);
                    localStorage.removeItem(STORAGE_KEY); // 기존 데이터 삭제해서 공간 확보
                    console.log('🎨 [Theme] Migrated from localStorage to IndexedDB');
                }
            }

            if (saved) {
                currentTheme = structuredClone(DEFAULT_THEME);
                deepMerge(currentTheme, saved);

                const hasImages = Object.values(currentTheme.icons || {}).some(v => v && v.length > 0) ||
                                  currentTheme.phone?.bgImage ||
                                  currentTheme.messages?.bgImage;
                if (hasImages) {
                    console.log('🎨 [Theme] Loaded with images:', {
                        icons: Object.keys(currentTheme.icons || {}).filter(k => currentTheme.icons[k]),
                        phoneBg: currentTheme.phone?.bgImage ? 'yes' : 'no',
                        msgBg: currentTheme.messages?.bgImage ? 'yes' : 'no'
                    });
                }
            } else {
                currentTheme = structuredClone(DEFAULT_THEME);
                console.log('🎨 [Theme] No saved theme, using default');
            }
        } catch (e) {
            console.error('Theme load error:', e);
            currentTheme = structuredClone(DEFAULT_THEME);
        }
    }

    async function saveTheme() {
        try {
            let themeToSave = structuredClone(currentTheme);
            let sizeInMB = new Blob([JSON.stringify(themeToSave)]).size / (1024 * 1024);

            console.log(`🎨 [Theme] Size: ${sizeInMB.toFixed(2)}MB`);

            // 50MB 초과 시에만 가벼운 압축 (IndexedDB는 수백 MB까지 가능)
            if (sizeInMB > 50) {
                console.log(`🖼️ [Theme] Compressing very large images...`);
                themeToSave = await compressAllImages(themeToSave);
                sizeInMB = new Blob([JSON.stringify(themeToSave)]).size / (1024 * 1024);
                currentTheme = themeToSave;
            }

            // IndexedDB에 저장 (용량 거의 무제한)
            await saveToIndexedDB(themeToSave);
            console.log(`🎨 [Theme] Saved to IndexedDB (${sizeInMB.toFixed(2)}MB)`);
            return true;
        } catch (e) {
            console.error('Theme save error:', e);
            toastr.error('테마 저장에 실패했습니다: ' + e.message);
            return false;
        }
    }

    // 강한 압축 (품질 낮춤)
    async function compressAllImagesStrong(theme) {
        const compressed = structuredClone(theme);

        // 고화질 유지 (IndexedDB는 용량 여유)
        if (compressed.phone?.bgImage) {
            compressed.phone.bgImage = await compressImage(compressed.phone.bgImage, 1920, 0.9);
        }
        if (compressed.messages?.bgImage) {
            compressed.messages.bgImage = await compressImage(compressed.messages.bgImage, 1920, 0.9);
        }
        if (compressed.icons) {
            for (const key of Object.keys(compressed.icons)) {
                if (compressed.icons[key]) {
                    compressed.icons[key] = await compressImage(compressed.icons[key], 256, 0.9);
                }
            }
        }

        return compressed;
    }

    // ===== 이미지 압축 함수 (고화질 유지) =====
    function compressImage(base64Data, maxWidth = 1920, quality = 0.9) {
        return new Promise((resolve) => {
            // base64가 아니거나 비어있으면 그냥 반환
            if (!base64Data || !base64Data.startsWith('data:image')) {
                console.warn('🖼️ [Theme] Invalid image data');
                resolve(base64Data);
                return;
            }

            const img = new Image();

            // 타임아웃 설정 (10초)
            const timeout = setTimeout(() => {
                console.warn('🖼️ [Theme] Image load timeout');
                resolve(base64Data);
            }, 10000);

            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // 최대 너비 제한 (너무 큰 이미지만 리사이즈)
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // 모든 이미지를 JPEG로 변환 (용량 최적화, PNG 제외)
                    const isPng = base64Data.includes('image/png');
                    const format = isPng ? 'image/png' : 'image/jpeg';
                    const compressed = canvas.toDataURL(format, quality);

                    const originalSize = (base64Data.length / 1024).toFixed(1);
                    const newSize = (compressed.length / 1024).toFixed(1);
                    console.log(`🖼️ [Theme] Image processed: ${originalSize}KB → ${newSize}KB (${width}x${height})`);
                    resolve(compressed);
                } catch (err) {
                    console.error('🖼️ [Theme] Canvas error:', err);
                    resolve(base64Data);
                }
            };

            img.onerror = (err) => {
                clearTimeout(timeout);
                console.error('🖼️ [Theme] Image load failed:', err);
                // 로드 실패 시 원본 그대로 저장 시도
                resolve(base64Data);
            };

            img.src = base64Data;
        });
    }

    // 테마 내 모든 이미지 압축 (50MB 초과 시에만 사용)
    async function compressAllImages(theme) {
        const compressed = structuredClone(theme);

        // 고화질 유지하면서 약간만 압축
        if (compressed.phone?.bgImage) {
            compressed.phone.bgImage = await compressImage(compressed.phone.bgImage, 1920, 0.85);
        }

        if (compressed.messages?.bgImage) {
            compressed.messages.bgImage = await compressImage(compressed.messages.bgImage, 1920, 0.85);
        }

        if (compressed.icons) {
            for (const key of Object.keys(compressed.icons)) {
                if (compressed.icons[key]) {
                    compressed.icons[key] = await compressImage(compressed.icons[key], 256, 0.85);
                }
            }
        }

        return compressed;
    }
    // 딥 머지 헬퍼
    function deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {};
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    // 테마 적용
    function applyTheme() {
        if (!currentTheme) return;

        const $container = $('#st-phone-container');
        if (!$container.length) return;

        const { frame, phone, messages, apps } = currentTheme;

        // === 프레임 적용 ===
        let frameStyle = `
            background-color: ${frame.color};
            border-radius: ${frame.radius}px;
            box-shadow: 0 0 0 ${frame.thickness}px ${frame.color}, 0 0 0 ${frame.thickness + 1}px ${frame.borderColor}
        `;

        if (frame.shadow === 'glow') {
            frameStyle += `, 0 0 30px ${frame.glowColor}, 0 0 60px ${frame.glowColor}40`;
        } else if (frame.shadow === 'default') {
            frameStyle += `, 0 30px 60px rgba(0,0,0,0.6)`;
        }
        frameStyle += ';';

        $container.attr('style', frameStyle);
        $container.css('padding', '12px');

        // === 폰 내부 배경 ===
        const $screen = $container.find('.st-phone-screen');
        // 배경 이미지 우선, 없으면 그라데이션, 그것도 없으면 단색
        if (phone.bgImage && phone.bgImage.length > 0) {
            $screen.css({
                'background-image': `url(${phone.bgImage})`,
                'background-size': 'cover',
                'background-position': 'center',
                'background-repeat': 'no-repeat'
            });
        } else if (phone.bgGradient && phone.bgGradient.length > 0) {
            $screen.css({
                'background-image': 'none',
                'background': phone.bgGradient
            });
        } else {
            $screen.css({
                'background-image': 'none',
                'background': phone.bgColor
            });
        }

        // === 노치 & 홈바 ===
        $container.find('.st-phone-notch').css('background-color', phone.notchColor);
        $container.find('.st-phone-home-bar').css('background-color', phone.homeBarColor);

        // === 아이콘 크기 ===
        $container.find('.st-app-icon').css({
            'width': `${phone.iconSize}px`,
            'height': `${phone.iconSize}px`,
            'border-radius': `${phone.iconRadius}px`
        });

        // === 커스텀 아이콘 적용 ===
        const icons = currentTheme.icons || {};
        Object.keys(icons).forEach(appId => {
            const iconImage = icons[appId];
            if (iconImage && iconImage.length > 0) {
                const $icon = $container.find(`.st-app-icon[data-app="${appId}"]`);
                if ($icon.length) {
                    $icon.css({
                        'background-color': 'transparent',  // 투명 배경 지원
                        'background-image': `url(${iconImage})`,
                        'background-size': 'cover',
                        'background-position': 'center'
                    });
                    // SVG 숨기기
                    $icon.find('svg').css('opacity', '0');
                }
            }
        });

        // === 다크모드 클래스 ===
        if (apps.isDarkMode) {
            $container.addClass('dark-mode');
        } else {
            $container.removeClass('dark-mode');
        }

        // === CSS 변수 업데이트 ===
        const root = $container[0];
        root.style.setProperty('--pt-bg-color', apps.listBg);
        root.style.setProperty('--pt-text-color', apps.listTextColor);
        root.style.setProperty('--pt-sub-text', apps.listSubTextColor);
        root.style.setProperty('--pt-card-bg', apps.listBg);
        root.style.setProperty('--pt-border', apps.listBorderColor);
        root.style.setProperty('--pt-accent', phone.accentColor);
        root.style.setProperty('--pt-font', phone.font);

        // === 메시지 앱 전용 변수 ===
        root.style.setProperty('--msg-my-bubble', messages.myBubbleColor);
        root.style.setProperty('--msg-my-text', messages.myBubbleTextColor);
        root.style.setProperty('--msg-their-bubble', messages.theirBubbleColor);
        root.style.setProperty('--msg-their-text', messages.theirBubbleTextColor);
        root.style.setProperty('--msg-bubble-width', `${messages.bubbleMaxWidth}%`);
        root.style.setProperty('--msg-bubble-radius', `${messages.bubbleRadius}px`);
        root.style.setProperty('--msg-font-size', `${messages.fontSize}px`);
        root.style.setProperty('--msg-timestamp', messages.timestampColor);

        // 메시지 배경 이미지 설정
        if (messages.bgImage && messages.bgImage.length > 0) {
            root.style.setProperty('--msg-bg-image', `url("${messages.bgImage}")`);
            root.style.setProperty('--msg-bg-color', 'transparent');
            console.log('🖼️ [Theme] Message bg image set, length:', messages.bgImage.length);

            // 현재 열려있는 채팅창에도 직접 적용
            const $chatMessages = $container.find('.st-chat-messages');
            if ($chatMessages.length) {
                $chatMessages.css({
                    'background-image': `url("${messages.bgImage}")`,
                    'background-color': 'transparent',
                    'background-size': 'cover',
                    'background-position': 'center',
                    'background-repeat': 'no-repeat'
                });
            }
        } else {
            root.style.setProperty('--msg-bg-image', 'none');
            root.style.setProperty('--msg-bg-color', messages.bgColor || phone.bgColor || '#f5f5f7');

            // 현재 열려있는 채팅창에도 직접 적용
            const $chatMessages = $container.find('.st-chat-messages');
            if ($chatMessages.length) {
                $chatMessages.css({
                    'background-image': 'none',
                    'background-color': messages.bgColor || phone.bgColor || '#f5f5f7'
                });
            }
        }

        console.log('🎨 Theme Applied');
    }

    function open() {
        // 테마가 로드되지 않았으면 로드
        if (!currentTheme) {
            loadTheme();
        }

        const $screen = window.STPhone.UI.getContentElement();
        $screen.empty();
        currentEditSection = 'frame';
        renderMainMenu();
    }

    function renderMainMenu() {
        const $screen = window.STPhone.UI.getContentElement();
        $screen.empty();

        const html = `
            <div class="st-theme-app" style="
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: var(--pt-bg-color); color: var(--pt-text-color);
                overflow-y: auto; padding: 20px; box-sizing: border-box;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                    <button id="theme-back-btn" style="
                        background: none; border: none; font-size: 28px; cursor: pointer;
                        color: var(--pt-accent); padding: 0; margin-right: 10px;
                    ">←</button>
                    <h1 style="font-size: 28px; font-weight: 700; margin: 0;">🎨 테마</h1>
                </div>

                <!-- 프리셋 섹션 -->
                <div class="st-section" style="background: var(--pt-card-bg); border-radius: 12px; margin-bottom: 20px; overflow: hidden;">
                    <div style="padding: 16px; border-bottom: 1px solid var(--pt-border);">
                        <span style="font-size: 14px; font-weight: 600; color: var(--pt-sub-text);">프리셋</span>
                    </div>
                    <div id="theme-presets" style="display: flex; gap: 10px; padding: 16px; overflow-x: auto;"></div>
                </div>

                <!-- 커스텀 편집 섹션 -->
                <div class="st-section" style="background: var(--pt-card-bg); border-radius: 12px; margin-bottom: 20px; overflow: hidden;">
                    <div style="padding: 16px; border-bottom: 1px solid var(--pt-border);">
                        <span style="font-size: 14px; font-weight: 600; color: var(--pt-sub-text);">커스텀 편집</span>
                    </div>

                    <div class="theme-menu-item" data-section="frame" style="padding: 16px; border-bottom: 1px solid var(--pt-border); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span>📱 폰 프레임 (케이스)</span>
                        <span style="color: var(--pt-sub-text);">›</span>
                    </div>
                    <div class="theme-menu-item" data-section="phone" style="padding: 16px; border-bottom: 1px solid var(--pt-border); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span>🏠 전체 UI</span>
                        <span style="color: var(--pt-sub-text);">›</span>
                    </div>
                    <div class="theme-menu-item" data-section="messages" style="padding: 16px; border-bottom: 1px solid var(--pt-border); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span>💬 메시지 앱</span>
                        <span style="color: var(--pt-sub-text);">›</span>
                    </div>
                    <div class="theme-menu-item" data-section="apps" style="padding: 16px; border-bottom: 1px solid var(--pt-border); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span>🎛️ 앱 공통</span>
                        <span style="color: var(--pt-sub-text);">›</span>
                    </div>
                    <div class="theme-menu-item" data-section="icons" style="padding: 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span>🖼️ 앱 아이콘</span>
                        <span style="color: var(--pt-sub-text);">›</span>
                    </div>
                </div>

                <!-- 가져오기/내보내기 -->
                <div class="st-section" style="background: var(--pt-card-bg); border-radius: 12px; margin-bottom: 20px; overflow: hidden;">
                    <div style="padding: 16px; border-bottom: 1px solid var(--pt-border);">
                        <span style="font-size: 14px; font-weight: 600; color: var(--pt-sub-text);">테마 공유</span>
                    </div>

                    <div id="theme-export-btn" style="padding: 16px; border-bottom: 1px solid var(--pt-border); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span>📤 테마 내보내기 (JSON)</span>
                        <span style="color: var(--pt-sub-text);">›</span>
                    </div>
                    <div id="theme-import-btn" style="padding: 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <span>📥 테마 불러오기</span>
                        <span style="color: var(--pt-sub-text);">›</span>
                    </div>
                    <input type="file" id="theme-file-input" accept=".json" style="display: none;">
                </div>

                <!-- 초기화 -->
                <div class="st-section" style="background: var(--pt-card-bg); border-radius: 12px; margin-bottom: 100px; overflow: hidden;">
                    <div id="theme-reset-btn" style="padding: 16px; cursor: pointer; text-align: center; color: #ff3b30;">
                        🔄 기본값으로 초기화
                    </div>
                </div>
            </div>
        `;

        $screen.append(html);

        // 프리셋 렌더링
        renderPresets();

        // 이벤트 바인딩
        $('#theme-back-btn').on('click', () => {
            window.STPhone.UI.renderHomeScreen();
        });

        $('.theme-menu-item').on('click', function() {
            const section = $(this).data('section');
            renderEditSection(section);
        });

        $('#theme-export-btn').on('click', exportTheme);
        $('#theme-import-btn').on('click', () => $('#theme-file-input').click());
        $('#theme-file-input').on('change', importTheme);
        $('#theme-reset-btn').on('click', resetTheme);
    }

    function renderPresets() {
        const $container = $('#theme-presets');
        $container.empty();

        Object.entries(PRESET_THEMES).forEach(([key, preset]) => {
            const previewColor = preset.theme.phone.bgGradient || preset.theme.phone.bgColor;
            const frameColor = preset.theme.frame.color;

            $container.append(`
                <div class="theme-preset-item" data-preset="${key}" style="
                    min-width: 70px; text-align: center; cursor: pointer;
                ">
                    <div style="
                        width: 50px; height: 80px; margin: 0 auto 8px;
                        border-radius: 10px; background: ${previewColor};
                        box-shadow: 0 0 0 3px ${frameColor};
                    "></div>
                    <span style="font-size: 12px;">${preset.name}</span>
                </div>
            `);
        });

        $('.theme-preset-item').on('click', async function() {
            const presetKey = $(this).data('preset');
            await applyPreset(presetKey);
        });
    }

    async function applyPreset(presetKey) {
        const preset = PRESET_THEMES[presetKey];
        if (!preset) return;

        currentTheme = structuredClone(preset.theme);
        await saveTheme();
        applyTheme();
        toastr.success(`${preset.name} 테마 적용됨`);
        renderMainMenu(); // 새로고침
    }

    function renderEditSection(section) {
        currentEditSection = section;
        const $screen = window.STPhone.UI.getContentElement();
        $screen.empty();

        const titles = {
            frame: '📱 폰 프레임 (케이스)',
            phone: '🏠 전체 UI',
            messages: '💬 메시지 앱',
            apps: '🎛️ 앱 공통',
            icons: '🖼️ 앱 아이콘'
        };

        const html = `
            <div class="st-theme-edit" style="
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: var(--pt-bg-color); color: var(--pt-text-color);
                overflow-y: auto; padding: 20px; box-sizing: border-box;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                    <button id="edit-back-btn" style="
                        background: none; border: none; font-size: 28px; cursor: pointer;
                        color: var(--pt-accent); padding: 0; margin-right: 10px;
                    ">←</button>
                    <h1 style="font-size: 24px; font-weight: 700; margin: 0;">${titles[section]}</h1>
                </div>

                <div id="edit-fields" class="st-section" style="
                    background: var(--pt-card-bg); border-radius: 12px;
                    margin-bottom: 100px; overflow: hidden;
                "></div>
            </div>
        `;

        $screen.append(html);

        // 필드 렌더링 (폰 컨테이너 내부에서 찾기)
        const $fieldsContainer = $screen.find('#edit-fields');
        renderEditFields(section, $fieldsContainer);

        // 뒤로가기
        $('#edit-back-btn').on('click', () => {
            saveTheme();
            applyTheme();
            renderMainMenu();
        });
    }

    function renderEditFields(section, $container) {
        // $container가 전달되지 않으면 폰 컨테이너 내에서 찾기
        if (!$container || !$container.length) {
            $container = $('#st-phone-container').find('#edit-fields');
        }

        if (!$container.length) {
            console.error('[Theme] edit-fields container not found');
            return;
        }

        // data가 없으면 초기화
        if (!currentTheme[section]) {
            currentTheme[section] = {};
        }
        const data = currentTheme[section];

        const fieldConfigs = {
            frame: [
                { key: 'color', label: '프레임 색상', type: 'color' },
                { key: 'borderColor', label: '테두리 색상', type: 'color' },
                { key: 'thickness', label: '두께', type: 'range', min: 5, max: 20 },
                { key: 'radius', label: '모서리 둥글기', type: 'range', min: 20, max: 80 },
                { key: 'shadow', label: '그림자 스타일', type: 'select', options: [
                    { value: 'default', label: '기본' },
                    { value: 'glow', label: '글로우' },
                    { value: 'none', label: '없음' }
                ]},
                { key: 'glowColor', label: '글로우 색상', type: 'color' }
            ],
            phone: [
                { key: 'bgColor', label: '배경 색상', type: 'color' },
                { key: 'bgGradient', label: '배경 그라데이션', type: 'text', placeholder: 'linear-gradient(...)' },
                { key: 'bgImage', label: '배경 이미지', type: 'image' },
                { key: 'notchColor', label: '노치 색상', type: 'color' },
                { key: 'homeBarColor', label: '홈바 색상', type: 'text', placeholder: 'rgba(255,255,255,0.4)' },
                { key: 'accentColor', label: '강조 색상', type: 'color' },
                { key: 'iconSize', label: '아이콘 크기', type: 'range', min: 50, max: 80 },
                { key: 'iconRadius', label: '아이콘 둥글기', type: 'range', min: 8, max: 30 }
            ],
            messages: [
                { key: 'bgColor', label: '채팅방 배경색', type: 'color' },
                { key: 'bgImage', label: '채팅방 배경이미지', type: 'image' },
                { key: 'myBubbleColor', label: '내 말풍선 색상', type: 'color' },
                { key: 'myBubbleTextColor', label: '내 말풍선 글자색', type: 'color' },
                { key: 'theirBubbleColor', label: '상대 말풍선 색상', type: 'color' },
                { key: 'theirBubbleTextColor', label: '상대 말풍선 글자색', type: 'color' },
                { key: 'bubbleMaxWidth', label: '말풍선 최대 너비 (%)', type: 'range', min: 50, max: 95 },
                { key: 'bubbleRadius', label: '말풍선 둥글기', type: 'range', min: 8, max: 30 },
                { key: 'fontSize', label: '글자 크기', type: 'range', min: 12, max: 22 },
                { key: 'timestampColor', label: '타임스탬프 색상', type: 'color' }
            ],
            apps: [
                { key: 'isDarkMode', label: '다크 모드', type: 'toggle' },
                { key: 'headerBg', label: '헤더 배경', type: 'text', placeholder: 'rgba(255,255,255,0.9)' },
                { key: 'headerTextColor', label: '헤더 글자색', type: 'color' },
                { key: 'listBg', label: '목록 배경색', type: 'color' },
                { key: 'listTextColor', label: '목록 글자색', type: 'color' },
                { key: 'listSubTextColor', label: '보조 글자색', type: 'color' },
                { key: 'listBorderColor', label: '구분선 색상', type: 'color' }
            ],
            icons: [
                { key: 'phone', label: '📞 전화', type: 'image' },
                { key: 'messages', label: '💬 메시지', type: 'image' },
                { key: 'contacts', label: '👤 연락처', type: 'image' },
                { key: 'camera', label: '📷 카메라', type: 'image' },
                { key: 'album', label: '🖼️ 앨범', type: 'image' },
                { key: 'settings', label: '⚙️ 설정', type: 'image' },
                { key: 'store', label: '🛒 App Store', type: 'image' }
            ]
        };

        const fields = fieldConfigs[section] || [];

        fields.forEach(field => {
            const value = data[field.key];
            let inputHtml = '';

            switch (field.type) {
                case 'color':
                    inputHtml = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="color" class="theme-input" data-key="${field.key}"
                                   value="${value || '#000000'}" style="width: 40px; height: 30px; border: none; cursor: pointer;">
                            <input type="text" class="theme-input-text" data-key="${field.key}"
                                   value="${value || ''}" style="flex: 1; background: transparent; border: 1px solid var(--pt-border);
                                   border-radius: 6px; padding: 6px 10px; color: var(--pt-text-color); font-size: 14px;">
                        </div>
                    `;
                    break;

                case 'range':
                    inputHtml = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="range" class="theme-input" data-key="${field.key}"
                                   value="${value}" min="${field.min}" max="${field.max}"
                                   style="flex: 1; cursor: pointer;">
                            <span class="range-value" style="min-width: 30px; text-align: right; color: var(--pt-accent);">${value}</span>
                        </div>
                    `;
                    break;

                case 'select':
                    const options = field.options.map(opt =>
                        `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`
                    ).join('');
                    inputHtml = `
                        <select class="theme-input" data-key="${field.key}" style="
                            background: var(--pt-card-bg); border: 1px solid var(--pt-border);
                            border-radius: 6px; padding: 8px; color: var(--pt-text-color); cursor: pointer;
                        ">${options}</select>
                    `;
                    break;

                case 'toggle':
                    inputHtml = `
                        <input type="checkbox" class="st-switch theme-input" data-key="${field.key}"
                               ${value ? 'checked' : ''}>
                    `;
                    break;

                case 'text':
                    inputHtml = `
                        <input type="text" class="theme-input" data-key="${field.key}"
                               value="${value || ''}" placeholder="${field.placeholder || ''}"
                               style="width: 100%; background: transparent; border: 1px solid var(--pt-border);
                               border-radius: 6px; padding: 8px 10px; color: var(--pt-text-color); font-size: 14px; margin-top: 8px;">
                    `;
                    break;

                case 'image':
                    inputHtml = `
                        <div style="margin-top: 8px;">
                            <input type="file" class="theme-image-input" data-key="${field.key}"
                                   accept="image/*" style="display: none;">
                            <button class="theme-image-btn" data-key="${field.key}" style="
                                background: var(--pt-accent); color: white; border: none;
                                border-radius: 8px; padding: 10px 16px; cursor: pointer; font-size: 14px;
                            ">이미지 선택</button>
                            ${value ? `<button class="theme-image-clear" data-key="${field.key}" style="
                                background: #ff3b30; color: white; border: none;
                                border-radius: 8px; padding: 10px 16px; cursor: pointer; font-size: 14px; margin-left: 8px;
                            ">삭제</button>` : ''}
                            ${value ? `<div style="margin-top: 10px;"><img src="${value}" style="max-width: 100%; max-height: 100px; border-radius: 8px;"></div>` : ''}
                        </div>
                    `;
                    break;
            }

            $container.append(`
                <div class="st-row" style="padding: 16px; border-bottom: 1px solid var(--pt-border); flex-direction: column; align-items: stretch;">
                    <label style="font-size: 15px; font-weight: 500; margin-bottom: 8px;">${field.label}</label>
                    ${inputHtml}
                </div>
            `);
        });

        // 이벤트 바인딩
        bindEditEvents(section);
    }

    function bindEditEvents(section) {
        // 일반 입력
        $('.theme-input').on('input change', function() {
            const key = $(this).data('key');
            let value = $(this).val();

            if ($(this).attr('type') === 'checkbox') {
                value = $(this).is(':checked');
            } else if ($(this).attr('type') === 'range') {
                $(this).siblings('.range-value').text(value);
                value = parseInt(value);
            }

            currentTheme[section][key] = value;
            saveTheme();  // 변경 시마다 즉시 저장
            applyTheme();
        });

        // 컨러 텍스트 입력 동기화
        $('.theme-input-text').on('input', function() {
            const key = $(this).data('key');
            const value = $(this).val();
            currentTheme[section][key] = value;
            $(this).siblings('input[type="color"]').val(value);
            saveTheme();  // 변경 시마다 즉시 저장
            applyTheme();
        });

        // 컬러 피커 -> 텍스트 동기화
        $('input[type="color"].theme-input').on('input', function() {
            const key = $(this).data('key');
            const value = $(this).val();
            $(this).siblings('.theme-input-text').val(value);
        });

        // 이미지 버튼
        $('.theme-image-btn').on('click', function() {
            const key = $(this).data('key');
            $(`.theme-image-input[data-key="${key}"]`).click();
        });

        // 이미지 선택
        $('.theme-image-input').on('change', function(e) {
            const key = $(this).data('key');
            const file = e.target.files[0];
            if (!file) return;

            console.log(`🖼️ [Theme] Loading image: ${file.name} (${(file.size/1024).toFixed(1)}KB, ${file.type})`);

            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const base64Data = ev.target.result;
                    console.log(`🖼️ [Theme] Image loaded, base64 length: ${base64Data.length}`);

                    // 이미지 압축 (배경은 크게, 아이콘은 작게)
                    const maxSize = section === 'icons' ? 256 : 1920;
                    const compressed = await compressImage(base64Data, maxSize, 0.9);

                    if (!compressed || compressed.length < 100) {
                        toastr.error('이미지 처리에 실패했습니다. 다른 이미지를 시도해주세요.');
                        return;
                    }

                    currentTheme[section][key] = compressed;
                    const saved = await saveTheme();

                    if (saved) {
                        applyTheme();
                        toastr.success('이미지 저장됨!');
                    }
                    renderEditSection(section);
                } catch (err) {
                    console.error('🖼️ [Theme] Image processing error:', err);
                    toastr.error('이미지 처리 중 오류가 발생했습니다.');
                }
            };

            reader.onerror = (err) => {
                console.error('🖼️ [Theme] FileReader error:', err);
                toastr.error('파일을 읽을 수 없습니다.');
            };

            reader.readAsDataURL(file);
        });

        // 이미지 삭제
        $('.theme-image-clear').on('click', function() {
            const key = $(this).data('key');
            currentTheme[section][key] = '';
            saveTheme();
            applyTheme();
            renderEditSection(section);
        });
    }

    function exportTheme() {
        const json = JSON.stringify(currentTheme, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `st-phone-theme-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
        toastr.success('테마 파일 다운로드됨');
    }

    function importTheme(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                currentTheme = deepMerge(structuredClone(DEFAULT_THEME), imported);
                await saveTheme();
                applyTheme();
                toastr.success('테마 불러오기 완료!');
                renderMainMenu();
            } catch (err) {
                toastr.error('잘못된 테마 파일입니다.');
                console.error('Theme import error:', err);
            }
        };
        reader.readAsText(file);

        // 입력 초기화 (같은 파일 다시 선택 가능하게)
        e.target.value = '';
    }

    async function resetTheme() {
        if (!confirm('테마를 기본값으로 초기화할까요?')) return;

        currentTheme = structuredClone(DEFAULT_THEME);
        await saveTheme();
        applyTheme();
        toastr.info('테마가 초기화되었습니다.');
        renderMainMenu();
    }

    // 스토어 앱 정보
    function getStoreInfo() {
        return {
            id: 'theme',
            name: '테마',
            icon: '🎨',
            description: '폰 전체 UI를 자유롭게 커스터마이징! 프레임, 배경, 말풍선 등을 꾸밀 수 있고 테마를 공유할 수도 있어요.',
            bg: 'linear-gradient(135deg, #667eea, #764ba2)'
        };
    }

    // 현재 테마 가져오기 (외부에서 접근용)
    function getCurrentTheme() {
        return currentTheme;
    }

    // 테마 완전 삭제 (앱 삭제 시 호출)
    async function clearTheme() {
        // IndexedDB에서 삭제
        try {
            const db = await openDB();
            const tx = db.transaction('themes', 'readwrite');
            const store = tx.objectStore('themes');
            store.delete('current');
        } catch (e) {
            console.log('IndexedDB clear failed:', e);
        }
        
        // localStorage에서도 삭제
        localStorage.removeItem(STORAGE_KEY);
        
        // 현재 테마 초기화
        currentTheme = null;
        
        // CSS 변수 모두 제거하여 기본값으로
        const $container = $('#st-phone-container');
        if ($container.length) {
            const root = $container[0];
            const props = [
                '--frame-color', '--frame-border', '--frame-thickness', '--frame-radius', '--frame-shadow',
                '--pt-bg-color', '--pt-text-color', '--pt-sub-text', '--pt-card-bg', '--pt-border', '--pt-accent', '--pt-font',
                '--msg-my-bubble', '--msg-my-text', '--msg-their-bubble', '--msg-their-text',
                '--msg-bubble-width', '--msg-bubble-radius', '--msg-font-size', '--msg-timestamp', '--msg-bg-image', '--msg-bg-color'
            ];
            props.forEach(p => root.style.removeProperty(p));
            
            // 인라인 스타일도 제거
            $('.st-phone-frame').css({ 'background': '', 'border': '', 'border-radius': '', 'box-shadow': '' });
            $('.st-phone-screen').css({ 'background': '', 'background-image': '', 'background-size': '', 'background-position': '' });
        }
        
        console.log('🗑️ Theme cleared completely');
    }

    return {
        init,
        open,
        applyTheme,
        getStoreInfo,
        getCurrentTheme,
        clearTheme
    };
})();

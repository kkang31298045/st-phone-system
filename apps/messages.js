window.STPhone = window.STPhone || {};
window.STPhone.Apps = window.STPhone.Apps || {};

window.STPhone.Apps.Messages = (function() {
    'use strict';

    function getSlashCommandParserInternal() {
        return window.SillyTavern?.getContext()?.SlashCommandParser || window.SlashCommandParser;
    }

    function normalizeModelOutput(raw) {
        if (raw == null) return '';
        if (typeof raw === 'string') return raw;
        if (typeof raw?.content === 'string') return raw.content;
        if (typeof raw?.text === 'string') return raw.text;
        const choiceContent = raw?.choices?.[0]?.message?.content;
        if (typeof choiceContent === 'string') return choiceContent;
        const dataContent = raw?.data?.content;
        if (typeof dataContent === 'string') return dataContent;
        try {
            return JSON.stringify(raw);
        } catch (e) {
            return String(raw);
        }
    }

    async function generateWithProfile(prompt, maxTokens = 1024) {
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        const profileId = settings.connectionProfileId;

        const debugId = Date.now();
        const startedAt = performance?.now?.() || 0;

        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context) throw new Error('SillyTavern context not available');

            if (profileId) {
                const connectionManager = context.ConnectionManagerRequestService;
                if (connectionManager && typeof connectionManager.sendRequest === 'function') {
                    console.debug('📱 [Messages][AI] sendRequest start', { debugId, profileId, maxTokens, promptLen: String(prompt || '').length });

                    const overrides = {};
                    if (maxTokens) {
                        overrides.max_tokens = maxTokens;
                    }

                    const result = await connectionManager.sendRequest(
                        profileId,
                        [{ content: prompt, role: 'user' }],
                        maxTokens,
                        {},
                        overrides
                    );

                    const text = normalizeModelOutput(result);
                    const elapsedMs = (performance?.now?.() || 0) - startedAt;
                    console.debug('📱 [Messages][AI] sendRequest done', { debugId, elapsedMs: Math.round(elapsedMs), resultType: typeof result, outLen: String(text || '').length });
                    return String(text || '').trim();
                }

                console.warn('📱 [Messages][AI] ConnectionManagerRequestService unavailable, falling back', { debugId, profileId });
            }

            const parser = getSlashCommandParserInternal();
            const genCmd = parser?.commands['genraw'] || parser?.commands['gen'];
            if (!genCmd) throw new Error('AI 명령어를 찾을 수 없습니다');

            const result = await genCmd.callback({ quiet: 'true' }, prompt);

            const elapsedMs = (performance?.now?.() || 0) - startedAt;
            console.debug('📱 [Messages][AI] slash gen done', { debugId, elapsedMs: Math.round(elapsedMs), outLen: String(result || '').length });
            return String(result || '').trim();

        } catch (e) {
            const elapsedMs = (performance?.now?.() || 0) - startedAt;
            console.error('[Messages] generateWithProfile 실패:', { debugId, elapsedMs: Math.round(elapsedMs), profileId, maxTokens, error: e });
            throw e;
        }
    }

    const notificationCss = `
        <style id="st-phone-notification-css">
            .st-bubble-notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }
            .st-bubble-notification {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                pointer-events: auto;
                cursor: pointer;
                animation: bubbleSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .st-bubble-notification.hiding {
                animation: bubbleSlideOut 0.3s ease-in forwards;
            }
            @keyframes bubbleSlideIn {
                from { transform: translateX(120%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes bubbleSlideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(120%); opacity: 0; }
            }
            .st-bubble-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                object-fit: cover;
                flex-shrink: 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .st-bubble-content {
                max-width: 280px;
                background: linear-gradient(135deg, #34c759 0%, #30b350 100%);
                color: white;
                padding: 10px 14px;
                border-radius: 18px;
                border-bottom-left-radius: 4px;
                font-size: 14px;
                line-height: 1.4;
                box-shadow: 0 4px 15px rgba(52, 199, 89, 0.4);
                word-break: break-word;
            }
            .st-bubble-sender {
                font-size: 11px;
                font-weight: 600;
                opacity: 0.9;
                margin-bottom: 3px;
            }
            .st-bubble-text {
                font-size: 14px;
            }
        </style>
    `;

    function ensureNotificationCss() {
        if (!$('#st-phone-notification-css').length) {
            $('head').append(notificationCss);
        }
    }

    ensureNotificationCss();

    const css = `
        <style>
            .st-messages-app {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%; z-index: 999;
                display: flex; flex-direction: column;
                background: var(--pt-bg-color, #f5f5f7);
                color: var(--pt-text-color, #000);
                font-family: var(--pt-font, -apple-system, sans-serif);
            }
            .st-messages-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 15px 10px;
            }
            .st-messages-title {
                font-size: 28px;
                font-weight: 700;
            }
            .st-messages-new-group {
                background: var(--pt-accent, #007aff);
                color: white;
                border: none;
                width: 36px; height: 36px;
                border-radius: 50%;
                font-size: 18px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .st-messages-tabs {
                display: flex;
                padding: 0 15px;
                gap: 0;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
            }
            .st-messages-tab {
                flex: 1;
                padding: 12px;
                text-align: center;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                color: var(--pt-sub-text, #86868b);
                transition: all 0.2s;
            }
            .st-messages-tab.active {
                color: var(--pt-accent, #007aff);
                border-bottom-color: var(--pt-accent, #007aff);
            }
            .st-messages-list {
                flex: 1;
                overflow-y: auto;
                padding: 0 15px;
            }
            .st-thread-item {
                display: flex;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
                cursor: pointer;
            }
            .st-thread-avatar {
                width: 50px; height: 50px;
                border-radius: 50%;
                background: #ddd;
                object-fit: cover;
                margin-right: 12px;
            }
            .st-thread-avatar-group {
                width: 50px; height: 50px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin-right: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                color: white;
            }
            .st-thread-info { flex: 1; min-width: 0; }
            .st-thread-name { font-size: 16px; font-weight: 600; }
            .st-thread-members { font-size: 12px; color: var(--pt-sub-text, #86868b); }
            .st-thread-preview { font-size: 14px; color: var(--pt-sub-text, #86868b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .st-thread-meta { text-align: right; }
            .st-thread-time { font-size: 12px; color: var(--pt-sub-text, #86868b); }
            .st-thread-badge { background: #ff3b30; color: white; font-size: 12px; padding: 2px 8px; border-radius: 10px; margin-top: 4px; display: inline-block; }
            .st-messages-empty { text-align: center; padding: 60px 20px; color: var(--pt-sub-text, #86868b); }

            /* 채팅 화면 */
            .st-chat-screen {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%;
                background: var(--pt-bg-color, #f5f5f7);
                display: flex; flex-direction: column;
                z-index: 1001;
            }
.st-chat-header {
                display: flex; align-items: center; padding: 12px 15px;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
                background: var(--pt-bg-color, #f5f5f7); flex-shrink: 0;
            }
            .st-chat-back {
                background: none; border: none; color: var(--pt-accent, #007aff);
                font-size: 24px; cursor: pointer; padding: 8px;
                display: flex; align-items: center; justify-content: center;
                position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
            }
            .st-chat-contact { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
            .st-chat-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
            .st-chat-name { font-weight: 600; font-size: 14px; color: var(--pt-text-color, #000); }
            .st-chat-messages {
                flex: 1; overflow-y: auto; padding: 15px; padding-bottom: 10px;
                display: flex; flex-direction: column; gap: 8px;
                background-color: var(--msg-bg-color, var(--pt-bg-color, #f5f5f7));
                background-image: var(--msg-bg-image, none);
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }

/* 그룹챗 메시지 스타일 */
.st-msg-wrapper {
                display: flex;
                flex-direction: column;
                max-width: 100%;
                width: fit-content;
            }
            .st-msg-wrapper.me {
                align-self: flex-end;
                align-items: flex-end;
            }
            .st-msg-wrapper.them {
                align-self: flex-start;
                align-items: flex-start;
            }
            .st-msg-sender-info {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 4px;
            }
            .st-msg-sender-avatar {
                width: 24px; height: 24px;
                border-radius: 50%;
                object-fit: cover;
            }
            .st-msg-sender-name {
                font-size: 12px;
                font-weight: 600;
                color: var(--pt-sub-text, #86868b);
            }

.st-msg-bubble { max-width: 75%; min-width: 40px; padding: 10px 14px; border-radius: 18px; font-size: 15px; line-height: 1.4; word-wrap: break-word; word-break: keep-all; }
            .st-msg-bubble.me { align-self: flex-end; background: var(--pt-accent, #007aff); color: white; border-bottom-right-radius: 4px; }
            .st-msg-bubble.them { align-self: flex-start; background: var(--pt-card-bg, #e5e5ea); color: var(--pt-text-color, #000); border-bottom-left-radius: 4px; }
            .st-msg-image { max-width: 200px; border-radius: 12px; cursor: pointer; }

            /* 번역 스타일 */
            .st-msg-translation {
                font-size: 12px;
                color: var(--pt-sub-text, #666);
                margin-top: 6px;
                padding-top: 6px;
                border-top: 1px dashed rgba(0,0,0,0.1);
                line-height: 1.4;
            }
            .st-msg-original {
                margin-bottom: 4px;
            }
            .st-msg-bubble.them .st-msg-translation {
                border-top-color: rgba(0,0,0,0.1);
            }

            /* 그룹챗 전용 말풍선 - 더 넓게 */
            .st-msg-wrapper .st-msg-bubble { max-width: 100%; }
            /* 입력창 영역 */
            .st-chat-input-area {
                display: flex; align-items: flex-end; padding: 12px 15px; padding-bottom: 45px; gap: 10px;
                border-top: 1px solid var(--pt-border, #e5e5e5); background: var(--pt-bg-color, #f5f5f7); flex-shrink: 0;
            }
            .st-chat-textarea {
                flex: 1; border: 1px solid var(--pt-border, #e5e5e5); background: var(--pt-card-bg, #fff);
                border-radius: 20px; padding: 10px 15px; font-size: 15px; resize: none;
                max-height: 100px; outline: none; color: var(--pt-text-color, #000);
            }
            .st-chat-send {
                width: 40px; height: 40px; border-radius: 50%; border: none; background: var(--pt-accent, #007aff);
                color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
                font-size: 18px; flex-shrink: 0; transition: transform 0.1s, background 0.2s;
            }
.st-chat-send:active { transform: scale(0.95); }

/* 번역 버튼 스타일 추가 */
.st-chat-translate-user-btn {
    width: 40px; height: 40px; border-radius: 50%; border: none;
    background: #34c759; /* 초록색 배경 */
    color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0; transition: transform 0.1s, background 0.2s;
}
.st-chat-translate-user-btn:active { transform: scale(0.95); }

.st-chat-cam-btn {
                width: 40px; height: 40px; border-radius: 50%; border: none;
                background: #e9e9ea; color: #666;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                font-size: 20px; flex-shrink: 0;
            }
            .st-chat-cam-btn:active { background: #d1d1d6; }

            .st-typing-indicator {
                align-self: flex-start; background: var(--pt-card-bg, #e5e5ea); padding: 12px 16px;
                border-radius: 18px; display: none;
            }
            .st-typing-dots { display: flex; gap: 4px; }
            .st-typing-dots span {
                width: 8px; height: 8px; background: #999; border-radius: 50%;
                animation: typingBounce 1.4s infinite;
            }
            .st-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
            .st-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
            @keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }

            /* 사진 입력 팝업 */
            .st-photo-popup {
                position: absolute; top:0; left:0; width:100%; height:100%;
                background: rgba(0,0,0,1); z-index: 2000;
                display: none; align-items: center; justify-content: center;
            }
            .st-photo-box {
                width: 80%; background: var(--pt-card-bg, #fff);
                padding: 20px; border-radius: 20px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                animation: popUp 0.2s ease-out;
            }
            @keyframes popUp { from{transform:scale(0.9);opacity:0;} to{transform:scale(1);opacity:1;} }

            .st-photo-input {
                width: 100%; box-sizing: border-box;
                padding: 12px; margin: 15px 0;
                border: 1px solid var(--pt-border, #e5e5e5);
                border-radius: 10px; background: var(--pt-bg-color, #f9f9f9);
                color: var(--pt-text-color, #000);
                font-size: 15px; outline: none;
            }
            .st-photo-actions { display: flex; gap: 10px; }
            .st-photo-btn { flex: 1; padding: 12px; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
            .st-photo-btn.cancel { background: #e5e5ea; color: #000; }
            .st-photo-btn.send { background: var(--pt-accent, #007aff); color: white; }

            /* 그룹 생성 모달 */
            .st-group-modal {
                position: absolute; top:0; left:0; width:100%; height:100%;
                background: rgba(0,0,0,1); z-index: 2000;
                display: none; align-items: center; justify-content: center;
            }
            .st-group-box {
                width: 90%; max-height: 80%;
                background: var(--pt-card-bg, #fff);
                padding: 20px; border-radius: 20px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                color: var(--pt-text-color, #000);
                display: flex; flex-direction: column;
            }
            .st-group-title {
                font-size: 18px; font-weight: 600;
                margin-bottom: 15px; text-align: center;
            }
            .st-group-name-input {
                width: 100%; padding: 12px;
                border: 1px solid var(--pt-border, #e5e5e5);
                border-radius: 10px; font-size: 15px;
                margin-bottom: 15px; outline: none;
                box-sizing: border-box;
                background: var(--pt-bg-color, #f9f9f9);
                color: var(--pt-text-color, #000);
            }
            .st-group-contacts {
                flex: 1; overflow-y: auto;
                max-height: 250px;
                border: 1px solid var(--pt-border, #e5e5e5);
                border-radius: 10px;
                margin-bottom: 15px;
            }
            .st-group-contact-item {
                display: flex; align-items: center;
                padding: 10px 12px;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
                cursor: pointer;
            }
            .st-group-contact-item:last-child { border-bottom: none; }
            .st-group-contact-item.selected { background: rgba(0,122,255,0.1); }
            .st-group-contact-avatar {
                width: 36px; height: 36px;
                border-radius: 50%; object-fit: cover;
                margin-right: 10px;
            }
            .st-group-contact-name { flex: 1; font-size: 15px; }
            .st-group-contact-check {
                width: 22px; height: 22px;
                border-radius: 50%;
                border: 2px solid var(--pt-border, #ccc);
                display: flex; align-items: center; justify-content: center;
                font-size: 14px; color: white;
            }
            .st-group-contact-item.selected .st-group-contact-check {
                background: var(--pt-accent, #007aff);
                border-color: var(--pt-accent, #007aff);
            }
            .st-group-actions { display: flex; gap: 10px; }
            .st-group-btn {
                flex: 1; padding: 12px;
                border: none; border-radius: 10px;
                font-size: 15px; font-weight: 600; cursor: pointer;
            }
            .st-group-btn.cancel { background: #e5e5ea; color: #000; }
            .st-group-btn.create { background: var(--pt-accent, #007aff); color: white; }
            .st-group-btn.create:disabled { background: #ccc; cursor: not-allowed; }

            /* 아이폰 스타일 버블 알림 */
            .st-bubble-notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }
            .st-bubble-notification {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                pointer-events: auto;
                cursor: pointer;
                animation: bubbleSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .st-bubble-notification.hiding {
                animation: bubbleSlideOut 0.3s ease-in forwards;
            }
            @keyframes bubbleSlideIn {
                from {
                    transform: translateX(120%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes bubbleSlideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(120%);
                    opacity: 0;
                }
            }
            .st-bubble-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                object-fit: cover;
                flex-shrink: 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .st-bubble-content {
                max-width: 280px;
                background: linear-gradient(135deg, #34c759 0%, #30b350 100%);
                color: white;
                padding: 10px 14px;
                border-radius: 18px;
                border-bottom-left-radius: 4px;
                font-size: 14px;
                line-height: 1.4;
                box-shadow: 0 4px 15px rgba(52, 199, 89, 0.4);
                word-break: break-word;
            }
            .st-bubble-sender {
                font-size: 11px;
                font-weight: 600;
                opacity: 0.9;
                margin-bottom: 3px;
            }
            .st-bubble-text {
                font-size: 14px;
            }

            /* 타임스탬프/구분선 스타일 */
            .st-msg-timestamp {
                text-align: center;
                padding: 15px 0;
                color: var(--pt-sub-text, #86868b);
                font-size: 12px;
            }
            .st-msg-timestamp-text {
                background: var(--pt-card-bg, rgba(0,0,0,0.05));
                padding: 5px 15px;
                border-radius: 15px;
                display: inline-block;
            }
            .st-msg-divider {
                display: flex;
                align-items: center;
                padding: 15px 0;
                color: var(--pt-sub-text, #86868b);
                font-size: 12px;
            }
            .st-msg-divider::before,
            .st-msg-divider::after {
                content: '';
                flex: 1;
                height: 1px;
                background: var(--pt-border, #e5e5e5);
            }
/* 수정후 - st-msg-divider-text 블록 뒤에 추가 */
            .st-msg-divider-text {
                padding: 0 10px;
            }

            /* RP 날짜 구분선 스타일 */
            .st-msg-rp-date {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 12px 0;
                color: var(--pt-sub-text, #86868b);
                font-size: 12px;
            }
            .st-msg-rp-date::before,
            .st-msg-rp-date::after {
                content: '';
                flex: 1;
                height: 1px;
                background: var(--pt-border, #e5e5e5);
                max-width: 60px;
            }
            .st-msg-rp-date-text {
                padding: 0 12px;
                font-weight: 500;
            }

            .bulk-mode .st-msg-bubble {
                position: relative;
            }
            .bulk-mode .st-msg-bubble::before {
                content: '';
                position: absolute;
                left: -25px;
                top: 50%;
                transform: translateY(-50%);
                width: 20px;
                height: 20px;
                border: 2px solid var(--pt-border, #ccc);
                border-radius: 50%;
                background: var(--pt-card-bg, #fff);
            }
            .bulk-mode .st-msg-bubble.me::before {
                left: auto;
                right: -25px;
            }
            .bulk-mode .st-msg-bubble.bulk-selected::before {
                background: #007aff;
                border-color: #007aff;
            }
            .bulk-mode .st-msg-bubble.bulk-selected::after {
                content: '✓';
                position: absolute;
                left: -23px;
                top: 50%;
                transform: translateY(-50%);
                color: white;
                font-size: 12px;
                font-weight: bold;
            }
            .bulk-mode .st-msg-bubble.me.bulk-selected::after {
                left: auto;
                right: -23px;
            }
        </style>
    `;

    const DEFAULT_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';
    let currentContactId = null;
    let currentGroupId = null;
    let currentChatType = 'dm';
    let replyTimer = null;

    let consecutiveMessageCount = 0;
    let interruptTimer = null;
    let pendingMessages = [];
    let isGenerating = false;
    let queuedMessages = [];
    let bulkSelectMode = false;

    // ========== 저장소 키 ==========
    function getStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId) return null;
        return 'st_phone_messages_' + context.chatId;
    }

function getGroupStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId) return null;
        return 'st_phone_groups_' + context.chatId;
    }

    // ========== 번역 캐시 저장소 ==========
function getTranslationStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId) return null;
        return 'st_phone_translations_' + context.chatId;
    }

    // ========== 타임스탬프 저장소 ==========
    function getTimestampStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId) return null;
        return 'st_phone_timestamps_' + context.chatId;
    }

    function loadTimestamps(contactId) {
        const key = getTimestampStorageKey();
        if (!key) return [];
        try {
            const all = JSON.parse(localStorage.getItem(key) || '{}');
            return all[contactId] || [];
        } catch (e) { return []; }
    }

    function saveTimestamp(contactId, beforeMsgIndex, timestamp) {
        const key = getTimestampStorageKey();
        if (!key) return;
        try {
            const all = JSON.parse(localStorage.getItem(key) || '{}');
            if (!all[contactId]) all[contactId] = [];
            // 중복 방지: 같은 인덱스에 이미 있으면 추가 안 함
            const exists = all[contactId].some(t => t.beforeMsgIndex === beforeMsgIndex);
            if (!exists) {
                all[contactId].push({ beforeMsgIndex, timestamp });
                localStorage.setItem(key, JSON.stringify(all));
            }
        } catch (e) { console.error('[Messages] 타임스탬프 저장 실패:', e); }
    }

    function loadTranslations() {
        const key = getTranslationStorageKey();
        if (!key) return {};
        try {
            return JSON.parse(localStorage.getItem(key) || '{}');
        } catch (e) { return {}; }
    }

    function saveTranslation(contactId, msgIndex, translatedText) {
        const key = getTranslationStorageKey();
        if (!key) return;
        const translations = loadTranslations();
        if (!translations[contactId]) translations[contactId] = {};
        translations[contactId][msgIndex] = translatedText;
        localStorage.setItem(key, JSON.stringify(translations));
    }

    function getTranslation(contactId, msgIndex) {
        const translations = loadTranslations();
        return translations[contactId]?.[msgIndex] || null;
    }

    // ========== 1:1 메시지 저장소 ==========
    function loadAllMessages() {
        const key = getStorageKey();
        if (!key) return {};
        try {
            return JSON.parse(localStorage.getItem(key) || '{}');
        } catch (e) { return {}; }
    }

    function saveAllMessages(data) {
        const key = getStorageKey();
        if (!key) return;
        localStorage.setItem(key, JSON.stringify(data));
    }

    function getMessages(contactId) {
        const all = loadAllMessages();
        return all[contactId] || [];
    }

/* 수정후 */
function addMessage(contactId, sender, text, imageUrl = null, addTimestamp = false, rpDate = null) {
    const all = loadAllMessages();
    if (!all[contactId]) all[contactId] = [];

    const newMsgIndex = all[contactId].length;
    if (addTimestamp) saveTimestamp(contactId, newMsgIndex, Date.now());

    // [수정] 캘린더 앱에서 현재 RP 날짜를 가져옵니다.
    const currentRpDate = window.STPhone?.Apps?.Calendar?.getRpDate();
    const rpDateStr = currentRpDate ? `${currentRpDate.year}년 ${currentRpDate.month}월 ${currentRpDate.day}일 ${currentRpDate.dayOfWeek}` : null;

    const msgData = {
        sender,
        text,
        image: imageUrl,
        timestamp: Date.now(),
        rpDate: rpDate || rpDateStr // 직접 입력된 날짜가 없으면 현재 캘린더 날짜를 저장
    };

    all[contactId].push(msgData);
    saveAllMessages(all);
    return all[contactId].length - 1;

        // RP 날짜가 있으면 저장
        if (rpDate) {
            msgData.rpDate = rpDate;
        }

        all[contactId].push(msgData);
        saveAllMessages(all);

        // [중요] 방금 추가한 메시지가 몇 번째인지(Index) 반환함
        return all[contactId].length - 1;
    }

    // ========== RP 날짜 처리 함수 ==========
    const RP_DATE_REGEX = /^\s*\[(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)\]\s*/;

    function extractRpDate(text) {
        const match = text.match(RP_DATE_REGEX);
        if (match) {
            return {
                year: parseInt(match[1]),
                month: parseInt(match[2]),
                day: parseInt(match[3]),
                dayOfWeek: match[4],
                fullMatch: match[0],
                dateStr: `${match[1]}년 ${match[2]}월 ${match[3]}일 ${match[4]}`
            };
        }
        return null;
    }

    function stripRpDate(text) {
        return text.replace(RP_DATE_REGEX, '').trim();
    }

    function getRpDateDividerHtml(dateStr) {
        return `<div class="st-msg-rp-date"><span class="st-msg-rp-date-text">📅 ${dateStr}</span></div>`;
    }


    // ========== 그룹 저장소 ==========
    function loadGroups() {
        const key = getGroupStorageKey();
        if (!key) return [];
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) { return []; }
    }

    function saveGroups(groups) {
        const key = getGroupStorageKey();
        if (!key) return;
        localStorage.setItem(key, JSON.stringify(groups));
    }

    function getGroup(groupId) {
        const groups = loadGroups();
        return groups.find(g => g.id === groupId);
    }

    function getGroupMessages(groupId) {
        const group = getGroup(groupId);
        return group?.messages || [];
    }

    function addGroupMessage(groupId, senderId, senderName, text, imageUrl = null) {
        const groups = loadGroups();
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        if (!group.messages) group.messages = [];
        group.messages.push({
            senderId,
            senderName,
            text,
            image: imageUrl,
            timestamp: Date.now()
        });
        saveGroups(groups);
    }

    function createGroup(name, memberIds) {
        const groups = loadGroups();
        const newGroup = {
            id: 'group_' + Date.now(),
            name,
            members: memberIds,
            messages: [],
            createdAt: Date.now()
        };
        groups.push(newGroup);
        saveGroups(groups);
        return newGroup;
    }

    // ========== 읽지 않음 카운트 ==========
    function getUnreadCount(contactId) {
        const key = getStorageKey();
        if (!key) return 0;
        try {
            const unread = JSON.parse(localStorage.getItem(key + '_unread') || '{}');
            return unread[contactId] || 0;
        } catch (e) { return 0; }
    }

    function setUnreadCount(contactId, count) {
        const key = getStorageKey();
        if (!key) return;
        const unread = JSON.parse(localStorage.getItem(key + '_unread') || '{}');
        unread[contactId] = count;
        localStorage.setItem(key + '_unread', JSON.stringify(unread));
    }

    function getTotalUnread() {
        const key = getStorageKey();
        if (!key) return 0;
        try {
            const unread = JSON.parse(localStorage.getItem(key + '_unread') || '{}');
            return Object.values(unread).reduce((a, b) => a + b, 0);
        } catch (e) { return 0; }
    }

    function formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function ensureBubbleContainer() {
        if (!$('.st-bubble-notification-container').length) {
            $('body').append('<div class="st-bubble-notification-container"></div>');
        }
        return $('.st-bubble-notification-container');
    }

    function showBubbleNotification(senderName, text, avatarUrl, chatId, chatType) {
        const $container = ensureBubbleContainer();
        const bubbleId = 'bubble_' + Date.now();

        const bubbleHtml = `
            <div class="st-bubble-notification" id="${bubbleId}" data-chat-id="${chatId}" data-chat-type="${chatType}">
                <img class="st-bubble-avatar" src="${avatarUrl || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div class="st-bubble-content">
                    <div class="st-bubble-sender">${senderName}</div>
                    <div class="st-bubble-text">${text}</div>
                </div>
            </div>
        `;

        $container.append(bubbleHtml);

        const $bubble = $(`#${bubbleId}`);

        $bubble.on('click', function() {
            const id = $(this).data('chat-id');
            const type = $(this).data('chat-type');

            $(this).addClass('hiding');
            setTimeout(() => $(this).remove(), 300);

            const $phone = $('#st-phone-container');
            if (!$phone.hasClass('active')) {
                $phone.addClass('active');
            }

            if (type === 'group') {
                openGroupChat(id);
            } else {
                openChat(id);
            }
        });

        setTimeout(() => {
            $bubble.addClass('hiding');
            setTimeout(() => $bubble.remove(), 300);
        }, 6000);
    }

    function showNotification(senderName, preview, avatarUrl, chatId, chatType) {
        showBubbleNotification(senderName, preview, avatarUrl, chatId, chatType);
    }

    async function showSequentialBubbles(contactId, lines, contactName, avatarUrl, chatType) {
        for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i].trim();
            if (!lineText) continue;

            await new Promise(resolve => setTimeout(resolve, i * 400));
            showBubbleNotification(contactName, lineText, avatarUrl, contactId, chatType || 'dm');
        }
    }

    async function receiveMessageSequential(contactId, text, contactName, myName) {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length === 0) return;

        const isPhoneActive = $('#st-phone-container').hasClass('active');
        const isViewingThisChat = (currentChatType === 'dm' && currentContactId === contactId);

        let contact = null;
        if (window.STPhone.Apps?.Contacts) {
            contact = window.STPhone.Apps.Contacts.getContact(contactId);
        }
        const contactAvatar = contact?.avatar || DEFAULT_AVATAR;

        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        const $container = $('#st-chat-messages');

/* 수정후 */
/* 수정후 (캘린더 앱 설치 확인 추가) */
/* 수정후 */
        for (let i = 0; i < lines.length; i++) {
            let lineText = lines[i].trim();
            if (!lineText) continue;

            // RP 날짜 추출 (캘린더 앱 설치 시에만)
            const calendarInstalled = window.STPhone?.Apps?.Store?.isInstalled?.('calendar');
            const rpDateInfo = calendarInstalled ? extractRpDate(lineText) : null;
            let rpDateStr = null;

            if (rpDateInfo) {
                // 날짜 부분 제거
                lineText = stripRpDate(lineText);
                rpDateStr = rpDateInfo.dateStr;

                // 캘린더 앱에 날짜 동기화
                if (window.STPhone?.Apps?.Calendar) {
                    window.STPhone.Apps.Calendar.updateRpDate({
                        year: rpDateInfo.year,
                        month: rpDateInfo.month,
                        day: rpDateInfo.day,
                        dayOfWeek: rpDateInfo.dayOfWeek
                    });
                }

                // 날짜만 있고 내용이 없으면 스킵
                if (!lineText) continue;
            }

            const baseDelay = 500 + Math.random() * 800;
            const charDelay = Math.min(lineText.length * 30, 1500);
            const totalDelay = baseDelay + charDelay;

            await new Promise(resolve => setTimeout(resolve, totalDelay));

/* 수정후 */
            const newIdx = addMessage(contactId, 'them', lineText, null, false, rpDateStr);

            let translatedText = null;
            if (settings.translateEnabled) {
                translatedText = await translateText(lineText);
                if (translatedText) {
                    saveTranslation(contactId, newIdx, translatedText);
                }
            }

            if (!isPhoneActive || !isViewingThisChat) {
                const unread = getUnreadCount(contactId) + 1;
                setUnreadCount(contactId, unread);
                updateMessagesBadge();

                const displayText = translatedText || lineText;
                showBubbleNotification(contactName, displayText, contactAvatar, contactId, 'dm');
            } else {
                $('#st-typing').hide();
                const side = 'them';
                const clickAttr = `data-action="msg-option" data-idx="${newIdx}" data-line-idx="0" data-sender="${side}" class="st-msg-bubble ${side} clickable" style="cursor:pointer;" title="옵션 보기"`;

                let bubbleContent = lineText;
                if (translatedText) {
                    const displayMode = settings.translateDisplayMode || 'both';
                    if (displayMode === 'korean') {
                        bubbleContent = translatedText;
                    } else {
                        bubbleContent = `<div class="st-msg-original">${lineText}</div><div class="st-msg-translation">${translatedText}</div>`;
                    }
                }

/* 수정후 - 에러 유발 블록 삭제됨 */
                // [수정] 현재 저장된 최신 메시지의 날짜를 가져와서 비교합니다.
                const msgs = getMessages(contactId);
                const currentMsg = msgs[msgs.length - 1];
                const prevMsg = msgs.length > 1 ? msgs[msgs.length - 2] : null;

                if (currentMsg && currentMsg.rpDate) {
                    // 이전 메시지와 날짜가 다르거나, 아예 첫 메시지라면 날짜 표시
                    if (!prevMsg || prevMsg.rpDate !== currentMsg.rpDate) {
                        $container.find('#st-typing').before(getRpDateDividerHtml(currentMsg.rpDate));
                    }
                }
                $container.find('#st-typing').before(`<div ${clickAttr}>${bubbleContent}</div>`);
                scrollToBottom();

                if (i < lines.length - 1) {
                    $('#st-typing').show();
                }
            }

            addHiddenLog(contactName, `[📩 ${contactName} -> ${myName}]: ${lineText}`);
        }
    }

    async function receiveMessage(contactId, text, imageUrl = null) {
        const newIdx = addMessage(contactId, 'them', text, imageUrl);

        const isPhoneActive = $('#st-phone-container').hasClass('active');
        const isViewingThisChat = (currentChatType === 'dm' && currentContactId === contactId);

        let contact = null;
        if (window.STPhone.Apps?.Contacts) {
            contact = window.STPhone.Apps.Contacts.getContact(contactId);
        }
        const contactName = contact?.name || '알 수 없음';
        const contactAvatar = contact?.avatar || DEFAULT_AVATAR;

        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        let translatedText = null;

        if (text && settings.translateEnabled) {
            translatedText = await translateText(text);
            if (translatedText) {
                saveTranslation(contactId, newIdx, translatedText);
            }
        }

        if (!isPhoneActive || !isViewingThisChat) {
            const unread = getUnreadCount(contactId) + 1;
            setUnreadCount(contactId, unread);
            updateMessagesBadge();

            const previewText = translatedText || text;
            const preview = imageUrl ? '📷 사진' : (previewText?.substring(0, 50) || '새 메시지');
            showNotification(contactName, preview, contactAvatar, contactId, 'dm');
        } else {
            appendBubble('them', text, imageUrl, newIdx, translatedText);
        }
    }

    // [새 함수] 번역 후 말풍선 업데이트
    async function translateAndUpdateBubble(contactId, msgIndex, originalText) {
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        const displayMode = settings.translateDisplayMode || 'both';

        // 번역 실행
        const translatedText = await translateText(originalText);
        if (!translatedText) return;

        // 번역 저장
        saveTranslation(contactId, msgIndex, translatedText);

        // 화면에 있는 해당 말풍선들 찾아서 업데이트
        const $bubbles = $(`[data-idx="${msgIndex}"]`);
        if ($bubbles.length === 0) return;

        const lines = originalText.split('\n');
        const translatedLines = translatedText.split('\n');

        $bubbles.each(function(idx) {
            const $bubble = $(this);
            const originalLine = lines[idx]?.trim() || originalText.trim();
            const translatedLine = translatedLines[idx]?.trim() || translatedText.trim();

            let newContent = '';
            if (displayMode === 'korean') {
                // 한국어만 표시
                newContent = translatedLine;
            } else {
                // 원문 + 번역 함께 표시
                newContent = `<div class="st-msg-original">${originalLine}</div><div class="st-msg-translation">${translatedLine}</div>`;
            }

            $bubble.html(newContent);
        });
    }
    // 그룹 메시지 수신
    function receiveGroupMessage(groupId, senderId, senderName, text, imageUrl = null) {
        // 1. 데이터에 저장
        addGroupMessage(groupId, senderId, senderName, text, imageUrl);

        // 2. 현재 상태 확인
        const isPhoneActive = $('#st-phone-container').hasClass('active');
        const isViewingThisChat = (currentChatType === 'group' && currentGroupId === groupId);

        // 3. 그룹 및 발신자 정보
        const group = getGroup(groupId);
        let senderAvatar = DEFAULT_AVATAR;
        if (window.STPhone.Apps?.Contacts) {
            const contact = window.STPhone.Apps.Contacts.getContact(senderId);
            if (contact) senderAvatar = contact.avatar || DEFAULT_AVATAR;
        }

        // 4. 알림 처리
        if (!isPhoneActive || !isViewingThisChat) {
            // 안 읽음 카운트 증가
            const unread = getUnreadCount(groupId) + 1;
            setUnreadCount(groupId, unread);

            // 홈 화면 배지 업데이트
            updateMessagesBadge();

            // 알림 표시
            const preview = imageUrl ? '📷 사진' : (text?.substring(0, 50) || '새 메시지');
            const displayName = `${group?.name || '그룹'} - ${senderName}`;
            showNotification(displayName, preview, senderAvatar, groupId, 'group');
        } else {
            // 해당 채팅방을 보고 있으면 바로 말풍선 추가
            appendGroupBubble(senderId, senderName, text, imageUrl);
        }
    }

    function updateMessagesBadge() {
        const total = getTotalUnread();
        // 홈 화면의 메시지 앱 아이콘에 배지 업데이트
        const $msgIcon = $('.st-app-icon[data-app="messages"]');
        $msgIcon.find('.st-app-badge').remove();
        if (total > 0) {
            $msgIcon.append(`<div class="st-app-badge">${total > 99 ? '99+' : total}</div>`);
        }
    }

    // ========== 메인 화면 (탭: 1:1 / 그룹) ==========
    async function open() {
        currentContactId = null;
        currentGroupId = null;
        currentChatType = 'dm';

        // 봇/유저 연락처 자동 동기화
        await window.STPhone.Apps?.Contacts?.syncAutoContacts?.();

        const $screen = window.STPhone.UI.getContentElement();
        if (!$screen?.length) return;
        $screen.empty();

        $screen.append(`
            ${css}
            <div class="st-messages-app">
                <div class="st-messages-header">
                    <div class="st-messages-title">메시지</div>
                    <button class="st-messages-new-group" id="st-new-group-btn" title="새 그룹 만들기">👥</button>
                </div>
                <div class="st-messages-tabs">
                    <div class="st-messages-tab active" data-tab="dm">1:1 대화</div>
                    <div class="st-messages-tab" data-tab="group">그룹</div>
                </div>
                <div class="st-messages-list" id="st-messages-list"></div>
            </div>

            <!-- 그룹 생성 모달 -->
            <div class="st-group-modal" id="st-group-modal">
                <div class="st-group-box">
                    <div class="st-group-title">새 그룹 만들기</div>
                    <input type="text" class="st-group-name-input" id="st-group-name" placeholder="그룹 이름">
                    <div class="st-group-contacts" id="st-group-contacts"></div>
                    <div class="st-group-actions">
                        <button class="st-group-btn cancel" id="st-group-cancel">취소</button>
                        <button class="st-group-btn create" id="st-group-create" disabled>만들기</button>
                    </div>
                </div>
            </div>
        `);

        renderDMList();
        attachMainListeners();
    }

    function renderDMList() {
        const $list = $('#st-messages-list');
        $list.empty();

        const contacts = window.STPhone.Apps?.Contacts?.getAllContacts() || [];
        const allMsgs = loadAllMessages();

        if (contacts.length === 0) {
            $list.html(`<div class="st-messages-empty"><div style="font-size:48px;opacity:0.5;margin-bottom:15px;">💬</div><div>대화가 없습니다</div><div style="font-size:12px;margin-top:5px;">연락처를 추가하고 대화를 시작하세요</div></div>`);
            return;
        }

        contacts.forEach(c => {
            const msgs = allMsgs[c.id] || [];
            const last = msgs[msgs.length - 1];
            const unread = getUnreadCount(c.id);
            $list.append(`
                <div class="st-thread-item" data-id="${c.id}" data-type="dm">
                    <img class="st-thread-avatar" src="${c.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                    <div class="st-thread-info">
                        <div class="st-thread-name">${c.name}</div>
                        <div class="st-thread-preview">${last ? (last.image ? '📷 사진' : last.text) : '새 대화'}</div>
                    </div>
                    <div class="st-thread-meta">
                        ${last ? `<div class="st-thread-time">${formatTime(last.timestamp)}</div>` : ''}
                        ${unread > 0 ? `<div class="st-thread-badge">${unread}</div>` : ''}
                    </div>
                </div>
            `);
        });
    }

    function renderGroupList() {
        const $list = $('#st-messages-list');
        $list.empty();

        const groups = loadGroups();

        if (groups.length === 0) {
            $list.html(`<div class="st-messages-empty"><div style="font-size:48px;opacity:0.5;margin-bottom:15px;">👥</div><div>그룹이 없습니다</div><div style="font-size:12px;margin-top:5px;">👥 버튼을 눌러 새 그룹을 만드세요</div></div>`);
            return;
        }

        groups.forEach(g => {
            const msgs = g.messages || [];
            const last = msgs[msgs.length - 1];
            const unread = getUnreadCount(g.id);

            // 멤버 이름 목록
            let memberNames = [];
            if (window.STPhone.Apps?.Contacts) {
                g.members.forEach(mid => {
                    const c = window.STPhone.Apps.Contacts.getContact(mid);
                    if (c) memberNames.push(c.name);
                });
            }

            $list.append(`
                <div class="st-thread-item" data-id="${g.id}" data-type="group">
                    <div class="st-thread-avatar-group">👥</div>
                    <div class="st-thread-info">
                        <div class="st-thread-name">${g.name}</div>
                        <div class="st-thread-members">${memberNames.join(', ') || '멤버 없음'}</div>
                        <div class="st-thread-preview">${last ? (last.image ? '📷 사진' : `${last.senderName}: ${last.text}`) : '새 대화'}</div>
                    </div>
                    <div class="st-thread-meta">
                        ${last ? `<div class="st-thread-time">${formatTime(last.timestamp)}</div>` : ''}
                        ${unread > 0 ? `<div class="st-thread-badge">${unread}</div>` : ''}
                    </div>
                </div>
            `);
        });
    }

    function attachMainListeners() {
        // 탭 전환
        $('.st-messages-tab').on('click', function() {
            $('.st-messages-tab').removeClass('active');
            $(this).addClass('active');
            const tab = $(this).data('tab');
            if (tab === 'dm') {
                renderDMList();
            } else {
                renderGroupList();
            }
            attachThreadClickListeners();
        });

        // 대화방 클릭
        attachThreadClickListeners();

        // 새 그룹 버튼
        $('#st-new-group-btn').on('click', openGroupModal);

        // 그룹 모달 닫기
        $('#st-group-cancel').on('click', () => {
            $('#st-group-modal').hide();
        });

        // 그룹 생성
        $('#st-group-create').on('click', createNewGroup);

        // 그룹명 입력 시 버튼 활성화 체크
        $('#st-group-name').on('input', checkGroupCreateBtn);
    }

    function attachThreadClickListeners() {
        $('.st-thread-item').off('click').on('click', function() {
            const id = $(this).data('id');
            const type = $(this).data('type');
            if (type === 'group') {
                openGroupChat(id);
            } else {
                openChat(id);
            }
        });
    }

    // ========== 그룹 생성 모달 ==========
    function openGroupModal() {
        const contacts = window.STPhone.Apps?.Contacts?.getAllContacts() || [];
        const $contacts = $('#st-group-contacts');
        $contacts.empty();

        if (contacts.length < 2) {
            $contacts.html('<div style="padding:20px;text-align:center;color:#999;">그룹을 만들려면 연락처가 2개 이상 필요합니다</div>');
            $('#st-group-create').prop('disabled', true);
            $('#st-group-modal').css('display', 'flex');
            return;
        }

        contacts.forEach(c => {
            $contacts.append(`
                <div class="st-group-contact-item" data-id="${c.id}">
                    <img class="st-group-contact-avatar" src="${c.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                    <div class="st-group-contact-name">${c.name}</div>
                    <div class="st-group-contact-check">✓</div>
                </div>
            `);
        });

        // 연락처 선택 토글
        $('.st-group-contact-item').on('click', function() {
            $(this).toggleClass('selected');
            checkGroupCreateBtn();
        });

        $('#st-group-name').val('');
        $('#st-group-modal').css('display', 'flex');
    }

    function checkGroupCreateBtn() {
        const name = $('#st-group-name').val().trim();
        const selected = $('.st-group-contact-item.selected').length;
        $('#st-group-create').prop('disabled', !name || selected < 2);
    }

    function createNewGroup() {
        const name = $('#st-group-name').val().trim();
        const memberIds = [];
        $('.st-group-contact-item.selected').each(function() {
            memberIds.push($(this).data('id'));
        });

        if (!name || memberIds.length < 2) return;

        const group = createGroup(name, memberIds);
        $('#st-group-modal').hide();
        toastr.success(`👥 "${name}" 그룹이 생성되었습니다!`);

        // 그룹 탭으로 전환
        $('.st-messages-tab').removeClass('active');
        $('.st-messages-tab[data-tab="group"]').addClass('active');
        renderGroupList();
        attachThreadClickListeners();
    }

    // ========== 1:1 채팅방 ==========
/* 수정후 */
    function openChat(contactId) {
        // [수정] replyTimer 취소 삭제 - AI 응답은 백그라운드에서 계속 진행
        // if (replyTimer) clearTimeout(replyTimer);

        currentContactId = contactId;
        currentGroupId = null;
        currentChatType = 'dm';
        setUnreadCount(contactId, 0);
        updateMessagesBadge();

        const contact = window.STPhone.Apps.Contacts.getContact(contactId);
        if (!contact) { toastr.error('연락처를 찾을 수 없습니다'); return; }

        const $screen = window.STPhone.UI.getContentElement();
        $screen.empty();

const msgs = getMessages(contactId);
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        const timestamps = loadTimestamps(contactId);
        const timestampMode = settings.timestampMode || 'none';
        let msgsHtml = '';

/* 수정후 */
        let lastRenderedRpDate = null;  // 렌더링용 마지막 날짜 추적

        msgs.forEach((m, index) => {
            // [수정] 날짜 정보가 있고, 이전에 그린 날짜와 다를 때만 구분선 추가
            if (m.rpDate && m.rpDate !== lastRenderedRpDate) {
                msgsHtml += getRpDateDividerHtml(m.rpDate);
                lastRenderedRpDate = m.rpDate; // 방금 그린 날짜를 기억
            }

            // 타임스탬프/구분선 표시 체크
            if (timestampMode !== 'none') {
                const tsData = timestamps.find(t => t.beforeMsgIndex === index);
                if (tsData) {
                    const date = new Date(tsData.timestamp);
                    const timeStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

                    if (timestampMode === 'timestamp') {
                        msgsHtml += `<div class="st-msg-timestamp"><span class="st-msg-timestamp-text">📱 ${timeStr}</span></div>`;
                    } else if (timestampMode === 'divider') {
                        msgsHtml += `<div class="st-msg-divider"><span class="st-msg-divider-text">대화 복귀</span></div>`;
                    }
                }
            }
            const side = m.sender === 'me' ? 'me' : 'them';

            const savedTranslation = (side === 'them') ? getTranslation(contactId, index) : null;
            const translateEnabled = settings.translateEnabled && side === 'them' && savedTranslation;
            const displayMode = settings.translateDisplayMode || 'both';

            if (m.image) {
                const imgAttr = `data-action="msg-option" data-idx="${index}" data-line-idx="0" data-sender="${side}" class="st-msg-bubble ${side} image-bubble clickable" style="cursor:pointer;" title="옵션 보기"`;
                msgsHtml += `<div ${imgAttr}><img class="st-msg-image" src="${m.image}"></div>`;
            }

            if (m.text) {
                const lines = m.text.split('\n');
                const translatedLines = savedTranslation ? savedTranslation.split('\n') : [];
                let lineIdx = 0;

/* 복원할 코드 */
                lines.forEach((line, idx) => {
                    const trimmed = line.trim();
                    if(trimmed) {
                        let bubbleContent = '';
                        const lineAttr = `data-action="msg-option" data-idx="${index}" data-line-idx="${lineIdx}" data-sender="${side}" class="st-msg-bubble ${side} clickable" style="cursor:pointer;" title="옵션 보기"`;

if (translateEnabled) {
    const translatedLine = translatedLines[idx]?.trim();

    if (displayMode === 'korean' && translatedLine) {
        bubbleContent = translatedLine;
    } else if (translatedLine) {
        bubbleContent = `<div class="st-msg-original">${trimmed}</div><div class="st-msg-translation">${translatedLine}</div>`;
    } else {
        bubbleContent = trimmed;
    }
} else {
                            bubbleContent = trimmed;
                        }

                        msgsHtml += `<div ${lineAttr}>${bubbleContent}</div>`;
                        lineIdx++;
                    }
                });
            }
        });

        $screen.append(`
            ${css}
            <div class="st-chat-screen">
<div class="st-chat-header" style="position: relative;">
                    <button class="st-chat-back" id="st-chat-back">‹</button>
                    <div class="st-chat-contact">
                        <img class="st-chat-avatar" src="${contact.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                        <span class="st-chat-name">${contact.name}</span>
                    </div>
                </div>

                <div class="st-chat-messages" id="st-chat-messages">
                    ${msgsHtml}
                    <div class="st-typing-indicator" id="st-typing">
                        <div class="st-typing-dots"><span></span><span></span><span></span></div>
                    </div>
                </div>

<div class="st-chat-input-area">
    <button class="st-chat-cam-btn" id="st-chat-cam">📷</button>
    <textarea class="st-chat-textarea" id="st-chat-input" placeholder="메시지" rows="1"></textarea>
    ${settings.translateEnabled ? '<button class="st-chat-translate-user-btn" id="st-chat-translate-user" title="영어로 번역">A/가</button>' : ''}
    <button class="st-chat-send" id="st-chat-send">↑</button>
</div>

                <div class="st-photo-popup" id="st-photo-popup">
                    <div class="st-photo-box">
                        <div style="font-weight:600;font-size:17px;text-align:center;">사진 보내기</div>
                        <input type="text" class="st-photo-input" id="st-photo-prompt" placeholder="어떤 사진인가요? (예: 해변의 석양)">
                        <div class="st-photo-actions">
                            <button class="st-photo-btn cancel" id="st-photo-cancel">취소</button>
                            <button class="st-photo-btn send" id="st-photo-confirm">생성 및 전송</button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        scrollToBottom();
        attachChatListeners(contactId, contact);

        // 테마 앱의 배경 이미지 적용
        applyMessageBackground();
    }

    // 메시지 앱 배경 이미지 적용 함수
    function applyMessageBackground() {
        if (window.STPhone.Apps?.Theme?.getCurrentTheme) {
            const theme = window.STPhone.Apps.Theme.getCurrentTheme();
            if (theme?.messages?.bgImage && theme.messages.bgImage.length > 0) {
                const $chatMessages = $('#st-chat-messages');
                if ($chatMessages.length) {
                    $chatMessages.css({
                        'background-image': `url("${theme.messages.bgImage}")`,
                        'background-color': 'transparent',
                        'background-size': 'cover',
                        'background-position': 'center',
                        'background-repeat': 'no-repeat'
                    });
                    console.log('🖼️ [Messages] Background applied');
                }
            }
        }
    }

    function attachChatListeners(contactId, contact) {
        $('#st-chat-back').off('click').on('click', open);

        $('#st-chat-messages').off('click', '[data-action="msg-option"]').on('click', '[data-action="msg-option"]', function(e) {
            if (bulkSelectMode) {
                e.stopPropagation();
                $(this).toggleClass('bulk-selected');
                updateBulkCounter();
                return;
            }
            e.stopPropagation();
            const idx = $(this).data('idx');
            const lineIdx = $(this).data('line-idx');
            const sender = $(this).data('sender');
            const isMyMessage = sender === 'me';
            showMsgOptions(currentContactId, idx, lineIdx, isMyMessage);
        });


        $('#st-chat-input').off('input').on('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
        $('#st-chat-input').off('keydown').on('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
$('#st-chat-send').off('click').on('click', sendMessage);

// 내 메시지 번역 기능 추가
$('#st-chat-translate-user').off('click').on('click', async function() {
    const $input = $('#st-chat-input');
    const text = $input.val().trim();
    if (!text) return;

    $(this).text('⏳');

    const settings = window.STPhone.Apps.Settings.getSettings();
    const prompt = settings.userTranslatePrompt || "Translate the following Korean text to English. Output ONLY the English translation.";

    const translated = await translateText(text, prompt);
    if (translated) {
        $input.val(translated);
        $input.trigger('input');
    }
    $(this).text('A/가');
});

$('#st-chat-cam').off('click').on('click', () => {
            $('#st-photo-popup').css('display', 'flex');
            $('#st-photo-prompt').focus();
        });
        $('#st-photo-cancel').off('click').on('click', () => {
            $('#st-photo-popup').hide();
            $('#st-photo-prompt').val('');
        });
        $('#st-photo-confirm').off('click').on('click', async () => {
            const prompt = $('#st-photo-prompt').val().trim();
            if (!prompt) { toastr.warning("설명을 입력해주세요."); return; }

            $('#st-photo-popup').hide();
            $('#st-photo-prompt').val('');

            appendBubble('me', `📸 사진 생성 중: ${prompt}...`);
            const imgUrl = await generateSmartImage(prompt, true);
            $('.st-msg-bubble.me:last').remove();

            if (imgUrl) {
                addMessage(currentContactId, 'me', '', imgUrl);
                appendBubble('me', '', imgUrl);
                const myName = getUserName();
                addHiddenLog(myName, `[📩 ${myName} -> ${contact.name}]: (Sent Photo: ${prompt})`);
                await generateReply(currentContactId, `(Sent a photo of ${prompt})`);
            } else {
                appendBubble('me', '(사진 생성 실패)');
            }
        });
        $('#st-photo-prompt').off('keydown').on('keydown', function(e) {
            if (e.key === 'Enter') $('#st-photo-confirm').click();
        });
    }

    // ========== 그룹 채팅방 ==========
    function openGroupChat(groupId) {
        if (replyTimer) clearTimeout(replyTimer);

        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};

        currentGroupId = groupId;
        currentContactId = null;
        currentChatType = 'group';
        setUnreadCount(groupId, 0);
        updateMessagesBadge();

        const group = getGroup(groupId);
        if (!group) { toastr.error('그룹을 찾을 수 없습니다'); return; }

        const $screen = window.STPhone.UI.getContentElement();
        $screen.empty();

        const msgs = getGroupMessages(groupId);
        const myName = getUserName();
        let msgsHtml = '';

        msgs.forEach((m) => {
            const isMe = (m.senderName === myName || m.senderId === 'me');

            if (isMe) {
                // 내 메시지
                msgsHtml += `<div class="st-msg-wrapper me">`;
                if (m.image) {
                    msgsHtml += `<div class="st-msg-bubble me"><img class="st-msg-image" src="${m.image}"></div>`;
                }
                if (m.text) {
                    msgsHtml += `<div class="st-msg-bubble me">${m.text}</div>`;
                }
                msgsHtml += `</div>`;
            } else {
                // 상대방 메시지 (아바타 + 이름 표시)
                let avatar = DEFAULT_AVATAR;
                if (window.STPhone.Apps?.Contacts) {
                    const c = window.STPhone.Apps.Contacts.getContact(m.senderId);
                    if (c) avatar = c.avatar || DEFAULT_AVATAR;
                }

                msgsHtml += `<div class="st-msg-wrapper them">`;
                msgsHtml += `<div class="st-msg-sender-info">
                    <img class="st-msg-sender-avatar" src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                    <span class="st-msg-sender-name">${m.senderName}</span>
                </div>`;
                if (m.image) {
                    msgsHtml += `<div class="st-msg-bubble them"><img class="st-msg-image" src="${m.image}"></div>`;
                }
                if (m.text) {
                    msgsHtml += `<div class="st-msg-bubble them">${m.text}</div>`;
                }
                msgsHtml += `</div>`;
            }
        });

        // 멤버 이름 목록
        let memberNames = [];
        if (window.STPhone.Apps?.Contacts) {
            group.members.forEach(mid => {
                const c = window.STPhone.Apps.Contacts.getContact(mid);
                if (c) memberNames.push(c.name);
            });
        }

        $screen.append(`
            ${css}
            <div class="st-chat-screen">
                <div class="st-chat-header">
                    <button class="st-chat-back" id="st-chat-back">‹</button>
                    <div class="st-chat-contact" style="flex-direction:column; gap:2px;">
                        <span class="st-chat-name">${group.name}</span>
                        <span style="font-size:11px; color:var(--pt-sub-text);">${memberNames.join(', ')}</span>
                    </div>
                    <div style="width:40px;"></div>
                </div>

                <div class="st-chat-messages" id="st-chat-messages">
                    ${msgsHtml}
                    <div class="st-typing-indicator" id="st-typing">
                        <div class="st-typing-dots"><span></span><span></span><span></span></div>
                    </div>
                </div>

<div class="st-chat-input-area">
    <button class="st-chat-cam-btn" id="st-chat-cam">📷</button>
    <textarea class="st-chat-textarea" id="st-chat-input" placeholder="메시지" rows="1"></textarea>
    ${settings.translateEnabled ? '<button class="st-chat-translate-user-btn" id="st-chat-translate-user" title="영어로 번역">A/가</button>' : ''}
    <button class="st-chat-send" id="st-chat-send">↑</button>
</div>
                <div class="st-photo-popup" id="st-photo-popup">
                    <div class="st-photo-box">
                        <div style="font-weight:600;font-size:17px;text-align:center;">사진 보내기</div>
                        <input type="text" class="st-photo-input" id="st-photo-prompt" placeholder="어떤 사진인가요?">
                        <div class="st-photo-actions">
                            <button class="st-photo-btn cancel" id="st-photo-cancel">취소</button>
                            <button class="st-photo-btn send" id="st-photo-confirm">생성 및 전송</button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        scrollToBottom();
        attachGroupChatListeners(groupId, group);

        // 테마 앱의 배경 이미지 적용
        applyMessageBackground();
    }

    function attachGroupChatListeners(groupId, group) {
        $('#st-chat-back').on('click', open);

        $('#st-chat-input').on('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
        $('#st-chat-input').on('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendGroupMessage();
            }
        });
$('#st-chat-send').on('click', sendGroupMessage);

// 내 메시지 번역 기능 추가 (그룹용)
$('#st-chat-translate-user').on('click', async function() {
    const $input = $('#st-chat-input');
    const text = $input.val().trim();
    if (!text) return;

    $(this).text('⏳');
// 설정에서 유저 전용 번역 프롬프트를 가져옴
    const settings = window.STPhone.Apps.Settings.getSettings();
    const prompt = settings.userTranslatePrompt || "Translate the following Korean text to English. Output ONLY the English translation.";

    const translated = await translateText(text, prompt);
    if (translated) {
        $input.val(translated);
        $input.trigger('input');
    }
    $(this).text('A/가');
});

$('#st-chat-cam').on('click', () => {
            $('#st-photo-popup').css('display', 'flex');
            $('#st-photo-prompt').focus();
        });
        $('#st-photo-cancel').on('click', () => {
            $('#st-photo-popup').hide();
            $('#st-photo-prompt').val('');
        });
        $('#st-photo-confirm').on('click', async () => {
            const prompt = $('#st-photo-prompt').val().trim();
            if (!prompt) { toastr.warning("설명을 입력해주세요."); return; }

            $('#st-photo-popup').hide();
            $('#st-photo-prompt').val('');

            const myName = getUserName();
            appendGroupBubble('me', myName, `📸 사진 생성 중...`);
            const imgUrl = await generateSmartImage(prompt, true);
            $('.st-msg-wrapper:last').remove();

            if (imgUrl) {
                addGroupMessage(currentGroupId, 'me', myName, '', imgUrl);
                appendGroupBubble('me', myName, '', imgUrl);
                addHiddenLog(myName, `[📩 Group "${group.name}"] ${myName}: (Sent Photo: ${prompt})`);
                await generateGroupReply(currentGroupId, `(${myName} sent a photo of ${prompt})`);
            }
        });
        $('#st-photo-prompt').on('keydown', function(e) {
            if (e.key === 'Enter') $('#st-photo-confirm').click();
        });
    }

    // ========== UI 헬퍼 ==========
    function scrollToBottom() {
        const el = document.getElementById('st-chat-messages');
        if (el) {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
    }

// [중요] msgIndex, translatedText 인자가 추가됨
    function appendBubble(sender, text, imageUrl, msgIndex, translatedText = null) {
        const side = sender === 'me' ? 'me' : 'them';
        const $container = $('#st-chat-messages');
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};

        const clickAttr = (msgIndex !== undefined && msgIndex !== null)
            ? `data-action="msg-option" data-idx="${msgIndex}" data-sender="${side}" class="st-msg-bubble ${side} clickable" style="cursor:pointer;" title="옵션 보기"`
            : `class="st-msg-bubble ${side}"`;

        if (imageUrl) {
            const imgAttr = clickAttr.replace('st-msg-bubble', 'st-msg-bubble image-bubble');
            $container.find('#st-typing').before(`<div ${imgAttr}><img class="st-msg-image" src="${imageUrl}"></div>`);
        }

        if (text) {
            const translateEnabled = settings.translateEnabled && sender === 'them' && translatedText;
            const displayMode = settings.translateDisplayMode || 'both';

            const lines = text.split('\n');
            const translatedLines = translatedText ? translatedText.split('\n') : [];

            lines.forEach((line, idx) => {
                const trimmed = line.trim();
                if(trimmed) {
                    let bubbleContent = '';

if (translateEnabled) {
    // 줄 번호(idx)가 일치하는 번역 라인이 있을 때만 가져옵니다.
    const translatedLine = translatedLines[idx]?.trim();

    if (displayMode === 'korean' && translatedLine) {
        bubbleContent = translatedLine;
    } else if (translatedLine) {
        bubbleContent = `<div class="st-msg-original">${trimmed}</div><div class="st-msg-translation">${translatedLine}</div>`;
    } else {
        bubbleContent = trimmed;
    }
} else {
                        bubbleContent = trimmed;
                    }

                    // 쪼개진 말풍선들 모두에게 똑같은 clickAttr(같은 번호표)를 붙임
                    $container.find('#st-typing').before(`<div ${clickAttr}>${bubbleContent}</div>`);
                }
            });
        }
        scrollToBottom();
    }


    function appendGroupBubble(senderId, senderName, text, imageUrl) {
        const myName = getUserName();
        const isMe = (senderName === myName || senderId === 'me');
        const $container = $('#st-chat-messages');

        let avatar = DEFAULT_AVATAR;
        if (!isMe && window.STPhone.Apps?.Contacts) {
            const c = window.STPhone.Apps.Contacts.getContact(senderId);
            if (c) avatar = c.avatar || DEFAULT_AVATAR;
        }

        let html = `<div class="st-msg-wrapper ${isMe ? 'me' : 'them'}">`;

        if (!isMe) {
            html += `<div class="st-msg-sender-info">
                <img class="st-msg-sender-avatar" src="${avatar}" onerror="this.src='${DEFAULT_AVATAR}'">
                <span class="st-msg-sender-name">${senderName}</span>
            </div>`;
        }

        if (imageUrl) {
            html += `<div class="st-msg-bubble ${isMe ? 'me' : 'them'}"><img class="st-msg-image" src="${imageUrl}"></div>`;
        }
        if (text) {
            html += `<div class="st-msg-bubble ${isMe ? 'me' : 'them'}">${text}</div>`;
        }
        html += `</div>`;

        $container.find('#st-typing').before(html);
        scrollToBottom();
    }

    // ========== 메시지 전송 ==========
    async function sendMessage() {
        let text = $('#st-chat-input').val().trim();
        if (!text || !currentContactId) return;

        if (text.startsWith('/photo') || text.startsWith('/사진')) {
            const prompt = text.replace(/^\/(photo|사진)\s*/i, '');
            if (!prompt) return;

            $('#st-chat-input').val('');
            appendBubble('me', `📸 사진 보내는 중: ${prompt}...`);
            const imgUrl = await generateSmartImage(prompt, true);
            $('.st-msg-bubble.me:last').remove();

            if (imgUrl) {
                addMessage(currentContactId, 'me', '', imgUrl);
                appendBubble('me', '', imgUrl);
                const contact = window.STPhone.Apps.Contacts.getContact(currentContactId);
                const myName = getUserName();
                addHiddenLog(myName, `[📩 ${myName} -> ${contact?.name}]: (Sent Photo: ${prompt})`);
                resetInterruptState();
                const savedContactId = currentContactId;
                // [수정] 즉시 AI 응답 생성 시작
                generateReply(savedContactId, `(Sent a photo of ${prompt})`);
            } else {
                appendBubble('me', '(사진 생성 실패)');
            }
            return;
        }

        $('#st-chat-input').val('').css('height', 'auto');

        let needsTimestamp = false;
        if (window.STPhoneTimestamp && window.STPhoneTimestamp.needsTimestamp) {
            needsTimestamp = window.STPhoneTimestamp.needsTimestamp();
        }

        const newIdx = addMessage(currentContactId, 'me', text, null, needsTimestamp);
        appendBubble('me', text, null, newIdx);

        const contact = window.STPhone.Apps.Contacts.getContact(currentContactId);
        const myName = getUserName();
        addHiddenLog(myName, `[📩 ${myName} -> ${contact?.name}]: ${text}`);

        if (isGenerating) {
            queuedMessages.push({ contactId: currentContactId, text });
            return;
        }

        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        const interruptEnabled = settings.interruptEnabled !== false;
        const interruptCount = settings.interruptCount || 3;
        const interruptDelay = settings.interruptDelay || 2000;

        if (replyTimer) {
            clearTimeout(replyTimer);
        }
        if (interruptTimer) {
            clearTimeout(interruptTimer);
        }

        consecutiveMessageCount++;
        pendingMessages.push(text);

        if (interruptEnabled && consecutiveMessageCount >= interruptCount) {
            const savedContactId = currentContactId;
            const savedMessages = [...pendingMessages];
            interruptTimer = setTimeout(async () => {
                await generateInterruptReply(savedContactId, savedMessages);
                resetInterruptState();
            }, interruptDelay);
        } else {
            // [수정] 즉시 AI 응답 생성 시작 (폰 닫아도 계속 진행됨)
            const savedContactId = currentContactId;
            const savedMessages = [...pendingMessages];
            resetInterruptState();
            queuedMessages = queuedMessages.filter(q => q.contactId !== savedContactId);

            // 5초 대기 없이 바로 generateReply 호출
            generateReply(savedContactId, savedMessages[savedMessages.length - 1] || text);
        }
    }

    function resetInterruptState() {
        consecutiveMessageCount = 0;
        pendingMessages = [];
        if (interruptTimer) {
            clearTimeout(interruptTimer);
            interruptTimer = null;
        }
    }

    async function generateInterruptReply(contactId, messageHistory) {
        const contact = window.STPhone.Apps.Contacts.getContact(contactId);
        if (!contact) return;

        isGenerating = true;
        $('#st-typing').show();
        scrollToBottom();

        try {
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const prefill = settings.prefill || '';
            const myName = getUserName();
            const maxContextTokens = settings.maxContextTokens || 4096;

            let unifiedContext = "";
            const ctx = window.SillyTavern?.getContext() || {};

            if (ctx.chat && ctx.chat.length > 0) {
                const reverseChat = ctx.chat.slice().reverse();
                const collectedLines = [];
                let currentTokens = 0;

                for (const m of reverseChat) {
                    const sender = m.name || 'System';
                    const line = `${sender}: ${m.mes}`;
                    const estimatedTokens = Math.ceil(line.length / 2.5);

                    if (currentTokens + estimatedTokens > maxContextTokens) {
                        break;
                    }

                    collectedLines.unshift(line);
                    currentTokens += estimatedTokens;
                }

                unifiedContext = collectedLines.join('\n');
            }

            const additionalQueued = queuedMessages.filter(q => q.contactId === contactId).map(q => q.text);
            const allMessages = [...messageHistory, ...additionalQueued];
            queuedMessages = queuedMessages.filter(q => q.contactId !== contactId);

            const recentMessages = allMessages.map(m => `${myName}: ${m}`).join('\n');
            // [NEW] 캘린더 기념일 정보만 가져오기 (날짜 출력 요청 X)
            let calendarEventsPrompt = '';
            const Store = window.STPhone?.Apps?.Store;
            if (Store && Store.isInstalled('calendar')) {
                const Calendar = window.STPhone?.Apps?.Calendar;
                if (Calendar && Calendar.isCalendarEnabled() && Calendar.getEventsOnlyPrompt) {
                    calendarEventsPrompt = Calendar.getEventsOnlyPrompt() || '';
                }
            }

            const prompt = `### Character Info
Name: ${contact.name}
Personality: ${contact.persona || '(not specified)'}

### User Info
Name: ${myName}
Personality: ${settings.userPersonality || '(not specified)'}

### Real-time Story Flow
"""
${unifiedContext}
"""

### Situation
${myName} has sent ${messageHistory.length} messages in quick succession without waiting for your reply.

### Recent Messages from ${myName}:
${recentMessages}

### System Instruction
Respond naturally as ${contact.name} would when someone sends multiple messages rapidly.
Consider: Are you annoyed? Amused? Concerned? Playful?
Keep it short and casual (SMS style).
DO NOT use quotation marks. DO NOT write prose.
If you want to ignore, reply ONLY with: [IGNORE]

### Response
${prefill ? prefill : ''}${contact.name}:`;

            let result = await generateWithProfile(prompt, maxContextTokens);
            let replyText = String(result).trim();

            if (prefill && replyText.startsWith(prefill.trim())) {
                replyText = replyText.substring(prefill.trim().length).trim();
            }

            if (replyText.includes('[IGNORE]')) {
                $('#st-typing').hide();
                isGenerating = false;
                return;
            }

            if (replyText) {
                await receiveMessageSequential(contactId, replyText, contact.name, myName);
            }

        } catch (e) {
            console.error('[Messages] Interrupt reply failed:', e);
        }

        isGenerating = false;
        $('#st-typing').hide();
    }

    async function sendGroupMessage() {
        let text = $('#st-chat-input').val().trim();
        if (!text || !currentGroupId) return;

        const myName = getUserName();
        const group = getGroup(currentGroupId);

        $('#st-chat-input').val('').css('height', 'auto');
        addGroupMessage(currentGroupId, 'me', myName, text);
        appendGroupBubble('me', myName, text);

        // 히든 로그 (말풍선 내용은 즉시 저장)
        addHiddenLog(myName, `[📩 Group "${group?.name}"] ${myName}: ${text}`);

        // [핵심 수정] 기존 타이머가 있으면 취소 (시간 리셋)
        if (replyTimer) {
            clearTimeout(replyTimer);
        }

        // AI 그룹 답장 생성 (다시 5초 카운트 시작)
        const savedGroupId = currentGroupId;
        replyTimer = setTimeout(async () => {
            // 마지막 챗 이후 5초간 침묵하면 실행됨
            await generateGroupReply(savedGroupId, text);
        }, 5000);
    }


    // ========== AI 답장 생성 (1:1) ==========
    async function generateReply(contactId, userText) {
        const contact = window.STPhone.Apps.Contacts.getContact(contactId);
        if (!contact) return;

        isGenerating = true;

        // [NEW] 폰 앱에서 생성 중임을 표시 (index.js가 캘린더 날짜 프롬프트 주입 안 하도록)
        window.STPhone.isPhoneGenerating = true;

        $('#st-typing').show();
        scrollToBottom();

        const additionalQueued = queuedMessages.filter(q => q.contactId === contactId).map(q => q.text);
        if (additionalQueued.length > 0) {
            userText = additionalQueued[additionalQueued.length - 1];
            queuedMessages = queuedMessages.filter(q => q.contactId !== contactId);
        }

        try {
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const systemPrompt = settings.smsSystemPrompt || getDefaultSystemPrompt();
            const prefill = settings.prefill || '';
            const myName = getUserName();

            const maxContextTokens = settings.maxContextTokens || 4096;

            // [로직 변경] 토큰 제한에 맞춰 대화 수집
            let unifiedContext = "";
            const ctx = window.SillyTavern?.getContext() || {};

            if (ctx.chat && ctx.chat.length > 0) {
                const reverseChat = ctx.chat.slice().reverse();
                const collectedLines = [];
                let currentTokens = 0;

                for (const m of reverseChat) {
                    const sender = m.name || 'System';
                    const line = `${sender}: ${m.mes}`;
                    const estimatedTokens = Math.ceil(line.length / 2.5);

                    if (currentTokens + estimatedTokens > maxContextTokens) {
                        break;
                    }

                    collectedLines.unshift(line);
                    currentTokens += estimatedTokens;
                }

                unifiedContext = collectedLines.join('\n');
            }

            // [NEW] 캘린더 기념일 안전하게 가져오기 (오류나면 무시)
            let calendarEventsPrompt = '';
            try {
                const Store = window.STPhone?.Apps?.Store;
                if (Store && typeof Store.isInstalled === 'function' && Store.isInstalled('calendar')) {
                    const Calendar = window.STPhone?.Apps?.Calendar;
                    if (Calendar && Calendar.isCalendarEnabled() && typeof Calendar.getEventsOnlyPrompt === 'function') {
                        const eventTxt = Calendar.getEventsOnlyPrompt();
                        if (eventTxt) calendarEventsPrompt = eventTxt;
                    }
                }
            } catch (calErr) {
                console.warn('[Messages] 캘린더 프롬프트 로드 실패(무시됨):', calErr);
            }

            const prompt = `### Character Info
Name: ${contact.name}
Personality: ${contact.persona || '(not specified)'}

### User Info
Name: ${myName}
Personality: ${settings.userPersonality || '(not specified)'}

### 📜 Real-time Story Flow (Chronological Order)
Includes actions, dialogues, and phone messages exactly as they happened.
Target Content Limit: ${maxContextTokens} Tokens
"""
${unifiedContext}
"""

${systemPrompt}
${calendarEventsPrompt}

### Instruction
Reply to the last message based on the [Real-time Story Flow].
The User just sent: "${userText}"

### Response
From ${myName}: "${userText}"
${prefill ? prefill : ''}${contact.name}:`;

            let result = await generateWithProfile(prompt, maxContextTokens);
            let replyText = String(result).trim();

            if (prefill && replyText.startsWith(prefill.trim())) {
                replyText = replyText.substring(prefill.trim().length).trim();
            }

            if (replyText.includes('[IGNORE]')) {
                $('#st-typing').hide();
                isGenerating = false; // 종료 상태 처리 추가
                return;
            }

            const imgMatch = replyText.match(/\[IMG:\s*([^\]]+)\]/i);
            if (imgMatch) {
                const imgPrompt = imgMatch[1].trim();
                replyText = replyText.replace(/\[IMG:\s*[^\]]+\]/i, '').trim();

                const imgUrl = await generateSmartImage(imgPrompt, false);
                if (imgUrl) {
                    if (replyText) receiveMessage(contactId, replyText);
                    receiveMessage(contactId, '', imgUrl);
                    addHiddenLog(contact.name, `[📩 ${contact.name} -> ${myName}]: (Photo: ${imgPrompt}) ${replyText}`);
                    $('#st-typing').hide();
                    isGenerating = false; // 종료 상태 처리 추가
                    return;
                }
            }

            if (replyText) {
                 let shouldCall = false;
                 if (replyText.toLowerCase().includes('[call to user]')) {
                     shouldCall = true;
                     replyText = replyText.replace(/\[call to user\]/gi, '').trim();
                 }

                 if (replyText) {
                     await receiveMessageSequential(contactId, replyText, contact.name, myName);
                 }

                 if (shouldCall && window.STPhone.Apps?.Phone?.receiveCall) {
                     setTimeout(() => {
                         window.STPhone.Apps.Phone.receiveCall(contact);
                     }, 2000);
                 }
            }

        } catch (e) {
            console.error('[Messages] Reply generation failed:', e);
            toastr.error('답장 생성 실패 (콘솔 확인)');
        }

        isGenerating = false;
        window.STPhone.isPhoneGenerating = false; // [NEW] 플래그 해제
        $('#st-typing').hide();
    }




    // ========== AI 그룹 답장 생성 ==========
    async function generateGroupReply(groupId, userText) {
        const group = getGroup(groupId);
        if (!group) return;

        const members = [];
        group.members.forEach(mid => {
            const c = window.STPhone.Apps?.Contacts?.getContact(mid);
            if (c) members.push({ id: c.id, name: c.name, persona: c.persona || '' });
        });
        if (members.length === 0) return;

        $('#st-typing').show();
        scrollToBottom();

        try {
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const myName = getUserName();
            const maxContextTokens = settings.maxContextTokens || 4096;

            // [로직 변경] 토큰 제한에 맞춰 대화 수집 (위와 동일한 로직)
            let unifiedContext = "";
            const ctx = window.SillyTavern?.getContext() || {};

            if (ctx.chat && ctx.chat.length > 0) {
                const reverseChat = ctx.chat.slice().reverse();
                const collectedLines = [];
                let currentTokens = 0;

                for (const m of reverseChat) {
                    // 시스템 로그 이름 처리 안전장치
                    const senderName = m.name || 'System';
                    const line = `${senderName}: ${m.mes}`;

                    // 토큰 계산 (대략적)
                    const estimatedTokens = Math.ceil(line.length / 2.5);

                    if (currentTokens + estimatedTokens > maxContextTokens) {
                        break;
                    }

                    collectedLines.unshift(line);
                    currentTokens += estimatedTokens;
                }
                unifiedContext = collectedLines.join('\n');
            }

            let membersInfo = members.map(m => `- ${m.name}: ${m.persona}`).join('\n');

            const prompt = `[System] GROUP CHAT Mode.
### Group: "${group.name}"
### Members Info:
${membersInfo}

### User Info
Name: ${myName}
Personality: ${settings.userPersonality || '(not specified)'}

### 📜 Real-time Story Flow (Chronological Order)
Context limit: ${maxContextTokens} Tokens.
"""
${unifiedContext}
"""

### Instructions
1. User just sent: "${userText}"
2. Decide who responds (one or multiple).
3. Format: [REPLY character_name]: message

### Responses:`;

            let result = await generateWithProfile(prompt, maxContextTokens);
            let responseText = String(result).trim();

            const replyPattern = /\[REPLY\s+([^\]]+)\]:\s*(.+?)(?=\[REPLY|$)/gs;
            let match;
            let replies = [];

            while ((match = replyPattern.exec(responseText)) !== null) {
                const charName = match[1].trim();
                let message = match[2].trim();
                const member = members.find(m => m.name.toLowerCase().includes(charName.toLowerCase()));
                if (member && message) replies.push({ member, message });
            }

            if (replies.length === 0 && responseText.length > 0) {
                const cleanText = responseText.replace(/\[REPLY[^\]]*\]:/g, '').trim();
                if (cleanText) replies.push({ member: members[0], message: cleanText });
            }

            // [수정됨] 이제 줄바꿈을 쪼개지 않고 멤버별 발언을 한 덩어리로 저장합니다.
            for (let i = 0; i < replies.length; i++) {
                const { member, message } = replies[i];

                if (!message.trim()) continue;

                // 텀을 두고 전송
                await new Promise(resolve => setTimeout(resolve, 1000));

                receiveGroupMessage(groupId, member.id, member.name, message);
                addHiddenLog(member.name, `[📩 Group "${group.name}"] ${member.name}: ${message}`);
            }


        } catch (e) {

            console.error('[Messages] Group reply failed:', e);
            toastr.error('그룹 답장 생성 실패');
        }

        $('#st-typing').hide();
    }



    // ========== 유틸리티 ==========
    function getUserName() {
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        if (settings.userName) return settings.userName;

        const ctx = window.SillyTavern?.getContext?.();
        return ctx?.name1 || 'User';
    }

    function getDefaultSystemPrompt() {
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        if (settings.smsSystemPrompt) {
            return settings.smsSystemPrompt;
        }
        return `[System] You are {{char}} texting {{user}}. Stay in character.
- Write SMS-style: short, casual, multiple messages separated by line breaks
- No narration, no prose, no quotation marks
- DO NOT use flowery language. DO NOT output character name prefix.
- may use: emojis, slang, abbreviations, typo, and internet speak

### 📷 PHOTO REQUESTS
To send a photo, reply with: [IMG: vivid description of photo content]

### 🚫 IGNORING (Ghosting)
If you don't want to reply (angry, busy, indifferent, asleep), reply ONLY: [IGNORE]

### 📞 CALL INITIATION
To start a voice call, append [call to user] at the very end.
NEVER decide {{user}}'s reaction. Just generate the tag and stop.

### OUTPUT
Write the next SMS response only. No prose. No quotation marks. No character name prefix.`;
    }

// ========== 번역 기능 (SillyTavern 백엔드 API 사용) ==========
// overridePrompt 인자를 추가하여 번역 방향을 바꿀 수 있게 합니다.
async function translateText(originalText, overridePrompt = null) {
    const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
    // 내 메시지 번역 버튼은 설정의 '번역 켜기' 유무와 상관없이 동작하도록 하려면 아래 줄을 수정하지 않아도 됩니다.
    if (!settings.translateEnabled && !overridePrompt) return null;

    const provider = settings.translateProvider || 'google';
    const model = settings.translateModel || 'gemini-2.0-flash';

    // overridePrompt가 있으면 그것을 사용하고, 없으면 설정된 기본 프롬프트를 사용합니다.
    const translatePrompt = overridePrompt || settings.translatePrompt ||
    `You are a Korean translator. Translate the following English text to natural Korean.
    IMPORTANT: You must preserve the EXACT same number of line breaks (newlines) as the original text.
    Each line of English must have exactly one corresponding line of Korean translation.
    Do not merge or split lines. Output ONLY the translated text.\n\nText to translate:`;
        try {
            // SillyTavern의 getRequestHeaders 함수 가져오기
            const getRequestHeaders = window.SillyTavern?.getContext?.()?.getRequestHeaders ||
                                       (() => ({ 'Content-Type': 'application/json' }));

            // 공급자별 chat_completion_source 설정
            const sourceMap = {
                'google': 'makersuite',
                'vertexai': 'vertexai',
                'openai': 'openai',
                'claude': 'claude'
            };
            const chatCompletionSource = sourceMap[provider] || 'makersuite';

            // 메시지 구성
            const fullPrompt = `${translatePrompt}\n\n"${originalText}"`;
            const messages = [{ role: 'user', content: fullPrompt }];

            // 요청 파라미터
            const parameters = {
                model: model,
                messages: messages,
                temperature: 0.3,
                stream: false,
                chat_completion_source: chatCompletionSource,
                max_tokens: 1000
            };

            // Vertex AI 특수 설정
            if (provider === 'vertexai') {
                parameters.vertexai_auth_mode = 'full';
            }

            // API 호출
            const response = await fetch('/api/backends/chat-completions/generate', {
                method: 'POST',
                headers: { ...getRequestHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(parameters)
            });

            if (!response.ok) {
                console.error('[Messages] Translation API error:', response.status);
                return null;
            }

            const data = await response.json();

            // 공급자별 결과 추출
            let result;
            switch (provider) {
                case 'openai':
                    result = data.choices?.[0]?.message?.content?.trim();
                    break;
                case 'claude':
                    result = data.content?.[0]?.text?.trim();
                    break;
                case 'google':
                case 'vertexai':
                    result = data.candidates?.[0]?.content?.trim() ||
                             data.choices?.[0]?.message?.content?.trim() ||
                             data.text?.trim();
                    break;
                default:
                    result = data.choices?.[0]?.message?.content?.trim();
            }

            // 따옴표 제거
            if (result) {
                result = result.replace(/^["']|["']$/g, '');
            }

            return result || null;

        } catch (e) {
            console.error('[Messages] Translation failed:', e);
            return null;
        }
    }

    // ========== [수정됨] 히든 로그 (AI 기억용) ==========
    function addHiddenLog(speaker, text) {
        if (!window.SillyTavern) return;
        const context = window.SillyTavern.getContext();

        // 채팅 배열이 없으면 중단
        if (!context || !context.chat) return;

        // [중요 수정] is_system: false로 변경!
        // 이렇게 해야 AI가 시스템 메시지가 아닌 "스토리의 일부"로 인식해서 절대 까먹지 않는다.
        // 우리는 index.js에서 CSS로 가려놨기 때문에, 유저 눈에는 여전히 안 보인다.
        // 이것이 바로 "투명망토" 전략이다.
        const newMessage = {
            name: speaker,        // 말한 사람 (캐릭터 이름 또는 System)
            is_user: false,       // 유저가 말한 것 아님
            is_system: false,     // ★ 핵심: 시스템 메시지 아님 (그래야 프롬프트에 포함됨)
            send_date: Date.now(),
            mes: text,
            extra: {
                // 강제 숨김(유령) 처리가 되지 않도록, extra 메타데이터는 깨끗하게 유지하거나
                // 단순히 식별용 태그만 남긴다. is_hidden 같은 건 넣지 마라.
                is_phone_log: true
            }
        };

        // 채팅 로그에 푸시
        context.chat.push(newMessage);

        // 즉시 저장 (새로고침해도 남도록)
        if (window.SlashCommandParser && window.SlashCommandParser.commands['savechat']) {
            window.SlashCommandParser.commands['savechat'].callback({});
        } else if (typeof saveChatConditional === 'function') {
            saveChatConditional();
        }
    }

    // ========== 이미지 생성 ==========
    async function generateSmartImage(basicDescription, isUserSender) {
        try {
            const parser = getSlashCommandParserInternal();
            const sdCmd = parser?.commands['sd'] || parser?.commands['imagine'];

            if (!sdCmd) {
                toastr.warning("이미지 생성 확장이 필요합니다");
                return null;
            }

            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const userSettings = {
                name: getUserName(),
                tags: settings.userTags || ''
            };

            // 현재 대화 상대 태그
            let charName = '';
            let charTags = '';

            if (currentChatType === 'dm' && currentContactId) {
                const contact = window.STPhone.Apps.Contacts.getContact(currentContactId);
                if (contact) {
                    charName = contact.name;
                    charTags = contact.tags || '';
                }
            }

            // 최근 대화 컨텍스트
            let chatContextStr = '';
            if (currentChatType === 'dm') {
                const msgs = getMessages(currentContactId).slice(-5);
                chatContextStr = msgs.map(m => {
                    const sender = m.sender === 'me' ? userSettings.name : charName;
                    return `${sender}: ${m.text || '(사진)'}`;
                }).join('\n');
            } else if (currentChatType === 'group') {
                const group = getGroup(currentGroupId);
                const msgs = (group?.messages || []).slice(-5);
                chatContextStr = msgs.map(m => `${m.senderName}: ${m.text || '(사진)'}`).join('\n');
            }

            const referenceText = `1. [${userSettings.name} Visuals]: ${userSettings.tags}\n2. [${charName} Visuals]: ${charTags}`;
            const modeHint = isUserSender ?
                `Mode: Selfie/Group (Focus on ${userSettings.name}, POV: Third person or Selfie)` :
                `Mode: Shot by ${userSettings.name} (Focus on ${charName})`;

            const instruct = `
### Background Story (Chat Log)
"""
${chatContextStr}
"""

### Visual Tag Library
${referenceText}

### Task
Generate a Stable Diffusion tag list based on the request below.

### User Request
Input: "${basicDescription}"
${modeHint}

### Steps
1. READ the [Background Story].
2. IDENTIFY who is in the picture.
3. COPY Visual Tags from [Visual Tag Library] for the appearing characters.
4. ADD emotional/scenery tags based on Story (time, location, lighting).
5. OUTPUT strictly comma-separated tags.

### Response (Tags Only):`;

            const tagResult = await generateWithProfile(instruct, 512);
            let finalPrompt = String(tagResult).trim();

            if (!finalPrompt || finalPrompt.length < 5) finalPrompt = basicDescription;

            toastr.info("🎨 그림 그리는 중...");
            const imgResult = await sdCmd.callback({ quiet: 'true' }, finalPrompt);

            if (typeof imgResult === 'string' && imgResult.length > 10) {
                return imgResult;
            }
        } catch (e) {
            console.error('[Messages] Image generation failed:', e);
        }
        return null;
    }

    // ========== 메시지 옵션 (삭제/수정/재생성) ==========
    function showMsgOptions(contactId, msgIndex, lineIndex, isMyMessage = false) {
        $('#st-msg-option-popup').remove();

        const allData = loadAllMessages();
        const msgs = allData[contactId];
        const targetMsg = msgs?.[msgIndex];

        if (!targetMsg) return;

        const hasImage = !!targetMsg.image;
        const hasText = !!(targetMsg.text && targetMsg.text.trim());
        const lines = hasText ? targetMsg.text.split('\n').filter(l => l.trim()) : [];
        const hasMultipleLines = lines.length > 1;
        const currentLineText = lines[lineIndex] || '';

        let optionsHtml = '';

        if (hasImage && !hasText) {
            optionsHtml += `
                <div id="st-opt-delete-image" style="padding: 15px; cursor: pointer; color: #ff3b30; border-bottom:1px solid var(--pt-border, #eee); font-size:15px;">🗑️ 이미지 삭제</div>
            `;
        } else if (hasImage && hasText) {
            optionsHtml += `
                <div id="st-opt-delete-image" style="padding: 15px; cursor: pointer; color: #ff3b30; border-bottom:1px solid var(--pt-border, #eee); font-size:15px;">🗑️ 이미지만 삭제</div>
                <div id="st-opt-edit-line" style="padding: 15px; cursor: pointer; color: #007aff; border-bottom:1px solid var(--pt-border, #eee); font-size:15px;">✏️ 이 메시지 수정</div>
                <div id="st-opt-delete-line" style="padding: 15px; cursor: pointer; color: #ff3b30; border-bottom:1px solid var(--pt-border, #eee); font-size:15px;">🗑️ 이 메시지 삭제</div>
            `;
        } else {
            optionsHtml += `
                <div id="st-opt-edit-line" style="padding: 15px; cursor: pointer; color: #007aff; border-bottom:1px solid var(--pt-border, #eee); font-size:15px;">✏️ 이 메시지 수정</div>
                <div id="st-opt-delete-line" style="padding: 15px; cursor: pointer; color: #ff3b30; border-bottom:1px solid var(--pt-border, #eee); font-size:15px;">🗑️ 이 메시지 삭제</div>
            `;
        }

        if (hasMultipleLines) {
            optionsHtml += `
                <div id="st-opt-edit-all" style="padding: 15px; cursor: pointer; color: #007aff; border-bottom:1px solid var(--pt-border, #eee); font-size:15px;">📝 전체 응답 수정</div>
                <div id="st-opt-delete-all" style="padding: 15px; cursor: pointer; color: #ff3b30; border-bottom:1px solid var(--pt-border, #eee); font-size:15px;">🗑️ 전체 응답 삭제</div>
            `;
        }

        if (!isMyMessage) {
            optionsHtml += `
                <div id="st-opt-regenerate" style="padding: 15px; cursor: pointer; color: #34c759; border-bottom:1px solid var(--pt-border, #eee); font-size:15px;">🔄 다시 받기</div>
            `;
        }

        optionsHtml += `
            <div id="st-opt-bulk" style="padding: 15px; cursor: pointer; color: #5856d6; border-bottom:1px solid var(--pt-border, #eee); font-size:15px;">☑️ 여러 개 선택</div>
        `;

        const popupHtml = `
            <div id="st-msg-option-popup" style="
                position: absolute; top:0; left:0; width:100%; height:100%;
                background: rgba(0,0,0,1); z-index: 3000;
                display: flex; align-items: center; justify-content: center;
            ">
                <div style="
                    width: 260px; background: var(--pt-card-bg, #fff);
                    border-radius: 15px; overflow: hidden; text-align: center;
                    box-shadow: 0 5px 25px rgba(0,0,0,0.4);
                    color: var(--pt-text-color, #000);
                ">
                    <div style="padding: 15px; font-weight:600; font-size:15px; border-bottom:1px solid var(--pt-border, #eee);">메시지 옵션</div>
                    ${optionsHtml}
                    <div id="st-opt-cancel" style="padding: 15px; cursor: pointer; background: #f2f2f7; color: #000; font-weight:600;">취소</div>
                </div>
            </div>
        `;
        $('.st-chat-screen').append(popupHtml);

        $('#st-opt-cancel').on('click', () => $('#st-msg-option-popup').remove());

        $('#st-opt-edit-line').on('click', () => {
            $('#st-msg-option-popup').remove();
            showLineEditPopup(contactId, msgIndex, lineIndex, currentLineText);
        });

        $('#st-opt-delete-line').on('click', () => {
            $('#st-msg-option-popup').remove();
            deleteLine(contactId, msgIndex, lineIndex);
        });

        $('#st-opt-delete-image').on('click', () => {
            $('#st-msg-option-popup').remove();
            deleteImage(contactId, msgIndex);
        });

        $('#st-opt-edit-all').on('click', () => {
            $('#st-msg-option-popup').remove();
            showEditPopup(contactId, msgIndex, targetMsg.text || '');
        });

        $('#st-opt-delete-all').on('click', () => {
            $('#st-msg-option-popup').remove();
            deleteMessage(contactId, msgIndex);
        });

        $('#st-opt-regenerate').on('click', () => {
            $('#st-msg-option-popup').remove();
            regenerateMessage(contactId, msgIndex);
        });

        $('#st-opt-bulk').on('click', () => {
            $('#st-msg-option-popup').remove();
            enableBulkSelectMode();
        });
    }

    function deleteImage(contactId, msgIndex) {
        const allData = loadAllMessages();
        const msgs = allData[contactId];

        if (!msgs || !msgs[msgIndex]) {
            toastr.error('메시지를 찾을 수 없습니다.');
            return;
        }

        const msg = msgs[msgIndex];

        if (msg.text && msg.text.trim()) {
            delete msg.image;
        } else {
            msgs.splice(msgIndex, 1);
        }

        saveAllMessages(allData);
        openChat(contactId);
        toastr.info('이미지가 삭제되었습니다.');
    }

    function showLineEditPopup(contactId, msgIndex, lineIndex, currentText) {
        $('#st-edit-popup').remove();

        const popupHtml = `
            <div id="st-edit-popup" style="
                position: absolute; top:0; left:0; width:100%; height:100%;
                background: rgba(0,0,0,1); z-index: 3000;
                display: flex; align-items: center; justify-content: center;
            ">
                <div style="
                    width: 85%; max-width: 320px; background: var(--pt-card-bg, #fff);
                    border-radius: 15px; overflow: hidden;
                    box-shadow: 0 5px 25px rgba(0,0,0,0.4);
                    color: var(--pt-text-color, #000);
                    padding: 20px;
                ">
                    <div style="font-weight:600; font-size:16px; margin-bottom:15px; text-align:center;">줄 수정</div>
                    <textarea id="st-edit-textarea" style="
                        width: 100%; box-sizing: border-box;
                        min-height: 80px; padding: 12px;
                        border: 1px solid var(--pt-border, #ddd);
                        border-radius: 10px; font-size: 15px;
                        background: var(--pt-bg-color, #f9f9f9);
                        color: var(--pt-text-color, #000);
                        resize: vertical;
                    ">${currentText}</textarea>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button id="st-edit-cancel" style="
                            flex: 1; padding: 12px; border: none; border-radius: 10px;
                            font-size: 15px; font-weight: 600; cursor: pointer;
                            background: #e5e5ea; color: #000;
                        ">취소</button>
                        <button id="st-edit-save" style="
                            flex: 1; padding: 12px; border: none; border-radius: 10px;
                            font-size: 15px; font-weight: 600; cursor: pointer;
                            background: var(--pt-accent, #007aff); color: white;
                        ">저장</button>
                    </div>
                </div>
            </div>
        `;
        $('.st-chat-screen').append(popupHtml);

        $('#st-edit-cancel').on('click', () => $('#st-edit-popup').remove());

        $('#st-edit-save').on('click', () => {
            const newText = $('#st-edit-textarea').val().trim();
            $('#st-edit-popup').remove();
            editLine(contactId, msgIndex, lineIndex, newText);
        });
    }

    function editLine(contactId, msgIndex, lineIndex, newLineText) {
        const allData = loadAllMessages();
        const msgs = allData[contactId];

        if (!msgs || !msgs[msgIndex]) {
            toastr.error('메시지를 찾을 수 없습니다.');
            return;
        }

        const oldText = msgs[msgIndex].text || '';
        const lines = oldText.split('\n');
        let realLineIndex = 0;
        let targetOriginalIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim()) {
                if (realLineIndex === lineIndex) {
                    targetOriginalIndex = i;
                    break;
                }
                realLineIndex++;
            }
        }

        if (targetOriginalIndex === -1) return;

        const oldLineText = lines[targetOriginalIndex];
        lines[targetOriginalIndex] = newLineText;
        const newText = lines.join('\n');

        msgs[msgIndex].text = newText;
        saveAllMessages(allData);

        updateHiddenLogText(oldLineText, newLineText);

        openChat(contactId);
        toastr.success('수정되었습니다.');
    }

    function deleteLine(contactId, msgIndex, lineIndex) {
        const allData = loadAllMessages();
        const msgs = allData[contactId];

        if (!msgs || !msgs[msgIndex]) {
            toastr.error('메시지를 찾을 수 없습니다.');
            return;
        }

        const oldText = msgs[msgIndex].text || '';
        const lines = oldText.split('\n');
        let realLineIndex = 0;
        let targetOriginalIndex = -1;
        let deletedLineText = '';

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim()) {
                if (realLineIndex === lineIndex) {
                    targetOriginalIndex = i;
                    deletedLineText = lines[i].trim();
                    break;
                }
                realLineIndex++;
            }
        }

        if (targetOriginalIndex === -1) return;

        lines.splice(targetOriginalIndex, 1);
        const newText = lines.filter(l => l.trim()).join('\n');

        if (newText) {
            msgs[msgIndex].text = newText;
        } else {
            msgs.splice(msgIndex, 1);
        }
        saveAllMessages(allData);

        if (deletedLineText) {
            removeHiddenLogByText(deletedLineText);
        }

        openChat(contactId);
        toastr.info('삭제되었습니다.');
    }

    function enableBulkSelectMode() {
        bulkSelectMode = true;
        $('#st-chat-messages').addClass('bulk-mode');

        const bulkBar = `
            <div id="st-bulk-bar" style="
                position: absolute; bottom: 0; left: 0; right: 0;
                background: var(--pt-card-bg, #fff);
                border-top: 1px solid var(--pt-border, #ddd);
                padding: 15px; display: flex; gap: 10px;
                z-index: 2500;
            ">
                <button id="st-bulk-cancel" style="
                    flex: 1; padding: 12px; border: none; border-radius: 10px;
                    font-size: 15px; font-weight: 600; cursor: pointer;
                    background: #e5e5ea; color: #000;
                ">취소</button>
                <button id="st-bulk-delete" style="
                    flex: 1; padding: 12px; border: none; border-radius: 10px;
                    font-size: 15px; font-weight: 600; cursor: pointer;
                    background: #ff3b30; color: white;
                ">삭제 (<span id="st-bulk-count">0</span>)</button>
            </div>
        `;
        $('.st-chat-screen').append(bulkBar);

        $('#st-bulk-cancel').on('click', disableBulkSelectMode);
        $('#st-bulk-delete').on('click', bulkDeleteSelected);

        toastr.info('삭제할 메시지들을 선택하세요');
    }

    function disableBulkSelectMode() {
        bulkSelectMode = false;
        $('#st-chat-messages').removeClass('bulk-mode');
        $('.st-msg-bubble').removeClass('bulk-selected');
        $('#st-bulk-bar').remove();
    }

    function updateBulkCounter() {
        const count = $('.bulk-selected').length;
        $('#st-bulk-count').text(count);
    }

    function bulkDeleteSelected() {
        const selected = $('.bulk-selected');
        if (selected.length === 0) {
            toastr.warning('선택된 메시지가 없습니다');
            return;
        }

        const toDelete = [];
        selected.each(function() {
            const msgIdx = $(this).data('idx');
            const lineIdx = $(this).data('line-idx');
            toDelete.push({ msgIdx, lineIdx });
        });

        toDelete.sort((a, b) => {
            if (b.msgIdx !== a.msgIdx) return b.msgIdx - a.msgIdx;
            return b.lineIdx - a.lineIdx;
        });

        const allData = loadAllMessages();
        const msgs = allData[currentContactId];

        toDelete.forEach(({ msgIdx, lineIdx }) => {
            if (!msgs || !msgs[msgIdx]) return;

            const oldText = msgs[msgIdx].text || '';
            const lines = oldText.split('\n');
            let realLineIndex = 0;
            let targetOriginalIndex = -1;
            let deletedLineText = '';

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim()) {
                    if (realLineIndex === lineIdx) {
                        targetOriginalIndex = i;
                        deletedLineText = lines[i].trim();
                        break;
                    }
                    realLineIndex++;
                }
            }

            if (targetOriginalIndex !== -1) {
                lines.splice(targetOriginalIndex, 1);
                const newText = lines.filter(l => l.trim()).join('\n');

                if (newText) {
                    msgs[msgIdx].text = newText;
                } else {
                    msgs[msgIdx].text = '';
                }

                if (deletedLineText) {
                    removeHiddenLogByText(deletedLineText);
                }
            }
        });

        for (let i = msgs.length - 1; i >= 0; i--) {
            if (!msgs[i].text && !msgs[i].image) {
                msgs.splice(i, 1);
            }
        }

        saveAllMessages(allData);
        disableBulkSelectMode();
        openChat(currentContactId);
        toastr.success(`${toDelete.length}개 항목이 삭제되었습니다.`);
    }

    function showEditPopup(contactId, msgIndex, currentText) {
        $('#st-edit-popup').remove();

        const popupHtml = `
            <div id="st-edit-popup" style="
                position: absolute; top:0; left:0; width:100%; height:100%;
                background: rgba(0,0,0,1); z-index: 3000;
                display: flex; align-items: center; justify-content: center;
            ">
                <div style="
                    width: 85%; max-width: 320px; background: var(--pt-card-bg, #fff);
                    border-radius: 15px; overflow: hidden;
                    box-shadow: 0 5px 25px rgba(0,0,0,0.4);
                    color: var(--pt-text-color, #000);
                    padding: 20px;
                ">
                    <div style="font-weight:600; font-size:16px; margin-bottom:15px; text-align:center;">메시지 수정</div>
                    <textarea id="st-edit-textarea" style="
                        width: 100%; box-sizing: border-box;
                        min-height: 100px; padding: 12px;
                        border: 1px solid var(--pt-border, #ddd);
                        border-radius: 10px; font-size: 15px;
                        background: var(--pt-bg-color, #f9f9f9);
                        color: var(--pt-text-color, #000);
                        resize: vertical;
                    ">${currentText}</textarea>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button id="st-edit-cancel" style="
                            flex: 1; padding: 12px; border: none; border-radius: 10px;
                            font-size: 15px; font-weight: 600; cursor: pointer;
                            background: #e5e5ea; color: #000;
                        ">취소</button>
                        <button id="st-edit-save" style="
                            flex: 1; padding: 12px; border: none; border-radius: 10px;
                            font-size: 15px; font-weight: 600; cursor: pointer;
                            background: var(--pt-accent, #007aff); color: white;
                        ">저장</button>
                    </div>
                </div>
            </div>
        `;
        $('.st-chat-screen').append(popupHtml);

        $('#st-edit-cancel').on('click', () => $('#st-edit-popup').remove());

        $('#st-edit-save').on('click', () => {
            const newText = $('#st-edit-textarea').val().trim();
            $('#st-edit-popup').remove();
            if (newText) {
                editMessage(contactId, msgIndex, newText);
            }
        });
    }

    function editMessage(contactId, msgIndex, newText) {
        const allData = loadAllMessages();
        const msgs = allData[contactId];

        if (!msgs || !msgs[msgIndex]) {
            toastr.error('메시지를 찾을 수 없습니다.');
            return;
        }

        const oldText = msgs[msgIndex].text || '';
        msgs[msgIndex].text = newText;
        saveAllMessages(allData);

        updateHiddenLogText(oldText, newText);

        openChat(contactId);
        toastr.success('메시지가 수정되었습니다.');
    }

    function updateHiddenLogText(oldText, newText) {
        if (!window.SillyTavern) return;
        const context = window.SillyTavern.getContext();
        if (!context || !context.chat) return;

        for (let i = context.chat.length - 1; i >= 0; i--) {
            const msg = context.chat[i];
            if (msg.extra && msg.extra.is_phone_log && msg.mes.includes(oldText)) {
                msg.mes = msg.mes.replace(oldText, newText);

                if (window.SlashCommandParser && window.SlashCommandParser.commands['savechat']) {
                    window.SlashCommandParser.commands['savechat'].callback({});
                }
                return;
            }
        }
    }

    function removeHiddenLogByText(textToRemove) {
        if (!window.SillyTavern) return;
        const context = window.SillyTavern.getContext();
        if (!context || !context.chat) return;


        for (let i = context.chat.length - 1; i >= 0; i--) {
            const msg = context.chat[i];


            if (msg.extra && msg.extra.is_phone_log && msg.mes.includes(textToRemove)) {

                context.chat.splice(i, 1);
                console.log(`📱 [Messages] 히든 로그 삭제됨: ${textToRemove}`);

                if (window.SlashCommandParser && window.SlashCommandParser.commands['savechat']) {
                    window.SlashCommandParser.commands['savechat'].callback({});
                } else if (typeof saveChatConditional === 'function') {
                    saveChatConditional();
                }
                return;
            }
        }
    }

/* 수정후 deleteMessage */
    function deleteMessage(contactId, index) {
        const allData = loadAllMessages();
        const msgs = allData[contactId];

        if(!msgs || !msgs[index]) {
            toastr.error('메시지를 찾을 수 없습니다.');
            return;
        }


        const targetText = msgs[index].text || '(사진)';


        msgs.splice(index, 1);
        saveAllMessages(allData);


        removeHiddenLogByText(targetText);


        openChat(contactId);
        toastr.info("메시지가 삭제되었습니다.");
    }



    async function regenerateMessage(contactId, index) {

        deleteMessage(contactId, index);

        toastr.info("🔄 기억을 지우고 답장을 다시 생성합니다...");


        let lastUserText = "(메시지 없음)";
        const msgs = getMessages(contactId);


        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].sender === 'me') {
                lastUserText = msgs[i].text || '(사진)';
                break;
            }
        }

        await generateReply(contactId, lastUserText);
    }


    // ========== 선제 메시지 시스템 (채팅 이벤트 기반) ==========
    let lastProactiveCheck = 0;
    const PROACTIVE_COOLDOWN = 60000;

    function getRandomContact() {
        const contacts = window.STPhone.Apps?.Contacts?.getAllContacts() || [];
        if (contacts.length === 0) return null;
        return contacts[Math.floor(Math.random() * contacts.length)];
    }

    function getContactByName(name) {
        const contacts = window.STPhone.Apps?.Contacts?.getAllContacts() || [];

        // 먼저 봇 연락처 ID로 찾기 (자동 생성된 봇 연락처 우선)
        const botContactId = window.STPhone.Apps?.Contacts?.getBotContactId?.();
        if (botContactId) {
            const botContact = contacts.find(c => c.id === botContactId);
            if (botContact && botContact.name.toLowerCase() === name.toLowerCase()) {
                return botContact;
            }
        }

        // 일반 연락처에서 이름으로 찾기
        return contacts.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
    }

    // 봇 연락처 자동 가져오기 (없으면 동기화 후 가져오기)
    async function getBotContact() {
        await window.STPhone.Apps?.Contacts?.syncAutoContacts?.();
        const contacts = window.STPhone.Apps?.Contacts?.getAllContacts() || [];
        const botContactId = window.STPhone.Apps?.Contacts?.getBotContactId?.();
        if (botContactId) {
            return contacts.find(c => c.id === botContactId) || null;
        }
        return null;
    }

    async function checkProactiveMessage(charName) {
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};

        console.debug('📱 [Proactive] check start', { charName, enabled: !!settings.proactiveEnabled, isGenerating });

        if (!settings.proactiveEnabled) {
            console.debug('📱 [Proactive] disabled');
            return;
        }

        const sinceLast = Date.now() - lastProactiveCheck;
        if (sinceLast < PROACTIVE_COOLDOWN) {
            console.debug('📱 [Proactive] cooldown', { sinceLast, cooldown: PROACTIVE_COOLDOWN });
            return;
        }

        if (isGenerating) {
            console.debug('📱 [Proactive] blocked by isGenerating');
            return;
        }

        const chance = settings.proactiveChance || 30;
        const roll = Math.random() * 100;

        console.debug('📱 [Proactive] roll', { roll: Number(roll.toFixed(2)), chance });

        if (roll > chance) {
            console.log(`📱 [Proactive] 확률 미달 (${roll.toFixed(0)}% > ${chance}%)`);
            return;
        }

        lastProactiveCheck = Date.now();

        // 1. 먼저 캐릭터 이름으로 연락처 찾기
        let contact = getContactByName(charName);

        // 2. 없으면 자동 생성된 봇 연락처 가져오기
        if (!contact) {
            contact = await getBotContact();
        }

        // 3. 그래도 없으면 랜덤 연락처
        if (!contact) {
            contact = getRandomContact();
        }

        if (!contact) {
            console.log('📱 [Proactive] 연락처 없음');
            return;
        }

        console.debug('📱 [Proactive] selected contact', { id: contact.id, name: contact.name, isTemp: !!contact.isTemp });
        console.log(`📱 [Proactive] ${contact.name}에게서 선제 메시지 생성!`);
        await generateProactiveMessage(contact);
    }

    async function generateProactiveMessage(contact) {
        if (!contact) return;

        const debugId = Date.now();
        const startedAt = performance?.now?.() || 0;
        isGenerating = true;

        try {
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const proactivePrompt = settings.proactivePrompt || '';
            const prefill = settings.prefill || '';
            const myName = getUserName();
            const maxContextTokens = settings.maxContextTokens || 4096;
            const profileId = settings.connectionProfileId || '';

            console.debug('📱 [Proactive] generate start', { debugId, profileId, contactId: contact.id, contactName: contact.name, maxContextTokens });

            let unifiedContext = "";
            const ctx = window.SillyTavern?.getContext() || {};

            if (ctx.chat && ctx.chat.length > 0) {
                const reverseChat = ctx.chat.slice().reverse();
                const collectedLines = [];
                let currentTokens = 0;

                for (const m of reverseChat) {
                    const sender = m.name || 'System';
                    const line = `${sender}: ${m.mes}`;
                    const estimatedTokens = Math.ceil(line.length / 2.5);

                    if (currentTokens + estimatedTokens > maxContextTokens) break;
                    collectedLines.unshift(line);
                    currentTokens += estimatedTokens;
                }
                unifiedContext = collectedLines.join('\n');
            }

            console.debug('📱 [Proactive] context built', { debugId, contextLen: unifiedContext.length });

            // ========== 1단계: 맥락 판단 ==========
            const contextCheckPrompt = `### Current Story Context
"""
${unifiedContext || '(No recent conversation)'}
"""

### Question
Based on the story context above, would it be natural and appropriate for ${contact.name} to send a spontaneous text message to ${myName} right now?

Consider:
- Is ${contact.name} physically able to text? (not in a conversation, not asleep, not in danger, etc.)
- Would it make sense given what just happened in the story?
- Is there a reason ${contact.name} would think of ${myName} right now?

Answer with ONLY "YES" or "NO" (one word only).`;

            const contextCheckResult = await generateWithProfile(contextCheckPrompt, 100);
            const checkAnswer = String(contextCheckResult || '').trim().toUpperCase();

            console.debug('📱 [Proactive] context check', { debugId, checkAnswer });

            if (!checkAnswer.includes('YES')) {
                console.log(`📱 [Proactive] 맥락상 부적절하여 스킵 (${checkAnswer})`);
                isGenerating = false;
                return;
            }

            // ========== 2단계: 실제 메시지 생성 ==========
            const filledProactivePrompt = proactivePrompt
                .replace(/\{\{char\}\}/gi, contact.name)
                .replace(/\{\{user\}\}/gi, myName);

            const prompt = `### Character Info
Name: ${contact.name}
Personality: ${contact.persona || '(not specified)'}

### User Info
Name: ${myName}
Personality: ${settings.userPersonality || '(not specified)'}

### Recent Story Context
"""
${unifiedContext || '(No recent conversation)'}
"""

### Special Instruction (PROACTIVE TEXT MESSAGE)
${filledProactivePrompt}

### Response
${prefill ? prefill : ''}${contact.name}:`;

            const result = await generateWithProfile(prompt, maxContextTokens);
            let replyText = String(result || '').trim();

            console.debug('📱 [Proactive] raw result', { debugId, resultType: typeof result, replyLen: replyText.length, replyPreview: replyText.slice(0, 120) });

            if (prefill && replyText.startsWith(prefill.trim())) {
                replyText = replyText.substring(prefill.trim().length).trim();
            }

            if (replyText.includes('[IGNORE]') || replyText.includes('[NO_TEXT]')) {
                console.log('📱 [Proactive] AI가 메시지 스킵');
                return;
            }

            if (replyText) {
                console.log(`📱 [Proactive] 메시지 전송: ${replyText.substring(0, 50)}...`);
                await receiveMessageSequential(contact.id, replyText, contact.name, myName);
                console.debug('📱 [Proactive] delivered', { debugId, contactId: contact.id, contactName: contact.name });
            } else {
                console.debug('📱 [Proactive] empty reply', { debugId });
            }

        } catch (e) {
            console.error('[Proactive] 메시지 생성 실패:', { debugId, error: e });
        } finally {
            const elapsedMs = (performance?.now?.() || 0) - startedAt;
            isGenerating = false;
            console.debug('📱 [Proactive] generate end', { debugId, elapsedMs: Math.round(elapsedMs), isGenerating });
        }
    }

    function initProactiveListener() {
        const checkInterval = setInterval(() => {
            const ctx = window.SillyTavern?.getContext?.();
            if (!ctx) return;

            clearInterval(checkInterval);

            const eventSource = ctx.eventSource;
            if (eventSource) {
                eventSource.on('message_received', (messageId) => {
                    setTimeout(() => {
                        const ctx = window.SillyTavern.getContext();
                        console.debug('📱 [Proactive] message_received', { messageId, chatLen: ctx?.chat?.length || 0 });
                        if (!ctx.chat || ctx.chat.length === 0) return;

                        const userMsgCount = ctx.chat.reduce((count, m) => count + (m?.is_user ? 1 : 0), 0);
                        if (userMsgCount === 0) {
                            console.log('📱 [Proactive] 그리팅/초기 메시지 스킵');
                            return;
                        }
                        const lastMsg = ctx.chat[ctx.chat.length - 1];
                        console.debug('📱 [Proactive] lastMsg', { name: lastMsg?.name, is_user: !!lastMsg?.is_user, mesPreview: String(lastMsg?.mes || '').slice(0, 80) });
                        if (lastMsg && !lastMsg.is_user) {
                            checkProactiveMessage(lastMsg.name);
                        }
                    }, 500);
                });
                console.log('📱 [Proactive] 채팅 이벤트 리스너 등록됨');
            } else {
                console.warn('📱 [Proactive] eventSource missing');
            }
        }, 1000);
    }

    setTimeout(initProactiveListener, 3000);

    function syncExternalMessage(sender, text) {
        const contacts = window.STPhone.Apps?.Contacts?.getAllContacts() || [];
        if (contacts.length === 0) return;

        const firstContact = contacts[0];
        addMessage(firstContact.id, sender, text);

        if (sender === 'them') {
            const unread = getUnreadCount(firstContact.id) + 1;
            setUnreadCount(firstContact.id, unread);
            updateMessagesBadge();
        }
    }

    return {
        open,
        openChat,
        openGroupChat,
        receiveMessage,
        receiveGroupMessage,
        getTotalUnread,
        getMessages,
        addMessage,
        syncExternalMessage,
        updateMessagesBadge
    };
})();

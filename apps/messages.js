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

    // 송금/출금 태그를 예쁜 문자열로 변환 (화면 표시용)
    function formatBankTagForDisplay(text) {
        if (!text) return text;

        // 송금 패턴: [💰 보내는사람 송금 받는사람: 금액]
        // 예: [💰 ㅇㅇ 송금 잭: 2₩] → 💰 ㅇㅇ님이 잭님에게 2원을 송금했습니다.
        text = text.replace(/\[💰\s*(.+?)\s+송금\s+(.+?)\s*[:\s：]+\s*[\$₩€¥£]?\s*([\d,]+)\s*[\$₩€¥£원]?\s*\]/gi,
            (match, sender, receiver, amount) => {
                return `💰 ${sender.trim()}님이 ${receiver.trim()}님에게 ${amount.trim()}원을 송금했습니다.`;
            });

        // 출금 패턴: [💰 가게이름 출금 유저: 금액]
        text = text.replace(/\[💰\s*(.+?)\s+출금\s+(.+?)\s*[:\s：]+\s*[\$₩€¥£]?\s*([\d,]+)\s*[\$₩€¥£원]?\s*\]/gi,
            (match, shop, user, amount) => {
                return `💰 ${shop.trim()}에서 ${amount.trim()}원 결제`;
            });

        // 잔액 패턴: [💰 유저 잔액: 금액] - 숨김 처리
        text = text.replace(/\[💰\s*.+?\s+잔액\s*[:\s：]+\s*[\$₩€¥£]?\s*[\d,]+\s*[\$₩€¥£원]?\s*\]/gi, '');

        return text.trim();
    }

    /**
     * AI 생성 함수 - 멀티턴 메시지 배열 지원
     * @param {string|Array} promptOrMessages - 단일 프롬프트 문자열 또는 메시지 배열 [{role, content}, ...]
     * @param {number} maxTokens - 최대 토큰 수
     * @returns {Promise<string>} - 생성된 텍스트
     */
    async function generateWithProfile(promptOrMessages, maxTokens = 1024) {
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        const profileId = settings.connectionProfileId;

        const debugId = Date.now();
        const startedAt = performance?.now?.() || 0;

        // 메시지 배열로 정규화
        const messages = Array.isArray(promptOrMessages)
            ? promptOrMessages
            : [{ role: 'user', content: promptOrMessages }];

        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context) throw new Error('SillyTavern context not available');

            if (profileId) {
                const connectionManager = context.ConnectionManagerRequestService;
                if (connectionManager && typeof connectionManager.sendRequest === 'function') {
                    console.debug('📱 [Messages][AI] sendRequest start', { debugId, profileId, maxTokens, messageCount: messages.length });

                    const overrides = {};
                    if (maxTokens) {
                        overrides.max_tokens = maxTokens;
                    }

                    const result = await connectionManager.sendRequest(
                        profileId,
                        messages,
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

            // fallback: 단일 프롬프트로 변환
            const fallbackPrompt = Array.isArray(promptOrMessages)
                ? promptOrMessages.map(m => `${m.role}: ${m.content}`).join('\n\n')
                : promptOrMessages;

            const parser = getSlashCommandParserInternal();
            const genCmd = parser?.commands['genraw'] || parser?.commands['gen'];
            if (!genCmd) throw new Error('AI 명령어를 찾을 수 없습니다');

            const result = await genCmd.callback({ quiet: 'true' }, fallbackPrompt);

            const elapsedMs = (performance?.now?.() || 0) - startedAt;
            console.debug('📱 [Messages][AI] slash gen done', { debugId, elapsedMs: Math.round(elapsedMs), outLen: String(result || '').length });
            return String(result || '').trim();

        } catch (e) {
            const elapsedMs = (performance?.now?.() || 0) - startedAt;
            const errorStr = String(e?.message || e || '');

            // Gemini PROHIBITED_CONTENT 등 안전 필터 오류는 조용히 빈 문자열 반환
            if (errorStr.includes('PROHIBITED_CONTENT') ||
                errorStr.includes('SAFETY') ||
                errorStr.includes('blocked') ||
                errorStr.includes('content filter')) {
                console.warn('📱 [Messages][AI] 안전 필터 차단됨, 스킵:', { debugId, error: errorStr });
                return '';
            }

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
                padding: 20px 20px 15px;
            }
            .st-messages-title {
                font-size: 28px;
                font-weight: 700;
            }
            .st-messages-new-group {
                background: var(--pt-accent, #007aff);
                color: white;
                border: none;
                width: 32px; height: 32px;
                border-radius: 50%;
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .st-messages-tabs {
                display: flex;
                padding: 0 20px;
                gap: 0;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
            }
            .st-messages-tab {
                flex: 1;
                padding: 14px;
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
                padding: 0 20px;
            }
            .st-thread-item {
                display: flex;
                align-items: center;
                padding: 14px 0;
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
                background: var(--pt-accent, #007aff);
                margin-right: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                color: white;
            }
            .st-thread-info { flex: 1; min-width: 0; }
            .st-thread-name { font-size: 16px; font-weight: 600; }
            .st-thread-members { font-size: 12px; color: var(--pt-sub-text, #86868b); }
            .st-thread-preview { font-size: 14px; color: var(--pt-sub-text, #86868b); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .st-thread-meta { text-align: right; }
            .st-thread-time { font-size: 12px; color: var(--pt-sub-text, #86868b); }
            .st-thread-badge { background: #ff3b30; color: white; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 8px; margin-top: 4px; display: inline-block; min-width: 16px; text-align: center; }
            .st-messages-empty { text-align: center; padding: 80px 24px; color: var(--pt-sub-text, #86868b); }

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
            }

/* 그룹챗 메시지 스타일 */
.st-msg-wrapper {
                display: flex;
                flex-direction: column;
                max-width: 100%;
                width: fit-content;
                min-width: 0; /* 부모 요소 때문에 찌그러지는 것 방지 */
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

            .st-msg-bubble {
                max-width: 75%;
                min-width: fit-content; /* 내용물에 맞게 최소 너비 설정 */
                width: auto; /* 너비를 자동으로 설정 */
                padding: 10px 14px;
                border-radius: 18px;
                font-size: 15px;
                line-height: 1.4;
                word-wrap: break-word;
                word-break: keep-all; /* 한글이 멋대로 잘리는 것 방지 */
                white-space: pre-wrap; /* 줄바꿈 규칙 최적화 */
                position: relative;
                display: inline-block;
            }
            .st-msg-bubble.me { align-self: flex-end; background: var(--msg-my-bubble, var(--pt-accent, #007aff)); color: var(--msg-my-text, white); border-bottom-right-radius: 4px; }
            .st-msg-bubble.them { align-self: flex-start; background: var(--msg-their-bubble, var(--pt-card-bg, #e5e5ea)); color: var(--msg-their-text, var(--pt-text-color, #000)); border-bottom-left-radius: 4px; }
            .st-msg-bubble.deleted { opacity: 0.6; font-style: italic; }
            .st-msg-image { max-width: 200px; border-radius: 12px; cursor: pointer; }

            /* 메시지 삭제 버튼 (3초 내) */
            .st-msg-delete-btn {
                position: absolute;
                left: -18px;
                top: 50%;
                transform: translateY(-50%);
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: rgba(255, 59, 48, 0.7);
                color: white;
                border: none;
                font-size: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.6;
                transition: opacity 0.2s, transform 0.2s;
                z-index: 10;
            }
            .st-msg-delete-btn:hover {
                opacity: 1;
                transform: translateY(-50%) scale(1.2);
            }

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

            /* 그룹챗 전용 - wrapper 스타일 (말풍선 너비는 테마 설정 유지) */
            .st-msg-wrapper { display: flex; flex-direction: column; }
            /* 입력창 영역 */
            .st-chat-input-area {
                display: flex; align-items: flex-end; padding: 14px 16px; padding-bottom: 45px; gap: 10px;
                border-top: 1px solid var(--pt-border, #e5e5e5); background: var(--pt-bg-color, #f5f5f7); flex-shrink: 0;
            }
            .st-chat-textarea {
                flex: 1; border: 1px solid var(--pt-border, #e5e5e5); background: var(--pt-card-bg, #f5f5f7);
                border-radius: 12px; padding: 12px 16px; font-size: 15px; resize: none;
                max-height: 100px; outline: none; color: var(--pt-text-color, #000); line-height: 1.4;
            }
            .st-chat-send {
                width: 36px; height: 36px; border-radius: 50%; border: none; background: var(--pt-accent, #007aff);
                color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
                font-size: 16px; flex-shrink: 0; transition: transform 0.1s, background 0.2s;
            }
.st-chat-send:active { transform: scale(0.95); }

/* 번역 버튼 스타일 추가 */
.st-chat-translate-user-btn {
    width: 36px; height: 36px; border-radius: 50%; border: none;
    background: var(--pt-sub-text, #86868b);
    color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 13px; flex-shrink: 0; transition: transform 0.1s, background 0.2s;
}
.st-chat-translate-user-btn:active { transform: scale(0.95); }

.st-chat-cam-btn {
                width: 36px; height: 36px; border-radius: 50%; border: none;
                background: var(--pt-card-bg, #e9e9ea); color: var(--pt-sub-text, #666);
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                font-size: 16px; flex-shrink: 0;
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

            /* 커스텀 타임스탬프 스타일 */
            .st-msg-custom-timestamp {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 10px 0;
                color: var(--pt-sub-text, #86868b);
                font-size: 11px;
            }
            .st-msg-custom-timestamp-text {
                background: var(--pt-card-bg, rgba(0,0,0,0.05));
                padding: 4px 12px;
                border-radius: 12px;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                transition: opacity 0.2s;
            }
            .st-msg-custom-timestamp-text:hover {
                opacity: 0.7;
            }
            .st-chat-timestamp-btn {
                width: 36px; height: 36px; border-radius: 50%; border: none;
                background: var(--pt-card-bg, #e9e9ea); color: var(--pt-sub-text, #666);
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                font-size: 14px; flex-shrink: 0;
            }
            .st-chat-timestamp-btn:active { background: #d1d1d6; }

            .bulk-mode .st-msg-bubble {
                position: relative;
                margin-left: 20px;
            }
            .bulk-mode .st-msg-bubble.me {
                margin-left: 0;
                margin-right: 20px;
            }
            .bulk-mode .st-msg-bubble::before {
                content: '';
                position: absolute;
                left: -18px;
                top: 50%;
                transform: translateY(-50%);
                width: 12px;
                height: 12px;
                border: 1.5px solid var(--pt-border, #ccc);
                border-radius: 50%;
                background: var(--pt-card-bg, #fff);
            }
            .bulk-mode .st-msg-bubble.me::before {
                left: auto;
                right: -18px;
            }
            .bulk-mode .st-msg-bubble.bulk-selected::before {
                background: #007aff;
                border-color: #007aff;
            }
            .bulk-mode .st-msg-bubble.bulk-selected::after {
                content: '✓';
                position: absolute;
                left: -18px;
                top: 50%;
                transform: translateY(-50%);
                color: white;
                font-size: 8px;
                font-weight: bold;
                width: 12px;
                text-align: center;
            }
            .bulk-mode .st-msg-bubble.me.bulk-selected::after {
                left: auto;
                right: -18px;
            }

            /* 답장 스타일 */
            .st-msg-reply-preview {
                font-size: 12px;
                padding: 6px 10px;
                margin-bottom: 4px;
                border-radius: 10px;
                max-width: 100%;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .st-msg-wrapper.me .st-msg-reply-preview {
                background: #ededed;
                border-left: 2px solid rgba(255,255,255,0.5);
                align-self: flex-end;
            }
            .st-msg-wrapper.them .st-msg-reply-preview {
                background: rgba(0,0,0,0.05);
                border-left: 2px solid var(--pt-accent, #007aff);
                align-self: flex-start;
            }
            .st-msg-reply-name {
                font-weight: 600;
                font-size: 11px;
                opacity: 0.8;
            }
            .st-msg-wrapper.me .st-msg-reply-name {
                color: #000;
            }
            .st-msg-wrapper.them .st-msg-reply-name {
                color: var(--pt-accent, #007aff);
            }
            .st-msg-reply-text {
                opacity: 0.8;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 180px;
            }
            .st-msg-wrapper.me .st-msg-reply-text {
                color: #1c1c1c;
            }
            .st-msg-wrapper.them .st-msg-reply-text {
                color: var(--pt-sub-text, #86868b);
            }

            /* 답장 입력 모드 UI */
            .st-reply-bar {
                display: flex;
                align-items: center;
                padding: 8px 16px;
                background: var(--pt-card-bg, #f0f0f0);
                border-top: 1px solid var(--pt-border, #e5e5e5);
                gap: 10px;
            }
            .st-reply-bar-content {
                flex: 1;
                min-width: 0;
            }
            .st-reply-bar-label {
                font-size: 11px;
                color: var(--pt-accent, #007aff);
                font-weight: 600;
            }
            .st-reply-bar-text {
                font-size: 13px;
                color: var(--pt-sub-text, #86868b);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .st-reply-bar-close {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: none;
                background: var(--pt-border, #ddd);
                color: var(--pt-sub-text, #666);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                flex-shrink: 0;
            }
            .st-reply-bar-close:hover {
                background: var(--pt-sub-text, #999);
                color: white;
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
    let replyToMessage = null;

    // ========== 저장소 키 ==========
    function getStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId) return null;

        // [NEW] 누적 모드일 때는 캐릭터 기반 키 사용
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        if (settings.recordMode === 'accumulate' && context.characterId !== undefined) {
            return 'st_phone_messages_char_' + context.characterId;
        }

        return 'st_phone_messages_' + context.chatId;
    }

function getGroupStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId) return null;

        // [NEW] 누적 모드일 때는 캐릭터 기반 키 사용
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        if (settings.recordMode === 'accumulate' && context.characterId !== undefined) {
            return 'st_phone_groups_char_' + context.characterId;
        }

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

    // ========== 커스텀 타임스탬프 저장소 ==========
    function getCustomTimestampStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId) return null;
        return 'st_phone_custom_timestamps_' + context.chatId;
    }

    function loadCustomTimestamps(contactId) {
        const key = getCustomTimestampStorageKey();
        if (!key) return [];
        try {
            const all = JSON.parse(localStorage.getItem(key) || '{}');
            return all[contactId] || [];
        } catch (e) { return []; }
    }

    function saveCustomTimestamp(contactId, beforeMsgIndex, text) {
        const key = getCustomTimestampStorageKey();
        if (!key) return;
        try {
            const all = JSON.parse(localStorage.getItem(key) || '{}');
            if (!all[contactId]) all[contactId] = [];
            all[contactId].push({ beforeMsgIndex, text, id: Date.now() });
            localStorage.setItem(key, JSON.stringify(all));
        } catch (e) { console.error('[Messages] 커스텀 타임스탬프 저장 실패:', e); }
    }

    function updateCustomTimestamp(contactId, timestampId, newText) {
        const key = getCustomTimestampStorageKey();
        if (!key) return;
        try {
            const all = JSON.parse(localStorage.getItem(key) || '{}');
            if (!all[contactId]) return;
            const ts = all[contactId].find(t => t.id === timestampId);
            if (ts) {
                ts.text = newText;
                localStorage.setItem(key, JSON.stringify(all));
            }
        } catch (e) { console.error('[Messages] 커스텀 타임스탬프 수정 실패:', e); }
    }

    function deleteCustomTimestamp(contactId, timestampId) {
        const key = getCustomTimestampStorageKey();
        if (!key) return;
        try {
            const all = JSON.parse(localStorage.getItem(key) || '{}');
            if (!all[contactId]) return;
            all[contactId] = all[contactId].filter(t => t.id !== timestampId);
            localStorage.setItem(key, JSON.stringify(all));
        } catch (e) { console.error('[Messages] 커스텀 타임스탬프 삭제 실패:', e); }
    }

    function getCustomTimestampHtml(text, timestampId) {
        return `<div class="st-msg-custom-timestamp" data-ts-id="${timestampId}"><span class="st-msg-custom-timestamp-text" data-action="edit-timestamp" data-ts-id="${timestampId}"><i class="fa-regular fa-clock"></i>${text}</span></div>`;
    }

    function removeTimestampHiddenLog(timestampId) {
        if (!window.SillyTavern) return;
        const context = window.SillyTavern.getContext();
        if (!context || !context.chat) return;

        const marker = `[ts:${timestampId}]`;
        for (let i = context.chat.length - 1; i >= 0; i--) {
            const msg = context.chat[i];
            if (msg.extra && msg.extra.is_phone_log && msg.mes.includes(marker)) {
                context.chat.splice(i, 1);
                console.log(`📱 [Messages] 타임스탬프 히든 로그 삭제됨: ${timestampId}`);
                if (window.SlashCommandParser && window.SlashCommandParser.commands['savechat']) {
                    window.SlashCommandParser.commands['savechat'].callback({});
                }
                return;
            }
        }
    }

    function addTimestampHiddenLog(contactId, timestampId, text) {
        const marker = `[ts:${timestampId}]`;
        let logText = '';
        if (currentChatType === 'group') {
            const group = getGroup(contactId);
            logText = `${marker}[⏰ Time Skip - Group "${group?.name || 'Unknown'}"] ${text}`;
        } else {
            const contact = window.STPhone.Apps?.Contacts?.getContact(contactId);
            logText = `${marker}[⏰ Time Skip - ${contact?.name || 'Unknown'}] ${text}`;
        }
        console.log('📱 [Messages] 타임스탬프 히든 로그 추가:', logText);
        addHiddenLog('System', logText);
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

// #IG_START - Instagram/SNS 태그 제거 함수 (메시지 저장 전 정리)
function stripInstagramTags(text) {
    if (!text) return text;
    let cleaned = text;
    // [IG_POST]...[/IG_POST] 제거
    cleaned = cleaned.replace(/\[IG_POST\][\s\S]*?\[\/IG_POST\]/gi, '');
    // [IG_REPLY]...[/IG_REPLY] 제거
    cleaned = cleaned.replace(/\[IG_REPLY\][\s\S]*?\[\/IG_REPLY\]/gi, '');
    // [IG_COMMENT]...[/IG_COMMENT] 제거
    cleaned = cleaned.replace(/\[IG_COMMENT\][\s\S]*?\[\/IG_COMMENT\]/gi, '');
    // 불완전한 태그 제거 (시작/끝만 있는 경우)
    cleaned = cleaned.replace(/\[IG_POST\][^\[]*/gi, '');
    cleaned = cleaned.replace(/[^\]]*\[\/IG_POST\]/gi, '');
    cleaned = cleaned.replace(/\[IG_REPLY\][^\[]*/gi, '');
    cleaned = cleaned.replace(/[^\]]*\[\/IG_REPLY\]/gi, '');
    cleaned = cleaned.replace(/\[IG_COMMENT\][^\[]*/gi, '');
    cleaned = cleaned.replace(/[^\]]*\[\/IG_COMMENT\]/gi, '');
    // 괄호 형식 제거
    cleaned = cleaned.replace(/\(Instagram:\s*"[^"]+"\)/gi, '');
    cleaned = cleaned.replace(/\(Instagram Reply:\s*"[^"]+"\)/gi, '');
    // 레거시 패턴 제거
    cleaned = cleaned.replace(/\[Instagram 포스팅\][^\n]*/gi, '');
    cleaned = cleaned.replace(/\[Instagram 답글\][^\n]*/gi, '');
    cleaned = cleaned.replace(/\[Instagram 댓글\][^\n]*/gi, '');
    // [reply] 태그 제거 (답장 마커)
    cleaned = cleaned.replace(/\[reply\]/gi, '');
    cleaned = cleaned.replace(/\[REPLY\s*[^\]]*\]/gi, '');
    // 연속 공백/줄바꿈 정리
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();
    return cleaned;
}
// #IG_END

function addMessage(contactId, sender, text, imageUrl = null, addTimestamp = false, rpDate = null, replyTo = null) {
    const all = loadAllMessages();
    if (!all[contactId]) all[contactId] = [];

    // #IG_START - Instagram 태그 제거 (저장 전 정리)
    const cleanedText = stripInstagramTags(text);
    // #IG_END

    const newMsgIndex = all[contactId].length;
    if (addTimestamp) saveTimestamp(contactId, newMsgIndex, Date.now());

    const currentRpDate = window.STPhone?.Apps?.Calendar?.getRpDate();
    const rpDateStr = currentRpDate ? `${currentRpDate.year}년 ${currentRpDate.month}월 ${currentRpDate.day}일 ${currentRpDate.dayOfWeek}` : null;

    const msgData = {
        sender,
        text: cleanedText,  // #IG - Instagram 태그 제거된 텍스트 사용
        image: imageUrl,
        timestamp: Date.now(),
        rpDate: rpDate || rpDateStr,
        // [NEW] 내가 보낸 메시지는 기본적으로 '안 읽음(false)' 상태
        // 상대방 메시지는 받자마자 내가 읽은 것이므로 상관없으나, 통일성을 위해 true 처리 가능
        read: sender === 'them' ? true : false
    };


    if (replyTo) {
        msgData.replyTo = replyTo;
    }

    all[contactId].push(msgData);
    saveAllMessages(all);
    return all[contactId].length - 1;
}


    // [NEW] 대화방의 내 모든 메시지를 '읽음' 처리 (1 없애기)
    function markMessagesAsRead(contactId) {
        const all = loadAllMessages();
        if (!all[contactId]) return;

        let changed = false;
        all[contactId].forEach(msg => {
            // 내가 보냈고, 아직 안 읽혔다면 -> 읽음 처리
            if (msg.sender === 'me' && msg.read === false) {
                msg.read = true;
                changed = true;
            }
        });

        if (changed) {
            saveAllMessages(all);
            // 현재 보고 있는 화면이면 UI 즉시 갱신 (1 지우기)
            $('.st-msg-unread-marker').fadeOut(200, function() { $(this).remove(); });
            console.log(`📱 [Messages] Contact ${contactId}의 모든 메시지를 읽음 처리했습니다.`);
        }
    }


    // ========== 메시지 수정 (삭제 시 대체 텍스트로 변경) ==========
    function updateMessage(contactId, msgIndex, newText, isDeleted = false) {
        const all = loadAllMessages();
        if (!all[contactId] || !all[contactId][msgIndex]) return false;

        all[contactId][msgIndex].text = newText;
        all[contactId][msgIndex].isDeleted = isDeleted;
        if (isDeleted) {
            all[contactId][msgIndex].image = null; // 이미지도 삭제
        }
        saveAllMessages(all);
        return true;
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
        return `<div class="st-msg-rp-date"><span class="st-msg-rp-date-text"><i class="fa-regular fa-calendar" style="margin-right:6px;"></i>${dateStr}</span></div>`;
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

    async function receiveMessageSequential(contactId, text, contactName, myName, replyTo = null) {
        // #IG_START - Instagram 태그 제거만 수행 (실제 처리는 processInstagramMessage에서)
        // [IG_POST], [IG_REPLY], [IG_COMMENT] 태그 제거
        text = text.replace(/\[IG_POST\][\s\S]*?\[\/IG_POST\]/gi, '').trim();
        text = text.replace(/\[IG_REPLY\][\s\S]*?\[\/IG_REPLY\]/gi, '').trim();
        text = text.replace(/\[IG_COMMENT\][\s\S]*?\[\/IG_COMMENT\]/gi, '').trim();
        // #IG_END

        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length === 0) return;

        let contact = null;
        if (window.STPhone.Apps?.Contacts) {
            contact = window.STPhone.Apps.Contacts.getContact(contactId);
        }
        const contactAvatar = contact?.avatar || DEFAULT_AVATAR;

        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};

        let lineReplyTo = replyTo;

        for (let i = 0; i < lines.length; i++) {
            let lineText = lines[i].trim();
            if (!lineText) continue;

            // #IG_START - Instagram 포스팅/답글/댓글 패턴 감지 및 제거 (줄 단위 - 하위 호환)
            if (window.STPhone.Apps?.Instagram) {
                const InstagramLine = window.STPhone.Apps.Instagram;

                // [IG_POST] 태그 및 불완전한 조각 제거
                if (lineText.includes('[IG_POST]') || lineText.includes('[/IG_POST]')) {
                    lineText = lineText.replace(/\[IG_POST\][\s\S]*?\[\/IG_POST\]/gi, '').trim();
                    lineText = lineText.replace(/\[IG_POST\][^\[]*/gi, '').trim();
                    lineText = lineText.replace(/[^\]]*\[\/IG_POST\]/gi, '').trim();
                }

                // [IG_REPLY] 태그 및 불완전한 조각 제거
                if (lineText.includes('[IG_REPLY]') || lineText.includes('[/IG_REPLY]')) {
                    lineText = lineText.replace(/\[IG_REPLY\][\s\S]*?\[\/IG_REPLY\]/gi, '').trim();
                    lineText = lineText.replace(/\[IG_REPLY\][^\[]*/gi, '').trim();
                    lineText = lineText.replace(/[^\]]*\[\/IG_REPLY\]/gi, '').trim();
                }

                // [IG_COMMENT] 태그 및 불완전한 조각 제거
                if (lineText.includes('[IG_COMMENT]') || lineText.includes('[/IG_COMMENT]')) {
                    lineText = lineText.replace(/\[IG_COMMENT\][\s\S]*?\[\/IG_COMMENT\]/gi, '').trim();
                    lineText = lineText.replace(/\[IG_COMMENT\][^\[]*/gi, '').trim();
                    lineText = lineText.replace(/[^\]]*\[\/IG_COMMENT\]/gi, '').trim();
                }

                // 빈 줄이면 스킵
                if (!lineText) continue;

                // 괄호 형식: (Instagram: "캡션") - 태그 제거만 (처리는 processInstagramMessage에서)
                if (lineText.includes('(Instagram:')) {
                    lineText = lineText.replace(/\(Instagram:\s*"[^"]+"\)/gi, '').trim();
                }

                // 새 패턴: (Instagram Reply: "답글") - 태그 제거만
                if (lineText.includes('(Instagram Reply:')) {
                    lineText = lineText.replace(/\(Instagram Reply:\s*"[^"]+"\)/gi, '').trim();
                }

                // 기존 패턴들도 유지 (하위 호환) - 태그 제거만
                if (lineText.includes('[Instagram 포스팅]')) {
                    lineText = lineText.replace(/\[Instagram 포스팅\][^\n]*/gi, '').trim();
                }

                if (lineText.includes('[Instagram 답글]')) {
                    lineText = lineText.replace(/\[Instagram 답글\][^\n]*/gi, '').trim();
                }

                // 댓글 패턴도 처리 (제거만)
                if (lineText.includes('[Instagram 댓글]')) {
                    lineText = lineText.replace(/\[Instagram 댓글\][^\n]*/gi, '').trim();
                }

                if (!lineText) continue;
            }
            // #IG_END

            const calendarInstalled = window.STPhone?.Apps?.Store?.isInstalled?.('calendar');
            const rpDateInfo = calendarInstalled ? extractRpDate(lineText) : null;
            let rpDateStr = null;

            if (rpDateInfo) {
                lineText = stripRpDate(lineText);
                rpDateStr = rpDateInfo.dateStr;

                if (window.STPhone?.Apps?.Calendar) {
                    window.STPhone.Apps.Calendar.updateRpDate({
                        year: rpDateInfo.year,
                        month: rpDateInfo.month,
                        day: rpDateInfo.day,
                        dayOfWeek: rpDateInfo.dayOfWeek
                    });
                }

                if (!lineText) continue;
            }

            const baseDelay = 500 + Math.random() * 800;
            const charDelay = Math.min(lineText.length * 30, 1500);
            const totalDelay = baseDelay + charDelay;

            await new Promise(resolve => setTimeout(resolve, totalDelay));

            const isPhoneActive = $('#st-phone-container').hasClass('active');
            const isViewingThisChat = (currentChatType === 'dm' && currentContactId === contactId);
            const $containerNow = $('#st-chat-messages');

            const newIdx = addMessage(contactId, 'them', lineText, null, false, rpDateStr, i === 0 ? lineReplyTo : null);

            let translatedText = null;
            if (settings.translateEnabled) {
                translatedText = await translateText(lineText);
                if (translatedText) {
                    saveTranslation(contactId, newIdx, translatedText);
                }
            }

            if (!isPhoneActive || !isViewingThisChat) {
                // 폰 꺼져있거나 다른 채팅방 보는 중 → 알림 + 미읽음 증가
                const unread = getUnreadCount(contactId) + 1;
                setUnreadCount(contactId, unread);
                updateMessagesBadge();

                const displayText = translatedText || lineText;
                showBubbleNotification(contactName, displayText, contactAvatar, contactId, 'dm');
            } else if ($containerNow.length) {
                if ($('#st-typing').length) $('#st-typing').hide();
                const side = 'them';
                const clickAttr = `data-action="msg-option" data-idx="${newIdx}" data-line-idx="0" data-sender="${side}" class="st-msg-bubble ${side} clickable" style="cursor:pointer;" title="옵션 보기"`;

                // 송금/출금 태그 변환 적용
                const displayLineText = formatBankTagForDisplay(lineText);
                let bubbleContent = displayLineText;
                if (translatedText) {
                    const displayMode = settings.translateDisplayMode || 'both';
                    if (displayMode === 'korean') {
                        bubbleContent = translatedText;
                    } else {
                        bubbleContent = `<div class="st-msg-original">${displayLineText}</div><div class="st-msg-translation">${translatedText}</div>`;
                    }
                }

                const msgs = getMessages(contactId);
                const currentMsg = msgs[msgs.length - 1];
                const prevMsg = msgs.length > 1 ? msgs[msgs.length - 2] : null;

                if (currentMsg && currentMsg.rpDate) {
                    if (!prevMsg || prevMsg.rpDate !== currentMsg.rpDate) {
                        $containerNow.find('#st-typing').before(getRpDateDividerHtml(currentMsg.rpDate));
                    }
                }

                let wrapperHtml = `<div class="st-msg-wrapper ${side}">`;
                if (i === 0 && lineReplyTo) {
                    wrapperHtml += `<div class="st-msg-reply-preview">
                        <div class="st-msg-reply-name">${lineReplyTo.senderName}</div>
                        <div class="st-msg-reply-text">${lineReplyTo.previewText}</div>
                    </div>`;
                }
                wrapperHtml += `<div ${clickAttr}>${bubbleContent}</div>`;
                wrapperHtml += `</div>`;

                $containerNow.find('#st-typing').before(wrapperHtml);
                scrollToBottom();

                if (i < lines.length - 1) {
                    if ($('#st-typing').length) $('#st-typing').show();
                }
            }

            addHiddenLog(contactName, `[📩 ${contactName} -> ${myName}]: ${lineText}`);
        }
    }

    async function receiveMessage(contactId, text, imageUrl = null, replyTo = null) {
        // #IG_START - Instagram 태그 제거 (저장 + 렌더링 모두 정리된 텍스트 사용)
        const cleanedText = stripInstagramTags(text);
        // #IG_END
        const newIdx = addMessage(contactId, 'them', cleanedText, imageUrl, false, null, replyTo);

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

        if (cleanedText && settings.translateEnabled) {  // #IG - cleanedText 사용
            translatedText = await translateText(cleanedText);
            if (translatedText) {
                saveTranslation(contactId, newIdx, translatedText);
            }
        }

        // 채팅방 보고 있으면 말풍선 추가
        if (isPhoneActive && isViewingThisChat) {
            appendBubble('them', cleanedText, imageUrl, newIdx, translatedText, replyTo);  // #IG - cleanedText 사용
        }

        // 채팅방 안 보고 있을 때만 알림
        if (!isPhoneActive || !isViewingThisChat) {
            const unread = getUnreadCount(contactId) + 1;
            setUnreadCount(contactId, unread);
            updateMessagesBadge();

            // 알림 미리보기 - 송금 태그는 간단하게 표시
            let preview;
            if (imageUrl) {
                preview = '사진';
            } else if (/\[💰.*송금.*:/.test(cleanedText)) {  // #IG - cleanedText 사용
                preview = '💰 송금 알림';
            } else if (/\[💰.*출금.*:/.test(cleanedText)) {  // #IG - cleanedText 사용
                preview = '💰 결제 알림';
            } else {
                preview = (translatedText || cleanedText)?.substring(0, 50) || '새 메시지';  // #IG - cleanedText 사용
            }
            showNotification(contactName, preview, contactAvatar, contactId, 'dm');
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
            const preview = imageUrl ? '사진' : (text?.substring(0, 50) || '새 메시지');
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

        // 메인 화면에서는 홈바 표시
        $('#st-home-btn').show();

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
                    <button class="st-messages-new-group" id="st-new-group-btn" title="새 그룹 만들기"><i class="fa-solid fa-user-group"></i></button>
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
            $list.html(`<div class="st-messages-empty"><div style="font-size:36px;opacity:0.4;margin-bottom:15px;"><i class="fa-regular fa-comments"></i></div><div>대화가 없습니다</div><div style="font-size:12px;margin-top:8px;opacity:0.7;">연락처를 추가하고 대화를 시작하세요</div></div>`);
            return;
        }

        contacts.forEach(c => {
            const msgs = allMsgs[c.id] || [];
            const last = msgs[msgs.length - 1];
            const unread = getUnreadCount(c.id);
            // 미리보기 텍스트에 송금/출금 태그 변환 적용
            let previewText = '새 대화';
            if (last) {
                if (last.image) {
                    previewText = '사진';
                } else if (last.text) {
                    previewText = formatBankTagForDisplay(last.text);
                }
            }
            $list.append(`
                <div class="st-thread-item" data-id="${c.id}" data-type="dm">
                    <img class="st-thread-avatar" src="${c.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                    <div class="st-thread-info">
                        <div class="st-thread-name">${c.name}</div>
                        <div class="st-thread-preview">${previewText}</div>
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
            $list.html(`<div class="st-messages-empty"><div style="font-size:36px;opacity:0.4;margin-bottom:15px;"><i class="fa-solid fa-user-group"></i></div><div>그룹이 없습니다</div><div style="font-size:12px;margin-top:8px;opacity:0.7;">상단 버튼을 눌러 새 그룹을 만드세요</div></div>`);
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
                    <div class="st-thread-avatar-group"><i class="fa-solid fa-users"></i></div>
                    <div class="st-thread-info">
                        <div class="st-thread-name">${g.name}</div>
                        <div class="st-thread-members">${memberNames.join(', ') || '멤버 없음'}</div>
                        <div class="st-thread-preview">${last ? (last.image ? '사진' : `${last.senderName}: ${last.text}`) : '새 대화'}</div>
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
        if (replyTimer) clearTimeout(replyTimer);

        // 홈바 숨김
        $('#st-home-btn').hide();

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
        const customTimestamps = loadCustomTimestamps(contactId);
        const timestampMode = settings.timestampMode || 'none';
        let msgsHtml = '';

        let lastRenderedRpDate = null;

        msgs.forEach((m, index) => {
            // #IG_START - 저장된 메시지에 Instagram 태그가 남아있으면 제거
            const displayText = m.text ? stripInstagramTags(m.text) : '';
            // #IG_END

            const customTsForIndex = customTimestamps.filter(t => t.beforeMsgIndex === index);
            customTsForIndex.forEach(ts => {
                msgsHtml += getCustomTimestampHtml(ts.text, ts.id);
            });

            if (m.rpDate && m.rpDate !== lastRenderedRpDate) {
                msgsHtml += getRpDateDividerHtml(m.rpDate);
                lastRenderedRpDate = m.rpDate;
            }

            if (timestampMode !== 'none') {
                const tsData = timestamps.find(t => t.beforeMsgIndex === index);
                if (tsData) {
                    const date = new Date(tsData.timestamp);
                    const timeStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

                    if (timestampMode === 'timestamp') {
                        msgsHtml += `<div class="st-msg-timestamp"><span class="st-msg-timestamp-text">${timeStr}</span></div>`;
                    } else if (timestampMode === 'divider') {
                        msgsHtml += `<div class="st-msg-divider"><span class="st-msg-divider-text">대화 복귀</span></div>`;
                    }
                }
            }
            const side = m.sender === 'me' ? 'me' : 'them';

            const savedTranslation = (side === 'them') ? getTranslation(contactId, index) : null;
            const translateEnabled = settings.translateEnabled && side === 'them' && savedTranslation;

            const isDeleted = m.isDeleted === true;
            const deletedClass = isDeleted ? ' deleted' : '';

            const isExcluded = m.excludeFromContext === true;
            const excludedTag = isExcluded ? '<span class="st-msg-no-context">미반영</span>' : '';

            // 래퍼 시작
            msgsHtml += `<div class="st-msg-wrapper ${side}" style="position: relative;">`;

            if (m.replyTo) {
                msgsHtml += `<div class="st-msg-reply-preview">
                    <div class="st-msg-reply-name">${m.replyTo.senderName}</div>
                    <div class="st-msg-reply-text">${m.replyTo.previewText}</div>
                </div>`;
            }

            if (m.image && !isDeleted) {
                const imgAttr = `data-action="msg-option" data-idx="${index}" data-line-idx="0" data-sender="${side}" class="st-msg-bubble ${side} image-bubble clickable" style="cursor:pointer;" title="옵션 보기"`;
                msgsHtml += `<div ${imgAttr}><img class="st-msg-image" src="${m.image}">${excludedTag}</div>`;

                if (!displayText && settings.readReceiptEnabled && side === 'me' && m.read === false) {  // #IG - displayText 사용
                     msgsHtml += `<span class="st-msg-unread-marker" style="bottom: 10px;">1</span>`;
                }
            }

            if (displayText) {  // #IG - displayText 사용
                if (isDeleted) {
                    const lineAttr = `data-action="msg-option" data-idx="${index}" data-line-idx="0" data-sender="${side}" class="st-msg-bubble ${side}${deletedClass} clickable" style="cursor:pointer;" title="옵션 보기"`;
                    msgsHtml += `<div ${lineAttr}>${displayText}${excludedTag}</div>`;  // #IG - displayText 사용
                } else {
                    const lines = displayText.split('\n');  // #IG - displayText 사용
                    const translatedLines = savedTranslation ? savedTranslation.split('\n') : [];
                    let lineIdx = 0;

                    lines.forEach((line, idx) => {
                        const trimmed = formatBankTagForDisplay(line.trim());
                        if(trimmed) {
                            let bubbleContent = '';
                            const lineAttr = `data-action="msg-option" data-idx="${index}" data-line-idx="${lineIdx}" data-sender="${side}" class="st-msg-bubble ${side} clickable" style="cursor:pointer;" title="옵션 보기"`;

                            if (translateEnabled) {
                                const translatedLine = translatedLines[idx]?.trim();
                                const displayMode = settings.translateDisplayMode || 'both';
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

                            // 1 표시
                            let unreadHtml = '';
                            if (settings.readReceiptEnabled && side === 'me' && m.read === false && idx === lines.length - 1) {
                                unreadHtml = `<span class="st-msg-unread-marker">1</span>`;
                            }

                            msgsHtml += `<div ${lineAttr}>${bubbleContent}${lineIdx === 0 ? excludedTag : ''}${unreadHtml}</div>`;
                            lineIdx++;
                        }
                    });
                }
            }

            msgsHtml += `</div>`; // Wrapper 끝
        });

        const trailingTimestamps = customTimestamps.filter(t => t.beforeMsgIndex >= msgs.length);
        trailingTimestamps.forEach(ts => {
            msgsHtml += getCustomTimestampHtml(ts.text, ts.id);
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

                <div class="st-chat-input-area" id="st-chat-input-area">
                    <button class="st-chat-cam-btn" id="st-chat-cam"><i class="fa-solid fa-camera"></i></button>
                    <button class="st-chat-timestamp-btn" id="st-chat-timestamp" title="타임스탬프 추가"><i class="fa-regular fa-clock"></i></button>
                    <textarea class="st-chat-textarea" id="st-chat-input" placeholder="메시지" rows="1"></textarea>
                    ${settings.translateEnabled ? '<button class="st-chat-translate-user-btn" id="st-chat-translate-user" title="영어로 번역"><i class="fa-solid fa-language"></i></button>' : ''}
                    <button class="st-chat-send" id="st-chat-send"><i class="fa-solid fa-arrow-up"></i></button>
                </div>

                <div class="st-blocked-banner" id="st-blocked-banner" style="display:none;">
                    <div style="text-align:center; padding: 15px; background: linear-gradient(135deg, #ff4757, #ff6b81); color: white; font-weight: 600;">
                        <i class="fa-solid fa-ban" style="margin-right: 8px;"></i>
                        <span id="st-blocked-name"></span>님에게 차단되어 메시지를 보낼 수 없습니다.
                    </div>
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
        applyMessageBackground();
    }

    // 메시지 앱 테마 스타일 적용 함수
    function applyMessageBackground() {
        if (window.STPhone.Apps?.Theme?.getCurrentTheme) {
            const theme = window.STPhone.Apps.Theme.getCurrentTheme();
            if (!theme?.messages) return;

            const messages = theme.messages;
            const $chatMessages = $('#st-chat-messages');

            // 배경 이미지 적용
            if (messages.bgImage && messages.bgImage.length > 0) {
                if ($chatMessages.length) {
                    $chatMessages.css({
                        'background-image': `url("${messages.bgImage}")`,
                        'background-color': 'transparent',
                        'background-size': 'cover',
                        'background-position': 'center',
                        'background-repeat': 'no-repeat'
                    });
                }
            }

            // 말풍선 스타일 적용 - !important로 강제 적용
            const bubbleWidth = messages.bubbleMaxWidth || 75;
            const bubbleRadius = messages.bubbleRadius || 18;
            const bubbleFontSize = messages.fontSize || 15;

            $('.st-msg-bubble').each(function() {
                // width: auto와 word-break 설정을 추가하여 옆으로 길어지게 만듭니다.
                this.style.cssText += `max-width: ${bubbleWidth}% !important; border-radius: ${bubbleRadius}px !important; font-size: ${bubbleFontSize}px !important; width: auto !important; min-width: fit-content !important; word-break: keep-all !important; white-space: pre-wrap !important;`;
            });
            $('.st-msg-bubble.me').each(function() {
                this.style.cssText += `background: ${messages.myBubbleColor} !important; color: ${messages.myBubbleTextColor} !important; border-bottom-right-radius: 4px !important;`;
            });
            $('.st-msg-bubble.them').each(function() {
                this.style.cssText += `background: ${messages.theirBubbleColor} !important; color: ${messages.theirBubbleTextColor} !important; border-bottom-left-radius: 4px !important;`;
            });

            console.log('🖼️ [Messages] Theme applied, bubble width:', bubbleWidth + '%');
        }
    }

    function attachChatListeners(contactId, contact) {
        // [차단 상태 체크 및 UI 업데이트]
        const Settings = window.STPhone.Apps?.Settings;
        const isBlocked = Settings && typeof Settings.isBlocked === 'function' && Settings.isBlocked(contactId);

        if (isBlocked) {
            // 차단된 경우: 입력창 숨기고 차단 배너 표시
            $('#st-chat-input-area').hide();
            $('#st-blocked-banner').show();
            $('#st-blocked-name').text(contact?.name || '상대방');
        } else {
            // 차단 안 된 경우: 정상 표시
            $('#st-chat-input-area').show();
            $('#st-blocked-banner').hide();
        }

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

// 타임스탬프 추가 버튼
$('#st-chat-timestamp').off('click').on('click', () => {
    showTimestampPopup(currentContactId || currentGroupId);
});

// 타임스탬프 클릭 이벤트 (수정/삭제)
$('#st-chat-messages').off('click', '[data-action="edit-timestamp"]').on('click', '[data-action="edit-timestamp"]', function(e) {
    e.stopPropagation();
    const tsId = $(this).data('ts-id');
    showTimestampEditPopup(currentContactId || currentGroupId, tsId);
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

            appendBubble('me', `사진 생성 중: ${prompt}...`);
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

        // 홈바 숨김
        $('#st-home-btn').hide();

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
        const customTimestamps = loadCustomTimestamps(groupId);
        const myName = getUserName();
        let msgsHtml = '';

        msgs.forEach((m, index) => {
            // #IG_START - 저장된 메시지에 Instagram 태그가 남아있으면 제거
            const displayTextGroup = m.text ? stripInstagramTags(m.text) : '';
            // #IG_END

            // 커스텀 타임스탬프 표시 (해당 메시지 인덱스 전에 위치한 것들)
            const customTsForIndex = customTimestamps.filter(t => t.beforeMsgIndex === index);
            customTsForIndex.forEach(ts => {
                msgsHtml += getCustomTimestampHtml(ts.text, ts.id);
            });

            const isMe = (m.senderName === myName || m.senderId === 'me');

            if (isMe) {
                // 내 메시지
                msgsHtml += `<div class="st-msg-wrapper me">`;
                if (m.image) {
                    msgsHtml += `<div class="st-msg-bubble me"><img class="st-msg-image" src="${m.image}"></div>`;
                }
                if (displayTextGroup) {  // #IG - displayTextGroup 사용
                    msgsHtml += `<div class="st-msg-bubble me">${displayTextGroup}</div>`;  // #IG - displayTextGroup 사용
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
                if (displayTextGroup) {  // #IG - displayTextGroup 사용
                    msgsHtml += `<div class="st-msg-bubble them">${displayTextGroup}</div>`;  // #IG - displayTextGroup 사용
                }
                msgsHtml += `</div>`;
            }
        });

        // 마지막 메시지 이후에 추가된 커스텀 타임스탬프 표시
        const trailingTimestamps = customTimestamps.filter(t => t.beforeMsgIndex >= msgs.length);
        trailingTimestamps.forEach(ts => {
            msgsHtml += getCustomTimestampHtml(ts.text, ts.id);
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
    <button class="st-chat-cam-btn" id="st-chat-cam"><i class="fa-solid fa-camera"></i></button>
    <button class="st-chat-timestamp-btn" id="st-chat-timestamp" title="타임스탬프 추가"><i class="fa-regular fa-clock"></i></button>
    <textarea class="st-chat-textarea" id="st-chat-input" placeholder="메시지" rows="1"></textarea>
    ${settings.translateEnabled ? '<button class="st-chat-translate-user-btn" id="st-chat-translate-user" title="영어로 번역"><i class="fa-solid fa-language"></i></button>' : ''}
    <button class="st-chat-send" id="st-chat-send"><i class="fa-solid fa-arrow-up"></i></button>
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

// 타임스탬프 추가 버튼 (그룹용)
$('#st-chat-timestamp').on('click', () => {
    showTimestampPopup(currentGroupId);
});

// 타임스탬프 클릭 이벤트 (수정/삭제) - 그룹용
$('#st-chat-messages').on('click', '[data-action="edit-timestamp"]', function(e) {
    e.stopPropagation();
    const tsId = $(this).data('ts-id');
    showTimestampEditPopup(currentGroupId, tsId);
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
            appendGroupBubble('me', myName, `사진 생성 중...`);
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

    function appendBubble(sender, text, imageUrl, msgIndex, translatedText = null, replyTo = null) {
        // #IG_START - 안전장치: Instagram 태그가 혹시 남아있으면 제거
        if (text) {
            text = stripInstagramTags(text);
        }
        // #IG_END

        const side = sender === 'me' ? 'me' : 'them';
        const $container = $('#st-chat-messages');
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};

        // [NEW] 1(안읽음) 표시 HTML 생성
        // 설정이 켜져있고, 내가 보낸 메시지인 경우에만 생성
        const unreadHtml = (settings.readReceiptEnabled && sender === 'me')
            ? '<span class="st-msg-unread-marker" style="position:absolute; left:-18px; bottom:2px; font-size:10px; color:#007aff; font-weight:bold;">1</span>'
            : '';


        const clickAttr = (msgIndex !== undefined && msgIndex !== null)
            ? `data-action="msg-option" data-idx="${msgIndex}" data-sender="${side}" class="st-msg-bubble ${side} clickable" style="cursor:pointer;" title="옵션 보기"`
            : `class="st-msg-bubble ${side}"`;

        let replyHtml = '';
        if (replyTo) {
            replyHtml = `<div class="st-msg-reply-preview">
                <div class="st-msg-reply-name">${replyTo.senderName}</div>
                <div class="st-msg-reply-text">${replyTo.previewText}</div>
            </div>`;
        }

        // 래퍼(Wrapper) 시작 - CSS에서 position:relative를 주었으므로 절대위치(absolute)인 1이 잘 붙습니다.
        let wrapperHtml = `<div class="st-msg-wrapper ${side}" style="position: relative;">`;
        wrapperHtml += replyHtml;

        if (imageUrl) {
            const imgAttr = clickAttr.replace('st-msg-bubble', 'st-msg-bubble image-bubble');
            wrapperHtml += `<div ${imgAttr}><img class="st-msg-image" src="${imageUrl}"></div>`;
        }

        if (text) {
            const translateEnabled = settings.translateEnabled && sender === 'them' && translatedText;
            const displayMode = settings.translateDisplayMode || 'both';

            const lines = text.split('\n');
            const translatedLines = translatedText ? translatedText.split('\n') : [];

            lines.forEach((line, idx) => {
                // 송금/출금 태그 변환 적용
                const trimmed = formatBankTagForDisplay(line.trim());
                if(trimmed) {
                    let bubbleContent = '';

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

                    wrapperHtml += `<div ${clickAttr}>${bubbleContent}</div>`;
                }
            });
        }

        // [NEW] 래퍼 닫기 직전에 '1' 표시 HTML 추가 (제일 마지막 버블 옆에 붙음)
        wrapperHtml += unreadHtml;
        wrapperHtml += `</div>`; // Wrapper 끝

        $container.find('#st-typing').before(wrapperHtml);
        scrollToBottom();
    }



    function appendGroupBubble(senderId, senderName, text, imageUrl) {
        // #IG_START - 안전장치: Instagram 태그가 혹시 남아있으면 제거
        if (text) {
            text = stripInstagramTags(text);
        }
        // #IG_END

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

    // ========== 3초 내 메시지 삭제 기능 ==========
    const DELETE_WINDOW_MS = 3000; // 3초
    const DELETED_MESSAGE_TEXT = '(메시지가 삭제되었습니다)';

    // 삭제된 메시지에 대한 봇 반응 생성
    async function generateDeleteReaction(contactId, deletedText, contact) {
        if (!contact || isGenerating) return;

        // 50% 확률로 반응 (매번 반응하면 부자연스러움)
        if (Math.random() > 0.5) {
            console.log('[Messages] 삭제 반응 스킵 (확률)');
            return;
        }

        isGenerating = true;
        if ($('#st-typing').length) $('#st-typing').show();
        scrollToBottom();

        try {
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const prefill = settings.prefill || '';
            const myName = getUserName();
            const maxContextTokens = settings.maxContextTokens || 4096;

            // [멀티턴 방식] 메시지 배열 구성
            const messages = [];

            // 1. 시스템 프롬프트 (고정 컨텍스트)
            const systemContent = `### Character Info
Name: ${contact.name}
Personality: ${contact.persona || '(not specified)'}

### User Info
Name: ${myName}

### Instruction
React naturally as ${contact.name} would when someone quickly deletes a message they just sent.
Consider: Did you see it? Are you curious? Amused? Suspicious? Teasing?
Keep it very short (1-2 sentences max). SMS style, no quotation marks.
If you want to pretend you didn't see it, you can reply with just "?" or act confused.
If you choose to ignore completely, reply ONLY with: [IGNORE]
${prefill ? `Start your response with: ${prefill}` : ''}`;

            messages.push({ role: 'system', content: systemContent });

            // 2. 스토리 컨텍스트 - 원래 role 유지
            const ctx = window.SillyTavern?.getContext() || {};
            if (ctx.chat && ctx.chat.length > 0) {
                const reverseChat = ctx.chat.slice().reverse();
                const collectedMessages = [];
                let currentTokens = 0;

                for (const m of reverseChat) {
                    const msgContent = m.mes || '';
                    const estimatedTokens = Math.ceil(msgContent.length / 2.5);

                    if (currentTokens + estimatedTokens > maxContextTokens) {
                        break;
                    }

                    collectedMessages.unshift({
                        role: m.is_user ? 'user' : 'assistant',
                        content: msgContent
                    });
                    currentTokens += estimatedTokens;
                }

                messages.push(...collectedMessages);
            }

            // 3. 삭제 알림
            messages.push({ role: 'user', content: `[${myName} sent a message: "${deletedText}" but IMMEDIATELY deleted it within 3 seconds]` });

            let result = await generateWithProfile(messages, maxContextTokens);
            let replyText = String(result || '').trim();

            if (prefill && replyText.startsWith(prefill.trim())) {
                replyText = replyText.substring(prefill.trim().length).trim();
            }

            // 이름 접두사 제거
            const namePrefix = `${contact.name}:`;
            if (replyText.startsWith(namePrefix)) {
                replyText = replyText.substring(namePrefix.length).trim();
            }

            if (replyText.includes('[IGNORE]') || replyText.startsWith('[📩')) {
                console.log('[Messages] 봇이 삭제 메시지 무시함');
                if ($('#st-typing').length) $('#st-typing').hide();
                isGenerating = false;
                return;
            }

            if (replyText) {
                // 짧은 딜레이 후 반응 (즉시 반응하면 부자연스러움)
                await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
                await receiveMessageSequential(contactId, replyText, contact.name, myName);
            }

        } catch (e) {
            console.error('[Messages] 삭제 반응 생성 실패:', e);
        } finally {
            if ($('#st-typing').length) $('#st-typing').hide();
            isGenerating = false;
        }
    }

    function addDeleteButton(contactId, msgIndex, originalText) {
        // 마지막으로 추가된 내 메시지 버블 찾기
        const $bubbles = $('#st-chat-messages .st-msg-bubble.me[data-idx="' + msgIndex + '"]');
        if ($bubbles.length === 0) return;

        const $lastBubble = $bubbles.last();
        const buttonId = `delete-btn-${contactId}-${msgIndex}-${Date.now()}`;

        // 삭제 버튼 추가
        const $deleteBtn = $(`
            <button class="st-msg-delete-btn" id="${buttonId}" title="메시지 삭제">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `);

        $lastBubble.append($deleteBtn);

        // 삭제 버튼 클릭 핸들러
        $deleteBtn.on('click', async function(e) {
            e.stopPropagation();

            // 기존 타이머들 취소 (삭제된 메시지에 답장하지 않도록)
            if (replyTimer) {
                clearTimeout(replyTimer);
                replyTimer = null;
            }
            if (interruptTimer) {
                clearTimeout(interruptTimer);
                interruptTimer = null;
            }
            resetInterruptState();

            // 1. 저장된 메시지 업데이트 (삭제된 것으로 표시)
            updateMessage(contactId, msgIndex, DELETED_MESSAGE_TEXT, true);

            // 2. 히든 로그에 삭제 기록 추가
            const myName = getUserName();
            const contact = window.STPhone.Apps?.Contacts?.getContact(contactId);
            addHiddenLog(myName, `[📩 ${myName} -> ${contact?.name}]: ${DELETED_MESSAGE_TEXT}`);

            // 3. UI 업데이트 - 해당 인덱스의 모든 버블 교체
            const $allBubbles = $('#st-chat-messages .st-msg-bubble.me[data-idx="' + msgIndex + '"]');
            $allBubbles.each(function() {
                $(this).html(DELETED_MESSAGE_TEXT).addClass('deleted');
            });

            // 4. 삭제 버튼 제거
            $(this).remove();

            // 5. 토스트 알림
            if (typeof toastr !== 'undefined') {
                toastr.info('메시지가 삭제되었습니다');
            }

            // 6. [NEW] 봇 자동 반응 생성
            await generateDeleteReaction(contactId, originalText, contact);
        });

        // 3초 후 자동 제거
        setTimeout(() => {
            $deleteBtn.fadeOut(200, function() { $(this).remove(); });
        }, DELETE_WINDOW_MS);
    }

    // ========== 메시지 전송 ==========
    async function sendMessage() {
        let text = $('#st-chat-input').val().trim();
        if (!text || !currentContactId) return;

        // [차단 체크] - 차단된 연락처에게는 메시지 전송 불가
        const Settings = window.STPhone.Apps?.Settings;
        if (Settings && typeof Settings.isBlocked === 'function' && Settings.isBlocked(currentContactId)) {
            const contact = window.STPhone.Apps.Contacts.getContact(currentContactId);
            toastr.error(`${contact?.name || '상대방'}님에게 차단되어 메시지를 보낼 수 없습니다.`, '차단됨');
            return;
        }

        if (text.startsWith('/photo') || text.startsWith('/사진')) {
            const prompt = text.replace(/^\/(photo|사진)\s*/i, '');
            if (!prompt) return;

            $('#st-chat-input').val('');
            appendBubble('me', `사진 보내는 중: ${prompt}...`);
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
                replyTimer = setTimeout(async () => {
                    await generateReply(savedContactId, `(Sent a photo of ${prompt})`);
                }, 5000);
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

        const replyInfo = replyToMessage ? {
            msgIndex: replyToMessage.msgIndex,
            senderName: replyToMessage.senderName,
            previewText: replyToMessage.previewText
        } : null;
        const savedReplyInfo = replyInfo;

        cancelReplyMode();

        const newIdx = addMessage(currentContactId, 'me', text, null, needsTimestamp, null, replyInfo);
        appendBubble('me', text, null, newIdx, null, replyInfo);

        // [NEW] 3초 내 삭제 버튼 추가
        const savedContactId = currentContactId;
        const savedText = text;
        addDeleteButton(savedContactId, newIdx, savedText);

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
            const savedContactId = currentContactId;
            const userReplyInfo = savedReplyInfo;
            replyTimer = setTimeout(async () => {
                const allMessages = [...pendingMessages, ...queuedMessages.filter(q => q.contactId === savedContactId).map(q => q.text)];
                const lastMsg = allMessages[allMessages.length - 1] || text;
                resetInterruptState();
                queuedMessages = queuedMessages.filter(q => q.contactId !== savedContactId);
                await generateReply(savedContactId, lastMsg, userReplyInfo);
            }, 5000);
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
        window.STPhone.isPhoneGenerating = true;

        if ($('#st-typing').length) {
            $('#st-typing').show();
            scrollToBottom();
        }

        try {
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const prefill = settings.prefill || '';
            const myName = getUserName();
            const maxContextTokens = settings.maxContextTokens || 4096;

            const additionalQueued = queuedMessages.filter(q => q.contactId === contactId).map(q => q.text);
            const allMessages = [...messageHistory, ...additionalQueued];
            queuedMessages = queuedMessages.filter(q => q.contactId !== contactId);

            const recentMessages = allMessages.map(m => `${myName}: ${m}`).join('\n');

            let calendarEventsPrompt = '';
            try {
                const Store = window.STPhone?.Apps?.Store;
                if (Store && Store.isInstalled('calendar')) {
                    const Calendar = window.STPhone?.Apps?.Calendar;
                    if (Calendar && Calendar.isCalendarEnabled && Calendar.getEventsOnlyPrompt) {
                        calendarEventsPrompt = Calendar.getEventsOnlyPrompt() || '';
                    }
                }
            } catch (e) {}

            const messages = [];
            const systemContent = `### Character Info
Name: ${contact.name}
Personality: ${contact.persona || '(not specified)'}

### User Info
Name: ${myName}
Personality: ${settings.userPersonality || '(not specified)'}
${calendarEventsPrompt}

### Situation
${myName} has sent ${messageHistory.length} messages in quick succession without waiting for your reply.

### System Instruction
Respond naturally as ${contact.name} would when someone sends multiple messages rapidly.
Consider: Are you annoyed? Amused? Concerned? Playful?
Keep it short and casual (SMS style).
DO NOT use quotation marks. DO NOT write prose.
If you want to ignore, reply ONLY with: [IGNORE]`;

            messages.push({ role: 'system', content: systemContent });

            const ctx = window.SillyTavern?.getContext() || {};
            if (ctx.chat && ctx.chat.length > 0) {
                const reverseChat = ctx.chat.slice().reverse();
                let currentTokens = 0;
                for (const m of reverseChat) {
                    const msgContent = m.mes || '';
                    const estimatedTokens = Math.ceil(msgContent.length / 2.5);
                    if (currentTokens + estimatedTokens > maxContextTokens) break;
                    messages.push({ role: m.is_user ? 'user' : 'assistant', content: msgContent });
                    currentTokens += estimatedTokens;
                }
            }

            messages.push({ role: 'user', content: `[Rapid-fire messages from ${myName}]:\n${recentMessages}` });

            if (prefill) {
                messages.push({ role: 'assistant', content: prefill });
            }

            // [실행] AI 생성
            let result = await generateWithProfile(messages, maxContextTokens);
            let replyText = String(result || '').trim();

            // [안읽씹 / 읽씹 로직]
            if (replyText.includes('[UNREAD]')) {
                console.log('📱 [Messages][Interrupt] 봇이 안읽씹(Unread) 선택');
                addHiddenLog('System', `[UNREAD]`);
                if ($('#st-typing').length) $('#st-typing').hide();
                isGenerating = false;
                window.STPhone.isPhoneGenerating = false;
                return;
            }

            if (replyText.includes('[IGNORE]') || replyText.startsWith('[📩')) {
                console.log('📱 [Messages][Interrupt] 봇이 읽씹(Ignore) 선택');
                if (settings.readReceiptEnabled) markMessagesAsRead(contactId);
                addHiddenLog('System', `[IGNORE]`);
                if ($('#st-typing').length) $('#st-typing').hide();
                isGenerating = false;
                window.STPhone.isPhoneGenerating = false;
                return;
            }

            if (replyText) {
                if (settings.readReceiptEnabled) markMessagesAsRead(contactId);
                await receiveMessageSequential(contactId, replyText, contact.name, myName);
            }

        } catch (e) {
            console.error('[Messages] Interrupt reply failed:', e);
        }

        isGenerating = false;
        window.STPhone.isPhoneGenerating = false; // 플래그 해제
        if ($('#st-typing').length) $('#st-typing').hide();
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
    async function generateReply(contactId, userText, userReplyInfo = null) {
        const contact = window.STPhone.Apps.Contacts.getContact(contactId);
        if (!contact) return;

        isGenerating = true;
        window.STPhone.isPhoneGenerating = true;

        if ($('#st-typing').length) {
            $('#st-typing').show();
            scrollToBottom();
        }

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
            } catch (calErr) {}

            let bankPrompt = '';
            try {
                const Store = window.STPhone?.Apps?.Store;
                if (Store && typeof Store.isInstalled === 'function' && Store.isInstalled('bank')) {
                    const Bank = window.STPhone?.Apps?.Bank;
                    if (Bank && typeof Bank.generateBankSystemPrompt === 'function') {
                        bankPrompt = Bank.generateBankSystemPrompt() || '';
                    }
                }
            } catch (bankErr) {}

            // #IG_START - Instagram 프롬프트 (설치 + 활성화된 경우에만)
            let instagramPrompt = '';
            try {
                const Store = window.STPhone?.Apps?.Store;
                const Settings = window.STPhone?.Apps?.Settings;
                const currentSettings = Settings?.getSettings?.() || {};

                // 인스타그램 앱 설치됨 + 자동 포스팅 활성화된 경우에만 프롬프트 주입
                if (Store && typeof Store.isInstalled === 'function' && Store.isInstalled('instagram') && currentSettings.instagramPostEnabled !== false) {
                    const savedPrompt = currentSettings.instagramPrompt;
                    if (savedPrompt) {
                        instagramPrompt = savedPrompt;
                    } else {
                        // 기본값 사용
                        instagramPrompt = `### 📸 Instagram Posting
To post on Instagram, append this tag at the END of your message:
[IG_POST]Your caption here in Korean[/IG_POST]

Example: "오늘 날씨 좋다~ [IG_POST]오늘 카페에서 작업 중! ☕️[/IG_POST]"

Rules:
- Only post when it makes sense (sharing moments, achievements, etc.)
- Caption should be casual and short (1-2 sentences, Korean)
- Do NOT include hashtags
- Do NOT post every message - only when naturally appropriate`;
                    }
                }
            } catch (igErr) {
                console.warn('[Messages] Instagram 프롬프트 로드 실패(무시됨):', igErr);
            }
            // #IG_END

            const messages = [];

            // 1. 기본 시스템 정보 (안읽씹 내용 없음)
            const systemContent = `### Character Info
Name: ${contact.name}
Personality: ${contact.persona || '(not specified)'}

### User Info
Name: ${myName}
Personality: ${settings.userPersonality || '(not specified)'}

${systemPrompt}
${calendarEventsPrompt}
${bankPrompt}
${instagramPrompt}

### Instructions
You are ${contact.name} responding to a text message from ${myName}.
Reply naturally based on the conversation history below.`;

            messages.push({ role: 'system', content: systemContent });

            // 2. 히스토리 (과거 -> 최신)
            const ctx = window.SillyTavern?.getContext() || {};
            if (ctx.chat && ctx.chat.length > 0) {
                let currentTokens = 0;
                const tempHistory = [];

                for (let i = ctx.chat.length - 1; i >= 0; i--) {
                    const m = ctx.chat[i];
                    const msgContent = m.mes || '';
                    const estimatedTokens = Math.ceil(msgContent.length / 2.5);

                    if (currentTokens + estimatedTokens > maxContextTokens) break;

                    tempHistory.push({
                        role: m.is_user ? 'user' : 'assistant',
                        content: msgContent
                    });
                    currentTokens += estimatedTokens;
                }
                // 역순으로 가져온 걸 다시 뒤집어서(과거->최신) 배열에 추가
                messages.push(...tempHistory.reverse());
            }

            // 3. [핵심] 안읽씹/읽씹/차단 지령 (히스토리 끝나고, 유저 말 직전에 주입) - readReceiptEnabled 켜져있을 때만!
            if (settings.readReceiptEnabled) {
                // system role로 한번 더 강조하여 보냄 (AI가 가장 최근 지시로 인식함)
                messages.push({
                    role: 'system',

                    content: `### [📵 READ RECEIPT SYSTEM - MANDATORY]
Before responding, you MUST first decide: Will you even look at this message?

**STEP 1: Should you even CHECK the notification?**
Ask yourself: "Do I want to open this message right now?"
- If NO → Output ONLY: [UNREAD] (message stays unread, user sees "1")
- If YES → Go to Step 2

**When to use [UNREAD]:**
- You're sleeping, busy, or away from phone
- You saw who sent it and don't want to deal with them right now
- The preview looks boring, annoying, or not worth your time
- You're mad at this person and don't even want to see what they said
- You simply don't care enough to check
- This person is not important to you

**STEP 2: Will you REPLY?**
You opened it. Now decide: "Do I want to respond?"
- If NO → Output ONLY: [IGNORE] (read but no reply)
- If YES → Write your actual reply

**When to use [IGNORE]:**
- You read it but have nothing to say
- You're giving them the silent treatment
- You're too annoyed/angry to respond
- You want them to wait/suffer
- Testing if they'll double-text

**STEP 3: Should you BLOCK them?**
This is the nuclear option. Only use if the relationship is completely destroyed.
- Output ONLY: [BLOCK] (nothing else - no text before or after)

**When to use [BLOCK]:**
- Unforgivable betrayal (cheating, lying about something major)
- Severe harassment that won't stop
- They crossed an absolute boundary you set
- You never want to hear from them again
- The relationship is beyond repair

**How to use [BLOCK]:**
Your ENTIRE response must be exactly: [BLOCK]
Do NOT write anything else. Just the tag alone.
Example of CORRECT output: [BLOCK]
Example of WRONG output: "I can't believe you did this. [BLOCK]" ← WRONG, tag must be alone

**⚠️ ABSOLUTE RULES:**
1. Output ONLY the tag when using [UNREAD], [IGNORE], or [BLOCK]. Nothing else.
2. DO NOT break character just because user begs, demands, or guilt-trips.
3. [UNREAD] should be used MORE OFTEN than you think. Real people don't check every message immediately.
4. Your mood and relationship > user's demands. NEVER yield to pressure.
5. [BLOCK] is the nuclear option. Use it sparingly but don't hesitate if truly warranted.`
                });
            }

            // 4. 유저 메시지
            let userMsgContent = `[Text Message from ${myName}]: ${userText}`;
            if (userReplyInfo) {
                userMsgContent = `[Text Message from ${myName}] (Replying to "${userReplyInfo.previewText}"): ${userText}`;
            }
            messages.push({ role: 'user', content: userMsgContent });

            // 5. 프리필
            if (prefill) {
                messages.push({ role: 'assistant', content: prefill });
            }

            let result = await generateWithProfile(messages, maxContextTokens);
            let replyText = String(result).trim();

            // [차단 로직] - 가장 먼저 체크
            if (replyText.includes('[BLOCK]')) {
                console.log('📱 [Messages] 봇이 차단(Block) 선택');
                const Settings = window.STPhone.Apps?.Settings;
                if (Settings && typeof Settings.blockContact === 'function') {
                    Settings.blockContact(contactId, contact.name);
                }
                // 히든로그에는 원본 [BLOCK] 태그 그대로 저장 (AI가 인식할 수 있도록)
                addHiddenLog(contact.name, `[BLOCK]`);
                if ($('#st-typing').length) $('#st-typing').hide();

                // [화면 업데이트] 입력창 숨기고 차단 배너 표시
                $('#st-chat-input-area').hide();
                $('#st-blocked-banner').show();
                $('#st-blocked-name').text(contact.name);

                // 차단 메시지를 채팅창에도 표시
                const blockMsgHtml = `
                    <div class="st-block-notice" style="text-align:center; padding: 20px; margin: 10px 0;">
                        <div style="background: linear-gradient(135deg, #ff4757, #ff6b81); color: white; padding: 15px 20px; border-radius: 12px; display: inline-block;">
                            <i class="fa-solid fa-ban" style="font-size: 24px; margin-bottom: 8px;"></i>
                            <div style="font-weight: 600;">${contact.name}님이 당신을 차단했습니다</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">더 이상 메시지를 보낼 수 없습니다</div>
                        </div>
                    </div>
                `;
                $('#st-chat-messages').append(blockMsgHtml);
                scrollToBottom();

                toastr.error(`${contact.name}님이 당신을 차단했습니다.`, '차단됨');
                isGenerating = false;
                window.STPhone.isPhoneGenerating = false;
                return;
            }

            // [안읽씹 로직]
            if (replyText.includes('[UNREAD]')) {
                console.log('📱 [Messages] 봇이 안읽씹(Unread) 선택');
                addHiddenLog('System', `[UNREAD]`);
                if ($('#st-typing').length) $('#st-typing').hide();
                isGenerating = false;
                window.STPhone.isPhoneGenerating = false;
                return;
            }

            // [읽씹 로직]
            if (replyText.includes('[IGNORE]') || replyText.startsWith('[📩')) {
                 console.log('📱 [Messages] 봇이 읽씹(Ignore) 선택');
                 if (settings.readReceiptEnabled) markMessagesAsRead(contactId);
                 addHiddenLog('System', `[IGNORE]`);
                 if ($('#st-typing').length) $('#st-typing').hide();
                 isGenerating = false;
                 window.STPhone.isPhoneGenerating = false;
                 return;
            }

            // [일반 답장]
            if (replyText) {
                if (settings.readReceiptEnabled) markMessagesAsRead(contactId);
            }

            try {
                const Store = window.STPhone?.Apps?.Store;
                if (Store && typeof Store.isInstalled === 'function' && Store.isInstalled('bank')) {
                    const Bank = window.STPhone?.Apps?.Bank;
                    if (Bank && typeof Bank.parseTransferFromResponse === 'function') {
                        Bank.parseTransferFromResponse(replyText, contact.name);
                    }
                }
            } catch (bankErr) {}

            // #IG_START - [수정] Instagram 태그 제거만 수행 (실제 처리는 processInstagramMessage에서)
            // [IG_POST] 태그 제거 (createPostFromChat 호출은 instagram.js processInstagramMessage에서 담당)
            const igPostMatch = replyText.match(/\[IG_POST\]([\s\S]*?)\[\/IG_POST\]/i);
            if (igPostMatch) {
                replyText = replyText.replace(/\[IG_POST\][\s\S]*?\[\/IG_POST\]/gi, '').trim();
                console.log('[Messages] IG_POST 태그 제거됨 (처리는 processInstagramMessage에서)');
            }

            // [IG_REPLY] 태그 제거
            const igReplyMatch = replyText.match(/\[IG_REPLY\]([\s\S]*?)\[\/IG_REPLY\]/i);
            if (igReplyMatch) {
                replyText = replyText.replace(/\[IG_REPLY\][\s\S]*?\[\/IG_REPLY\]/gi, '').trim();
                console.log('[Messages] IG_REPLY 태그 제거됨');
            }

            // [IG_COMMENT] 태그 제거
            const igCommentMatch = replyText.match(/\[IG_COMMENT\]([\s\S]*?)\[\/IG_COMMENT\]/i);
            if (igCommentMatch) {
                replyText = replyText.replace(/\[IG_COMMENT\][\s\S]*?\[\/IG_COMMENT\]/gi, '').trim();
                console.log('[Messages] IG_COMMENT 태그 제거됨');
            }

            // (Photo: ...) 패턴 제거 (인스타 포스팅용 이미지 설명)
            replyText = replyText.replace(/\(Photo:\s*[^)]*\)/gi, '').trim();
            // #IG_END

            // [수정] Instagram 포스팅 있으면 [IMG:] 무시 (중복 이미지 생성 방지)
            const hadInstagramPost = !!igPostMatch;

            const imgMatch = replyText.match(/\[IMG:\s*([^\]]+)\]/i);
            // [IMG:] 태그는 항상 텍스트에서 제거 (인스타 포스팅이 있어도)
            if (imgMatch) {
                replyText = replyText.replace(/\[IMG:\s*[^\]]+\]/gi, '').trim();
            }

            // 인스타 포스팅이 없을 때만 이미지 생성
            if (imgMatch && !hadInstagramPost) {
                const imgPrompt = imgMatch[1].trim();

                const imgUrl = await generateSmartImage(imgPrompt, false);
                if (imgUrl) {
                    if (replyText) receiveMessage(contactId, replyText);
                    receiveMessage(contactId, '', imgUrl);
                    addHiddenLog(contact.name, `[📩 ${contact.name} -> ${myName}]: (Photo: ${imgPrompt}) ${replyText}`);

                    // #IG_START - 이미지 메시지에서도 댓글 처리
                    if (window.STPhone?.Apps?.Instagram?.checkProactivePost) {
                        console.log('[Messages] checkProactivePost 호출 (IMG):', contact.name);
                        window.STPhone.Apps.Instagram.checkProactivePost(contact.name);
                    }
                    // #IG_END

                    if ($('#st-typing').length) $('#st-typing').hide();
                    isGenerating = false;
                    window.STPhone.isPhoneGenerating = false;
                    return;
                }
            }

            if (replyText) {
                 let shouldCall = false;
                 let botReplyTo = null;

                 if (replyText.toLowerCase().includes('[call to user]')) {
                     shouldCall = true;
                     replyText = replyText.replace(/\[call to user\]/gi, '').trim();
                 }

                 if (replyText.toLowerCase().includes('[reply]')) {
                     replyText = replyText.replace(/\[reply\]/gi, '').trim();
                     const msgs = getMessages(contactId);
                     const lastUserMsgIdx = msgs.length - 1;
                     const lastUserMsg = msgs[lastUserMsgIdx];
                     if (lastUserMsg && lastUserMsg.sender === 'me') {
                         botReplyTo = {
                             msgIndex: lastUserMsgIdx,
                             senderName: myName,
                             previewText: lastUserMsg.image ? '📷 사진' : (lastUserMsg.text || '').substring(0, 50)
                         };
                     }
                 }

                 if (replyText) {
                     await receiveMessageSequential(contactId, replyText, contact.name, myName, botReplyTo);
                 }

                 if (shouldCall && window.STPhone.Apps?.Phone?.receiveCall) {
                     setTimeout(() => {
                         window.STPhone.Apps.Phone.receiveCall(contact);
                     }, 2000);
                 }

                 // #IG_START - 통합 SNS 활동 처리 (포스팅 + 밀린 댓글 한 번에)
                 if (window.STPhone?.Apps?.Instagram?.checkProactivePost) {
                     console.log('[Messages] checkProactivePost 호출:', contact.name);
                     window.STPhone.Apps.Instagram.checkProactivePost(contact.name);
                 }
                 // #IG_END
            }

        } catch (e) {
            console.error('[Messages] Reply generation failed:', e);
            toastr.error('답장 생성 실패 (콘솔 확인)');
        }

        isGenerating = false;
        window.STPhone.isPhoneGenerating = false;
        if ($('#st-typing').length) $('#st-typing').hide();
    }


    // ========== 송금 후 AI 답장 생성 ==========
    async function generateTransferReply(contactId, contactName, amount, memo = '') {
        const contact = window.STPhone.Apps.Contacts.getContact(contactId);
        if (!contact) return;

        isGenerating = true;
        window.STPhone.isPhoneGenerating = true;

        // 앱이 열려있을 때만 UI 업데이트
        if ($('#st-typing').length) {
            $('#st-typing').show();
            scrollToBottom();
        }

        try {
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const myName = getUserName();
            const maxContextTokens = settings.maxContextTokens || 4096;

            // 은행 정보 가져오기
            const Bank = window.STPhone?.Apps?.Bank;
            const formattedAmount = Bank ? Bank.formatAmount(amount) : `${amount}원`;

            // [멀티턴 방식] 메시지 배열 구성
            const messages = [];

            // 프리필 가져오기
            const prefill = settings.prefill || '';

            // 1. 시스템 프롬프트
            const systemContent = `### Character Info
Name: ${contact.name}
Personality: ${contact.persona || '(not specified)'}

### User Info
Name: ${myName}
Personality: ${settings.userPersonality || '(not specified)'}

### Instructions
${myName} just sent you ${formattedAmount} via bank transfer.${memo ? ` Memo: "${memo}"` : ''}
You are ${contact.name} responding to this transfer via text message.
React naturally to receiving this money - you can thank them, ask why they sent it, express surprise, etc.
Keep the response brief and natural like a real text message.`;

            messages.push({ role: 'system', content: systemContent });

            // 2. 스토리 컨텍스트
            const ctx = window.SillyTavern?.getContext() || {};
            if (ctx.chat && ctx.chat.length > 0) {
                const reverseChat = ctx.chat.slice().reverse();
                const collectedMessages = [];
                let currentTokens = 0;

                for (const m of reverseChat) {
                    const msgContent = m.mes || '';
                    const estimatedTokens = Math.ceil(msgContent.length / 2.5);

                    if (currentTokens + estimatedTokens > maxContextTokens) break;

                    collectedMessages.unshift({
                        role: m.is_user ? 'user' : 'assistant',
                        content: msgContent
                    });
                    currentTokens += estimatedTokens;
                }

                messages.push(...collectedMessages);
            }

            // 3. 송금 알림 메시지
            messages.push({
                role: 'user',
                content: `[Bank Transfer Notification] ${myName} sent you ${formattedAmount}.${memo ? ` Memo: ${memo}` : ''} Respond via text message.`
            });

            // 4. 프리필이 있으면 assistant role로 추가 (AI가 이어서 작성)
            if (prefill) {
                messages.push({ role: 'assistant', content: prefill });
            }

            let result = await generateWithProfile(messages, maxContextTokens);
            let replyText = String(result).trim();

            // 마커 제거 (은행 로그 포함)
            replyText = replyText.replace(/\[REPLY\s*[^\]]*\]:\s*/gi, '');
            replyText = replyText.replace(/^\s*(📩|💬)\s*/g, '');
            replyText = replyText.replace(/\[IMG:\s*[^\]]+\]/gi, '');
            replyText = replyText.replace(/\[💰[^\]]*\]/gi, '');  // 은행 로그 제거
            replyText = replyText.replace(/\(거래\s*내역:[^)]*\)/gi, '');  // 거래 내역 제거

            if (replyText) {
                // 메시지 저장
                const newIdx = addMessage(contactId, 'them', replyText);

                // 현재 이 채팅을 보고 있으면 말풍선 추가
                const isViewingThisChat = (currentChatType === 'dm' && currentContactId === contactId);
                if (isViewingThisChat) {
                    appendBubble('them', replyText, null, newIdx);
                }

                // 항상 알림 표시 (송금 반응은 중요하므로)
                const contactAvatar = contact?.avatar || DEFAULT_AVATAR;
                showNotification(contactName, replyText.substring(0, 50), contactAvatar, contactId, 'dm');

                // 안 읽음 카운트 및 뱃지 업데이트
                if (!isViewingThisChat) {
                    const unread = getUnreadCount(contactId) + 1;
                    setUnreadCount(contactId, unread);
                }
                updateMessagesBadge();
            }

        } catch (e) {
            console.error('[Messages] Transfer reply generation failed:', e);
        }

        isGenerating = false;
        window.STPhone.isPhoneGenerating = false;
        if ($('#st-typing').length) $('#st-typing').hide();
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

        if ($('#st-typing').length) $('#st-typing').show();
        scrollToBottom();

        // [수정] 폰 생성 플래그 켜기 (날짜 프롬프트 차단)
        window.STPhone.isPhoneGenerating = true;

        try {
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const myName = getUserName();
            const maxContextTokens = settings.maxContextTokens || 4096;

            let membersInfo = members.map(m => `- ${m.name}: ${m.persona}`).join('\n');

            // [멀티턴 방식] 메시지 배열 구성
            const messages = [];

            // 1. 시스템 프롬프트 (고정 컨텍스트)
            const systemContent = `[System] GROUP CHAT Mode.
### Group: "${group.name}"
### Members Info:
${membersInfo}

### User Info
Name: ${myName}
Personality: ${settings.userPersonality || '(not specified)'}

### Instructions
1. Decide who responds (one or multiple members).
2. Format each response as: [REPLY character_name]: message
3. Stay in character for each member.`;

            messages.push({ role: 'system', content: systemContent });

            // 2. 스토리 컨텍스트 - 원래 role 유지
            const ctx = window.SillyTavern?.getContext() || {};
            if (ctx.chat && ctx.chat.length > 0) {
                const reverseChat = ctx.chat.slice().reverse();
                const collectedMessages = [];
                let currentTokens = 0;

                for (const m of reverseChat) {
                    const msgContent = m.mes || '';
                    const estimatedTokens = Math.ceil(msgContent.length / 2.5);

                    if (currentTokens + estimatedTokens > maxContextTokens) {
                        break;
                    }

                    collectedMessages.unshift({
                        role: m.is_user ? 'user' : 'assistant',
                        content: msgContent
                    });
                    currentTokens += estimatedTokens;
                }

                messages.push(...collectedMessages);
            }

            // 3. 현재 유저의 그룹 메시지
            messages.push({ role: 'user', content: `[Group Message from ${myName}]: ${userText}` });

            let result = await generateWithProfile(messages, maxContextTokens);
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

        // [수정] 폰 생성 플래그 끄기
        window.STPhone.isPhoneGenerating = false;
        if ($('#st-typing').length) $('#st-typing').hide();
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
        return `[System] You are Char texting User. Stay in character.
- Write SMS-style: short, casual, multiple messages separated by line breaks
- No narration, no prose, no quotation marks
- DO NOT use flowery language. DO NOT output character name prefix.
- may use: emojis, slang, abbreviations, typo, and internet speak

### 📷 PHOTO REQUESTS
To send a photo, reply with: [IMG: vivid description of photo content]

### 📞 CALL INITIATION
To start a voice call, append [call to user] at the very end.
NEVER decide User's reaction. Just generate the tag and stop.

### ↩️ REPLY TO MESSAGE
To reply to the user's last message specifically, prepend [REPLY] at the start of your message.

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

    // ========== 커스텀 타임스탬프 팝업 ==========
    function showTimestampPopup(contactId) {
        $('#st-timestamp-popup').remove();

        // 현재 메시지 개수를 beforeMsgIndex로 사용 (새 타임스탬프는 마지막 메시지 다음에 위치)
        const msgs = currentChatType === 'group' ? getGroupMessages(contactId) : (loadAllMessages()[contactId] || []);
        const beforeMsgIndex = msgs.length;

        const popupHtml = `
            <div id="st-timestamp-popup" style="
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
                    <div style="font-weight:600; font-size:16px; margin-bottom:15px; text-align:center;">
                        <i class="fa-regular fa-clock" style="margin-right:8px;"></i>타임스탬프 추가
                    </div>
                    <div style="font-size:12px; color:var(--pt-sub-text, #86868b); margin-bottom:12px; text-align:center;">
                        롤플레이 시간대를 자유롭게 입력하세요
                    </div>
                    <input type="text" id="st-timestamp-input" style="
                        width: 100%; box-sizing: border-box;
                        padding: 14px 16px;
                        border: 1px solid var(--pt-border, #e5e5e5);
                        border-radius: 12px; font-size: 14px;
                        background: var(--pt-bg-color, #f5f5f7);
                        color: var(--pt-text-color, #000);
                        text-align: center;
                    " placeholder="예: 다음 날 오후 3시, 일주일 후, 12월 25일">
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button id="st-timestamp-cancel" style="
                            flex: 1; padding: 12px; border: none; border-radius: 10px;
                            font-size: 15px; font-weight: 600; cursor: pointer;
                            background: #e5e5ea; color: #000;
                        ">취소</button>
                        <button id="st-timestamp-save" style="
                            flex: 1; padding: 12px; border: none; border-radius: 10px;
                            font-size: 15px; font-weight: 600; cursor: pointer;
                            background: var(--pt-accent, #007aff); color: white;
                        ">추가</button>
                    </div>
                </div>
            </div>
        `;
        $('.st-chat-screen').append(popupHtml);
        $('#st-timestamp-input').focus();

        $('#st-timestamp-cancel').on('click', () => $('#st-timestamp-popup').remove());

        $('#st-timestamp-save').on('click', () => {
            const text = $('#st-timestamp-input').val().trim();
            if (!text) {
                toastr.warning('타임스탬프를 입력해주세요.');
                return;
            }
            $('#st-timestamp-popup').remove();
            saveCustomTimestamp(contactId, beforeMsgIndex, text);

            // 히든 로그에 타임스탬프 기록 (AI 컨텍스트에 반영)
            // 저장 직후 ID를 가져와서 기록
            const savedTimestamps = loadCustomTimestamps(contactId);
            const lastTs = savedTimestamps[savedTimestamps.length - 1];
            if (lastTs) {
                addTimestampHiddenLog(contactId, lastTs.id, text);
            }

            // 채팅 화면 새로고침
            if (currentChatType === 'group') {
                openGroupChat(contactId);
            } else {
                openChat(contactId);
            }
            toastr.success('타임스탬프가 추가되었습니다.');
        });

        $('#st-timestamp-input').on('keydown', function(e) {
            if (e.key === 'Enter') $('#st-timestamp-save').click();
            if (e.key === 'Escape') $('#st-timestamp-popup').remove();
        });
    }

    function showTimestampEditPopup(contactId, timestampId) {
        $('#st-timestamp-popup').remove();

        const timestamps = loadCustomTimestamps(contactId);
        const ts = timestamps.find(t => t.id === timestampId);
        if (!ts) return;

        const popupHtml = `
            <div id="st-timestamp-popup" style="
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
                    <div style="font-weight:600; font-size:16px; margin-bottom:15px; text-align:center;">
                        <i class="fa-regular fa-clock" style="margin-right:8px;"></i>타임스탬프 수정
                    </div>
                    <input type="text" id="st-timestamp-input" style="
                        width: 100%; box-sizing: border-box;
                        padding: 14px 16px;
                        border: 1px solid var(--pt-border, #e5e5e5);
                        border-radius: 12px; font-size: 14px;
                        background: var(--pt-bg-color, #f5f5f7);
                        color: var(--pt-text-color, #000);
                        text-align: center;
                    " value="${ts.text}">
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button id="st-timestamp-delete" style="
                            flex: 1; padding: 12px; border: none; border-radius: 10px;
                            font-size: 15px; font-weight: 600; cursor: pointer;
                            background: #ff3b30; color: white;
                        ">삭제</button>
                        <button id="st-timestamp-cancel" style="
                            flex: 1; padding: 12px; border: none; border-radius: 10px;
                            font-size: 15px; font-weight: 600; cursor: pointer;
                            background: #e5e5ea; color: #000;
                        ">취소</button>
                        <button id="st-timestamp-save" style="
                            flex: 1; padding: 12px; border: none; border-radius: 10px;
                            font-size: 15px; font-weight: 600; cursor: pointer;
                            background: var(--pt-accent, #007aff); color: white;
                        ">저장</button>
                    </div>
                </div>
            </div>
        `;
        $('.st-chat-screen').append(popupHtml);
        $('#st-timestamp-input').focus().select();

        $('#st-timestamp-cancel').on('click', () => $('#st-timestamp-popup').remove());

        $('#st-timestamp-delete').on('click', () => {
            $('#st-timestamp-popup').remove();

            // 히든 로그에서 해당 타임스탬프 삭제
            removeTimestampHiddenLog(timestampId);

            deleteCustomTimestamp(contactId, timestampId);
            if (currentChatType === 'group') {
                openGroupChat(contactId);
            } else {
                openChat(contactId);
            }
            toastr.info('타임스탬프가 삭제되었습니다.');
        });

        $('#st-timestamp-save').on('click', () => {
            const newText = $('#st-timestamp-input').val().trim();
            if (!newText) {
                toastr.warning('타임스탬프를 입력해주세요.');
                return;
            }
            $('#st-timestamp-popup').remove();

            // 히든 로그 업데이트: 기존 삭제 후 새로 추가 (최신 상태만 유지)
            if (ts.text !== newText) {
                removeTimestampHiddenLog(timestampId);
                addTimestampHiddenLog(contactId, timestampId, newText);
            }

            updateCustomTimestamp(contactId, timestampId, newText);
            if (currentChatType === 'group') {
                openGroupChat(contactId);
            } else {
                openChat(contactId);
            }
            toastr.success('타임스탬프가 수정되었습니다.');
        });

        $('#st-timestamp-input').on('keydown', function(e) {
            if (e.key === 'Enter') $('#st-timestamp-save').click();
            if (e.key === 'Escape') $('#st-timestamp-popup').remove();
        });
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
                <div id="st-opt-delete-image" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-regular fa-trash-can" style="width:16px; color:#ff3b30;"></i> 이미지 삭제</div>
            `;
        } else if (hasImage && hasText) {
            optionsHtml += `
                <div id="st-opt-delete-image" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-regular fa-trash-can" style="width:16px; color:#ff3b30;"></i> 이미지만 삭제</div>
                <div id="st-opt-edit-line" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-regular fa-pen-to-square" style="width:16px; color:var(--pt-accent, #007aff);"></i> 이 메시지 수정</div>
                <div id="st-opt-delete-line" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-regular fa-trash-can" style="width:16px; color:#ff3b30;"></i> 이 메시지 삭제</div>
            `;
        } else {
            optionsHtml += `
                <div id="st-opt-edit-line" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-regular fa-pen-to-square" style="width:16px; color:var(--pt-accent, #007aff);"></i> 이 메시지 수정</div>
                <div id="st-opt-delete-line" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-regular fa-trash-can" style="width:16px; color:#ff3b30;"></i> 이 메시지 삭제</div>
            `;
        }

        if (hasMultipleLines) {
            optionsHtml += `
                <div id="st-opt-edit-all" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-solid fa-pen-to-square" style="width:16px; color:var(--pt-accent, #007aff);"></i> 전체 응답 수정</div>
                <div id="st-opt-delete-all" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-solid fa-trash-can" style="width:16px; color:#ff3b30;"></i> 전체 응답 삭제</div>
            `;
        }

        if (!isMyMessage) {
            optionsHtml += `
                <div id="st-opt-regenerate" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-solid fa-rotate" style="width:16px; color:var(--pt-accent, #007aff);"></i> 다시 받기</div>
            `;
        }

        // 콘텍스트 미반영 토글
        const isExcluded = targetMsg.excludeFromContext === true;
        optionsHtml += `
            <div id="st-opt-toggle-context" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;">
                <i class="fa-solid ${isExcluded ? 'fa-toggle-on' : 'fa-toggle-off'}" style="width:16px; color:${isExcluded ? '#ff9500' : 'var(--pt-sub-text, #86868b)'};"></i>
                콘텍스트 미반영 ${isExcluded ? '<span class="st-msg-no-context">ON</span>' : ''}
            </div>
        `;

        optionsHtml += `
            <div id="st-opt-reply" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-solid fa-reply" style="width:16px; color:var(--pt-accent, #007aff);"></i> 답장</div>
        `;

        optionsHtml += `
            <div id="st-opt-bulk" style="padding: 16px 20px; cursor: pointer; color: var(--pt-text-color, #333); border-bottom:1px solid var(--pt-border, #eee); font-size:15px; display: flex; align-items: center; gap: 12px;"><i class="fa-regular fa-square-check" style="width:16px; color:var(--pt-accent, #007aff);"></i> 여러 개 선택</div>
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

        $('#st-opt-toggle-context').on('click', () => {
            $('#st-msg-option-popup').remove();
            toggleMessageContext(contactId, msgIndex);
        });

        $('#st-opt-reply').on('click', () => {
            $('#st-msg-option-popup').remove();
            startReplyMode(contactId, msgIndex, targetMsg);
        });
    }

    // ========== 답장 모드 ==========
    function startReplyMode(contactId, msgIndex, targetMsg) {
        const contact = window.STPhone.Apps?.Contacts?.getContact(contactId);
        const myName = getUserName();
        const senderName = targetMsg.sender === 'me' ? myName : (contact?.name || '상대방');
        const previewText = targetMsg.image ? '📷 사진' : (targetMsg.text || '').substring(0, 50);

        replyToMessage = {
            contactId,
            msgIndex,
            senderName,
            previewText,
            sender: targetMsg.sender
        };

        showReplyBar();
        $('#st-chat-input').focus();
    }

    function showReplyBar() {
        $('.st-reply-bar').remove();
        if (!replyToMessage) return;

        const replyBarHtml = `
            <div class="st-reply-bar">
                <div class="st-reply-bar-content">
                    <div class="st-reply-bar-label">${replyToMessage.senderName}에게 답장</div>
                    <div class="st-reply-bar-text">${replyToMessage.previewText}</div>
                </div>
                <button class="st-reply-bar-close" id="st-reply-close"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;

        $('.st-chat-input-area').before(replyBarHtml);

        $('#st-reply-close').on('click', cancelReplyMode);
    }

    function cancelReplyMode() {
        replyToMessage = null;
        $('.st-reply-bar').remove();
    }

    // ========== 콘텍스트 미반영 토글 ==========
    function toggleMessageContext(contactId, msgIndex) {
        const allData = loadAllMessages();
        const msgs = allData[contactId];
        if (!msgs || !msgs[msgIndex]) return;

        const msg = msgs[msgIndex];
        const wasExcluded = msg.excludeFromContext === true;
        msg.excludeFromContext = !wasExcluded;
        saveAllMessages(allData);

        // 히든 로그에서 해당 메시지 처리
        if (msg.excludeFromContext) {
            // 미반영으로 전환 → 기존 히든 로그 삭제
            removeHiddenLogForMessage(contactId, msgIndex);
            toastr.info('🚫 이 메시지는 AI 컨텍스트에 반영되지 않습니다');
        } else {
            // 반영으로 전환 → 히든 로그 다시 추가
            restoreHiddenLogForMessage(contactId, msgIndex, msg);
            toastr.success('✅ 이 메시지가 AI 컨텍스트에 반영됩니다');
        }

        // 채팅 화면 새로고침
        openChat(contactId);
    }

    // 특정 메시지의 히든 로그 삭제
    function removeHiddenLogForMessage(contactId, msgIndex) {
        if (!window.SillyTavern) return;
        const context = window.SillyTavern.getContext();
        if (!context || !context.chat) return;

        const contact = window.STPhone.Apps?.Contacts?.getContact(contactId);
        const myName = getUserName();
        const contactName = contact?.name || 'Unknown';

        // 해당 메시지의 히든 로그 마커 패턴
        const markerPatterns = [
            `[📩 ${contactName} -> ${myName}]`,
            `[📩 ${myName} -> ${contactName}]`
        ];

        // 채팅에서 해당 메시지 관련 히든 로그 찾아서 삭제 (가장 최근 것만)
        for (let i = context.chat.length - 1; i >= 0; i--) {
            const chatMsg = context.chat[i];
            if (chatMsg.extra && chatMsg.extra.is_phone_log) {
                const msgText = chatMsg.mes || '';
                for (const pattern of markerPatterns) {
                    if (msgText.includes(pattern)) {
                        // 삭제 대신 excludeFromContext 마커 추가
                        chatMsg.extra.excludedFromContext = true;
                        console.log(`📱 [Messages] 히든 로그 컨텍스트 제외 처리: ${msgText.substring(0, 50)}...`);
                        if (window.SlashCommandParser && window.SlashCommandParser.commands['savechat']) {
                            window.SlashCommandParser.commands['savechat'].callback({});
                        }
                        return;
                    }
                }
            }
        }
    }

    // 특정 메시지의 히든 로그 복원
    function restoreHiddenLogForMessage(contactId, msgIndex, msg) {
        if (!window.SillyTavern) return;
        const context = window.SillyTavern.getContext();
        if (!context || !context.chat) return;

        const contact = window.STPhone.Apps?.Contacts?.getContact(contactId);
        const myName = getUserName();
        const contactName = contact?.name || 'Unknown';

        // 먼저 기존에 제외 처리된 로그가 있는지 확인하고 복원
        const markerPatterns = [
            `[📩 ${contactName} -> ${myName}]`,
            `[📩 ${myName} -> ${contactName}]`
        ];

        for (let i = context.chat.length - 1; i >= 0; i--) {
            const chatMsg = context.chat[i];
            if (chatMsg.extra && chatMsg.extra.is_phone_log && chatMsg.extra.excludedFromContext) {
                const msgText = chatMsg.mes || '';
                for (const pattern of markerPatterns) {
                    if (msgText.includes(pattern)) {
                        delete chatMsg.extra.excludedFromContext;
                        console.log(`📱 [Messages] 히든 로그 컨텍스트 복원: ${msgText.substring(0, 50)}...`);
                        if (window.SlashCommandParser && window.SlashCommandParser.commands['savechat']) {
                            window.SlashCommandParser.commands['savechat'].callback({});
                        }
                        return;
                    }
                }
            }
        }
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
                        min-height: 80px; padding: 14px 16px;
                        border: 1px solid var(--pt-border, #e5e5e5);
                        border-radius: 12px; font-size: 14px; line-height: 1.5;
                        background: var(--pt-card-bg, #f5f5f7);
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

        toastr.info("기억을 지우고 답장을 다시 생성합니다...");


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

        // [NEW] 연락처에서 선제 메시지 비활성화되어 있는지 확인
        if (contact.disableProactiveMessage) {
            console.log(`📱 [Proactive] ${contact.name}의 선제 메시지가 비활성화됨`);
            return;
        }

        console.log(`📱 [Proactive] ${contact.name}에게서 선제 메시지 생성!`);
        await generateProactiveMessage(contact);
    }

    async function generateProactiveMessage(contact) {
        if (!contact) return;

        const debugId = Date.now();
        const startedAt = performance?.now?.() || 0;
        isGenerating = true;
        // [수정] 폰 생성 플래그 켜기
        window.STPhone.isPhoneGenerating = true;

        try {
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const proactivePrompt = settings.proactivePrompt || '';
            const prefill = settings.prefill || '';
            const myName = getUserName();
            const maxContextTokens = settings.maxContextTokens || 4096;
            const profileId = settings.connectionProfileId || '';

            console.debug('📱 [Proactive] generate start', { debugId, profileId, contactId: contact.id, contactName: contact.name, maxContextTokens });

            // 스토리 컨텍스트 수집 (멀티턴용)
            const ctx = window.SillyTavern?.getContext() || {};
            const collectedMessages = [];
            let currentTokens = 0;

            if (ctx.chat && ctx.chat.length > 0) {
                const reverseChat = ctx.chat.slice().reverse();

                for (const m of reverseChat) {
                    const msgContent = m.mes || '';
                    const estimatedTokens = Math.ceil(msgContent.length / 2.5);

                    if (currentTokens + estimatedTokens > maxContextTokens) break;
                    collectedMessages.unshift({
                        role: m.is_user ? 'user' : 'assistant',
                        content: msgContent
                    });
                    currentTokens += estimatedTokens;
                }
            }

            // 단순 텍스트 컨텍스트 (1단계용)
            const unifiedContext = collectedMessages.map(m => m.content).join('\n');

            console.debug('📱 [Proactive] context built', { debugId, contextLen: unifiedContext.length, messageCount: collectedMessages.length });

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

            // ========== 2단계: 실제 메시지 생성 (멀티턴) ==========
            const filledProactivePrompt = proactivePrompt
                .replace(/\{\{char\}\}/gi, contact.name)
                .replace(/\{\{user\}\}/gi, myName);

            // [멀티턴 방식] 메시지 배열 구성
            const messages = [];

            // 1. 시스템 프롬프트 (고정 컨텍스트)
            const systemContent = `### Character Info
Name: ${contact.name}
Personality: ${contact.persona || '(not specified)'}

### User Info
Name: ${myName}
Personality: ${settings.userPersonality || '(not specified)'}

### Special Instruction (PROACTIVE TEXT MESSAGE)
${filledProactivePrompt}

You are ${contact.name} sending a spontaneous text message to ${myName}.
Write a natural SMS-style message based on the conversation history.
${prefill ? `Start your response with: ${prefill}` : ''}`;

            messages.push({ role: 'system', content: systemContent });

            // 2. 스토리 컨텍스트 - 원래 role 유지
            if (collectedMessages.length > 0) {
                messages.push(...collectedMessages);
            }

            // 3. 선제 메시지 요청
            messages.push({ role: 'user', content: `[System: ${contact.name} decides to send a spontaneous text message to ${myName}. Generate the message.]` });

            const result = await generateWithProfile(messages, maxContextTokens);
            let replyText = String(result || '').trim();

            console.debug('📱 [Proactive] raw result', { debugId, resultType: typeof result, replyLen: replyText.length, replyPreview: replyText.slice(0, 120) });

            if (prefill && replyText.startsWith(prefill.trim())) {
                replyText = replyText.substring(prefill.trim().length).trim();
            }

            if (replyText.includes('[IGNORE]') || replyText.includes('[NO_TEXT]') || replyText.startsWith('[📩')) {
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
            // [수정] 폰 생성 플래그 끄기
            window.STPhone.isPhoneGenerating = false;
            console.debug('📱 [Proactive] generate end', { debugId, elapsedMs: Math.round(elapsedMs), isGenerating });
        }
    }

    function initProactiveListener() {
        console.log('📱 [Proactive] initProactiveListener 시작');
        const checkInterval = setInterval(() => {
            const ctx = window.SillyTavern?.getContext?.();
            console.log('📱 [Proactive] context 체크', { hasCtx: !!ctx });
            if (!ctx) return;

            clearInterval(checkInterval);

            const eventSource = ctx.eventSource;
            const eventTypes = ctx.eventTypes;
            console.log('📱 [Proactive] eventSource/eventTypes 체크', {
                hasEventSource: !!eventSource,
                hasEventTypes: !!eventTypes,
                MESSAGE_RECEIVED: eventTypes?.MESSAGE_RECEIVED
            });

            if (eventSource && eventTypes) {
                // eventTypes.MESSAGE_RECEIVED 사용 (정확한 이벤트 이름)
                eventSource.on(eventTypes.MESSAGE_RECEIVED, (messageId) => {
                    console.log('📱 [Proactive] MESSAGE_RECEIVED 이벤트 발생!', { messageId });
                    setTimeout(() => {
                        const ctx = window.SillyTavern.getContext();
                        console.log('📱 [Proactive] message_received 처리 중', { messageId, chatLen: ctx?.chat?.length || 0 });
                        if (!ctx.chat || ctx.chat.length === 0) return;

                        const userMsgCount = ctx.chat.reduce((count, m) => count + (m?.is_user ? 1 : 0), 0);
                        if (userMsgCount === 0) {
                            console.log('📱 [Proactive] 그리팅/초기 메시지 스킵');
                            return;
                        }
                        const lastMsg = ctx.chat[ctx.chat.length - 1];
                        console.log('📱 [Proactive] lastMsg', { name: lastMsg?.name, is_user: !!lastMsg?.is_user, mesPreview: String(lastMsg?.mes || '').slice(0, 80) });
                        if (lastMsg && !lastMsg.is_user) {
                            checkProactiveOrAirdrop(lastMsg.name);
                        }
                    }, 500);
                });
                console.log('📱 [Proactive] 채팅 이벤트 리스너 등록 완료! (eventTypes 사용)');
            } else if (eventSource) {
                // 폴백: 문자열 이벤트 이름 사용
                eventSource.on('message_received', (messageId) => {
                    console.log('📱 [Proactive] message_received(문자열) 이벤트 발생!', { messageId });
                    setTimeout(() => {
                        const ctx = window.SillyTavern.getContext();
                        if (!ctx.chat || ctx.chat.length === 0) return;

                        const userMsgCount = ctx.chat.reduce((count, m) => count + (m?.is_user ? 1 : 0), 0);
                        if (userMsgCount === 0) return;

                        const lastMsg = ctx.chat[ctx.chat.length - 1];
                        if (lastMsg && !lastMsg.is_user) {
                            checkProactiveOrAirdrop(lastMsg.name);
                        }
                    }, 500);
                });
                console.log('📱 [Proactive] 채팅 이벤트 리스너 등록됨 (폴백)');
            } else {
                console.warn('📱 [Proactive] eventSource missing');
            }
        }, 1000);
    }

    setTimeout(initProactiveListener, 3000);

    // ========== 통합 트리거 (선제 메시지 1순위 + 에어드롭 2순위, 독립 확률) ==========
    // lastProactiveCheck, PROACTIVE_COOLDOWN은 위(4132~4133줄)에 이미 선언됨
    let lastAirdropUnifiedCheck = 0;
    const AIRDROP_UNIFIED_COOLDOWN = 60000;

    async function checkProactiveOrAirdrop(charName) {
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        const proactiveEnabled = settings.proactiveEnabled;
        const airdropEnabled = settings.airdropEnabled;

        console.log('📱 [Unified] checkProactiveOrAirdrop 호출됨', {
            charName,
            proactiveEnabled,
            airdropEnabled,
            isGenerating,
            isAirdropGenerating
        });

        if (!proactiveEnabled && !airdropEnabled) {
            console.log('📱 [Unified] 둘 다 비활성화됨 - 설정 확인 필요');
            return;
        }

        const now = Date.now();
        let proactiveTriggered = false;

        // === 1순위: 선제 메시지 (독립적 확률 체크) ===
        if (proactiveEnabled && !isGenerating && !isAirdropGenerating) {
            const sinceLastProactive = now - lastProactiveCheck;
            if (sinceLastProactive >= PROACTIVE_COOLDOWN) {
                const proactiveChance = settings.proactiveChance || 30;
                const proactiveRoll = Math.random() * 100;
                console.debug('📱 [Proactive] roll', { roll: proactiveRoll.toFixed(2), chance: proactiveChance });

                if (proactiveRoll <= proactiveChance) {
                    lastProactiveCheck = now;
                    console.log('📱 [Unified] 선제 메시지 당첨!');
                    await triggerProactiveMessage(charName);
                    proactiveTriggered = true;
                } else {
                    console.log(`📱 [Proactive] 확률 미달 (${proactiveRoll.toFixed(0)}% > ${proactiveChance}%)`);
                }
            } else {
                console.debug('📱 [Proactive] 쿨다운 중', { sinceLastProactive, cooldown: PROACTIVE_COOLDOWN });
            }
        }

        // === 2순위: 에어드롭 (선제 메시지와 독립적으로 체크) ===
        if (airdropEnabled && !isAirdropGenerating) {
            // 선제 메시지가 트리거되었으면 잠시 대기 후 에어드롭 체크
            if (proactiveTriggered) {
                // 선제 메시지 생성 완료 후 에어드롭 체크를 위해 약간의 딜레이
                setTimeout(async () => {
                    await checkAirdropAfterProactive(charName, settings);
                }, 2000);
            } else if (!isGenerating) {
                // 선제 메시지가 트리거되지 않았으면 바로 에어드롭 체크
                const sinceLastAirdrop = now - lastAirdropUnifiedCheck;
                if (sinceLastAirdrop >= AIRDROP_UNIFIED_COOLDOWN) {
                    const airdropChance = settings.airdropChance || 15;
                    const airdropRoll = Math.random() * 100;
                    console.debug('📱 [Airdrop] roll', { roll: airdropRoll.toFixed(2), chance: airdropChance });

                    if (airdropRoll <= airdropChance) {
                        lastAirdropUnifiedCheck = now;
                        console.log('📱 [Unified] 에어드롭 당첨!');
                        await triggerAirdropMessage(charName);
                    } else {
                        console.log(`📱 [Airdrop] 확률 미달 (${airdropRoll.toFixed(0)}% > ${airdropChance}%)`);
                    }
                } else {
                    console.debug('📱 [Airdrop] 쿨다운 중', { sinceLastAirdrop, cooldown: AIRDROP_UNIFIED_COOLDOWN });
                }
            }
        }
    }

    // 선제 메시지 이후 에어드롭 체크 함수
    async function checkAirdropAfterProactive(charName, settings) {
        if (isAirdropGenerating || isGenerating) {
            console.debug('📱 [Airdrop] 선제 메시지 후 체크 - 아직 생성 중이라 스킵');
            return;
        }

        const sinceLastAirdrop = Date.now() - lastAirdropUnifiedCheck;
        if (sinceLastAirdrop < AIRDROP_UNIFIED_COOLDOWN) {
            console.debug('📱 [Airdrop] 선제 메시지 후 체크 - 쿨다운 중');
            return;
        }

        const airdropChance = settings.airdropChance || 15;
        const airdropRoll = Math.random() * 100;
        console.debug('📱 [Airdrop] 선제 메시지 후 roll', { roll: airdropRoll.toFixed(2), chance: airdropChance });

        if (airdropRoll <= airdropChance) {
            lastAirdropUnifiedCheck = Date.now();
            console.log('📱 [Unified] 선제 메시지 후 에어드롭도 당첨!');
            await triggerAirdropMessage(charName);
        } else {
            console.log(`📱 [Airdrop] 선제 메시지 후 확률 미달 (${airdropRoll.toFixed(0)}% > ${airdropChance}%)`);
        }
    }

    async function triggerProactiveMessage(charName) {
        let contact = getContactByName(charName);
        if (!contact) contact = await getBotContact();
        if (!contact) contact = getRandomContact();
        if (!contact) {
            console.log('📱 [Proactive] 연락처 없음');
            return;
        }
        console.log(`📱 [Proactive] ${contact.name}에게서 선제 메시지 생성!`);
        await generateProactiveMessage(contact);
    }

    async function triggerAirdropMessage(charName) {
        let contact = getContactByName(charName);
        if (!contact) contact = await getBotContact();
        if (!contact) contact = getRandomContact();
        if (!contact) {
            console.log('📱 [Airdrop] 연락처 없음');
            return;
        }
        console.log(`📱 [Airdrop] ${contact.name}에게서 에어드롭 생성!`);
        await generateAirdropPhoto(contact);
    }

    // ========== 에어드롭 시스템 ==========
    let lastAirdropCheck = 0;
    const AIRDROP_COOLDOWN = 120000;
    let isAirdropGenerating = false;

    async function checkAirdropMessage(charName) {
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};

        console.debug('📱 [Airdrop] check start', { charName, enabled: !!settings.airdropEnabled, isAirdropGenerating });

        if (!settings.airdropEnabled) {
            console.debug('📱 [Airdrop] disabled');
            return;
        }

        const sinceLast = Date.now() - lastAirdropCheck;
        if (sinceLast < AIRDROP_COOLDOWN) {
            console.debug('📱 [Airdrop] cooldown', { sinceLast, cooldown: AIRDROP_COOLDOWN });
            return;
        }

        if (isAirdropGenerating || isGenerating) {
            console.debug('📱 [Airdrop] blocked by generating state');
            return;
        }

        const chance = settings.airdropChance || 15;
        const roll = Math.random() * 100;

        console.debug('📱 [Airdrop] roll', { roll: Number(roll.toFixed(2)), chance });

        if (roll > chance) {
            console.log(`📱 [Airdrop] 확률 미달 (${roll.toFixed(0)}% > ${chance}%)`);
            return;
        }

        lastAirdropCheck = Date.now();

        let contact = getContactByName(charName);
        if (!contact) {
            contact = await getBotContact();
        }
        if (!contact) {
            contact = getRandomContact();
        }

        if (!contact) {
            console.log('📱 [Airdrop] 연락처 없음');
            return;
        }

        console.debug('📱 [Airdrop] selected contact', { id: contact.id, name: contact.name });
        console.log(`📱 [Airdrop] ${contact.name}에게서 에어드롭 생성!`);
        await generateAirdropPhoto(contact);
    }

    async function generateAirdropPhoto(contact) {
        if (!contact) return;

        const debugId = Date.now();
        const startedAt = performance?.now?.() || 0;
        isAirdropGenerating = true;

        try {
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const airdropPrompt = settings.airdropPrompt || '';
            const myName = getUserName();
            const maxContextTokens = settings.maxContextTokens || 4096;

            console.debug('📱 [Airdrop] generate start', { debugId, contactId: contact.id, contactName: contact.name });

            // 스토리 컨텍스트 수집 (멀티턴용)
            const ctx = window.SillyTavern?.getContext() || {};
            const collectedMessages = [];
            let currentTokens = 0;

            if (ctx.chat && ctx.chat.length > 0) {
                const reverseChat = ctx.chat.slice().reverse();

                for (const m of reverseChat) {
                    const msgContent = m.mes || '';
                    const estimatedTokens = Math.ceil(msgContent.length / 2.5);

                    if (currentTokens + estimatedTokens > maxContextTokens) break;
                    collectedMessages.unshift({
                        role: m.is_user ? 'user' : 'assistant',
                        content: msgContent
                    });
                    currentTokens += estimatedTokens;
                }
            }

            // 단순 텍스트 컨텍스트 (1단계용)
            const unifiedContext = collectedMessages.map(m => m.content).join('\n');

            // ========== 1단계: 맥락 판단 ==========
            const contextCheckPrompt = `### Current Story Context
"""
${unifiedContext || '(No recent conversation)'}
"""

### Question
Based on the story context above, would it be natural and appropriate for ${contact.name} to share a photo via AirDrop to ${myName} right now?

Consider:
- Is ${contact.name} in a situation where they could share a photo? (has phone, not in danger, etc.)
- Is there something worth sharing? (a moment, a memory, something they saw)
- Would ${contact.name} think of sharing something with ${myName}?

Answer with ONLY "YES" or "NO" (one word only).`;

            const contextCheckResult = await generateWithProfile(contextCheckPrompt, 100);
            const checkAnswer = String(contextCheckResult || '').trim().toUpperCase();

            console.debug('📱 [Airdrop] context check', { debugId, checkAnswer });

            if (!checkAnswer.includes('YES')) {
                console.log(`📱 [Airdrop] 맥락상 부적절하여 스킵 (${checkAnswer})`);
                isAirdropGenerating = false;
                return;
            }

            // ========== 2단계: 사진 설명 생성 (멀티턴) ==========
            const filledAirdropPrompt = airdropPrompt
                .replace(/\{\{char\}\}/gi, contact.name)
                .replace(/\{\{user\}\}/gi, myName);

            // [멀티턴 방식] 메시지 배열 구성
            const messages = [];

            // 1. 시스템 프롬프트
            const systemContent = `### Character Info
Name: ${contact.name}
Personality: ${contact.persona || '(not specified)'}

### Task
${filledAirdropPrompt}

Generate a photo description that ${contact.name} would share with ${myName} via AirDrop.
Output ONLY the photo description, nothing else.`;

            messages.push({ role: 'system', content: systemContent });

            // 2. 스토리 컨텍스트 - 원래 role 유지
            if (collectedMessages.length > 0) {
                messages.push(...collectedMessages);
            }

            // 3. 에어드롭 요청
            messages.push({ role: 'user', content: `[System: ${contact.name} decides to share a photo via AirDrop. Describe what photo they would share.]` });

            const descResult = await generateWithProfile(messages, 256);
            let photoDescription = String(descResult || '').trim();

            console.debug('📱 [Airdrop] photo description', { debugId, photoDescription });

            if (!photoDescription || photoDescription.length < 5) {
                console.log('📱 [Airdrop] 설명 생성 실패');
                isAirdropGenerating = false;
                return;
            }

            // ========== 3단계: 이미지 생성용 태그 변환 ==========
            const charTags = contact.tags || '';
            const userTags = settings.userTags || '';

            const tagPrompt = `### Visual Tag Library
1. [${contact.name}]: ${charTags}
2. [${myName}]: ${userTags}

### Task
Convert this photo description into Stable Diffusion tags.

Description: "${photoDescription}"

### Rules
1. If ${contact.name} appears in the photo, use their visual tags from the library.
2. Output ONLY comma-separated tags, nothing else.
3. Keep it under 200 characters.

### Response (Tags Only):`;

            const tagResult = await generateWithProfile(tagPrompt, 256);
            let finalTags = String(tagResult || '').trim();

            if (!finalTags || finalTags.length < 5) {
                finalTags = photoDescription;
            }

            console.debug('📱 [Airdrop] final tags', { debugId, finalTags });

            // ========== 4단계: 이미지 생성 ==========
            const parser = getSlashCommandParserInternal();
            const sdCmd = parser?.commands['sd'] || parser?.commands['imagine'];

            if (!sdCmd) {
                console.warn('📱 [Airdrop] SD 확장 없음');
                isAirdropGenerating = false;
                return;
            }

            console.log('📱 [Airdrop] 이미지 생성 중...');
            const imgResult = await sdCmd.callback({ quiet: 'true' }, finalTags);

            if (typeof imgResult === 'string' && imgResult.length > 10) {
                console.log('📱 [Airdrop] 이미지 생성 완료, 에어드롭 팝업 표시');
                showAirdropPopup(contact, imgResult, photoDescription);
            } else {
                console.warn('📱 [Airdrop] 이미지 생성 실패');
            }

        } catch (e) {
            console.error('[Airdrop] 생성 실패:', { debugId, error: e });
        } finally {
            const elapsedMs = (performance?.now?.() || 0) - startedAt;
            isAirdropGenerating = false;
            console.debug('📱 [Airdrop] generate end', { debugId, elapsedMs: Math.round(elapsedMs) });
        }
    }

    function showAirdropPopup(contact, imageUrl, description) {
        if (window.STPhone.UI && window.STPhone.UI.showAirdropPopup) {
            window.STPhone.UI.showAirdropPopup(contact, imageUrl, description);
        } else {
            console.warn('📱 [Airdrop] UI.showAirdropPopup not available');
        }
    }

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
        updateMessagesBadge,
        addHiddenLog,
        generateTransferReply
    };
})();

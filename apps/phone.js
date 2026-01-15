window.STPhone = window.STPhone || {};
window.STPhone.Apps = window.STPhone.Apps || {};

window.STPhone.Apps.Phone = (function() {
    'use strict';

    // ========== Connection Profile을 사용한 AI 생성 함수 ==========
    function getSlashCommandParser() {
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

            const executeSlashCommands = context.executeSlashCommands || context.executeSlashCommandsWithOptions;

            const findProfileName = async (id) => {
                try {
                    const parser = getSlashCommandParser();
                    const listCmd = parser?.commands['profile-list'];
                    const getCmd = parser?.commands['profile-get'];
                    if (!listCmd || !getCmd) return null;

                    const listResult = await listCmd.callback();
                    const profiles = JSON.parse(listResult);
                    if (Array.isArray(profiles)) {
                        if (profiles.includes(id)) return id;
                        for (const name of profiles) {
                            try {
                                const detail = await getCmd.callback({}, name);
                                const profileData = JSON.parse(detail);
                                const possibleId = profileData?.id || profileData?.profileId || profileData?.uuid;
                                if (possibleId === id) return name;
                            } catch (e) {
                                continue;
                            }
                        }
                    }
                } catch (e) {
                    return null;
                }
                return null;
            };

            const runSlashGenWithProfile = async () => {
                const parser = getSlashCommandParser();
                const genCmd = parser?.commands['genraw'] || parser?.commands['gen'];
                if (!genCmd) throw new Error('AI 명령어를 찾을 수 없습니다');

                let originalProfile = null;
                if (profileId && executeSlashCommands) {
                    try {
                        const currentResult = await executeSlashCommands('/profile');
                        originalProfile = currentResult?.pipe || String(currentResult || '').trim();

                        const targetProfileName = await findProfileName(profileId);
                        if (targetProfileName && targetProfileName !== originalProfile) {
                            await executeSlashCommands(`/profile ${targetProfileName}`);
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        } else if (targetProfileName) {
                            originalProfile = null;
                        }
                    } catch (e) {
                        originalProfile = null;
                    }
                }

                try {
                    const result = await genCmd.callback({ quiet: 'true' }, prompt);
                    const elapsedMs = (performance?.now?.() || 0) - startedAt;
                    console.debug('📞 [Phone][AI] slash gen done', { debugId, elapsedMs: Math.round(elapsedMs), outLen: String(result || '').length });
                    return String(result || '').trim();
                } finally {
                    if (originalProfile && executeSlashCommands) {
                        try {
                            await executeSlashCommands(`/profile ${originalProfile}`);
                        } catch (e) {
                            // no-op
                        }
                    }
                }
            };

            // Connection Profile이 설정되어 있으면 ConnectionManager 사용
            if (profileId) {
                const connectionManager = context.ConnectionManagerRequestService;
                if (connectionManager && typeof connectionManager.sendRequest === 'function') {
                    console.debug('📞 [Phone][AI] sendRequest start', { debugId, profileId, maxTokens, promptLen: String(prompt || '').length });

                    const overrides = {};
                    if (maxTokens) {
                        overrides.max_tokens = maxTokens;
                    }

                    try {
                        const result = await connectionManager.sendRequest(
                            profileId,
                            [{ content: prompt, role: 'user' }],
                            maxTokens,
                            {},
                            overrides
                        );

                        const text = normalizeModelOutput(result);
                        const elapsedMs = (performance?.now?.() || 0) - startedAt;
                        console.debug('📞 [Phone][AI] sendRequest done', { debugId, elapsedMs: Math.round(elapsedMs), resultType: typeof result, outLen: String(text || '').length });
                        return String(text || '').trim();
                    } catch (e) {
                        // Fallback to slash gen with profile switching
                        return await runSlashGenWithProfile();
                    }
                }
            }

            return await runSlashGenWithProfile();

        } catch (e) {
            const elapsedMs = (performance?.now?.() || 0) - startedAt;
            console.error('[Phone] generateWithProfile 실패:', { debugId, elapsedMs: Math.round(elapsedMs), profileId, maxTokens, error: e });
            throw e;
        }
    }

    const css = `
        <style>
            .st-phone-app {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%; z-index: 999;
                display: flex; flex-direction: column;
                background: var(--pt-bg-color, #f5f5f7);
                color: var(--pt-text-color, #000);
                font-family: var(--pt-font, -apple-system, sans-serif);
            }
            .st-phone-header {
                padding: 20px 20px 15px;
                font-size: 28px;
                font-weight: 700;
            }
            .st-phone-tabs {
                display: flex;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
                padding: 0 20px;
            }
            .st-phone-tab {
                flex: 1;
                padding: 14px;
                text-align: center;
                font-size: 14px;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                color: var(--pt-sub-text, #86868b);
                transition: color 0.2s;
            }
            .st-phone-tab.active {
                color: var(--pt-accent, #007aff);
                border-bottom-color: var(--pt-accent, #007aff);
            }
            .st-phone-content {
                flex: 1;
                overflow-y: auto;
                padding: 10px 20px;
            }
            .st-call-item {
                display: flex;
                align-items: center;
                padding: 14px 0;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
            }
            .st-call-avatar {
                width: 45px; height: 45px;
                border-radius: 50%;
                object-fit: cover;
                margin-right: 12px;
            }
            .st-call-info { flex: 1; }
            .st-call-name { font-size: 16px; font-weight: 500; }
            .st-call-type {
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .st-call-type.missed { color: #ff3b30; }
            .st-call-type.outgoing { color: var(--pt-sub-text, #86868b); }
            .st-call-type.incoming { color: #34c759; }
            .st-call-time {
                font-size: 13px;
                color: var(--pt-sub-text, #86868b);
                margin-right: 10px;
            }
            .st-call-btn {
                width: 38px; height: 38px;
                border-radius: 50%;
                border: none;
                background: #34c759;
                color: white;
                cursor: pointer;
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.1s, background 0.2s;
            }
            .st-call-btn:active {
                transform: scale(0.95);
            }
            .st-phone-empty {
                text-align: center;
                padding: 80px 24px;
                color: var(--pt-sub-text, #86868b);
            }
            .st-contact-call-item {
                display: flex;
                align-items: center;
                padding: 14px 0;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
                cursor: pointer;
            }

            /* 통화 화면 */
            .st-calling-screen {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%;
                background: #1c1c1e;
                display: flex; flex-direction: column;
                align-items: center;
                padding: 50px 20px 40px;
                z-index: 1002;
                color: white;
                box-sizing: border-box;
            }
            .st-calling-info {
                text-align: center;
                flex-shrink: 0;
            }
            .st-calling-avatar {
                width: 100px; height: 100px;
                border-radius: 50%;
                object-fit: cover;
                margin-bottom: 15px;
                border: 3px solid rgba(255,255,255,0.2);
            }
            .st-calling-name {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 5px;
            }
            .st-calling-status {
                font-size: 15px;
                color: rgba(255,255,255,0.7);
            }
/* === 수정 후 코드 (이걸로 덮어씌우세요) === */
            .st-calling-message {
                /* [수정됨] 높이 제한 해제: 내용만큼만 커짐 */
                width: 100%;
                height: auto;        /* 내용에 맞춰 늘어남 */
                min-height: 0;       /* 강제 최소 높이 제거 */

                margin: 20px 0;
                padding: 20px;       /* 내부 여백으로 기본 크기 확보 */
                box-sizing: border-box;

                /* 디자인: 반투명 검정 배경 */
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 20px;

                /* 텍스트 스타일 */
                color: white;
                font-size: 17px;
                line-height: 1.5;
                text-align: center;
                word-break: keep-all;
                white-space: pre-wrap;

                /* 내용 정렬 */
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;

                /* 부드러운 크기 변화 애니메이션 (선택사항) */
                transition: height 0.2s ease;
            }



            .st-calling-message:empty {
                display: none;
            }
            .st-call-msg-item {
                margin-bottom: 12px;
                padding: 10px 12px;
                border-radius: 12px;
                max-width: 85%;
            }
            .st-call-msg-item.me {
                background: rgba(0,122,255,0.8);
                margin-left: auto;
                text-align: right;
            }
            .st-call-msg-item.them {
                background: rgba(255,255,255,0.15);
            }
            .st-calling-input-area {
                width: 100%;
                flex-shrink: 0;
                margin-bottom: 15px;
            }
            .st-calling-input {
                width: 100%;
                padding: 14px 18px;
                border-radius: 25px;
                border: none;
                background: rgba(255,255,255,0.15);
                color: white;
                font-size: 15px;
                outline: none;
                box-sizing: border-box;
            }
            .st-calling-input::placeholder { color: rgba(255,255,255,0.5); }
            .st-calling-actions {
                display: flex;
                gap: 25px;
                flex-shrink: 0;
            }
            .st-call-action-btn {
                width: 60px; height: 60px;
                border-radius: 50%;
                border: none;
                font-size: 22px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.1s;
            }
            .st-call-action-btn:active {
                transform: scale(0.95);
            }
            .st-call-action-btn.end {
                background: #ff3b30;
                color: white;
            }
            .st-call-action-btn.accept {
                background: #34c759;
                color: white;
            }
            .st-call-action-btn.mute {
                background: rgba(255,255,255,0.2);
                color: white;
            }

            /* 수신 화면 */
            .st-incoming-screen {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%;
                background: #1c1c1e;
                display: flex; flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                z-index: 1003;
                color: white;
                box-sizing: border-box;
            }
            .st-incoming-status {
                font-size: 18px;
                color: rgba(255,255,255,0.7);
                margin-bottom: 20px;
            }
            .st-incoming-actions {
                display: flex;
                gap: 60px;
                margin-top: 50px;
            }
            .st-incoming-btn-wrap {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }
            .st-incoming-label {
                font-size: 13px;
                color: rgba(255,255,255,0.7);
            }
        </style>
    `;

    const DEFAULT_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';
/* === 수정 후 코드 (변수 하나 추가) === */
    let callHistory = [];
    let currentCall = null;
    let callTimer = null;
    let callDuration = 0;

    // [추가됨] 통화 대본을 저장할 임시 공간
    let currentLog = [];


    // [수정됨] 타이핑(글자) 효과 제어용 변수
    let typeWriterInterval = null;
    // [신규추가] 다음 문장으로 넘어가는 대기 시간 제어용 변수
    let sentenceTimeout = null;
    // [신규] AI가 말하는 중인지 추적
    let isAISpeaking = false;
    // [신규] AI가 말하다 끊겼을 때 마지막 발화 텍스트
    let lastAIUtterance = '';
    // [신규] 현재 화면에 타이핑 중인 문장 (끊겼을 때 정확한 문장 캡처용)
    let currentDisplayedSentence = '';

    function getStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId) return null;

        // [NEW] 누적 모드일 때는 캐릭터 기반 키 사용
        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        if (settings.recordMode === 'accumulate' && context.characterId !== undefined) {
            return 'st_phone_calls_char_' + context.characterId;
        }

        return 'st_phone_calls_' + context.chatId;
    }

    function loadHistory() {
        const key = getStorageKey();
        if (!key) { callHistory = []; return; }
        try {
            callHistory = JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) { callHistory = []; }
    }

    function saveHistory() {
        const key = getStorageKey();
        if (!key) return;
        localStorage.setItem(key, JSON.stringify(callHistory));
    }

    function deleteHistoryEntry(index) {
        loadHistory();
        if (!Number.isInteger(index)) return;
        if (index < 0 || index >= callHistory.length) return;
        callHistory.splice(index, 1);
        saveHistory();
    }

    function addToHistory(contactId, type) {
        loadHistory();
        const contact = window.STPhone.Apps?.Contacts?.getContact(contactId);
        callHistory.unshift({
            contactId,
            contactName: contact?.name || 'Unknown',
            contactAvatar: contact?.avatar || '',
            type,
            timestamp: Date.now()
        });
        if (callHistory.length > 50) callHistory = callHistory.slice(0, 50);
        saveHistory();
    }

    function formatTime(ts) {
        const d = new Date(ts);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    function formatDuration(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function open() {
        loadHistory();
        const $screen = window.STPhone.UI.getContentElement();
        if (!$screen?.length) return;
        $screen.empty();

        const contacts = window.STPhone.Apps?.Contacts?.getAllContacts() || [];

        let historyHtml = '';
        if (callHistory.length === 0) {
            historyHtml = `<div class="st-phone-empty"><div style="font-size:36px;opacity:0.5;margin-bottom:15px;"><i class="fa-solid fa-phone"></i></div><div>통화 기록이 없습니다</div></div>`;
        } else {
/* 수정된 반복문 코드 (복사해서 덮어씌우세요) */
            callHistory.forEach((h, index) => {
                // 1. 상태에 따라 아이콘과 글자, 색상 정하기
                let typeIcon, typeLabel, typeColor;

                if (h.type === 'missed') {
                    typeIcon = '<i class="fa-solid fa-phone-slash"></i>';
                    typeLabel = '부재중 전화';
                    typeColor = '#ff3b30';
                }
                else if (h.type === 'rejected') {
                    typeIcon = '<i class="fa-solid fa-xmark"></i>';
                    typeLabel = '통화 거절됨';
                    typeColor = '#ff3b30';
                }
                else if (h.type === 'outgoing') {
                    typeIcon = '<i class="fa-solid fa-arrow-up-right"></i>';
                    typeLabel = '발신 (통화 성공)';
                    typeColor = 'var(--pt-sub-text, #86868b)';
                }
                else {
                    typeIcon = '<i class="fa-solid fa-arrow-down-left"></i>';
                    typeLabel = '수신 (통화 성공)';
                    typeColor = 'var(--pt-accent, #007aff)';
                }

                // 2. 통화 시간 표시 (부재중/거절은 시간 표시 안 함)
                let durationStr = '';
                if (h.type !== 'missed' && h.type !== 'rejected' && h.duration > 0) {
                     const min = Math.floor(h.duration / 60);
                     const sec = h.duration % 60;
                     const timeTxt = min > 0 ? `${min}분 ${sec}초` : `${sec}초`;
                     // 시간 뱃지 디자인
                     durationStr = ` <span style="font-size:10px; font-weight:500; color:var(--pt-sub-text, #86868b); background:var(--pt-border, #e5e5e5); padding:2px 6px; border-radius:8px; margin-left:6px;">${timeTxt}</span>`;
                }

                // [NEW] 콘텍스트 미반영 알약 태그
                const excludedTag = h.excludeFromContext === true ? '<span class="st-msg-no-context">미반영</span>' : '';

                const hasLog = h.log && h.log.length > 0;

                // 3. HTML 조립
                // [핵심] nameStyle을 제거했습니다. 이제 이름은 항상 기본색(검정)입니다.
                historyHtml += `
                    <div class="st-call-item">
                        <img class="st-call-avatar" src="${h.contactAvatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                        <div class="st-call-info">
                            <div class="st-call-name">${h.contactName}${durationStr}${excludedTag}</div>
                            <!-- 상태 메시지(부재중/거절됨)만 빨간색으로 표시됩니다 -->
                            <div class="st-call-type" style="color: ${typeColor}; margin-top:3px;">
                                ${typeIcon} ${typeLabel}
                            </div>
                        </div>
                        <div class="st-call-time">${formatTime(h.timestamp)}</div>

                        <div style="display:flex; gap:5px;">
                            <button class="st-call-btn" style="background:#ff3b30;" data-action="delete-history" data-index="${index}"><i class="fa-solid fa-trash"></i></button>
                            ${hasLog ? `<button class="st-call-btn" style="background:#555;" data-action="view-log" data-index="${index}"><i class="fa-solid fa-file-lines"></i></button>` : ''}
                            <button class="st-call-btn" data-id="${h.contactId}" data-action="call"><i class="fa-solid fa-phone"></i></button>
                        </div>
                    </div>`;
            });


        }

        let contactsHtml = '';
        if (contacts.length === 0) {
            contactsHtml = `<div class="st-phone-empty"><div>연락처가 없습니다</div></div>`;
        } else {
            contacts.forEach(c => {
                contactsHtml += `
                    <div class="st-contact-call-item" data-id="${c.id}">
                        <img class="st-call-avatar" src="${c.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                        <div class="st-call-info">
                            <div class="st-call-name">${c.name}</div>
                        </div>
                        <button class="st-call-btn" data-id="${c.id}" data-action="call"><i class="fa-solid fa-phone"></i></button>
                    </div>`;
            });
        }

        $screen.append(`
            ${css}
            <div class="st-phone-app">
                <div class="st-phone-header">전화</div>
                <div class="st-phone-tabs">
                    <div class="st-phone-tab active" data-tab="recents">최근 기록</div>
                    <div class="st-phone-tab" data-tab="contacts">연락처</div>
                </div>
                <div class="st-phone-content" id="st-phone-content">
                    <div id="st-tab-recents">${historyHtml}</div>
                    <div id="st-tab-contacts" style="display:none;">${contactsHtml}</div>
                </div>
            </div>
        `);

        $('.st-phone-tab').on('click', function() {
            const tab = $(this).data('tab');
            $('.st-phone-tab').removeClass('active');
            $(this).addClass('active');
            $('#st-tab-recents, #st-tab-contacts').hide();
            $(`#st-tab-${tab}`).show();
        });

        $('[data-action="call"]').on('click', function(e) {
            e.stopPropagation();
            const id = $(this).data('id');
            if (id) makeCall(id);
        });

        $('[data-action="view-log"]').on('click', function(e) {
            e.stopPropagation();
            const index = $(this).data('index');
            openLogViewer(index);
        });

        $('[data-action="delete-history"]').on('click', function(e) {
            e.stopPropagation();
            const index = Number($(this).data('index'));
            deleteHistoryEntry(index);
            open();
        });

        // [NEW] 통화 기록 우클릭 컨텍스트 메뉴
        $('.st-call-item').on('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const index = $(this).find('[data-action="delete-history"]').data('index');
            if (index !== undefined) {
                showCallContextMenu(e.pageX, e.pageY, Number(index), $(this));
            }
        });
    }

    // [NEW] 통화 기록 우클릭 컨텍스트 메뉴 표시
    function showCallContextMenu(x, y, index, $item) {
        // 기존 메뉴 제거
        $('#st-call-context-menu').remove();

        loadHistory();
        if (index < 0 || index >= callHistory.length) return;

        const h = callHistory[index];
        const isExcluded = h.excludeFromContext === true;

        // 폰 컨테이너 기준 상대 좌표 계산
        const $phoneContainer = $('#st-phone-container');
        const phoneOffset = $phoneContainer.offset();
        const relativeX = x - phoneOffset.left;
        const relativeY = y - phoneOffset.top;

        const menuHtml = `
            <div id="st-call-context-menu" style="
                position: absolute;
                left: ${relativeX}px;
                top: ${relativeY}px;
                background: var(--pt-card-bg, #fff);
                border-radius: 12px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                z-index: 3000;
                min-width: 160px;
                overflow: hidden;
            ">
                <div class="st-context-item" data-action="toggle-context" data-index="${index}" style="
                    padding: 14px 16px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                    color: var(--pt-text-color, #333);
                    border-bottom: 1px solid var(--pt-border, #eee);
                ">
                    <i class="fa-solid ${isExcluded ? 'fa-eye' : 'fa-eye-slash'}" style="width:16px; color:${isExcluded ? '#34c759' : '#ff9500'};"></i>
                    ${isExcluded ? '컨텍스트 반영' : '컨텍스트 미반영'}
                </div>
                <div class="st-context-item" data-action="close" style="
                    padding: 14px 16px;
                    cursor: pointer;
                    font-size: 14px;
                    color: var(--pt-sub-text, #86868b);
                    text-align: center;
                ">취소</div>
            </div>
        `;

        $phoneContainer.append(menuHtml);

        // 클릭 이벤트
        $('#st-call-context-menu [data-action="toggle-context"]').on('click', function() {
            const idx = $(this).data('index');
            toggleCallContextQuick(idx);
            $('#st-call-context-menu').remove();
        });

        $('#st-call-context-menu [data-action="close"]').on('click', function() {
            $('#st-call-context-menu').remove();
        });

        // 메뉴 외부 클릭 시 닫기
        setTimeout(() => {
            $(document).one('click', function() {
                $('#st-call-context-menu').remove();
            });
        }, 100);
    }

    // [NEW] 빠른 컨텍스트 토글 (화면 새로고침)
    function toggleCallContextQuick(index) {
        loadHistory();
        if (index < 0 || index >= callHistory.length) return;

        const h = callHistory[index];
        const wasExcluded = h.excludeFromContext === true;
        h.excludeFromContext = !wasExcluded;
        saveHistory();

        if (h.excludeFromContext) {
            toastr.info('🚫 이 통화 기록은 AI 컨텍스트에 반영되지 않습니다');
        } else {
            toastr.success('✅ 이 통화 기록이 AI 컨텍스트에 반영됩니다');
        }

        // 화면 새로고침
        open();
    }



    // [수정된 함수] userName 변수 선언 추가됨
    function makeCall(contactId) {
        const contact = window.STPhone.Apps?.Contacts?.getContact(contactId);
        if (!contact) { toastr.error('연락처를 찾을 수 없습니다'); return; }

        // [차단 체크] - 차단된 연락처에게는 전화 불가
        const Settings = window.STPhone.Apps?.Settings;
        if (Settings && typeof Settings.isBlocked === 'function' && Settings.isBlocked(contactId)) {
            toastr.error(`${contact.name}님에게 차단되어 전화를 걸 수 없습니다.`, '차단됨');
            return;
        }

        // [수정됨] 설정 앱(Settings)에 저장된 내 이름("오타쿠")을 가져오는 마법의 코드
        let userName = 'User';
        if (window.SillyTavern && window.SillyTavern.getContext) {
            const ctx = window.SillyTavern.getContext();
            // 1. 일단 기본 이름
            userName = ctx.name2 || 'User';
            // 2. 폰 설정 저장소를 뒤져서 유저가 설정한 이름이 있으면 덮어쓰기
            if (ctx.chatId) {
                try {
                    const cfg = JSON.parse(localStorage.getItem('st_phone_config_' + ctx.chatId) || '{}');
                    if (cfg.userName) userName = cfg.userName;
                } catch(e) {}
            }
        }


        // [중요] 통화 대본 기록 초기화
        currentLog = [];

        // outgoing(발신) 설정
        currentCall = { contactId, contact, startTime: null, isOutgoing: true };

        // 통화 시작 로그 (이제 userName이 정의되었으니 에러가 안 납니다)
        // System 글자 대신 실제 상황을 명확히 대괄호로 묶음
        addHiddenLog('System', `[📞 Call Start] ${userName} -> ${contact.name}`);


        showCallingScreen(contact, true);
    }



    // 2단계 교체 코드: apps/phone.js
    function receiveCall(contactInput) {
        console.debug('📞 [Phone] receiveCall invoked', { inputType: typeof contactInput, hasId: !!contactInput?.id, name: contactInput?.name });
        // [수정됨] 입력값이 ID인 경우와 객체(임시연락처)인 경우를 모두 처리
        let contact = null;
        if (typeof contactInput === 'object') {
            contact = contactInput; // 임시 연락처 객체가 들어옴
        } else {
            contact = window.STPhone.Apps?.Contacts?.getContact(contactInput);
        }

        if (!contact) return;

        // 폰이 내려가 있다면 자동으로 올림 (팝업!)
        const $phoneContainer = $('#st-phone-container');
        if (!$phoneContainer.hasClass('active')) {
            window.STPhone.UI.togglePhone();
        }

        const $screen = window.STPhone.UI.getContentElement();
        $screen.append(`
            ${css}
            <div class="st-incoming-screen" id="st-incoming-screen">
                <div class="st-incoming-status"><i class="fa-solid fa-phone-volume"></i> 전화가 왔습니다</div>
                <img class="st-calling-avatar" src="${contact.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div class="st-calling-name">${contact.name}</div>
                <div class="st-incoming-actions">
                    <div class="st-incoming-btn-wrap">
                        <button class="st-call-action-btn end" id="st-incoming-decline"><i class="fa-solid fa-phone-slash"></i></button>
                        <span class="st-incoming-label">거절</span>
                    </div>
                    <div class="st-incoming-btn-wrap">
                        <button class="st-call-action-btn accept" id="st-incoming-accept"><i class="fa-solid fa-phone"></i></button>
                        <span class="st-incoming-label">받기</span>
                    </div>
                </div>
            </div>
        `);

        // 1. 거절(Decline) 버튼 클릭 시
        $('#st-incoming-decline').on('click', () => {
            // 유저 이름 가져오기
            let userName = 'User';
            if (window.SillyTavern && window.SillyTavern.getContext) {
                const ctx = window.SillyTavern.getContext();
                userName = ctx.name2 || 'User';
                if (ctx.chatId) {
                    try {
                        const cfg = JSON.parse(localStorage.getItem('st_phone_config_' + ctx.chatId) || '{}');
                        if (cfg.userName) userName = cfg.userName;
                    } catch(e) {}
                }
            }

            // 임시 연락처가 아니면 기록에 남김
            if (!contact.isTemp) addToHistory(contact.id, 'missed');
            $('#st-incoming-screen').remove();

            // AI에게 거절 사실 알림
            addHiddenLog('System', `[📵 Call Declined by ${userName}] (${userName} explicitly rejected ${contact.name}'s call)`);

            // AI에게 즉시 알림 전송 (AI가 반응할 수 있도록)
            triggerAINotification(contact, 'declined', userName);
        });

        // 2. 받기(Accept) 버튼 클릭 시
        $('#st-incoming-accept').on('click', () => {
            $('#st-incoming-screen').remove();
            addHiddenLog('System', `[📞 Incoming Call Accepted from ${contact.name}]`);

            currentLog = [];
            currentCall = {
                contactId: contact.id,
                contact: contact,
                startTime: null,
                isOutgoing: false
            };
            showCallingScreen(contact, false);
        });

        // 3. 30초 시간 초과(Timeout) 시
        setTimeout(() => {
            if ($('#st-incoming-screen').length) {
                // 유저 이름 가져오기
                let userName = 'User';
                if (window.SillyTavern && window.SillyTavern.getContext) {
                    const ctx = window.SillyTavern.getContext();
                    userName = ctx.name2 || 'User';
                    if (ctx.chatId) {
                        try {
                            const cfg = JSON.parse(localStorage.getItem('st_phone_config_' + ctx.chatId) || '{}');
                            if (cfg.userName) userName = cfg.userName;
                        } catch(e) {}
                    }
                }

                if (!contact.isTemp) addToHistory(contact.id, 'missed');
                $('#st-incoming-screen').remove();
                toastr.warning(`📵 ${contact.name}의 부재중 전화`);

                // AI에게 부재중 사실 알림
                addHiddenLog('System', `[📵 Call Missed] (${userName} did not answer ${contact.name}'s call - No response after 30 seconds)`);

                // AI에게 즉시 알림 전송
                triggerAINotification(contact, 'missed', userName);
            }
        }, 30000);
    }

    // [NEW] AI에게 부재중/거절 알림 전송 함수
    async function triggerAINotification(contact, reason, userName) {
        try {
            // 채팅 로그 가져오기
            let mainChatHistory = "";
            const ctx = window.SillyTavern?.getContext() || {};
            if (ctx.chat?.length) {
                mainChatHistory = ctx.chat.slice(-10).map(m => `${m.name}: ${m.mes}`).join('\n');
            }

            // 캐릭터 정보 가져오기
            let charRealData = `Name: ${contact.name}`;
            if (ctx.characters && ctx.characterId !== undefined) {
                const liveChar = ctx.characters[ctx.characterId];
                if (liveChar && liveChar.name === contact.name) {
                    charRealData = `Name: ${liveChar.name}\nPersonality: ${liveChar.personality || ''}\nDescription: ${liveChar.description || ''}`;
                }
            }

            const reasonText = reason === 'declined'
                ? `${userName} has REJECTED your phone call.`
                : `${userName} did NOT ANSWER your phone call (missed call after 30 seconds).`;

            const prompt = `[System Note: Phone Call Event]
${reasonText}

### Character
${charRealData}

### Recent Context
${mainChatHistory}

### Task
As ${contact.name}, send a SHORT text message (SMS) reaction to ${userName} about the missed/declined call.
Keep it in character. Express your feelings naturally (disappointed, worried, annoyed, etc. based on personality).
Response should be 1-2 sentences max.

### Response Format (JSON Only)
{"text": "YOUR_SMS_MESSAGE"}`;

            const response = await generateWithProfile(prompt);
            let rawResult = String(response).trim();

            // JSON 파싱
            let smsText = rawResult;
            try {
                const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
                if (jsonMatch) smsText = JSON.parse(jsonMatch[0]).text || smsText;
            } catch(e) {}

            smsText = smsText.replace(/"/g, '').trim();
            if (!smsText || smsText.length < 2) return;

            // 문자 앱에 메시지 추가
            if (window.STPhone.Apps && window.STPhone.Apps.Messages) {
                // 연락처 ID 찾기
                let targetContactId = contact.id;
                if (contact.isTemp) {
                    // 임시 연락처면 연락처 목록에서 이름으로 찾기
                    const contacts = window.STPhone.Apps.Contacts?.getAllContacts() || [];
                    const found = contacts.find(c => c.name === contact.name);
                    if (found) targetContactId = found.id;
                }

                if (targetContactId && !contact.isTemp) {
                    window.STPhone.Apps.Messages.receiveMessage(targetContactId, smsText);

                    // 히든 로그에도 남기기
                    addHiddenLog(contact.name, `[📩 ${contact.name} -> ${userName}]: ${smsText}`);
                }
            }

            console.log(`📱 [Phone] AI notification sent: ${smsText}`);

        } catch (e) {
            console.error('[Phone] AI notification failed:', e);
        }
    }



    function showCallingScreen(contact, isOutgoing) {
        const $screen = window.STPhone.UI.getContentElement();

        $screen.append(`
            ${css}
            <div class="st-calling-screen" id="st-calling-screen">
                <div class="st-calling-info">
                    <img class="st-calling-avatar" src="${contact.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                    <div class="st-calling-name">${contact.name}</div>
                    <div class="st-calling-status" id="st-call-status">연결 중...</div>
                </div>
                <div class="st-calling-message" id="st-call-message"></div>
                <div class="st-calling-input-area" id="st-call-input-area" style="display:none;">
                    <input class="st-calling-input" id="st-call-input" placeholder="말하기...">
                </div>
                <div class="st-calling-actions">
                    <button class="st-call-action-btn mute" id="st-call-mute"><i class="fa-solid fa-microphone-slash"></i></button>
                    <button class="st-call-action-btn end" id="st-call-end"><i class="fa-solid fa-phone-slash"></i></button>
                </div>
            </div>
        `);

        // ============================================================
        // [CASE 1] AI가 건 전화를 내가 받았을 때 (Incoming Call Accepted)
        // ============================================================
        if (!isOutgoing) {
            // 1. 즉시 연결 처리 (AI 허락 필요 없음)
            currentCall.startTime = Date.now();
            $('#st-call-status').text('통화 중 0:00').css('color', '#4ade80');
            $('.st-calling-avatar').css('animation', 'none');

            // 2. 타이머 시작
            callTimer = setInterval(() => {
                callDuration++;
                $('#st-call-status').text(`통화 중 ${formatDuration(callDuration)}`);
            }, 1000);

            // 3. [핵심] 유저 입력창 바로 띄우기 (네가 먼저 말해야 함)
            setTimeout(() => {
                $('#st-call-input-area').fadeIn(200);
                $('#st-call-input').focus();

                // 안내 메시지 살짝 띄우기 (선택사항)
                // appendCallMessage('them', "...", null);
            }, 500);

            // 이벤트 핸들러 연결하고 종료 (AI 생성 로직 실행 안 함)
            attachCallListeners();
            return;
        }

        // ============================================================
        // [CASE 2] 내가 AI에게 걸었을 때 (Outgoing Call) - 기존 로직 유지
        // ============================================================
        setTimeout(async () => {
            if (!currentCall) return;

            $('#st-call-status').text('신호 가는 중...');
            $('.st-calling-avatar').css('animation', 'pulse 1.5s infinite');

            try {
                let mainChatHistory = "";
                let userName = "User";
                if (window.SillyTavern && window.SillyTavern.getContext) {
                    const ctx = window.SillyTavern.getContext();
                    userName = ctx.name2 || "User";
                    if (ctx.chatId) {
                        try {
                            const cfg = JSON.parse(localStorage.getItem('st_phone_config_' + ctx.chatId) || '{}');
                            if (cfg.userName) userName = cfg.userName;
                        } catch(e) {}
                    }
                    if (ctx.chat && ctx.chat.length > 0) {
                            mainChatHistory = ctx.chat.slice(-15).map(m => `${m.name}: ${m.mes}`).join('\n');
                        }
                    }

                    // 설정에서 전화 수신 프롬프트 가져오기
                    const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
                    let pickupPromptTemplate = settings.phonePickupPrompt || `[System Instruction: Incoming Voice Call Simulation]
You are "{{char}}". User "{{user}}" is calling you on the phone.

### Task
Analyze the relationship and current situation, then output a JSON object defined below.

1. **pickup**: boolean (true = Accept Call, false = Reject Call)
2. **content**: string (The message)
   - If pickup=true: Your **FIRST SPOKEN LINE** when answering.
   - If pickup=false: The **Internal Reason** for rejection.

### Format (Strict JSON)
{"pickup": true, "content": "Hello, what's up?"}`;

                    // 변수 치환
                    const oneShotPrompt = pickupPromptTemplate
                        .replace(/\{\{char\}\}/g, contact.name)
                        .replace(/\{\{user\}\}/g, userName)
                    + `\n\n### Context (Recent Chat)\n${mainChatHistory}`;

                    const result = await generateWithProfile(oneShotPrompt);
                    let decision = { pickup: true, content: "Hello?" };
                    try {
                        const match = String(result).match(/\{[\s\S]*\}/);
                        if (match) decision = JSON.parse(match[0]);
                    } catch (e) { }

                    decision.content = decision.content.replace(/"/g, '').trim();

                    if (decision.pickup === false) {
                        $('#st-call-status').text('통화 거절됨').css('color', '#ff3b30');
                        $('.st-calling-avatar').css('animation', 'none');
                        $('#st-call-message').html(`
                            <div style="text-align:center; color:#ff453a; padding:20px; font-weight:600; opacity:0; animation:fadeIn 0.5s forwards;">
                                [부재중]<br><span style="font-size:15px; font-weight:400; color:white; margin-top:10px; display:block;">"${decision.content}"</span>
                            </div>
                        `).show();
                        if (typeof addHiddenLog === 'function') {
                            addHiddenLog("System", `[📞 Call Declined by ${contact.name}]: ${decision.content}`);
                        }
                        setTimeout(() => endCall('rejected'), 3000);
                        return;
                    }

                    // 수락 시
                    currentCall.startTime = Date.now();
                    $('#st-call-status').text('통화 중 0:00').css('color', '#4ade80');
                    $('.st-calling-avatar').css('animation', 'none');

                    currentLog.push({ sender: contact.name, text: decision.content });
                    if (typeof addHiddenLog === 'function') {
                        addHiddenLog(contact.name, `[📞 ${contact.name} on Phone]: ${decision.content}`);
                    }

                    appendCallMessage('them', decision.content, () => {
                        $('#st-call-input-area').fadeIn(200);
                        $('#st-call-input').val('').focus();
                    });

                    if (isOutgoing) $('#st-call-input-area').hide();

                    callTimer = setInterval(() => {
                        callDuration++;
                        $('#st-call-status').text(`통화 중 ${formatDuration(callDuration)}`);
                    }, 1000);
            } catch (err) {
                // 에러 처리
                currentCall.startTime = Date.now();
                $('#st-call-status').text('통화 중 0:00').css('color', '#4ade80');
                appendCallMessage('them', "Hello?");
                 callTimer = setInterval(() => {
                    callDuration++;
                    $('#st-call-status').text(`통화 중 ${formatDuration(callDuration)}`);
                }, 1000);
            }
        }, 1500);

        attachCallListeners();
    }

    // 리스너 부착 함수 분리 (중복 제거용)
    function attachCallListeners() {
        $('#st-call-end').off('click').on('click', function() {
            endCall(null, 'user');
        });

        $('#st-call-input').off('keydown').on('keydown', async function(e) {
            if (e.key === 'Enter') {
                const text = $(this).val().trim();
                if (text) {
                    $(this).val('');
                    await handleCallInput(text);
                }
            }
        });
    }


    async function handleCallInput(text) {
        if (!currentCall) return;
        const contact = currentCall.contact;

        // [수정 포인트] 전송하자마자 입력창 숨기기
        $('#st-call-input-area').fadeOut(200);

        appendCallMessage('me', text);
        currentLog.push({ sender: '나', text: text });

        // 유저 이름 찾기
        let finalUserName = 'User';
        if (window.SillyTavern && window.SillyTavern.getContext) {
            const ctx = window.SillyTavern.getContext();
            finalUserName = ctx.name2 || 'User';
            if (ctx.chatId) {
                const configKey = 'st_phone_config_' + ctx.chatId;
                const savedConfig = localStorage.getItem(configKey);
                if (savedConfig) {
                    try {
                        const parsed = JSON.parse(savedConfig);
                        if (parsed.userName && parsed.userName.trim() !== '') {
                            finalUserName = parsed.userName;
                        }
                    } catch (e) {}
                }
            }
        }

        if (typeof addHiddenLog === 'function') {
            // [수정됨] 이제 "(Phone) 보냄" 대신 "[📞 이름 on Phone]: 내용" 형식으로 뜹니다.
            addHiddenLog(finalUserName, `[📞 ${finalUserName} on Phone]: ${text}`);
        }


        await generateAIResponse(contact, text);
    }




    // 3단계 교체 코드: apps/phone.js
    async function generateAIResponse(contact, userText) {
        // [NEW] 폰 앱에서 생성 중임을 표시
        window.STPhone.isPhoneGenerating = true;

        try {

            /* 정보 수집 시작 */
            let ctx = window.SillyTavern?.getContext() || {};
            let userSettings = { name: ctx.name2 || 'User', persona: '' };
            let mainChatHistory = "";

            // 최근 대화 내용 가져오기
            if (ctx.chat?.length) mainChatHistory = ctx.chat.slice(-15).map(m => `${m.name}: ${m.mes}`).join('\n');

            // 유저 폰 설정(이름, 성격) 가져오기
            if (ctx.chatId) {
                try {
                    const cfg = JSON.parse(localStorage.getItem('st_phone_config_' + ctx.chatId) || '{}');
                    if (cfg.userName) userSettings.name = cfg.userName;
                    if (cfg.userPersonality) userSettings.persona = cfg.userPersonality;
                } catch(e) {}
            }

            // [NEW] 캘린더 기념일 안전하게 가져오기
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
                console.warn('[Phone] 캘린더 프롬프트 로드 실패(무시됨):', calErr);
            }

            /* 캐릭터 데이터 가져오기 */
            let charRealData = `Name: ${contact.name}\nPersonality: ${contact.persona || 'Unknown'}`;
            if (ctx.characters && ctx.characterId !== undefined) {
                const liveChar = ctx.characters[ctx.characterId];
                if (liveChar && liveChar.name === contact.name) {
                    charRealData = `
### Full Character Definition
Name: ${liveChar.name}
Description: ${liveChar.description || ''}
Personality: ${liveChar.personality || ''}
Scenario: ${liveChar.scenario || ''}
`;
                }
            }

            /* 상황 판단 */
            let situationInstruction = "";
            let currentTurnLine = "";

            if (userText === null) {
                situationInstruction = `Situation: ${userSettings.name} just called ${contact.name}. ${contact.name} picks up the phone.`;
                currentTurnLine = `(Waiting for ${contact.name}'s first greeting...)`;
            } else {
                situationInstruction = `Situation: Ongoing Phone Call between ${contact.name} and ${userSettings.name}.`;
                currentTurnLine = `${userSettings.name}: "${userText}"`;
            }

            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const phoneCallRules = settings.phoneCallPrompt || `### 📞 Strict Phone Call Rules (MUST FOLLOW)
1. **Language:** Respond ONLY in **Korean**.
2. **Format:** DO NOT use quotation marks ("") around speech. Just write the raw text.
3. **No Prose:** DO NOT write novel-style descriptions, actions, or inner thoughts.
4. **Audio Only:** Output ONLY what can be heard through the phone (Speech) and audible sounds.
5. **Sound Effects:** Put distinct sounds in parentheses like (한숨), (웃음).
6. **Termination:** To hang up the phone, append [HANGUP] at the very end of your response.

### Response Format (JSON Only)
{"text": "대사_입력"}`;

            const prompt = `
[System Note: ${situationInstruction}]
Roleplay as "${contact.name}".

${charRealData}

### Interlocutor (User) Profile
Name: ${userSettings.name}
Details: ${userSettings.persona}

${phoneCallRules}

### Context (Chat History)
${mainChatHistory}
${calendarEventsPrompt}

### Current Turn
${currentTurnLine}
`;

            /* 생성 요청 */
            const response = await generateWithProfile(prompt);
            let rawResult = String(response).trim();

            let aiText = rawResult;
            try {
                const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
                if (jsonMatch) aiText = JSON.parse(jsonMatch[0]).text || aiText;
            } catch(e) {}

            aiText = aiText.replace(/"/g, '').trim();

            let shouldHangUp = false;
            if (aiText.includes('[HANGUP]')) {
                shouldHangUp = true;
                aiText = aiText.replace(/\[HANGUP\]/gi, '').trim();
            }

            if (!aiText) aiText = "...";

            /* 로그 저장 */
            currentLog.push({ sender: contact.name, text: aiText });
            if (typeof addHiddenLog === 'function') {
                const status = shouldHangUp ? '(Hung up)' : '';
                addHiddenLog(contact.name, `[📞 ${contact.name} on Phone]: ${aiText} ${status}`);
            }

            /* 화면 출력 */
            appendCallMessage('them', aiText, () => {
                if (shouldHangUp) {
                    $('#st-call-status').text('Call Ended').css('color', '#ff3b30');
                    setTimeout(() => endCall(null, 'ai'), 1000);
                } else {
                    $('#st-call-input-area').fadeIn(200);
                    $('#st-call-input').val('').focus();
                }
            });

        } catch (e) {
            console.error(e);
            appendCallMessage('them', '...');
            $('#st-call-input-area').fadeIn();
        } finally {
            // [NEW] 플래그 해제
            window.STPhone.isPhoneGenerating = false;
        }
    }






    function appendCallMessage(sender, text, onComplete = null) {
        const $msgArea = $('#st-call-message');

        // 기존 타이핑 중단 (새 문장이 오면 기존 건 멈춤)
        if (typeWriterInterval) clearInterval(typeWriterInterval);
        if (sentenceTimeout) clearTimeout(sentenceTimeout);
        typeWriterInterval = null;
        sentenceTimeout = null;

        // [신규] AI 발화 상태 추적
        if (sender === 'them') {
            isAISpeaking = true;
            lastAIUtterance = text;
        }

        $msgArea.empty();

        const nameLabel = sender === 'me' ? '나' : (currentCall ? currentCall.contact.name : '상대방');
        const color = sender === 'me' ? '#007aff' : '#34c759';

        $msgArea.html(`
            <div style="width:100%;">
                <div style="font-size:13px; color:${color}; margin-bottom:12px; font-weight:bold; letter-spacing:0.5px;">${nameLabel}</div>
                <div id="st-typewriter-text" style="min-height:24px;"></div>
            </div>
        `);
        const $textBox = $('#st-typewriter-text');

        // 내가 말할 때는 즉시 표시하고 종료
        if (sender === 'me') {
            $textBox.text(text);
            if (onComplete) onComplete();
            return;
        }

        // --- AI가 말할 때 (타이핑 효과) ---
        // 문장을 쪼갭니다 (마침표, 물음표, 느낌표 기준)
        const sentences = text.match(/[^.!?\n]+[.!?\n]+["']?|[^.!?\n]+$/g) || [text];
        let currentSentenceIndex = 0;

        function playNextSentence() {
            // [중요 수정] 더 이상 보여줄 문장이 없으면? -> 모든 대화 종료!
            if (currentSentenceIndex >= sentences.length) {
                // 여기서 완료 신호를 보냅니다. (이때 전화를 끊으면 됩니다)
                isAISpeaking = false; // [신규] AI 발화 완료
                currentDisplayedSentence = ''; // [신규] 초기화
                if (onComplete) onComplete();
                return;
            }

            const sentence = sentences[currentSentenceIndex].trim();
            currentSentenceIndex++;

            if (!sentence) {
                playNextSentence();
                return;
            }

            // [신규] 현재 타이핑 중인 문장 저장 (끊겼을 때 캡처용)
            currentDisplayedSentence = sentence;

            $textBox.text(''); // 화면 비우기

            let charIndex = 0;
            typeWriterInterval = setInterval(() => {
                $textBox.text($textBox.text() + sentence.charAt(charIndex));
                charIndex++;

                // 한 문장 타이핑 완료
                if (charIndex >= sentence.length) {
                    clearInterval(typeWriterInterval);

                    // 읽는 시간 (글자수 * 40ms + 1초 기본)
                    // 문장이 짧으면 빨리, 길면 천천히
                    let readTime = 1000 + (sentence.length * 40);

                    // 다음 문장이 남았다면 -> 대기 후 다음 문장 재생
                    if (currentSentenceIndex < sentences.length) {
                         sentenceTimeout = setTimeout(() => {
                             playNextSentence();
                         }, readTime);
                    }
                    else {
                         // 마지막 문장이었다면 -> 잠시 여운을 주고 완료 처리
                         // [핵심] 여기서 1.5초 정도 기다렸다가 "다 끝났어"라고 알려줍니다.
                         setTimeout(() => {
                             isAISpeaking = false; // [신규] AI 발화 완료
                             currentDisplayedSentence = ''; // [신규] 초기화
                             if (onComplete) onComplete();
                         }, 1500);
                    }
                }
            }, 40); // 글자 속도
        }

        playNextSentence(); // 시작!
    }





    // [수정됨] status와 endedBy 인자를 받습니다.
    function endCall(status = null, endedBy = null) {
        // [신규] AI가 말하는 중에 유저가 끊었는지 체크
        const wasAISpeakingWhenHungUp = isAISpeaking && endedBy === 'user';
        const savedContact = currentCall?.contact;
        const savedUtterance = lastAIUtterance;
        // [신규] 현재 화면에 표시 중이던 문장 캡처
        const savedCurrentSentence = currentDisplayedSentence;

        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }

        // 타이핑 효과 중단
        if (typeWriterInterval) clearInterval(typeWriterInterval);
        if (sentenceTimeout) clearTimeout(sentenceTimeout);

        // [신규] AI 발화 상태 초기화
        isAISpeaking = false;
        lastAIUtterance = '';
        currentDisplayedSentence = ''; // [신규] 초기화

        if (currentCall) {
            const { contactId, contact, isOutgoing } = currentCall;

            // 유저 이름 가져오기
            let userName = 'User';
            if (window.SillyTavern && window.SillyTavern.getContext) {
                const ctx = window.SillyTavern.getContext();
                userName = ctx.name2 || 'User';
                if (ctx.chatId) {
                    try {
                        const cfg = JSON.parse(localStorage.getItem('st_phone_config_' + ctx.chatId) || '{}');
                        if (cfg.userName) userName = cfg.userName;
                    } catch(e) {}
                }
            }

            // [핵심 로직]
            let type;
            if (status === 'rejected') {
                type = 'rejected';
            } else {
                type = isOutgoing ? 'outgoing' : 'incoming';
            }

            loadHistory();
            callHistory.unshift({
                contactId,
                contactName: contact?.name || 'Unknown',
                contactAvatar: contact?.avatar || '',
                type: type,
                timestamp: Date.now(),
                duration: callDuration,
                log: [...currentLog]
            });
            if (callHistory.length > 50) callHistory = callHistory.slice(0, 50);
            saveHistory();

            // 로그 남기기 (누가 끊었는지 포함)
            if (status !== 'rejected') {
                if (endedBy === 'user') {
                    addHiddenLog('System', `[❌ Call Ended by ${userName}]`);
                } else if (endedBy === 'ai') {
                    addHiddenLog('System', `[❌ Call Ended by ${contact?.name || 'Character'}]`);
                } else {
                    addHiddenLog('System', `[❌ Call Ended]`);
                }
            }
        }

        callDuration = 0;
        currentCall = null;
        $('#st-calling-screen').remove();

        open();
        if (status === 'rejected') {
            toastr.error('통화가 거절되었습니다');
        } else {
            toastr.info('통화가 종료되었습니다');
        }

        // [신규] AI가 말하던 중에 유저가 끊었으면 -> 문자로 반응 보내기
        if (wasAISpeakingWhenHungUp && savedContact) {
            setTimeout(() => {
                generateHangUpTextReaction(savedContact, savedUtterance, savedCurrentSentence);
            }, 2000); // 2초 후 문자 반응
        }
    }


    // ========== [신규] 통화 중 끊김 반응 문자 생성 ==========
    async function generateHangUpTextReaction(contact, lastUtterance, currentSentence = '') {
        if (!contact) return;

        try {
            // 설정 가져오기
            const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
            const prefill = settings.prefill || '';
            const maxContextTokens = settings.maxContextTokens || 4096;

            // 유저 이름 가져오기
            let userName = 'User';
            const ctx = window.SillyTavern?.getContext?.();
            if (ctx) {
                userName = ctx.name2 || 'User';
                if (ctx.chatId) {
                    try {
                        const cfg = JSON.parse(localStorage.getItem('st_phone_config_' + ctx.chatId) || '{}');
                        if (cfg.userName) userName = cfg.userName;
                    } catch(e) {}
                }
            }

            // 끊긴 시점의 문장 설명 생성
            let hangUpDescription = '';
            if (currentSentence) {
                hangUpDescription = `[${userName} hung up the phone while ${contact.name} was saying: "${currentSentence}"]`;
            } else if (lastUtterance) {
                hangUpDescription = `[${userName} hung up the phone while ${contact.name} was in the middle of speaking: "${lastUtterance}"]`;
            } else {
                hangUpDescription = `[${userName} hung up the phone while ${contact.name} was speaking]`;
            }

            // [멀티턴 방식] 메시지 배열 구성
            const messages = [];

            // 1. 시스템 프롬프트
            const systemContent = `### Character Info
Name: ${contact.name}
Personality: ${contact.persona || '(not specified)'}

### User Info
Name: ${userName}
Personality: ${settings.userPersonality || '(not specified)'}

### Instructions
You are ${contact.name}. You just had a phone call with ${userName}, but ${userName} suddenly hung up on you mid-sentence.
Write a SHORT text message (SMS) reacting to being hung up on.
React naturally based on what you were saying when cut off. This could be confused, annoyed, worried, sad, hurt, or any other appropriate reaction based on the character's personality.
Keep it natural and in-character. 1-3 sentences max.
Do NOT include any brackets, tags, or meta-text. Just write the message content directly.
${prefill ? `Start your response with: ${prefill}` : ''}`;

            messages.push({ role: 'system', content: systemContent });

            // 2. 채팅 히스토리 (히든로그 포함)
            if (ctx && ctx.chat && ctx.chat.length > 0) {
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

            // 3. 끊긴 상황 설명 (유저 메시지로)
            messages.push({ role: 'user', content: hangUpDescription });

            // AI 응답 생성
            const response = await generateWithProfile(messages, 256);
            let replyText = String(response).trim();

            // 프리필 제거
            if (prefill && replyText.startsWith(prefill.trim())) {
                replyText = replyText.substring(prefill.trim().length).trim();
            }

            // 괄호나 태그 제거
            replyText = replyText.replace(/^\[.*?\]\s*/g, '').replace(/^"(.*)"$/, '$1').trim();

            if (!replyText || replyText.length < 2) {
                replyText = "...?";
            }

            // Messages 앱을 통해 문자 수신 처리
            const Messages = window.STPhone.Apps?.Messages;
            if (Messages && typeof Messages.receiveMessage === 'function') {
                // Messages 앱의 receiveMessage 함수 직접 사용
                await Messages.receiveMessage(contact.id, replyText);
                // 히든 로그도 추가
                addHiddenLog(contact.name, `[📩 ${contact.name} -> ${userName}]: ${replyText}`);
            } else {
                // fallback: 직접 저장 처리
                const messagesKey = getMessagesStorageKey(contact.id);
                if (messagesKey) {
                    try {
                        const msgs = JSON.parse(localStorage.getItem(messagesKey) || '[]');
                        msgs.push({
                            sender: 'them',
                            text: replyText,
                            timestamp: Date.now(),
                            image: null
                        });
                        localStorage.setItem(messagesKey, JSON.stringify(msgs));

                        // 히든 로그 추가
                        addHiddenLog(contact.name, `[📩 ${contact.name} -> ${userName}]: ${replyText}`);

                        // 알림 표시
                        if (typeof toastr !== 'undefined') {
                            toastr.info(`${contact.name}: ${replyText}`, '새 문자');
                        }
                    } catch (e) {
                        console.error('[Phone] 문자 저장 실패:', e);
                    }
                }
            }

            console.debug('[Phone] 통화 끊김 반응 문자 전송:', {
                contact: contact.name,
                currentSentence: currentSentence || '(없음)',
                reply: replyText
            });

        } catch (e) {
            console.error('[Phone] generateHangUpTextReaction 실패:', e);
        }
    }

    // 메시지 저장소 키 가져오기 헬퍼
    function getMessagesStorageKey(contactId) {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId) return null;
        return `st_phone_msgs_${context.chatId}_${contactId}`;
    }


    function getSlashCommandParser() {
        if (window.SlashCommandParser?.commands) return window.SlashCommandParser;
        const ctx = window.SillyTavern?.getContext?.();
        if (ctx?.SlashCommandParser?.commands) return ctx.SlashCommandParser;
        if (typeof SlashCommandParser !== 'undefined') return SlashCommandParser;
        return null;
    }
    // ========== [수정됨] 히든 로그 함수 (누락된 부분 복구) ==========
    function addHiddenLog(speaker, text) {
        if (!window.SillyTavern) return;
        const context = window.SillyTavern.getContext();

        if (!context || !context.chat) return;

        const newMessage = {
            name: speaker,
            is_user: false,
            is_system: false, // AI가 기억하도록 일반 메시지로 위장
            send_date: Date.now(),
            mes: text,
            extra: { is_phone_log: true }
        };

        context.chat.push(newMessage);

        if (window.SlashCommandParser && window.SlashCommandParser.commands['savechat']) {
            window.SlashCommandParser.commands['savechat'].callback({});
        } else if (typeof saveChatConditional === 'function') {
            saveChatConditional();
        }
    }

    // [신규 기능] 통화 녹음 내용 보여주는 화면
    function openLogViewer(index) {
        const h = callHistory[index];
        if (!h || !h.log || h.log.length === 0) {
            toastr.info("이 통화의 대화 내용이 없습니다.");
            return;
        }

        const isExcluded = h.excludeFromContext === true;
        const date = new Date(h.timestamp);
        const dateStr = `${date.getFullYear()}.${date.getMonth()+1}.${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

        let logHtml = '';
        h.log.forEach(line => {
            const color = line.sender === '나' ? '#007aff' : 'var(--pt-text-color)';
            const align = line.sender === '나' ? 'right' : 'left';
            const bg = line.sender === '나' ? 'rgba(0,122,255,0.1)' : 'var(--pt-border, #eee)';

            logHtml += `
                <div style="margin-bottom:12px; text-align:${align};">
                    <div style="font-size:12px; color:#888; margin-bottom:4px;">${line.sender}</div>
                    <div style="display:inline-block; padding:8px 12px; border-radius:12px; background:${bg}; color:${color}; font-size:14px; text-align:left;">
                        ${line.text}
                    </div>
                </div>
            `;
        });

        const viewerHtml = `
            <div id="st-log-viewer" style="position:absolute; top:0; left:0; width:100%; height:100%; background:var(--pt-bg-color, #1c1c1e); z-index:2000; display:flex; flex-direction:column;">
                <div style="padding:15px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; align-items:center;">
                    <button id="st-log-close" style="background:none; border:none; color:var(--pt-accent, #007aff); font-size:16px; cursor:pointer;">‹ 닫기</button>
                    <div style="flex:1; text-align:center; font-weight:bold; margin-right:40px;">통화 내용</div>
                </div>
                <!-- [NEW] 콘텍스트 미반영 토글 -->
                <div style="padding:12px 15px; border-bottom:1px solid var(--pt-border, #333); display:flex; align-items:center; justify-content:space-between; background:var(--pt-card-bg, #2c2c2e);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-brain" style="color:var(--pt-sub-text, #86868b);"></i>
                        <span style="font-size:14px; color:var(--pt-text-color);">AI 컨텍스트 반영</span>
                        ${isExcluded ? '<span class="st-msg-no-context">미반영</span>' : ''}
                    </div>
                    <button id="st-log-toggle-context" style="
                        padding:8px 16px; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;
                        background:${isExcluded ? '#ff9500' : 'var(--pt-accent, #007aff)'}; color:white;
                    ">${isExcluded ? '반영하기' : '미반영으로'}</button>
                </div>
                <div style="flex:1; overflow-y:auto; padding:15px; color:var(--pt-text-color);">
                    <div style="text-align:center; color:#666; font-size:12px; margin-bottom:20px;">
                        ${dateStr} <br> ${h.contactName}님과의 통화
                    </div>
                    ${logHtml}
                </div>
            </div>
        `;

        $('.st-phone-app').append(viewerHtml);

        $('#st-log-close').on('click', function() {
            $('#st-log-viewer').remove();
        });

        $('#st-log-toggle-context').on('click', function() {
            toggleCallContext(index);
        });
    }

    // ========== 통화 기록 콘텍스트 미반영 토글 ==========
    function toggleCallContext(index) {
        loadHistory();
        if (index < 0 || index >= callHistory.length) return;

        const h = callHistory[index];
        const wasExcluded = h.excludeFromContext === true;
        h.excludeFromContext = !wasExcluded;
        saveHistory();

        if (h.excludeFromContext) {
            toastr.info('🚫 이 통화 기록은 AI 컨텍스트에 반영되지 않습니다');
        } else {
            toastr.success('✅ 이 통화 기록이 AI 컨텍스트에 반영됩니다');
        }

        // 뷰어 새로고침
        $('#st-log-viewer').remove();
        openLogViewer(index);
    }
    async function injectAiCallLogic() {
        const parser = getSlashCommandParser();
        if (!parser?.commands) return;

        const ctx = window.SillyTavern?.getContext?.();
        const charName = ctx?.characters?.[ctx?.characterId]?.name;

        if (charName) {
            const contacts = window.STPhone.Apps?.Contacts?.getAllContacts?.() || [];
            const contact = contacts.find(c => c.name === charName);

            if (contact?.disableProactiveCall) {
                if (parser.commands['eject']) {
                    try {
                        await parser.commands['eject'].callback({}, 'st_phone_auto_call_logic');
                    } catch (e) {}
                }
                return;
            }
        }

        if (!parser.commands['inject']) return;

        const promptText = `
[Phone Logic]
If you want to initiate a voice call with User, append [call to user] at the very end of your response.
NEVER decide the User's reaction or whether they pick up. Just generate the tag and stop.
Wait for the system to process the call.`;

        try {
            await parser.commands['inject'].callback({
                id: 'st_phone_auto_call_logic',
                position: 'chat',
                depth: 2,
                role: 'system'
            }, promptText);
        } catch (e) {}
    }

    function startIncomingCallObserver() {
        const chatRoot = document.getElementById('chat');
        if (!chatRoot) {
            setTimeout(startIncomingCallObserver, 2000);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList.contains('mes')) {
                        checkMessageForCallTag(node);
                    }
                });
                if (mutation.type === 'characterData' || mutation.type === 'childList') {
                    const target = mutation.target.parentElement?.closest('.mes');
                    if (target) checkMessageForCallTag(target);
                }
            });
        });

        observer.observe(chatRoot, { childList: true, subtree: true });
        setInterval(injectAiCallLogic, 5000);
    }

    function checkMessageForCallTag(msgNode) {
        if (msgNode.dataset.callChecked) return;
        if (msgNode.getAttribute('is_user') === 'true') return;
        if (!msgNode.classList.contains('last_mes')) return;

        const textDiv = msgNode.querySelector('.mes_text');
        if (!textDiv) return;

        const html = textDiv.innerHTML;

        if (html.toLowerCase().includes('[call to user]')) {
            msgNode.dataset.callChecked = "true";

            textDiv.innerHTML = html.replace(/\[call to user\]/gi, '').trim();
            const charName = msgNode.getAttribute('ch_name') || "Unknown";
            triggerIncomingCallByName(charName);
        }
    }

    function triggerIncomingCallByName(name) {
        const contacts = window.STPhone.Apps.Contacts.getAllContacts();
        let contact = contacts.find(c => c.name === name);

        if (!contact) {
            let avatar = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';
            const ctx = window.SillyTavern?.getContext?.();
            if (ctx?.characters && ctx.characterId !== undefined) {
                const charData = ctx.characters[ctx.characterId];
                if (charData?.name === name && charData.avatar) {
                    avatar = charData.avatar;
                    if (!avatar.startsWith('http') && !avatar.startsWith('data')) {
                        avatar = '/characters/' + avatar;
                    }
                }
            }

            contact = {
                id: 'temp_' + Date.now(),
                name: name,
                avatar: avatar,
                persona: "",
                tags: "",
                isTemp: true
            };
        }

        if (contact.disableProactiveCall) return;

        receiveCall(contact);
    }

    $(document).ready(function() {
        setTimeout(startIncomingCallObserver, 3000);
    });

    return { open, makeCall, receiveCall, endCall };
})();

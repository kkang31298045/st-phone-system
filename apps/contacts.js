window.STPhone = window.STPhone || {};
window.STPhone.Apps = window.STPhone.Apps || {};

window.STPhone.Apps.Contacts = (function() {
    'use strict';

    const css = `
        <style>
            .st-contacts-app {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%; z-index: 999;
                display: flex; flex-direction: column;
                background: var(--pt-bg-color, #f5f5f7);
                color: var(--pt-text-color, #000);
                font-family: var(--pt-font, -apple-system, sans-serif);
            }
            .st-contacts-header {
                padding: 20px 20px 15px;
                font-size: 28px;
                font-weight: 700;
                flex-shrink: 0;
            }
            .st-contacts-search {
                margin: 0 20px 12px;
                padding: 12px 16px;
                border-radius: 10px;
                border: none;
                background: var(--pt-card-bg, #fff);
                color: var(--pt-text-color, #000);
                font-size: 14px;
                outline: none;
            }
            .st-contacts-list {
                flex: 1;
                overflow-y: auto;
                padding: 0 20px 80px;
            }
            .st-contact-item {
                display: flex;
                align-items: center;
                padding: 14px 0;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
                cursor: pointer;
            }
            .st-contact-avatar {
                width: 45px; height: 45px;
                border-radius: 50%;
                background: #ddd;
                object-fit: cover;
                margin-right: 12px;
            }
            .st-contact-info { flex: 1; min-width: 0; }
            .st-contact-name {
                font-size: 16px;
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .st-contact-preview {
                font-size: 13px;
                color: var(--pt-sub-text, #86868b);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .st-contact-actions { display: flex; gap: 8px; }
            .st-contact-action-btn {
                width: 32px; height: 32px;
                border-radius: 50%;
                border: none;
                color: white;
                font-size: 14px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .st-contact-action-btn.msg { background: #34c759; }
            .st-contact-action-btn.call { background: #007aff; }
            .st-contacts-fab {
                position: absolute;

                /* [수정됨] 바닥에서 훨씬 높이 띄움 (85px) */
                bottom: calc(85px + env(safe-area-inset-bottom, 20px));

                right: 20px;
                /* ... 나머지 코드는 그대로 두기 ... */

                width: 56px; height: 56px;
                border-radius: 50%;
                /* ... (나머지 코드는 그대로 둬도 됨) ... */
                background: var(--pt-accent, #007aff);
                color: white;
                border: none;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            }

            .st-contacts-empty {
                text-align: center;
                padding: 60px 20px;
                color: var(--pt-sub-text, #86868b);
            }
            .st-contact-edit {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%;
                background: var(--pt-bg-color, #f5f5f7);
                display: flex; flex-direction: column;
                z-index: 1001;
            }
            .st-contact-edit-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
            }
            .st-contact-edit-btn {
                background: none;
                border: none;
                color: var(--pt-accent, #007aff);
                font-size: 16px;
                cursor: pointer;
            }
            .st-contact-edit-btn.delete { color: #ff3b30; }
            .st-contact-edit-content {
                flex: 1;
                overflow-y: auto;

                /* [수정됨] 아래쪽 여백을 100px로 확 늘려서 홈 바와 겹치지 않게 함 */
                padding: 20px 15px calc(100px + env(safe-area-inset-bottom)) 15px;
            }

            .st-contact-edit-avatar-wrap {
                text-align: center;
                margin-bottom: 25px;
            }
            .st-contact-edit-avatar {
                width: 100px; height: 100px;
                border-radius: 50%;
                background: #ddd;
                object-fit: cover;
                cursor: pointer;
            }
            .st-contact-edit-avatar-label {
                display: block;
                margin-top: 8px;
                color: var(--pt-accent, #007aff);
                font-size: 14px;
                cursor: pointer;
            }
            .st-contact-edit-group {
                background: var(--pt-card-bg, #fff);
                border-radius: 12px;
                margin-bottom: 20px;
                overflow: hidden;
            }
            .st-contact-edit-row {
                padding: 12px 15px;
                border-bottom: 1px solid var(--pt-border, #e5e5e5);
            }
            .st-contact-edit-row:last-child { border-bottom: none; }
            .st-contact-edit-label {
                font-size: 12px;
                color: var(--pt-sub-text, #86868b);
                margin-bottom: 5px;
            }
            .st-contact-edit-input {
                width: 100%;
                border: none;
                background: transparent;
                color: var(--pt-text-color, #000);
                font-size: 16px;
                outline: none;
            }
            .st-contact-edit-textarea {
                width: 100%;
                border: 1px solid var(--pt-border, #e5e5e5);
                background: var(--pt-card-bg, #f5f5f7);
                color: var(--pt-text-color, #000);
                font-size: 14px;
                line-height: 1.5;
                outline: none;
                resize: vertical;
                min-height: 80px;
                border-radius: 12px;
                padding: 14px 16px;
                box-sizing: border-box;
            }
            /* 체크박스 옵션 스타일 */
            .st-contact-checkbox-option {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 16px 20px;
            }
            .st-contact-checkbox-option input[type="checkbox"] {
                width: 18px;
                height: 18px;
                margin: 0;
                margin-top: 2px;
                accent-color: var(--pt-accent, #007aff);
                cursor: pointer;
                flex-shrink: 0;
            }
            .st-contact-checkbox-content {
                flex: 1;
            }
            .st-contact-checkbox-title {
                font-size: 14px;
                font-weight: 500;
                color: var(--pt-text-color, #1d1d1f);
                margin-bottom: 4px;
            }
            .st-contact-checkbox-desc {
                font-size: 12px;
                color: var(--pt-sub-text, #86868b);
                line-height: 1.4;
            }
        </style>
    `;

    let contacts = [];
    const DEFAULT_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';
    
    // 특수 ID: 봇을 위한 고정 ID (유저는 설정의 프로필에서 관리)
    const BOT_CONTACT_ID = '__st_char__';

    function getStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId) return null;
        return 'st_phone_contacts_' + context.chatId;
    }

    // SillyTavern 매크로를 해석하는 함수
    async function resolveMacro(text) {
        if (!text) return '';
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx?.substituteParams) return text;
        try {
            return await ctx.substituteParams(text);
        } catch (e) {
            return text;
        }
    }

    // 캐릭터(봇) 정보 가져오기
    async function getCharacterInfo() {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return null;
        
        try {
            const name = await resolveMacro('{{char}}');
            const description = await resolveMacro('{{description}}');
            
            // 아바타 가져오기
            let avatar = '';
            if (ctx.characters && ctx.characterId !== undefined) {
                const char = ctx.characters[ctx.characterId];
                if (char?.avatar) {
                    avatar = `/characters/${char.avatar}`;
                }
            }
            
            return { name, description, avatar };
        } catch (e) {
            console.error('[Contacts] 캐릭터 정보 가져오기 실패:', e);
            return null;
        }
    }

    // 유저(페르소나) 정보 가져오기
    async function getUserInfo() {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return null;
        
        try {
            const name = await resolveMacro('{{user}}');
            const persona = await resolveMacro('{{persona}}');
            
            // 유저 아바타 가져오기
            let avatar = '';
            if (ctx.user_avatar) {
                avatar = `/User Avatars/${ctx.user_avatar}`;
            }
            
            return { name, persona, avatar };
        } catch (e) {
            console.error('[Contacts] 유저 정보 가져오기 실패:', e);
            return null;
        }
    }

    // 봇 연락처 자동 생성/업데이트
    async function syncBotContact() {
        const charInfo = await getCharacterInfo();
        if (!charInfo || !charInfo.name) return null;

        loadContacts();
        let botContact = contacts.find(c => c.id === BOT_CONTACT_ID);

        // [NEW] 캐릭터별로 저장된 외모 태그 불러오기
        const savedBotTags = loadBotTagsForCharacter();

        if (!botContact) {
            // 새로 생성 - 캐릭터별 저장된 태그가 있으면 복원
            botContact = {
                id: BOT_CONTACT_ID,
                name: charInfo.name,
                avatar: charInfo.avatar || '',
                persona: charInfo.description || '',
                tags: savedBotTags || '',  // [FIX] 캐릭터별 저장된 태그 복원
                isAutoSync: true,
                createdAt: Date.now()
            };
            contacts.unshift(botContact); // 맨 앞에 추가
            saveContacts();
            console.log('[Contacts] 봇 연락처 자동 생성:', charInfo.name, savedBotTags ? '(태그 복원됨)' : '');
        } else {
            // 업데이트 (이름, 아바타, 설명 동기화)
            let updated = false;
            if (botContact.isAutoSync !== false) {
                if (botContact.name !== charInfo.name) {
                    botContact.name = charInfo.name;
                    updated = true;
                }
                if (charInfo.avatar && botContact.avatar !== charInfo.avatar) {
                    botContact.avatar = charInfo.avatar;
                    updated = true;
                }
                if (charInfo.description && botContact.persona !== charInfo.description) {
                    botContact.persona = charInfo.description;
                    updated = true;
                }
                // [NEW] 태그가 비어있고 캐릭터별 저장된 태그가 있으면 복원
                if (!botContact.tags && savedBotTags) {
                    botContact.tags = savedBotTags;
                    updated = true;
                    console.log('[Contacts] 봇 외모 태그 복원:', savedBotTags);
                }
                if (updated) {
                    saveContacts();
                    console.log('[Contacts] 봇 연락처 업데이트:', charInfo.name);
                }
            }
        }
        return botContact;
    }

    // 페르소나에서 외모 태그 추출 (간단한 휴리스틱)
    function extractAppearanceTags(persona) {
        if (!persona) return '';

        // 외모 관련 키워드 패턴
        const appearancePatterns = [
            /appearance:\s*([^\n]+)/i,
            /looks:\s*([^\n]+)/i,
            /외모:\s*([^\n]+)/i,
            /생김새:\s*([^\n]+)/i,
            /physical:\s*([^\n]+)/i,
            /features:\s*([^\n]+)/i
        ];

        // 각 패턴을 시도
        for (const pattern of appearancePatterns) {
            const match = persona.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        // 패턴이 없으면 전체 페르소나를 간단히 처리 (첫 50자만)
        const lines = persona.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
            // 첫 몇 줄에서 외모 관련 단어가 있는지 확인
            for (const line of lines.slice(0, 3)) {
                if (line.match(/hair|eye|height|skin|build|tall|short|slim|muscular/i) ||
                    line.match(/머리|눈|키|피부|체격/)) {
                    return line.substring(0, 100).trim();
                }
            }
        }

        return '';
    }

    // 설정에서 유저 프로필 정보를 SillyTavern과 동기화
    async function syncUserProfileToSettings() {
        const userInfo = await getUserInfo();
        if (!userInfo || !userInfo.name) return;

        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};

        // profileAutoSync가 활성화되어 있는 경우에만 자동 동기화
        if (settings.profileAutoSync === false) {
            console.log('[Contacts] 프로필 자동 동기화 비활성화됨');
            return;
        }

        let updated = false;

        // 설정의 프로필이 비어있으면 SillyTavern 정보로 채우기
        if (!settings.userName || settings.userName === 'User') {
            window.STPhone.Apps?.Settings?.updateSetting?.('userName', userInfo.name);
            updated = true;
        }
        if (!settings.userPersonality && userInfo.persona) {
            window.STPhone.Apps?.Settings?.updateSetting?.('userPersonality', userInfo.persona);
            updated = true;
        }
        if (!settings.userAvatar && userInfo.avatar) {
            window.STPhone.Apps?.Settings?.updateSetting?.('userAvatar', userInfo.avatar);
            updated = true;
        }

        // [NEW] 외모 태그 자동 추출 및 동기화
        if (!settings.userTags && userInfo.persona) {
            const extractedTags = extractAppearanceTags(userInfo.persona);
            if (extractedTags) {
                window.STPhone.Apps?.Settings?.updateSetting?.('userTags', extractedTags);
                updated = true;
                console.log('[Contacts] 외모 태그 자동 추출됨:', extractedTags);
            }
        }

        if (updated) {
            console.log('[Contacts] 설정 프로필에 유저 정보 동기화됨');
        }
    }

    // 모든 자동 연락처 동기화 (봇만)
    async function syncAutoContacts() {
        await syncBotContact();
        // 유저 정보는 설정 프로필에 동기화
        await syncUserProfileToSettings();
    }

    // [NEW] 캐릭터 ID 기반 키 (다른 채팅방에서도 같은 캐릭터면 공유)
    function getCharacterStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.characterId && !context?.characters) return null;
        // 캐릭터 ID 또는 이름을 기반으로 키 생성
        const charId = context.characterId !== undefined ? context.characterId : 'unknown';
        return 'st_phone_contacts_char_' + charId;
    }

    // [NEW] 봇 외모 태그 캐릭터별 저장 키
    function getBotTagsStorageKey() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.characterId && !context?.characters) return null;
        const charId = context.characterId !== undefined ? context.characterId : 'unknown';
        return 'st_phone_bot_tags_' + charId;
    }

    // [NEW] 봇 외모 태그 캐릭터별로 저장
    function saveBotTagsForCharacter(tags) {
        const key = getBotTagsStorageKey();
        if (!key) return;
        try {
            localStorage.setItem(key, tags || '');
            console.log('[Contacts] 봇 외모 태그 캐릭터별 저장:', tags);
        } catch (e) {
            console.error('[Contacts] 봇 태그 저장 실패:', e);
        }
    }

    // [NEW] 봇 외모 태그 캐릭터별로 로드
    function loadBotTagsForCharacter() {
        const key = getBotTagsStorageKey();
        if (!key) return '';
        try {
            return localStorage.getItem(key) || '';
        } catch (e) {
            return '';
        }
    }

    // [NEW] 캐릭터별로 연락처 저장
    function saveContactForCharacter(contactData) {
        const key = getCharacterStorageKey();
        if (!key) return;
        
        try {
            let charContacts = JSON.parse(localStorage.getItem(key) || '[]');
            // 같은 이름 있으면 업데이트, 없으면 추가
            const existingIndex = charContacts.findIndex(c => c.name === contactData.name);
            if (existingIndex >= 0) {
                charContacts[existingIndex] = { ...charContacts[existingIndex], ...contactData };
            } else {
                charContacts.push({ ...contactData, id: 'char_' + Date.now() });
            }
            localStorage.setItem(key, JSON.stringify(charContacts));
        } catch (e) { console.error('[Contacts] 캐릭터별 저장 실패:', e); }
    }

    // [NEW] 캐릭터별 저장된 연락처 로드
    function loadContactsForCharacter() {
        const key = getCharacterStorageKey();
        if (!key) return [];
        
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) { return []; }
    }

    function deleteContactForCharacterByName(name) {
        const key = getCharacterStorageKey();
        if (!key || !name) return false;

        try {
            const charContacts = JSON.parse(localStorage.getItem(key) || '[]');
            const next = charContacts.filter(c => (c?.name || '').toLowerCase() !== String(name).toLowerCase());
            if (next.length === charContacts.length) return false;
            localStorage.setItem(key, JSON.stringify(next));
            return true;
        } catch (e) {
            console.error('[Contacts] 캐릭터별 삭제 실패:', e);
            return false;
        }
    }

    function loadContacts() {
        const key = getStorageKey();
        if (!key) { contacts = []; return; }
        try {
            contacts = JSON.parse(localStorage.getItem(key) || '[]');
            
            // [NEW] 캐릭터별로 저장된 연락처가 있으면 병합
            const charContacts = loadContactsForCharacter();
            charContacts.forEach(charContact => {
                // 같은 이름의 연락처가 현재 채팅에 없으면 추가
                const exists = contacts.some(c => c.name === charContact.name);
                if (!exists && charContact.persistForChar) {
                    contacts.push({
                        ...charContact,
                        id: generateId() // 새 ID 부여
                    });
                }
            });
            
            // 병합 후 저장
            if (charContacts.length > 0) {
                saveContacts();
            }
        } catch (e) { contacts = []; }
    }

    function saveContacts() {
        const key = getStorageKey();
        if (!key) return;
        localStorage.setItem(key, JSON.stringify(contacts));
    }

    function generateId() {
        return 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    function getContact(id) {
        loadContacts();
        return contacts.find(c => c.id === id);
    }

    function getAllContacts() {
        loadContacts();
        return [...contacts];
    }

    function addContact(data) {
        loadContacts();
        const c = {
            id: generateId(),
            name: data.name || '새 연락처',
            avatar: data.avatar || '',
            persona: data.persona || '',
            tags: data.tags || '',
            persistForChar: data.persistForChar || false,  // [NEW]
            createdAt: Date.now()
        };
        contacts.push(c);
        saveContacts();
        return c;
    }

    function updateContact(id, data) {
        loadContacts();
        const i = contacts.findIndex(c => c.id === id);
        if (i >= 0) {
            contacts[i] = { ...contacts[i], ...data };
            saveContacts();

            // [NEW] 봇 연락처의 태그가 수정되면 캐릭터별로 저장
            if (id === BOT_CONTACT_ID && data.tags !== undefined) {
                saveBotTagsForCharacter(data.tags);
            }

            return contacts[i];
        }
        return null;
    }

    function deleteContactById(id) {
        loadContacts();
        const i = contacts.findIndex(c => c.id === id);
        if (i >= 0) {
            const deletedContact = contacts[i];
            contacts.splice(i, 1);
            saveContacts();

            if (deletedContact?.persistForChar) {
                deleteContactForCharacterByName(deletedContact.name);
            }
            return true;
        }
        return false;
    }

    async function open() {
        // 먼저 봇 연락처 자동 동기화
        await syncAutoContacts();
        
        loadContacts();
        
        // 기존 유저 연락처(__st_user__) 자동 정리
        const userContactIndex = contacts.findIndex(c => c.id === '__st_user__');
        if (userContactIndex >= 0) {
            contacts.splice(userContactIndex, 1);
            saveContacts();
            console.log('[Contacts] 기존 유저 연락처 정리됨');
        }
        
        const $screen = window.STPhone.UI.getContentElement();
        if (!$screen?.length) return;
        $screen.empty();

        let listHtml = '';
        if (contacts.length === 0) {
            listHtml = `<div class="st-contacts-empty"><div style="font-size:36px;opacity:0.4;margin-bottom:15px;"><i class="fa-regular fa-address-book"></i></div><div>연락처가 없습니다</div></div>`;
        } else {
            contacts.forEach(c => {
                // 자동 동기화 연락처 표시 (봇만 해당)
                const isAutoContact = c.id === BOT_CONTACT_ID;
                const syncBadge = isAutoContact ? '<span style="font-size:10px;font-weight:600;background:#1d1d1f;color:white;padding:2px 6px;border-radius:8px;margin-left:6px;">자동</span>' : '';
                
                listHtml += `
                    <div class="st-contact-item" data-id="${c.id}">
                        <img class="st-contact-avatar" src="${c.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                        <div class="st-contact-info">
                            <div class="st-contact-name">${c.name}${syncBadge}</div>
                            <div class="st-contact-preview">${c.persona?.substring(0, 30) || ''}</div>
                        </div>
                        <div class="st-contact-actions">
                            <button class="st-contact-action-btn msg" data-action="msg" data-id="${c.id}"><i class="fa-regular fa-comment"></i></button>
                            <button class="st-contact-action-btn call" data-action="call" data-id="${c.id}"><i class="fa-solid fa-phone"></i></button>
                        </div>
                    </div>`;
            });
        }

        $screen.append(`
            ${css}
            <div class="st-contacts-app">
                <div class="st-contacts-header">연락처</div>
                <input class="st-contacts-search" id="st-contacts-search" placeholder="검색">
                <div class="st-contacts-list">${listHtml}</div>
                <button class="st-contacts-fab" id="st-contacts-add"><i class="fa-solid fa-plus"></i></button>
            </div>
        `);

        $('.st-contact-item').on('click', function(e) {
            if ($(e.target).closest('.st-contact-action-btn').length) return;
            openEdit($(this).data('id'));
        });
        $('.st-contact-action-btn[data-action="msg"]').on('click', function(e) {
            e.stopPropagation();
            window.STPhone.Apps?.Messages?.openChat($(this).data('id'));
        });
        $('.st-contact-action-btn[data-action="call"]').on('click', function(e) {
            e.stopPropagation();
            window.STPhone.Apps?.Phone?.makeCall($(this).data('id'));
        });
        $('#st-contacts-add').on('click', () => openEdit(null));
        $('#st-contacts-search').on('input', function() {
            const q = $(this).val().toLowerCase();
            $('.st-contact-item').each(function() {
                $(this).toggle($(this).find('.st-contact-name').text().toLowerCase().includes(q));
            });
        });
    }

    function openEdit(id) {
        const c = id ? getContact(id) : null;
        const isAutoContact = c && c.id === BOT_CONTACT_ID;
        const autoSyncEnabled = c?.isAutoSync !== false;
        
        // 자동 동기화 연락처용 안내 메시지 (봇만 해당)
        const autoSyncNotice = isAutoContact ? `
            <div class="st-contact-edit-group">
                <div class="st-contact-checkbox-option">
                    <input type="checkbox" id="st-edit-autosync" ${autoSyncEnabled ? 'checked' : ''}>
                    <div class="st-contact-checkbox-content">
                        <div class="st-contact-checkbox-title">자동 동기화</div>
                        <div class="st-contact-checkbox-desc">SillyTavern 캐릭터와 자동으로 연동합니다.</div>
                    </div>
                </div>
            </div>
        ` : '';
        
        const html = `
            <div class="st-contact-edit" id="st-contact-edit">
                <div class="st-contact-edit-header">
                    <button class="st-contact-edit-btn" id="st-edit-cancel">취소</button>
                    <span style="font-weight:600;">${c ? '편집' : '새 연락처'}${isAutoContact ? ' (자동)' : ''}</span>
                    <button class="st-contact-edit-btn delete" id="st-edit-delete" style="visibility:${c && !isAutoContact ? 'visible' : 'hidden'}">삭제</button>
                </div>
                <div class="st-contact-edit-content">
                    ${autoSyncNotice}
                    <div class="st-contact-edit-avatar-wrap">
                        <img class="st-contact-edit-avatar" id="st-edit-avatar" src="${c?.avatar || DEFAULT_AVATAR}" onerror="this.src='${DEFAULT_AVATAR}'">
                        <label class="st-contact-edit-avatar-label" for="st-edit-avatar-file">사진 변경</label>
                        <input type="file" id="st-edit-avatar-file" accept="image/*" style="display:none;">
                    </div>
                    <div class="st-contact-edit-group">
                        <div class="st-contact-edit-row">
                            <div class="st-contact-edit-label">이름${isAutoContact && autoSyncEnabled ? ' (자동 동기화)' : ''}</div>
                            <input class="st-contact-edit-input" id="st-edit-name" value="${c?.name || ''}" placeholder="이름" ${isAutoContact && autoSyncEnabled ? 'readonly style="opacity:0.7"' : ''}>
                        </div>
                    </div>
                    <div class="st-contact-edit-group">
                        <div class="st-contact-edit-row">
                            <div class="st-contact-edit-label">성격 (AI 응답용)</div>
                            <textarea class="st-contact-edit-textarea" id="st-edit-persona" placeholder="예: 친절하고 유머러스...">${c?.persona || ''}</textarea>
                        </div>
                    </div>
                    <div class="st-contact-edit-group">
                        <div class="st-contact-edit-row">
                            <div class="st-contact-edit-label">외모 태그 (이미지 생성용)</div>
                            <textarea class="st-contact-edit-textarea" id="st-edit-tags" placeholder="예: 1girl, long hair...">${c?.tags || ''}</textarea>
                        </div>
                    </div>
                    <!-- [NEW] 캐릭터별 연락처 저장 체크박스 -->
                    <div class="st-contact-edit-group">
                        <div class="st-contact-checkbox-option">
                            <input type="checkbox" id="st-edit-persist" ${c?.persistForChar ? 'checked' : ''}>
                            <div class="st-contact-checkbox-content">
                                <div class="st-contact-checkbox-title">새 채팅에도 유지</div>
                                <div class="st-contact-checkbox-desc">같은 캐릭터의 새 채팅방에서도 이 연락처를 유지합니다.</div>
                            </div>
                        </div>
                    </div>
                    <!-- [NEW] 선제 기능 비활성화 체크박스 -->
                    <div class="st-contact-edit-group">
                        <div class="st-contact-checkbox-option">
                            <input type="checkbox" id="st-edit-disable-proactive-msg" ${c?.disableProactiveMessage ? 'checked' : ''}>
                            <div class="st-contact-checkbox-content">
                                <div class="st-contact-checkbox-title">선제 메시지 비활성화</div>
                                <div class="st-contact-checkbox-desc">이 연락처에서 먼저 문자를 보내지 않습니다.</div>
                            </div>
                        </div>
                        <div class="st-contact-checkbox-option" style="border-top: 1px solid var(--pt-border, #e5e5e5);">
                            <input type="checkbox" id="st-edit-disable-proactive-call" ${c?.disableProactiveCall ? 'checked' : ''}>
                            <div class="st-contact-checkbox-content">
                                <div class="st-contact-checkbox-title">선제 전화 비활성화</div>
                                <div class="st-contact-checkbox-desc">이 연락처에서 먼저 전화를 걸지 않습니다.</div>
                            </div>
                        </div>
                    </div>
                    <button id="st-edit-save" style="width:100%;padding:15px;border:none;border-radius:12px;background:var(--pt-accent,#007aff);color:white;font-size:16px;cursor:pointer;">저장</button>                </div>
            </div>`;
        $('.st-contacts-app').append(html);

        $('#st-edit-cancel').on('click', () => $('#st-contact-edit').remove());
        $('#st-edit-delete').on('click', async () => {
            if (c && confirm('삭제하시겠습니까?')) {
                const deleted = deleteContactById(c.id);
                $('#st-contact-edit').remove();
                if (deleted) {
                    toastr.success('연락처가 삭제되었습니다');
                }
                await open();
            }
        });
$('#st-edit-avatar-file').on('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // 이미지 리사이징 (최대 200x200, 용량 줄이기)
            const reader = new FileReader();
            reader.onload = function(ev) {
                const img = new Image();
                img.onload = function() {
                    // 캔버스로 리사이징
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 200;
                    let width = img.width;
                    let height = img.height;
                    
                    // 비율 유지하며 축소
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height = Math.round(height * MAX_SIZE / width);
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width = Math.round(width * MAX_SIZE / height);
                            height = MAX_SIZE;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 압축된 이미지로 변환 (JPEG, 품질 80%)
                    const compressedUrl = canvas.toDataURL('image/jpeg', 0.8);
                    $('#st-edit-avatar').attr('src', compressedUrl);
                    toastr.success('사진이 변경되었습니다');
                };
                img.onerror = function() {
                    toastr.error('이미지를 불러올 수 없습니다');
                };
                img.src = ev.target.result;
            };
            reader.onerror = function() {
                toastr.error('파일을 읽을 수 없습니다');
            };
            reader.readAsDataURL(file);
        });
        $('#st-edit-save').on('click', () => {
            const name = $('#st-edit-name').val().trim();
            if (!name) { toastr.warning('이름을 입력하세요'); return; }
            const persistForChar = $('#st-edit-persist').is(':checked');
            const isAutoSync = $('#st-edit-autosync').length ? $('#st-edit-autosync').is(':checked') : undefined;
            const disableProactiveMessage = $('#st-edit-disable-proactive-msg').is(':checked');
            const disableProactiveCall = $('#st-edit-disable-proactive-call').is(':checked');

            const data = {
                name,
                avatar: $('#st-edit-avatar').attr('src'),
                persona: $('#st-edit-persona').val().trim(),
                tags: $('#st-edit-tags').val().trim(),
                persistForChar: persistForChar,  // [NEW] 캐릭터별 유지 여부
                disableProactiveMessage: disableProactiveMessage,  // [NEW] 선제 메시지 비활성화
                disableProactiveCall: disableProactiveCall  // [NEW] 선제 전화 비활성화
            };
            
            // 자동 동기화 연락처의 경우 isAutoSync 옵션 저장
            if (isAutoSync !== undefined) {
                data.isAutoSync = isAutoSync;
            }
            
            if (c) updateContact(c.id, data);
            else addContact(data);
            
            // [NEW] 캐릭터별 유지 체크되어 있으면 캐릭터 전용 저장소에도 저장
            if (persistForChar) {
                saveContactForCharacter(data);
            }
            $('#st-contact-edit').remove();
            open();
            toastr.success('저장되었습니다');
        });
        
        // 자동 동기화 토글 시 이름 필드 활성화/비활성화
        $('#st-edit-autosync').on('change', function() {
            const enabled = $(this).is(':checked');
            if (enabled) {
                $('#st-edit-name').attr('readonly', true).css('opacity', '0.7');
            } else {
                $('#st-edit-name').removeAttr('readonly').css('opacity', '1');
            }
        });
    }

    // 봇 연락처 ID 가져오기 (외부에서 사용)
    function getBotContactId() {
        return BOT_CONTACT_ID;
    }

    return { 
        open, 
        getContact, 
        getAllContacts, 
        addContact, 
        updateContact, 
        deleteContact: deleteContactById, 
        loadContacts,
        syncAutoContacts,
        getBotContactId
    };
})();

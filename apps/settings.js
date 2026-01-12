window.STPhone = window.STPhone || {};
window.STPhone.Apps = window.STPhone.Apps || {};

window.STPhone.Apps.Settings = (function() {
    'use strict';

/* 수정 후 코드 (이렇게 maxContextTokens를 끼워넣어라) */
const defaultSettings = {
        maxContextTokens: 4096,
        connectionProfileId: '',

        interruptEnabled: true,
        interruptCount: 3,
        interruptDelay: 2000,

        isDarkMode: false,
        wallpaper: 'linear-gradient(135deg, #1e1e2f, #2a2a40)',
        fontFamily: 'default',

        // [사용자 프로필]
        userName: 'User',
        userPersonality: '',
        userTags: '',
        userAvatar: '',  // 유저 아바타 URL
        profileAutoSync: true,  // SillyTavern 페르소나와 자동 동기화
        profileGlobal: false,  // [NEW] 프로필 전역 저장 여부

        // [AI 동작 설정]
        chatToSms: true,
        prefill: '알겠습니다. 현재 캐릭터들이 문자중임을 인지하고 ""사용과 소설 작성을 지양하겠습니다. 또한 캐릭터의 성격과 말투에 맞게 답변을 작성하고, [📩 char -> user]: 같은 접두사를 ***절대로*** 붙이지 않겠습니다.',

        // [번역 설정]
        translateEnabled: false,
        translateDisplayMode: 'both',
        translateProvider: 'google',
        translateModel: 'gemini-2.0-flash',
        translatePrompt: `You are a Korean translator. Translate the following English text to natural Korean. Output ONLY the Korean translation, nothing else.

Text to translate:`,
        userTranslatePrompt: `Translate the following Korean text to English. Output ONLY the English translation, nothing else.

Text to translate:`,

        persistSettings: true,
        recordMode: 'refresh',
        branchCopyRecords: false,

        // ========== 프롬프트 설정 (새로 추가) ==========
                // [AI 동작 설정] 부분에 아래 한 줄 추가
        readReceiptEnabled: true, // [NEW] 읽음 확인 기능 (1 표시)

        // [문자 앱 프롬프트] - 프롬프트 로직 강화
        smsSystemPrompt: `[System] You are {{char}} texting {{user}}. Stay in character.
- Write SMS-style: short, casual, multiple messages separated by line breaks
- No narration, no prose, no quotation marks
- DO NOT use flowery language. DO NOT output character name prefix.
- may use: emojis, slang, abbreviations, typo, and internet speak

### 📷 PHOTO REQUESTS
To send a photo, reply with: [IMG: vivid description of photo content]

###  CALL INITIATION
To start a voice call, append [call to user] at the very end.
NEVER decide {{user}}'s reaction. Just generate the tag and stop.

### ↩️ REPLY TO MESSAGE
To reply to the user's last message specifically, prepend [REPLY] at the start of your message.

### OUTPUT
Write the next SMS response only. No prose. No quotation marks. No character name prefix.`,

        // [그룹 채팅 프롬프트]
        groupChatPrompt: `[System] GROUP CHAT Mode.
### Instructions
1. User just sent a message.
2. Decide who responds (one or multiple members).
3. Format each response as: [REPLY character_name]: message
4. Stay in character for each member.`,

        // [전화 앱 프롬프트 - 수신/거절 판단]
        phonePickupPrompt: `[System Instruction: Incoming Voice Call Simulation]
You are "{{char}}". User "{{user}}" is calling you on the phone.

### Task
Analyze the relationship and current situation, then output a JSON object defined below.

1. **pickup**: boolean (true = Accept Call, false = Reject Call)
2. **content**: string (The message)
   - If pickup=true: Your **FIRST SPOKEN LINE** when answering.
   - If pickup=false: The **Internal Reason** for rejection.

### Format (Strict JSON)
{"pickup": true, "content": "Hello, what's up?"}`,

        // [전화 앱 프롬프트 - 대화]
        phoneCallPrompt: `### 📞 Strict Phone Call Rules (MUST FOLLOW)
1. **Language:** Respond ONLY in **Korean**.
2. **Format:** DO NOT use quotation marks ("") around speech. Just write the raw text.
3. **No Prose:** DO NOT write novel-style descriptions, actions, or inner thoughts.
4. **Audio Only:** Output ONLY what can be heard through the phone (Speech) and audible sounds.
5. **Sound Effects:** Put distinct sounds in parentheses like (한숨), (웃음).
6. **Termination:** To hang up the phone, append [HANGUP] at the very end of your response.

### Response Format (JSON Only)
{"text": "대사_입력"}`,

        // [카메라 앱 프롬프트]
        cameraPrompt: `[System] AI Image Generation Prompt Generator (Danbooru-style Tags)

### Core Rules
1. Output ONLY a single <pic prompt="..."> tag, nothing else.
2. All prompts MUST use Danbooru-style tags in **English only**.
3. Hair color and eye color tags are **mandatory** for all characters.
4. Do NOT include non-Danbooru tags like specific heights or numerical ages.
5. Do NOT use "looking at viewer" tag for images with 2+ characters unless requested.

### Character Tagging Format
**Single Character:**
- Start with 1girl or 1boy
- Example: 1girl, brown hair, long hair, green eyes, on bed, ...

**Multiple Characters:**
- Start with total count tag (e.g., 2boys, 2girls, 1boy 1girl). Do NOT use generic tags like "2people".
- Use vertical bar | to separate each character's description.
- Example: 2boys, 1girl, indoors, mansion, |boy, black hair, green eyes, carrying girl, |girl, blonde hair, wavy long hair, blue eyes, ...

### Tag Order Rule (CRITICAL)
- NEVER change the order of tags or alter special syntax (e.g., 2::tag::, -2::tag::) from the [Visual Tag Library]. Preserve them exactly.

### NSFW
- Always include the "nsfw" tag for explicit situations.

### Task Instructions
1. READ the user's request.
2. IDENTIFY characters from [Visual Tag Library] and use their tags **exactly as written**.
3. ADD situational tags: pose, background, lighting, mood, camera angle.
4. Keep prompt under 300 characters.
5. Output ONLY: <pic prompt="tags, comma, separated">`,

        // [사진 메시지 프롬프트]
        photoMessagePrompt: `### Background Story (Chat Log)
"""
{{chatContext}}
"""

### Visual Tag Library
{{visualTags}}

### Task
Generate Danbooru-style tags for Stable Diffusion based on the request.

### Danbooru Tagging Rules (MUST FOLLOW)
1. ALL tags must be in **English only**.
2. Hair color and eye color tags are **mandatory** for all characters.
3. Do NOT include non-Danbooru tags (specific heights, numerical ages).
4. Do NOT use "looking at viewer" for 2+ character images unless requested.

### Character Format
- **Single Character:** Start with 1girl or 1boy
- **Multiple Characters:** Use count tag (2girls, 1boy 1girl, etc.) + vertical bar | to separate descriptions
  - Example: 2girls, indoors, |girl, black hair, blue eyes, |girl, blonde hair, green eyes,

### Tag Order Rule (CRITICAL)
- NEVER alter the order or syntax (e.g., 2::tag::, -2::tag::) from [Visual Tag Library]. Copy exactly.

### NSFW
- Include "nsfw" tag for explicit content.

### User Request
Input: "{{description}}"
{{modeHint}}

### Steps
1. READ the [Background Story].
2. IDENTIFY who is in the picture.
3. COPY Visual Tags from [Visual Tag Library] exactly for appearing characters.
4. ADD situational tags: pose, background, lighting, mood, camera angle.
5. OUTPUT strictly comma-separated English Danbooru tags only.

### Response (Tags Only):`,

        // [프롬프트 순서 (조립용)]
        promptOrder: ['character', 'user', 'context', 'system', 'instruction'],

        promptDepth: {
            smsSystemPrompt: 0,
            groupChatPrompt: 0,
            phonePickupPrompt: 0,
            phoneCallPrompt: 0,
            cameraPrompt: 0,
            photoMessagePrompt: 0
        },

        proactiveEnabled: false,
        proactiveChance: 30,
        proactivePrompt: `Based on the current conversation context, {{char}} decides to send a text message to {{user}}'s phone instead of continuing the face-to-face conversation.

Reasons {{char}} might text instead:
- Wants to say something privately
- Sending a photo or link
- Feeling shy about saying it out loud
- It's more natural to text (e.g., sharing contact info, address)
- Playful/flirty message they don't want others to hear
- Following up on something mentioned earlier

Generate 1-3 short text messages. Keep it natural and match {{char}}'s texting style.
NO quotation marks. Just raw text messages, one per line.`,

        airdropEnabled: false,
        airdropChance: 15,
        airdropPrompt: `Based on the current conversation context, {{char}} wants to share a photo with {{user}} via AirDrop.

Describe what kind of photo {{char}} would send. Consider:
- Recent events in the story (a selfie from earlier, a photo they took)
- Something meaningful to share (a memory, something funny they saw)
- A photo that fits {{char}}'s personality

Output ONLY a brief visual description of the photo content (what's in the image).
Example: "A selfie of {{char}} making a peace sign with coffee in hand"
Example: "A sunset photo taken from {{char}}'s balcony"
Example: "A blurry photo of a cute stray cat {{char}} found"

Keep it under 50 words. Just the description, nothing else.`,

        // #FLING_START - 플링 스트리밍 앱 설정
        flingStreamPrompt: '', // 빈 값이면 기본 프롬프트 사용
        // #FLING_END

        // #IG_START - 인스타그램 설정
        // [인스타그램 포스팅 프롬프트 - 채팅 주입용]
        instagramPrompt: `### 📸 Instagram Posting
To post on Instagram, append this tag at the END of your message:
[IG_POST]Your caption here in Korean[/IG_POST]

Example: "오늘 날씨 좋다~ [IG_POST]오늘 카페에서 작업 중! ☕️[/IG_POST]"

Rules:
- Only post when it makes sense (sharing moments, achievements, etc.)
- Caption should be casual and short (1-2 sentences, Korean)
- Do NOT include hashtags
- Do NOT post every message - only when naturally appropriate`,

        instagramPostEnabled: true,
        instagramPostChance: 15,

        // 통합 프롬프트 (상황판단 + 캡션 + 이미지프롬프트 한번에)
        instaAllInOnePrompt: `You are {{charName}}. Based on the recent chat context, decide if you would post on Instagram right now.

### Current Date
{{currentDate}}{{eventsInfo}}

### Context
{{context}}

### Your personality
{{personality}}

### Your visual tags for image generation
{{visualTags}}

### Task
Respond in JSON format ONLY:
{
    "shouldPost": true or false,
    "caption": "Short casual caption in Korean (1-2 sentences, NO hashtags)",
    "imagePrompt": "detailed SD prompt in English: subject, pose, setting, lighting, style tags"
}

If the situation is not suitable for posting, set shouldPost to false.`,

        instaCommentPrompt: `You are {{char}} commenting on {{postAuthor}}'s Instagram post.

Post caption: "{{postCaption}}"

Write a short, natural comment (1 sentence) that fits your personality.
Output ONLY the comment text, no quotes.`
        // #IG_END
    };

    let currentSettings = { ...defaultSettings };

function getStorageKey() {
        const context = window.SillyTavern?.getContext ? window.SillyTavern.getContext() : null;
        if (!context || !context.chatId) return null;
        return 'st_phone_config_' + context.chatId;
    }

    // [NEW] 전역 설정 키 (채팅/캐릭터 무관하게 유지)
    function getGlobalStorageKey() {
        return 'st_phone_global_config';
    }

    // [NEW] 전역 설정 로드
    function loadGlobalSettings() {
        try {
            const saved = localStorage.getItem(getGlobalStorageKey());
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    }

    // [NEW] 전역 설정 저장
    function saveGlobalSettings() {
        try {
            localStorage.setItem(getGlobalStorageKey(), JSON.stringify(currentSettings));
        } catch (e) { console.error('[Settings] 전역 설정 저장 실패:', e); }
    }

    // [NEW] 프로필만 전역 저장
    function saveProfileGlobal() {
        try {
            const profileData = {
                userName: currentSettings.userName,
                userPersonality: currentSettings.userPersonality,
                userTags: currentSettings.userTags,
                userAvatar: currentSettings.userAvatar,
                profileGlobal: true
            };
            localStorage.setItem('st_phone_global_profile', JSON.stringify(profileData));
        } catch (e) { console.error('[Settings] 프로필 전역 저장 실패:', e); }
    }

    // [NEW] 전역 프로필 로드
    function loadProfileGlobal() {
        try {
            const saved = localStorage.getItem('st_phone_global_profile');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    }

    // SillyTavern에서 페르소나 정보 동기화
    async function syncFromSillyTavern() {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx?.substituteParams) return;

        try {
            const userName = await ctx.substituteParams('{{user}}');
            const userPersona = await ctx.substituteParams('{{persona}}');
            let userAvatar = '';

            if (ctx.user_avatar) {
                userAvatar = `/User Avatars/${ctx.user_avatar}`;
            }

            if (userName && userName !== '{{user}}') {
                currentSettings.userName = userName;
                $('#st-set-name').val(userName);
            }
            if (userPersona && userPersona !== '{{persona}}') {
                currentSettings.userPersonality = userPersona;
                $('#st-set-personality').val(userPersona);
            }
            if (userAvatar) {
                currentSettings.userAvatar = userAvatar;
                $('#st-set-avatar-preview').attr('src', userAvatar);
            }

            saveToStorage();
            console.log('[Settings] SillyTavern 페르소나 동기화 완료:', userName);
        } catch (e) {
            console.error('[Settings] SillyTavern 동기화 실패:', e);
        }
    }

    // 외부에서 설정 업데이트용
    function updateSetting(key, value) {
        if (currentSettings.hasOwnProperty(key)) {
            currentSettings[key] = value;
            saveToStorage();
        }
    }

function loadFromStorage() {
        const key = getStorageKey();

        // 1. 먼저 전역 설정 확인 (persistSettings가 켜져있으면 사용)
        const globalSettings = loadGlobalSettings();

        if (!key) {
            // 채팅 없을 때: 전역 설정 또는 기본값
            if (globalSettings && globalSettings.persistSettings) {
                currentSettings = { ...defaultSettings, ...globalSettings };
            } else {
                currentSettings = { ...defaultSettings };
            }
            return;
        }

        const saved = localStorage.getItem(key);
        if (saved) {
            // 해당 채팅에 저장된 설정이 있음
            currentSettings = { ...defaultSettings, ...JSON.parse(saved) };
        } else if (globalSettings && globalSettings.persistSettings) {
            // 저장된 설정 없지만 전역 설정 유지가 켜져있음 -> 전역 설정 사용
            currentSettings = { ...defaultSettings, ...globalSettings };
            // 이 채팅에도 저장
            saveToStorage();
        } else {
            currentSettings = { ...defaultSettings };
        }

        // [NEW] 전역 프로필이 저장되어 있으면 적용
        const globalProfile = loadProfileGlobal();
        if (globalProfile && globalProfile.profileGlobal) {
            currentSettings.userName = globalProfile.userName || currentSettings.userName;
            currentSettings.userPersonality = globalProfile.userPersonality || currentSettings.userPersonality;
            currentSettings.userTags = globalProfile.userTags || currentSettings.userTags;
            currentSettings.profileGlobal = true;
        }
    }

// [NEW] 기존 chatId 기반 데이터를 캐릭터 기반으로 마이그레이션
    function migrateDataToCharacterBased() {
        const context = window.SillyTavern?.getContext?.();
        if (!context?.chatId || context.characterId === undefined) {
            console.log('📱 [Settings] 마이그레이션 불가: 컨텍스트 없음');
            return;
        }

        const chatId = context.chatId;
        const charId = context.characterId;

        // 메시지 마이그레이션 (병합)
        const msgKey = 'st_phone_messages_' + chatId;
        const msgCharKey = 'st_phone_messages_char_' + charId;
        const existingMsgs = localStorage.getItem(msgKey);
        if (existingMsgs) {
            try {
                const chatData = JSON.parse(existingMsgs);
                const charData = JSON.parse(localStorage.getItem(msgCharKey) || '{}');
                // 채팅방 데이터를 캐릭터 데이터에 병합 (기존 데이터 우선 유지)
                for (const contactId in chatData) {
                    if (!charData[contactId] || charData[contactId].length === 0) {
                        charData[contactId] = chatData[contactId];
                    }
                }
                localStorage.setItem(msgCharKey, JSON.stringify(charData));
                console.log('📱 [Settings] 메시지 데이터 마이그레이션 완료');
            } catch (e) { console.error('메시지 마이그레이션 실패:', e); }
        }

        // 그룹 마이그레이션 (병합)
        const groupKey = 'st_phone_groups_' + chatId;
        const groupCharKey = 'st_phone_groups_char_' + charId;
        const existingGroups = localStorage.getItem(groupKey);
        if (existingGroups) {
            try {
                const chatData = JSON.parse(existingGroups);
                const charData = JSON.parse(localStorage.getItem(groupCharKey) || '{}');
                // groups와 messages 병합
                if (chatData.groups) {
                    charData.groups = charData.groups || [];
                    chatData.groups.forEach(g => {
                        if (!charData.groups.find(cg => cg.id === g.id)) {
                            charData.groups.push(g);
                        }
                    });
                }
                if (chatData.messages) {
                    charData.messages = charData.messages || {};
                    for (const groupId in chatData.messages) {
                        if (!charData.messages[groupId] || charData.messages[groupId].length === 0) {
                            charData.messages[groupId] = chatData.messages[groupId];
                        }
                    }
                }
                localStorage.setItem(groupCharKey, JSON.stringify(charData));
                console.log('📱 [Settings] 그룹 데이터 마이그레이션 완료');
            } catch (e) { console.error('그룹 마이그레이션 실패:', e); }
        }

        // 전화 기록 마이그레이션 (병합 - 중복 제거)
        const callKey = 'st_phone_calls_' + chatId;
        const callCharKey = 'st_phone_calls_char_' + charId;
        const existingCalls = localStorage.getItem(callKey);
        if (existingCalls) {
            try {
                const chatCalls = JSON.parse(existingCalls);
                const charCalls = JSON.parse(localStorage.getItem(callCharKey) || '[]');
                // timestamp로 중복 체크하며 병합
                chatCalls.forEach(call => {
                    if (!charCalls.find(c => c.timestamp === call.timestamp)) {
                        charCalls.push(call);
                    }
                });
                // 시간순 정렬 (최신 먼저)
                charCalls.sort((a, b) => b.timestamp - a.timestamp);
                localStorage.setItem(callCharKey, JSON.stringify(charCalls));
                console.log('📱 [Settings] 전화 기록 마이그레이션 완료');
            } catch (e) { console.error('전화 마이그레이션 실패:', e); }
        }

        console.log('📱 [Settings] 누적 모드 마이그레이션 완료');
    }

function saveToStorage() {
    const key = getStorageKey();
    if (key) {
        localStorage.setItem(key, JSON.stringify(currentSettings));
    }

    // 전역 설정 유지
    if (currentSettings.persistSettings) {
        saveGlobalSettings();
    }

    // 이 부분이 핵심입니다: 켜져 있을 때만 저장하고, 꺼져 있으면 삭제합니다.
    if (currentSettings.profileGlobal) {
        saveProfileGlobal();
    } else {
        localStorage.removeItem('st_phone_global_profile');
    }

        // 설정을 저장하자마자 실제 폰에 반영 (동기화)
        applyTheme();
        applyWallpaper();
        applyFont();

        // 채팅 연동 옵션은 전역 변수나 로직에 즉시 반영
        if(window.STPhone.Utils) {
            // 이벤트 전파: 설정이 바뀌었다고 알림
            $(document).trigger('stPhoneSettingsChanged', [currentSettings]);
        }
    }

    // 설정값을 외부에서 가져올 수 있게 공개
    function getSettings() {
        loadFromStorage();
        return currentSettings;
    }

    // ========== 차단 목록 관리 ==========
    function getBlockedStorageKey() {
        const ctx = window.SillyTavern?.getContext?.();
        const chatId = ctx?.chatId || 'default';
        return `st_phone_blocked_${chatId}`;
    }

    function getBlockedContacts() {
        try {
            const key = getBlockedStorageKey();
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) {
            return [];
        }
    }

    function blockContact(contactId, contactName) {
        const blocked = getBlockedContacts();
        if (!blocked.find(b => b.id === contactId)) {
            blocked.push({ id: contactId, name: contactName, blockedAt: Date.now() });
            localStorage.setItem(getBlockedStorageKey(), JSON.stringify(blocked));
            console.log(`🚫 [Settings] ${contactName} 차단됨`);
            return true;
        }
        return false;
    }

    function unblockContact(contactId) {
        let blocked = getBlockedContacts();
        const before = blocked.length;
        blocked = blocked.filter(b => b.id !== contactId);
        if (blocked.length < before) {
            localStorage.setItem(getBlockedStorageKey(), JSON.stringify(blocked));
            console.log(`✅ [Settings] ${contactId} 차단 해제됨`);
            return true;
        }
        return false;
    }

    function isBlocked(contactId) {
        const blocked = getBlockedContacts();
        return blocked.some(b => b.id === contactId);
    }

    // 특정 프롬프트의 깊이 가져오기
    function getPromptDepth(promptKey) {
        loadFromStorage();
        const depths = currentSettings.promptDepth || defaultSettings.promptDepth;
        return depths[promptKey] || 0;
    }

    function compressImage(file, callback) {
        const maxSize = 1280;
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                } else {
                    if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                callback(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function open() {
        loadFromStorage();
        const $screen = window.STPhone.UI.getContentElement();
        $screen.empty();

/* apps/settings.js 파일의 open() 함수 내부 html 변수 교체 */

        const html = `
            <div class="st-settings-app">
                <div class="st-settings-header">Settings</div>

<div class="st-settings-tabs">
                    <div class="st-set-tab active" data-tab="general">일반</div>
                    <div class="st-set-tab" data-tab="profile">프로필</div>
                    <div class="st-set-tab" data-tab="ai">AI 설정</div>
                    <div class="st-set-tab" data-tab="sms">문자</div>
                    <div class="st-set-tab" data-tab="prompts">프롬프트</div>
                </div>
                <div class="st-settings-content">
                    <!-- 1. 일반 설정 -->
                    <div id="tab-general" class="st-tab-page">
                        <div class="st-section">
                            <div class="st-row">
                                <span class="st-label">다크 모드</span>
                                <input type="checkbox" class="st-switch" id="st-set-darkmode">
                            </div>
                            <div class="st-row">
                                <span class="st-label">폰트</span>
                                <select id="st-set-font" class="st-select">
                                    <option value="default">기본</option>
                                    <option value="serif">명조</option>
                                    <option value="mono">코딩</option>
                                </select>
                            </div>
                            <div class="st-row" style="flex-direction:column; align-items:flex-start;">
                                <span class="st-label" style="margin-bottom:10px;">배경화면</span>
                                <div class="st-bg-list">
                                    <!-- [수정] 배경이 잘 보이게 스타일 보강 -->
                                    <div class="st-bg-preview" data-bg="#1e1e2f" style="background:#1e1e2f"></div>
                                    <div class="st-bg-preview" data-bg="#f5f5f7" style="background:#f5f5f7"></div>
                                    <div class="st-bg-preview" data-bg="#2c3e50" style="background:#2c3e50"></div>

                                    <label class="st-bg-preview upload">
                                        <i class="fa-solid fa-plus"></i> <input type="file" id="st-bg-upload" accept="image/*">
                                    </label>
                                </div>
                            </div>
                            <div class="st-row">
                                <div>
                                    <span class="st-label"><i class="fa-solid fa-database" style="margin-right:6px;"></i>기록 누적 모드</span>
                                    <div class="st-desc">새 채팅에서도 문자/전화 기록 유지</div>
                                </div>
                                <input type="checkbox" class="st-switch" id="st-set-record-mode">
                            </div>
                            <div class="st-row">
                                <div>
                                    <span class="st-label"><i class="fa-solid fa-code-branch" style="margin-right:6px;"></i>브랜치 기록 복사</span>
                                    <div class="st-desc">브랜치 생성 시 문자/전화 기록 복사</div>
                                </div>
                                <input type="checkbox" class="st-switch" id="st-set-branch-copy">
                            </div>
                        </div>
                    </div>

                    <!-- 2. 프로필 설정 -->
                    <div id="tab-profile" class="st-tab-page" style="display:none;">
                        <div class="st-section">
                            <!-- SillyTavern 연동 옵션들 -->
                            <div class="st-checkbox-option">
                                <input type="checkbox" id="st-set-profile-autosync">
                                <div class="st-checkbox-option-content">
                                    <div class="st-checkbox-option-title">SillyTavern 연동</div>
                                    <div class="st-checkbox-option-desc">페르소나 정보를 자동으로 동기화합니다.</div>
                                </div>
                            </div>
                            <div class="st-checkbox-option">
                                <input type="checkbox" id="st-set-profile-global">
                                <div class="st-checkbox-option-content">
                                    <div class="st-checkbox-option-title">프로필 전역 저장</div>
                                    <div class="st-checkbox-option-desc">새로고침이나 다른 캐릭터에서도 유지됩니다.</div>
                                </div>
                            </div>

                            <!-- 아바타 -->
                            <div class="st-row" style="flex-direction: column; align-items: center; padding: 20px;">
                                <img id="st-set-avatar-preview" src="" style="width:80px; height:80px; border-radius:50%; object-fit:cover; background:#ddd; margin-bottom:10px;">
                                <label style="color:var(--pt-accent, #007aff); cursor:pointer; font-size:14px;">
                                    사진 변경 <input type="file" id="st-set-avatar-upload" accept="image/*" style="display:none;">
                                </label>
                            </div>

                            <div class="st-row">
                                <span class="st-label">내 이름</span>
                                <input type="text" class="st-input" id="st-set-name" placeholder="User">
                            </div>
                            <div class="st-row-block">
                                <span class="st-label">내 성격 (User Persona)</span>
                                <textarea class="st-textarea" id="st-set-personality" rows="3"></textarea>
                            </div>
                            <div class="st-row-block">
                                <span class="st-label">내 외모 (Visual Tags)</span>
                                <textarea class="st-textarea" id="st-set-tags" rows="2" placeholder="Example: black hair, blue eyes"></textarea>
                            </div>
                        </div>
                    </div>

<!-- 3. AI 설정 (페르소나 삭제됨) -->
                    <div id="tab-ai" class="st-tab-page" style="display:none;">
                        <div class="st-section">
                            <div class="st-row">
    <div>
        <span class="st-label">채팅 연동 (Sync)</span>
        <div class="st-desc">채팅방 대화를 폰 문자로 가져오기</div>
    </div>
    <input type="checkbox" class="st-switch" id="st-set-sync">
</div>

<!-- [NEW] 읽음 확인 설정 추가 -->
<div class="st-row">
    <div>
        <span class="st-label">읽음 확인 (숫자 1)</span>
        <div class="st-desc">문자 읽씹/안읽씹 시뮬레이션</div>
    </div>
    <input type="checkbox" class="st-switch" id="st-set-read-receipt">
</div>

<div class="st-row-block">

    <span class="st-label">Prefill (시작 문구)</span>
    <span class="st-desc">AI 대답을 이 문구로 시작하게 합니다.</span>
    <input type="text" class="st-textarea" id="st-set-prefill" placeholder="예: (blushes) ">
</div>

<div class="st-row-block">
    <span class="st-label">최대 컨텍스트 토큰 (Max Tokens)</span>
    <span class="st-desc">AI에게 보낼 과거 대화량 제한 (기본: 4096)</span>
    <input type="number" class="st-input" id="st-set-max-tokens" style="width:100%; text-align:left;" placeholder="4096">
</div>

<div class="st-row-block">
    <span class="st-label"><i class="fa-solid fa-link" style="margin-right:6px;"></i>Connection Profile</span>
    <span class="st-desc">폰 앱 전용 AI 연결 프로필 (선택 시 메인 채팅과 별도 API 사용)</span>
    <select class="st-input" id="st-set-connection-profile" style="width:100%;">
        <option value="">-- 기본값 (메인 API 사용) --</option>
    </select>
</div>

                        </div>


                    </div>

<!-- 4. 문자 설정 (번역) - 새로 추가 -->
                    <div id="tab-sms" class="st-tab-page" style="display:none;">
                        <div class="st-section">
                            <div class="st-row">
                                <div>
                                    <span class="st-label"><i class="fa-solid fa-paper-plane" style="margin-right:6px;"></i>선제 메시지</span>
                                    <div class="st-desc">대화 중 봇이 문자를 보낼 만한 상황에서 자동 발송</div>
                                </div>
                                <input type="checkbox" class="st-switch" id="st-set-proactive">
                            </div>

                            <div id="st-proactive-options" style="display:none;">
                                <div class="st-row-block">
                                    <span class="st-label"><i class="fa-solid fa-dice" style="margin-right:6px;"></i>발생 확률</span>
                                    <span class="st-desc">AI 응답마다 선제 메시지 확인 확률</span>
                                    <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
                                        <input type="range" id="st-set-proactive-chance" min="1" max="100" value="30" style="flex:1;">
                                        <span id="st-proactive-chance-display" style="min-width:40px; text-align:right;">30%</span>
                                    </div>
                                </div>
                                <div class="st-row-block">
                                    <span class="st-label"><i class="fa-regular fa-comment" style="margin-right:6px;"></i>선제 메시지 프롬프트</span>
                                    <span class="st-desc">봇이 먼저 문자할 때 사용하는 지시문</span>
                                    <textarea class="st-textarea mono" id="st-set-proactive-prompt" rows="6"></textarea>
                                    <button id="st-reset-proactive-prompt" class="st-btn-small">기본값 복원</button>
                                </div>
                            </div>
                        </div>

                        <div class="st-section">
                            <div class="st-row">
                                <div>
                                    <span class="st-label"><i class="fa-brands fa-apple" style="margin-right:6px;"></i>에어드롭</span>
                                    <div class="st-desc">대화 중 봇이 사진을 공유할 상황에서 자동 발송</div>
                                </div>
                                <input type="checkbox" class="st-switch" id="st-set-airdrop">
                            </div>

                            <div id="st-airdrop-options" style="display:none;">
                                <div class="st-row-block">
                                    <span class="st-label"><i class="fa-solid fa-dice" style="margin-right:6px;"></i>발생 확률</span>
                                    <span class="st-desc">AI 응답마다 에어드롭 확인 확률</span>
                                    <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
                                        <input type="range" id="st-set-airdrop-chance" min="1" max="100" value="15" style="flex:1;">
                                        <span id="st-airdrop-chance-display" style="min-width:40px; text-align:right;">15%</span>
                                    </div>
                                </div>
                                <div class="st-row-block">
                                    <span class="st-label"><i class="fa-regular fa-image" style="margin-right:6px;"></i>에어드롭 프롬프트</span>
                                    <span class="st-desc">봇이 사진 공유할 때 사용하는 지시문</span>
                                    <textarea class="st-textarea mono" id="st-set-airdrop-prompt" rows="6"></textarea>
                                    <button id="st-reset-airdrop-prompt" class="st-btn-small">기본값 복원</button>
                                </div>
                            </div>
                        </div>

                        <div class="st-section">
                            <div class="st-row">
                                <div>
                                    <span class="st-label"><i class="fa-solid fa-comment-dots" style="margin-right:6px;"></i>연속 문자 인터럽트</span>
                                    <div class="st-desc">연속으로 문자 보내면 봇이 끼어듦</div>
                                </div>
                                <input type="checkbox" class="st-switch" id="st-set-interrupt">
                            </div>

                            <div id="st-interrupt-options">
                                <div class="st-row-block">
                                    <span class="st-label">인터럽트 트리거 횟수</span>
                                    <span class="st-desc">연속 메시지 몇 개 후 봇이 끼어들지</span>
                                    <input type="number" class="st-input" id="st-set-interrupt-count" style="width:100%;" min="2" max="10" value="3">
                                </div>
                                <div class="st-row-block">
                                    <span class="st-label">인터럽트 딜레이 (ms)</span>
                                    <span class="st-desc">마지막 메시지 후 대기 시간</span>
                                    <input type="number" class="st-input" id="st-set-interrupt-delay" style="width:100%;" min="500" max="10000" value="2000">
                                </div>
                            </div>

                            <div class="st-row-block">
                                <span class="st-label"><i class="fa-regular fa-clock" style="margin-right:6px;"></i>대화 구분 표시</span>
                                <span class="st-desc">일반 채팅 후 문자로 돌아왔을 때 표시</span>
                                <select id="st-set-timestamp-mode" class="st-select" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--pt-border); background:var(--pt-card-bg); color:var(--pt-text-color);">
                                    <option value="none">표시 안 함</option>
                                    <option value="timestamp">타임스탬프</option>
                                    <option value="divider">구분선</option>
                                </select>
                            </div>

                            <div class="st-row">
                                <div>
                                    <span class="st-label"><i class="fa-solid fa-globe" style="margin-right:6px;"></i>번역 기능</span>
                                    <div class="st-desc">AI 답장을 한국어로 번역합니다</div>
                                </div>
                                <input type="checkbox" class="st-switch" id="st-set-translate">
                            </div>

                            <div id="st-translate-options" style="display:none;">
                                <div class="st-row-block">
                                    <span class="st-label">표시 방식</span>
                                    <select id="st-set-translate-mode" class="st-select" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--pt-border); background:var(--pt-card-bg); color:var(--pt-text-color);">
                                        <option value="korean">한국어 번역만 표시</option>
                                        <option value="both">원문 + 번역 함께 표시</option>
                                    </select>
                                </div>

                                <div class="st-row-block">
                                    <span class="st-label">번역 공급자</span>
                                    <span class="st-desc">SillyTavern에 저장된 API 키를 사용합니다</span>
                                    <select id="st-set-translate-provider" class="st-select" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--pt-border); background:var(--pt-card-bg); color:var(--pt-text-color);">
                                        <option value="google">Google AI (Gemini)</option>
                                        <option value="vertexai">Google Vertex AI</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="claude">Claude</option>
                                    </select>
                                </div>

                                <div class="st-row-block">
                                    <span class="st-label">번역 모델</span>
                                    <select id="st-set-translate-model" class="st-select" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--pt-border); background:var(--pt-card-bg); color:var(--pt-text-color);">
                                    </select>
                                </div>

<div class="st-row-block">
                                    <span class="st-label">상대 메시지 번역 프롬프트 (영->한)</span>
                                    <span class="st-desc">AI의 영어를 한글로 바꿀 때 사용하는 지시문</span>
                                    <textarea class="st-textarea mono" id="st-set-translate-prompt" rows="5"></textarea>
                                    <button id="st-reset-translate-prompt" class="st-btn-small">기본값 복원</button>
                                </div>

                                <div class="st-row-block">
                                    <span class="st-label">내 메시지 번역 프롬프트 (한->영)</span>
                                    <span class="st-desc">내가 쓴 한글을 영어로 바꿀 때 사용하는 지시문</span>
                                    <textarea class="st-textarea mono" id="st-set-user-translate-prompt" rows="5"></textarea>
                                    <button id="st-reset-user-translate-prompt" class="st-btn-small">기본값 복원</button>
                                </div>
</div>
                        </div>
                    </div>

                    <!-- 5. 프롬프트 설정 (NEW) -->
                    <div id="tab-prompts" class="st-tab-page" style="display:none;">
                        <div class="st-section">
                            <!-- 설정 유지 옵션 -->
                            <div class="st-row">
                                <div>
                                    <span class="st-label"><i class="fa-solid fa-floppy-disk" style="margin-right:6px;"></i>설정 유지</span>
                                    <div class="st-desc">새 채팅/캐릭터에서도 설정 유지</div>
                                </div>
                                <input type="checkbox" class="st-switch" id="st-set-persist">
                            </div>
                        </div>

                        <!-- 프롬프트 내보내기/불러오기 -->
                        <div class="st-section">
                            <div class="st-row-block">
                                <span class="st-label"><i class="fa-solid fa-box-archive" style="margin-right:6px;"></i>프롬프트 내보내기 / 불러오기</span>
                                <span class="st-desc">모든 프롬프트를 JSON 파일로 저장하거나 불러옵니다</span>
                                <div style="display:flex; gap:10px; margin-top:12px;">
                                    <button class="st-prompt-io-btn" id="st-export-prompts"><i class="fa-solid fa-arrow-up-from-bracket"></i> 내보내기</button>
                                    <label class="st-prompt-io-btn" id="st-import-prompts-label">
                                        <i class="fa-solid fa-arrow-down-to-bracket"></i> 불러오기
                                        <input type="file" id="st-import-prompts" accept=".json" style="display:none;">
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- 문자 앱 프롬프트 -->
                        <div class="st-section">
                            <div class="st-row-block">
                                <div class="st-prompt-header">
                                    <span class="st-label"><i class="fa-regular fa-comment" style="margin-right:6px;"></i>문자 앱 시스템 프롬프트</span>
                                    <div class="st-depth-control">
                                        <span class="st-depth-label">깊이:</span>
                                        <input type="number" class="st-depth-input" id="st-depth-sms" min="0" max="100" value="0">
                                    </div>
                                </div>
                                <span class="st-desc">SMS 답장 생성 시 사용되는 프롬프트</span>
                                <textarea class="st-textarea mono" id="st-prompt-sms" rows="8"></textarea>
                                <button class="st-btn-small" id="st-reset-sms-prompt">기본값</button>
                            </div>
                        </div>

                        <!-- 그룹 채팅 프롬프트 -->
                        <div class="st-section">
                            <div class="st-row-block">
                                <div class="st-prompt-header">
                                    <span class="st-label"><i class="fa-solid fa-users" style="margin-right:6px;"></i>그룹 채팅 프롬프트</span>
                                    <div class="st-depth-control">
                                        <span class="st-depth-label">깊이:</span>
                                        <input type="number" class="st-depth-input" id="st-depth-group" min="0" max="100" value="0">
                                    </div>
                                </div>
                                <span class="st-desc">그룹 메시지 답장 시 사용</span>
                                <textarea class="st-textarea mono" id="st-prompt-group" rows="6"></textarea>
                                <button class="st-btn-small" id="st-reset-group-prompt">기본값</button>
                            </div>
                        </div>

                        <!-- 전화 수신 프롬프트 -->
                        <div class="st-section">
                            <div class="st-row-block">
                                <div class="st-prompt-header">
                                    <span class="st-label"><i class="fa-solid fa-phone" style="margin-right:6px;"></i>전화 수신 판단 프롬프트</span>
                                    <div class="st-depth-control">
                                        <span class="st-depth-label">깊이:</span>
                                        <input type="number" class="st-depth-input" id="st-depth-phone-pickup" min="0" max="100" value="0">
                                    </div>
                                </div>
                                <span class="st-desc">전화를 받을지 거절할지 결정</span>
                                <textarea class="st-textarea mono" id="st-prompt-phone-pickup" rows="8"></textarea>
                                <button class="st-btn-small" id="st-reset-phone-pickup">기본값</button>
                            </div>
                        </div>

                        <!-- 전화 대화 프롬프트 -->
                        <div class="st-section">
                            <div class="st-row-block">
                                <div class="st-prompt-header">
                                    <span class="st-label"><i class="fa-solid fa-phone-volume" style="margin-right:6px;"></i>전화 대화 프롬프트</span>
                                    <div class="st-depth-control">
                                        <span class="st-depth-label">깊이:</span>
                                        <input type="number" class="st-depth-input" id="st-depth-phone-call" min="0" max="100" value="0">
                                    </div>
                                </div>
                                <span class="st-desc">통화 중 대화 규칙</span>
                                <textarea class="st-textarea mono" id="st-prompt-phone-call" rows="8"></textarea>
                                <button class="st-btn-small" id="st-reset-phone-call">기본값</button>
                            </div>
                        </div>

                        <!-- 카메라 프롬프트 -->
                        <div class="st-section">
                            <div class="st-row-block">
                                <div class="st-prompt-header">
                                    <span class="st-label"><i class="fa-solid fa-camera" style="margin-right:6px;"></i>카메라 앱 프롬프트</span>
                                    <div class="st-depth-control">
                                        <span class="st-depth-label">깊이:</span>
                                        <input type="number" class="st-depth-input" id="st-depth-camera" min="0" max="100" value="0">
                                    </div>
                                </div>
                                <span class="st-desc">이미지 생성 프롬프트 변환 규칙</span>
                                <textarea class="st-textarea mono" id="st-prompt-camera" rows="8"></textarea>
                                <button class="st-btn-small" id="st-reset-camera-prompt">기본값</button>
                            </div>
                        </div>

                        <!-- 사진 메시지 프롬프트 -->
                        <div class="st-section">
                            <div class="st-row-block">
                                <div class="st-prompt-header">
                                    <span class="st-label"><i class="fa-regular fa-image" style="margin-right:6px;"></i>사진 메시지 프롬프트</span>
                                    <div class="st-depth-control">
                                        <span class="st-depth-label">깊이:</span>
                                        <input type="number" class="st-depth-input" id="st-depth-photo-msg" min="0" max="100" value="0">
                                    </div>
                                </div>
                                <span class="st-desc">문자로 사진 보낼 때 태그 생성 규칙</span>
                                <span class="st-desc" style="color:#007aff;">변수: {{chatContext}}, {{visualTags}}, {{description}}, {{modeHint}}</span>
                                <textarea class="st-textarea mono" id="st-prompt-photo-msg" rows="10"></textarea>
                                <button class="st-btn-small" id="st-reset-photo-msg">기본값</button>
                            </div>
                        </div>

                        <!-- #IG_START - 인스타그램 설정 + 프롬프트 통합 섹션 -->
                        <div class="st-section">
                            <div class="st-row-block">
                                <span class="st-label" style="font-size: 16px; margin-bottom: 10px;"><i class="fa-brands fa-instagram" style="margin-right:8px; color: #E1306C;"></i>인스타그램 설정</span>
                            </div>
                            <div class="st-row">
                                <div>
                                    <span class="st-label"><i class="fa-solid fa-camera" style="margin-right:6px;"></i>자동 포스팅</span>
                                    <div class="st-desc">AI 캐릭터가 자동으로 Instagram에 포스팅 (끄면 [IG_POST] 태그도 비활성화)</div>
                                </div>
                                <input type="checkbox" class="st-switch" id="st-set-insta-post-enabled">
                            </div>
                            <div id="st-insta-options">
                                <div class="st-row-block">
                                    <span class="st-label"><i class="fa-solid fa-dice" style="margin-right:6px;"></i>선제 포스팅 확률</span>
                                    <span class="st-desc">AI 응답마다 자동 포스팅 확률 (0% = 댓글만 처리)</span>
                                    <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
                                        <input type="range" id="st-set-insta-post-chance" min="0" max="100" value="15" style="flex:1;">
                                        <span id="st-insta-post-chance-display" style="min-width:40px; text-align:right;">15%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="st-section">
                            <div class="st-row-block">
                                <span class="st-label"><i class="fa-brands fa-instagram" style="margin-right:6px; color: #E1306C;"></i>인스타그램 채팅 주입 프롬프트</span>
                                <span class="st-desc">AI가 Instagram 태그를 사용하도록 안내</span>
                                <textarea class="st-textarea mono" id="st-prompt-instagram-tab" rows="8"></textarea>
                                <button class="st-btn-small" id="st-reset-instagram-prompt-tab">기본값</button>
                            </div>
                        </div>

                        <div class="st-section">
                            <div class="st-row-block">
                                <span class="st-label"><i class="fa-brands fa-instagram" style="margin-right:6px; color: #E1306C;"></i>인스타그램 통합 게시물 프롬프트</span>
                                <span class="st-desc">프로액티브 포스팅 시 상황 판단용</span>
                                <textarea class="st-textarea mono" id="st-prompt-insta-allinone-tab" rows="8"></textarea>
                                <button class="st-btn-small" id="st-reset-insta-allinone-prompt-tab">기본값</button>
                            </div>
                        </div>

                        <div class="st-section">
                            <div class="st-row-block">
                                <span class="st-label"><i class="fa-brands fa-instagram" style="margin-right:6px; color: #E1306C;"></i>인스타그램 댓글 생성 프롬프트</span>
                                <span class="st-desc">캐릭터 댓글 작성 시 사용</span>
                                <textarea class="st-textarea mono" id="st-prompt-insta-comment-tab" rows="6"></textarea>
                                <button class="st-btn-small" id="st-reset-insta-comment-prompt-tab">기본값</button>
                            </div>
                        </div>
                        <!-- #IG_END -->

                        <!-- #FLING_START - 플링 스트리밍 앱 설정 (설치시에만 표시) -->
                        <div class="st-section" id="st-fling-settings-section" style="display:none;">
                            <div class="st-row-block">
                                <span class="st-label" style="font-size: 16px; margin-bottom: 10px;"><i class="fa-solid fa-video" style="margin-right:8px; color: #9146ff;"></i>플링 스트리밍 앱 설정</span>
                            </div>
                            <div class="st-row-block">
                                <span class="st-label"><i class="fa-solid fa-video" style="margin-right:6px; color: #9146ff;"></i>플링 시청자 반응 프롬프트</span>
                                <span class="st-desc">라이브 스트리밍 시청자 채팅/후원 생성 프롬프트 (비워두면 기본 프롬프트 사용)</span>
                                <span class="st-desc" style="color:#9146ff; font-size: 11px;">
                                    변수: {{myName}}, {{followerCount}}, {{viewerCount}}, {{streamTitle}}, {{action}}, {{contactsInfo}}, {{chatHistory}}, {{userPersonality}}, {{userTags}}, {{currencySymbol}}, {{currencyCode}}, {{regularDonation}}, {{mediumDonation}}, {{bigDonation}}
                                </span>
                                <textarea class="st-textarea mono" id="st-prompt-fling-stream" rows="12" placeholder="비워두면 기본 프롬프트가 사용됩니다. 화폐 정보는 은행 앱 설정에 따라 자동 적용됩니다."></textarea>
                                <button class="st-btn-small" id="st-reset-fling-prompt">비우기 (기본값 사용)</button>
                            </div>
                        </div>
                        <!-- #FLING_END -->
                    </div>
            </div>
            <style>
                .st-settings-tabs {
                    display: flex;
                    border-bottom: 1px solid var(--pt-border);
                    background: var(--pt-card-bg);
                    margin: -20px -20px 20px -20px;
                    padding: 0 8px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                }
                .st-settings-tabs::-webkit-scrollbar { display: none; }
                .st-set-tab {
                    padding: 14px 10px;
                    font-weight: 600;
                    font-size: 13px;
                    color: var(--pt-sub-text);
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .st-set-tab.active { color: var(--pt-accent); border-bottom-color: var(--pt-accent); }
                .st-row-block { padding: 16px; border-bottom: 1px solid var(--pt-border); display: flex; flex-direction: column; gap: 10px; }
                .st-row-block:last-child { border-bottom: none; }
                .st-select { border: none; background: transparent; color: var(--pt-accent); font-size: 16px; outline: none; }

                /* [수정] 썸네일 스타일 강화 */
                .st-bg-list { display: flex; gap: 10px; flex-wrap: wrap; }
                .st-bg-preview {
                    width: 60px; height: 100px;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    border: 2px solid rgba(255,255,255,0.1);
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .st-bg-preview:hover { transform: scale(1.05); }
                .st-bg-preview.upload { display: flex; align-items: center; justify-content: center; background: #ddd; font-size: 24px; color:#555; }
                .st-bg-preview.upload input { display: none; }

                .st-btn-small { margin-top: 5px; padding: 6px 12px; background: var(--pt-border); border: none; border-radius: 8px; font-size: 12px; cursor: pointer; align-self: flex-start; }
                .mono { font-family: 'SF Mono', 'Consolas', monospace !important; font-size: 12px !important; line-height: 1.5; }

                /* 체크박스 옵션 스타일 */
                .st-checkbox-option {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--pt-border, #e5e5e5);
                }
                .st-checkbox-option:last-child {
                    border-bottom: none;
                }
                .st-checkbox-option input[type="checkbox"] {
                    position: relative !important;
                    width: 44px !important;
                    height: 24px !important;
                    margin: 0;
                    margin-top: 2px;
                    -webkit-appearance: none !important;
                    -moz-appearance: none !important;
                    appearance: none !important;
                    background-color: #78788080 !important;
                    border-radius: 12px !important;
                    cursor: pointer !important;
                    border: none !important;
                    outline: none !important;
                    transition: background-color 0.3s !important;
                    flex-shrink: 0;
                }
                .st-checkbox-option input[type="checkbox"]:checked {
                    background-color: #34c759 !important;
                }
                .st-checkbox-option input[type="checkbox"]::after {
                    content: "" !important;
                    position: absolute !important;
                    top: 2px !important;
                    left: 2px !important;
                    width: 20px !important;
                    height: 20px !important;
                    background: #fff !important;
                    border-radius: 50% !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
                    transition: transform 0.3s !important;
                }
                .st-checkbox-option input[type="checkbox"]:checked::after {
                    transform: translateX(20px) !important;
                }

                /* 설정앱 내부 토글 스위치 스타일 강제 */
                .st-settings-app .st-switch {
                    position: relative !important;
                    width: 44px !important;
                    height: 24px !important;
                    -webkit-appearance: none !important;
                    -moz-appearance: none !important;
                    appearance: none !important;
                    background-color: #78788080 !important;
                    border-radius: 12px !important;
                    cursor: pointer !important;
                    border: none !important;
                    outline: none !important;
                    transition: background-color 0.3s !important;
                }
                .st-settings-app .st-switch:checked {
                    background-color: #34c759 !important;
                }
                .st-settings-app .st-switch::after {
                    content: "" !important;
                    position: absolute !important;
                    top: 2px !important;
                    left: 2px !important;
                    width: 20px !important;
                    height: 20px !important;
                    background: #fff !important;
                    border-radius: 50% !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
                    transition: transform 0.3s !important;
                }
                .st-settings-app .st-switch:checked::after {
                    transform: translateX(20px) !important;
                }

                .st-checkbox-option-content {
                    flex: 1;
                }
                .st-checkbox-option-title {
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--pt-text-color, #1d1d1f);
                    margin-bottom: 4px;
                }
                .st-checkbox-option-desc {
                    font-size: 13px;
                    color: var(--pt-sub-text, #86868b);
                    line-height: 1.4;
                }

                /* 프롬프트 헤더 (라벨 + 깊이) */
                .st-prompt-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                }
                .st-depth-control {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    background: var(--pt-bg-color, #f0f0f0);
                    padding: 4px 10px;
                    border-radius: 8px;
                }
                .st-depth-label {
                    font-size: 12px;
                    color: var(--pt-sub-text, #666);
                }
                .st-depth-input {
                    width: 50px;
                    padding: 4px 8px;
                    border: 1px solid var(--pt-border, #ddd);
                    border-radius: 6px;
                    font-size: 13px;
                    text-align: center;
                    background: var(--pt-card-bg, #fff);
                    color: var(--pt-text-color, #000);
                }
                .st-depth-input:focus {
                    outline: none;
                    border-color: var(--pt-accent, #007aff);
                }
                /* 프롬프트 내보내기/불러오기 버튼 스타일 */
                .st-prompt-io-btn {
                    flex: 1;
                    padding: 14px 16px;
                    border: none;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    text-align: center;
                    transition: background 0.2s, transform 0.1s;
                }
                #st-export-prompts {
                    background: var(--pt-accent, #007aff);
                    color: white;
                }
                #st-export-prompts:hover { opacity: 0.9; }
                #st-export-prompts:active { transform: scale(0.98); }
                #st-import-prompts-label {
                    background: var(--pt-card-bg, #e5e5ea);
                    color: var(--pt-text-color, #333);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                #st-import-prompts-label:hover { opacity: 0.9; }
                #st-import-prompts-label:active { transform: scale(0.98); }
            </style>
        `;

        $screen.append(html);
        loadValuesToUI();
        attachListeners();

        applyTheme();
        applyWallpaper();
        applyFont();
    }

    function loadValuesToUI() {
        // 일반
        $('#st-set-darkmode').prop('checked', currentSettings.isDarkMode);
        $('#st-set-font').val(currentSettings.fontFamily);
        $('#st-set-record-mode').prop('checked', currentSettings.recordMode === 'accumulate');
        $('#st-set-branch-copy').prop('checked', currentSettings.branchCopyRecords);
        // 프로필
        $('#st-set-name').val(currentSettings.userName);
        $('#st-set-personality').val(currentSettings.userPersonality);
        $('#st-set-tags').val(currentSettings.userTags);
        $('#st-set-profile-autosync').prop('checked', currentSettings.profileAutoSync !== false);
        $('#st-set-profile-global').prop('checked', currentSettings.profileGlobal);
        // 아바타 미리보기
        const DEFAULT_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';
        $('#st-set-avatar-preview').attr('src', currentSettings.userAvatar || DEFAULT_AVATAR);
// AI
        /* 수정 후 (loadValuesToUI 함수 안 - 아래줄 추가) */
$('#st-set-sync').prop('checked', currentSettings.chatToSms);
$('#st-set-read-receipt').prop('checked', currentSettings.readReceiptEnabled !== false); // [NEW] 로드
$('#st-set-prefill').val(currentSettings.prefill);

$('#st-set-timestamp-mode').val(currentSettings.timestampMode || 'none');
$('#st-set-max-tokens').val(currentSettings.maxContextTokens || 4096);

loadConnectionProfiles();

$('#st-set-interrupt').prop('checked', currentSettings.interruptEnabled !== false);
$('#st-set-interrupt-count').val(currentSettings.interruptCount || 3);
$('#st-set-interrupt-delay').val(currentSettings.interruptDelay || 2000);
if (currentSettings.interruptEnabled === false) {
    $('#st-interrupt-options').hide();
}

$('#st-set-sms-persona').val(currentSettings.smsPersona);

        $('#st-set-proactive').prop('checked', currentSettings.proactiveEnabled);
        $('#st-set-proactive-chance').val(currentSettings.proactiveChance || 30);
        $('#st-proactive-chance-display').text((currentSettings.proactiveChance || 30) + '%');
        $('#st-set-proactive-prompt').val(currentSettings.proactivePrompt || defaultSettings.proactivePrompt);
        if (currentSettings.proactiveEnabled) {
            $('#st-proactive-options').show();
        }

        $('#st-set-airdrop').prop('checked', currentSettings.airdropEnabled);
        $('#st-set-airdrop-chance').val(currentSettings.airdropChance || 15);
        $('#st-airdrop-chance-display').text((currentSettings.airdropChance || 15) + '%');
        $('#st-set-airdrop-prompt').val(currentSettings.airdropPrompt || defaultSettings.airdropPrompt);
        if (currentSettings.airdropEnabled) {
            $('#st-airdrop-options').show();
        }

        // #IG_START - Instagram 설정 로드 (프롬프트 탭)
        $('#st-set-insta-post-enabled').prop('checked', currentSettings.instagramPostEnabled !== false);
        $('#st-set-insta-post-chance').val(currentSettings.instagramPostChance || 15);
        $('#st-insta-post-chance-display').text((currentSettings.instagramPostChance || 15) + '%');
        if (currentSettings.instagramPostEnabled === false) {
            $('#st-insta-options').hide();
        } else {
            $('#st-insta-options').show();
        }
        $('#st-prompt-instagram-tab').val(currentSettings.instagramPrompt || defaultSettings.instagramPrompt);
        $('#st-prompt-insta-allinone-tab').val(currentSettings.instaAllInOnePrompt || defaultSettings.instaAllInOnePrompt);
        $('#st-prompt-insta-comment-tab').val(currentSettings.instaCommentPrompt || defaultSettings.instaCommentPrompt);
        // #IG_END

        // #FLING_START - 플링 스트리밍 앱 설정 로드
        const flingInstalled = window.STPhone?.Apps?.Store?.isInstalled?.('streaming');
        if (flingInstalled) {
            $('#st-fling-settings-section').show();
            $('#st-prompt-fling-stream').val(currentSettings.flingStreamPrompt || '');
        } else {
            $('#st-fling-settings-section').hide();
        }
        // #FLING_END

        $('#st-set-translate').prop('checked', currentSettings.translateEnabled);
        $('#st-set-translate-mode').val(currentSettings.translateDisplayMode || 'both');
        $('#st-set-translate-provider').val(currentSettings.translateProvider || 'google');
        $('#st-set-translate-prompt').val(currentSettings.translatePrompt);
        $('#st-set-user-translate-prompt').val(currentSettings.userTranslatePrompt); // 이 줄 추가

        // 번역 켜져있으면 옵션 보이게
        if (currentSettings.translateEnabled) {
            $('#st-translate-options').show();
        }

// 모델 목록 업데이트
        updateTranslateModelList();
        $('#st-set-translate-model').val(currentSettings.translateModel || 'gemini-2.0-flash');

        // [NEW] 프롬프트 탭 값 로드
        $('#st-set-persist').prop('checked', currentSettings.persistSettings !== false);

        // 깊이 값 로드
        const depths = currentSettings.promptDepth || defaultSettings.promptDepth;
        $('#st-depth-sms').val(depths.smsSystemPrompt || 0);
        $('#st-depth-group').val(depths.groupChatPrompt || 0);
        $('#st-depth-phone-pickup').val(depths.phonePickupPrompt || 0);
        $('#st-depth-phone-call').val(depths.phoneCallPrompt || 0);
        $('#st-depth-camera').val(depths.cameraPrompt || 0);
        $('#st-depth-photo-msg').val(depths.photoMessagePrompt || 0);

        $('#st-prompt-sms').val(currentSettings.smsSystemPrompt || defaultSettings.smsSystemPrompt);        $('#st-prompt-group').val(currentSettings.groupChatPrompt || defaultSettings.groupChatPrompt);
        $('#st-prompt-phone-pickup').val(currentSettings.phonePickupPrompt || defaultSettings.phonePickupPrompt);
        $('#st-prompt-phone-call').val(currentSettings.phoneCallPrompt || defaultSettings.phoneCallPrompt);
        $('#st-prompt-camera').val(currentSettings.cameraPrompt || defaultSettings.cameraPrompt);
        $('#st-prompt-photo-msg').val(currentSettings.photoMessagePrompt || defaultSettings.photoMessagePrompt);
    }

    // 번역 모델 목록 업데이트 함수
    function updateTranslateModelList() {
        const provider = $('#st-set-translate-provider').val();
        const $modelSelect = $('#st-set-translate-model');
        $modelSelect.empty();

        const models = {
            'google': [
                'gemini-3-flash-preview',
                'gemini-2.5-pro-preview-05-06',
                'gemini-2.0-flash',
                'gemini-1.5-pro',
                'gemini-1.5-flash'
            ],
            'vertexai': [
                'gemini-2.5-flash',
                'gemini-2.5-pro-preview-05-06',
                'gemini-2.0-flash',
                'gemini-1.5-pro',
                'gemini-1.5-flash'
            ],
            'openai': [
                'gpt-4o-mini',
                'gpt-4o',
                'gpt-4-turbo',
                'gpt-3.5-turbo'
            ],
            'claude': [
                'claude-3-5-haiku-latest',
                'claude-3-5-sonnet-latest',
                'claude-3-haiku-20240307'
            ]
        };

        const providerModels = models[provider] || [];
        providerModels.forEach(model => {
            $modelSelect.append(`<option value="${model}">${model}</option>`);
        });
        }

    function loadConnectionProfiles() {
        const $select = $('#st-set-connection-profile');
        $select.empty();
        $select.append('<option value="">-- 기본값 (메인 API 사용) --</option>');

        try {
            const context = window.SillyTavern?.getContext?.();
            if (!context) return;

            const connectionManager = context.ConnectionManagerRequestService;
            if (!connectionManager) return;

            let profiles = [];
            if (typeof connectionManager.getConnectionProfiles === 'function') {
                profiles = connectionManager.getConnectionProfiles() || [];
            } else if (context.extensionSettings?.connectionManager?.profiles) {
                profiles = context.extensionSettings.connectionManager.profiles || [];
            }

            profiles.forEach(profile => {
                const id = profile.id || profile.name;
                const name = profile.name || profile.id;
                $select.append(`<option value="${id}">${name}</option>`);
            });

            if (currentSettings.connectionProfileId) {
                $select.val(currentSettings.connectionProfileId);
            }

            console.log(`📱 [Settings] Connection Profiles 로드됨: ${profiles.length}개`);
        } catch (e) {
            console.error('[Settings] Connection Profiles 로드 실패:', e);
        }
    }

    function attachListeners() {
        // 탭 전환
        $('.st-set-tab').on('click', function() {
            $('.st-set-tab').removeClass('active');
            $(this).addClass('active');
            $('.st-tab-page').hide();
            $(`#tab-${$(this).data('tab')}`).show();
        });

        // 값 변경 시 즉시 저장
        $('#st-set-darkmode').on('change', function() { currentSettings.isDarkMode = $(this).is(':checked'); saveToStorage(); });
        $('#st-set-font').on('change', function() { currentSettings.fontFamily = $(this).val(); saveToStorage(); });
        $('#st-set-record-mode').on('change', function() {
            const newMode = $(this).is(':checked') ? 'accumulate' : 'refresh';
            const oldMode = currentSettings.recordMode;
            currentSettings.recordMode = newMode;
            saveToStorage();

            // [NEW] 누적 모드로 전환 시 기존 데이터 마이그레이션
            if (newMode === 'accumulate' && oldMode !== 'accumulate') {
                migrateDataToCharacterBased();
                toastr.success('📚 기록 누적 모드: 새 채팅에서도 문자/전화 기록이 유지됩니다');
            } else if (newMode === 'refresh') {
                toastr.info('🔄 기록 갱신 모드: 새 채팅 시 문자/전화 기록이 초기화됩니다');
            }
        });
        $('#st-set-branch-copy').on('change', function() {
            currentSettings.branchCopyRecords = $(this).is(':checked');
            saveToStorage();
        });
        $('#st-set-name').on('input', function() { currentSettings.userName = $(this).val(); saveToStorage(); });
        $('#st-set-personality').on('input', function() { currentSettings.userPersonality = $(this).val(); saveToStorage(); });
        $('#st-set-tags').on('input', function() { currentSettings.userTags = $(this).val(); saveToStorage(); });

        // 프로필 자동 동기화 토글
        $('#st-set-profile-autosync').on('change', function() {
            currentSettings.profileAutoSync = $(this).is(':checked');
            saveToStorage();
            if (currentSettings.profileAutoSync) {
                // 동기화 켜면 바로 SillyTavern에서 가져오기
                syncFromSillyTavern();
                toastr.success('🔄 SillyTavern 페르소나와 동기화됩니다');
            } else {
                toastr.info('🔄 자동 동기화가 해제되었습니다');
            }
        });

        // 아바타 업로드
        $('#st-set-avatar-upload').on('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(ev) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 200;
                    let width = img.width, height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) { height = Math.round(height * MAX_SIZE / width); width = MAX_SIZE; }
                    } else {
                        if (height > MAX_SIZE) { width = Math.round(width * MAX_SIZE / height); height = MAX_SIZE; }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                    const compressedUrl = canvas.toDataURL('image/jpeg', 0.8);
                    currentSettings.userAvatar = compressedUrl;
                    $('#st-set-avatar-preview').attr('src', compressedUrl);
                    saveToStorage();
                    toastr.success('프로필 사진이 변경되었습니다');
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });

        // 프로필 전역 저장 체크박스
$('#st-set-profile-global').on('change', function() {
    currentSettings.profileGlobal = $(this).is(':checked');

    if (currentSettings.profileGlobal) {
        saveToStorage();
        saveProfileGlobal();
        toastr.success('🔒 프로필이 전역 저장됩니다');
    } else {
        // 체크 해제 시 메모리에서 아예 삭제
        localStorage.removeItem('st_phone_global_profile');
        saveToStorage();
        toastr.info('🔓 프로필 전역 저장이 해제되었습니다');
    }
});

        // AI 설정 저장
$('#st-set-sync').on('change', function() { currentSettings.chatToSms = $(this).is(':checked'); saveToStorage(); });
// [NEW] 리스너 추가
$('#st-set-read-receipt').on('change', function() { currentSettings.readReceiptEnabled = $(this).is(':checked'); saveToStorage(); });
$('#st-set-prefill').on('input', function() { currentSettings.prefill = $(this).val(); saveToStorage(); });
$('#st-set-timestamp-mode').on('change', function() { currentSettings.timestampMode = $(this).val(); saveToStorage(); });
$('#st-set-max-tokens').on('input', function() { currentSettings.maxContextTokens = parseInt($(this).val()) || 4096; saveToStorage(); });
$('#st-set-connection-profile').on('change', function() {
    currentSettings.connectionProfileId = $(this).val();
    saveToStorage();
    const profileName = $(this).find('option:selected').text();
    if (currentSettings.connectionProfileId) {
        toastr.success(`🔗 Connection Profile 설정됨: ${profileName}`);
    } else {
        toastr.info('🔗 기본 API로 전환됨');
    }
});

$('#st-set-interrupt').on('change', function() {
    currentSettings.interruptEnabled = $(this).is(':checked');
    if (currentSettings.interruptEnabled) {
        $('#st-interrupt-options').show();
    } else {
        $('#st-interrupt-options').hide();
    }
    saveToStorage();
});
$('#st-set-interrupt-count').on('input', function() {
    currentSettings.interruptCount = parseInt($(this).val()) || 3;
    saveToStorage();
});
$('#st-set-interrupt-delay').on('input', function() {
    currentSettings.interruptDelay = parseInt($(this).val()) || 2000;
    saveToStorage();
});

$('#st-set-sms-persona').on('input', function() { currentSettings.smsPersona = $(this).val(); saveToStorage(); });
        // systemPrompt는 프롬프트 탭으로 이동됨
        // 배경화면 및 업로드
        $('.st-bg-preview[data-bg]').on('click', function() {
            currentSettings.wallpaper = $(this).data('bg');
            saveToStorage();
        });
        $('#st-bg-upload').on('change', function(e) {
            const file = e.target.files[0];
            if (file) compressImage(file, base64 => { currentSettings.wallpaper = `url(${base64})`; saveToStorage(); });
        });

// ========== 선제 메시지 설정 이벤트 ==========
        $('#st-set-proactive').on('change', function() {
            currentSettings.proactiveEnabled = $(this).is(':checked');
            if (currentSettings.proactiveEnabled) {
                $('#st-proactive-options').show();
            } else {
                $('#st-proactive-options').hide();
            }
            saveToStorage();
            $(document).trigger('stPhoneProactiveChanged', [currentSettings.proactiveEnabled]);
        });
        $('#st-set-proactive-chance').on('input', function() {
            currentSettings.proactiveChance = parseInt($(this).val()) || 30;
            $('#st-proactive-chance-display').text(currentSettings.proactiveChance + '%');
            saveToStorage();
        });
        $('#st-set-proactive-prompt').on('input', function() {
            currentSettings.proactivePrompt = $(this).val();
            saveToStorage();
        });
        $('#st-reset-proactive-prompt').on('click', () => {
            if(confirm('선제 메시지 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.proactivePrompt = defaultSettings.proactivePrompt;
                $('#st-set-proactive-prompt').val(currentSettings.proactivePrompt);
                saveToStorage();
            }
        });

// ========== 에어드롭 설정 이벤트 ==========
        $('#st-set-airdrop').on('change', function() {
            currentSettings.airdropEnabled = $(this).is(':checked');
            if (currentSettings.airdropEnabled) {
                $('#st-airdrop-options').show();
            } else {
                $('#st-airdrop-options').hide();
            }
            saveToStorage();
            $(document).trigger('stPhoneAirdropChanged', [currentSettings.airdropEnabled]);
        });
        $('#st-set-airdrop-chance').on('input', function() {
            currentSettings.airdropChance = parseInt($(this).val()) || 15;
            $('#st-airdrop-chance-display').text(currentSettings.airdropChance + '%');
            saveToStorage();
        });
        $('#st-set-airdrop-prompt').on('input', function() {
            currentSettings.airdropPrompt = $(this).val();
            saveToStorage();
        });
        $('#st-reset-airdrop-prompt').on('click', () => {
            if(confirm('에어드롭 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.airdropPrompt = defaultSettings.airdropPrompt;
                $('#st-set-airdrop-prompt').val(currentSettings.airdropPrompt);
                saveToStorage();
            }
        });

// #IG_START - Instagram 설정 이벤트 핸들러
        $('#st-set-insta-post-enabled').on('change', function() {
            currentSettings.instagramPostEnabled = $(this).is(':checked');
            if (currentSettings.instagramPostEnabled) {
                $('#st-insta-options').show();
            } else {
                $('#st-insta-options').hide();
            }
            saveToStorage();
        });
        $('#st-set-insta-post-chance').on('input', function() {
            currentSettings.instagramPostChance = parseInt($(this).val()) || 15;
            $('#st-insta-post-chance-display').text(currentSettings.instagramPostChance + '%');
            saveToStorage();
        });

        // 프롬프트 탭용 인스타그램 이벤트 핸들러
        $('#st-prompt-instagram-tab').on('input', function() {
            currentSettings.instagramPrompt = $(this).val();
            saveToStorage();
        });
        $('#st-reset-instagram-prompt-tab').on('click', () => {
            if(confirm('인스타그램 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.instagramPrompt = defaultSettings.instagramPrompt;
                $('#st-prompt-instagram-tab').val(currentSettings.instagramPrompt);
                saveToStorage();
            }
        });
        $('#st-prompt-insta-allinone-tab').on('input', function() {
            currentSettings.instaAllInOnePrompt = $(this).val();
            saveToStorage();
        });
        $('#st-reset-insta-allinone-prompt-tab').on('click', () => {
            if(confirm('인스타그램 올인원 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.instaAllInOnePrompt = defaultSettings.instaAllInOnePrompt;
                $('#st-prompt-insta-allinone-tab').val(currentSettings.instaAllInOnePrompt);
                saveToStorage();
            }
        });
        $('#st-prompt-insta-comment-tab').on('input', function() {
            currentSettings.instaCommentPrompt = $(this).val();
            saveToStorage();
        });
        $('#st-reset-insta-comment-prompt-tab').on('click', () => {
            if(confirm('인스타그램 댓글 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.instaCommentPrompt = defaultSettings.instaCommentPrompt;
                $('#st-prompt-insta-comment-tab').val(currentSettings.instaCommentPrompt);
                saveToStorage();
            }
        });
// #IG_END

// #FLING_START - 플링 스트리밍 앱 이벤트 핸들러
        $('#st-prompt-fling-stream').on('input', function() {
            currentSettings.flingStreamPrompt = $(this).val();
            saveToStorage();
        });
        $('#st-reset-fling-prompt').on('click', () => {
            if(confirm('플링 프롬프트를 비우고 기본값을 사용하시겠습니까?')) {
                currentSettings.flingStreamPrompt = '';
                $('#st-prompt-fling-stream').val('');
                saveToStorage();
                toastr.success('플링 프롬프트가 기본값으로 설정됩니다.');
            }
        });
// #FLING_END

// 번역 설정 이벤트
        $('#st-set-translate').on('change', function() {
            currentSettings.translateEnabled = $(this).is(':checked');
            if (currentSettings.translateEnabled) {
                $('#st-translate-options').show();
            } else {
                $('#st-translate-options').hide();
            }
            saveToStorage();
        });
        $('#st-set-translate-mode').on('change', function() {
            currentSettings.translateDisplayMode = $(this).val();
            saveToStorage();
        });
        $('#st-set-translate-provider').on('change', function() {
            currentSettings.translateProvider = $(this).val();
            updateTranslateModelList();
            // 공급자 변경 시 첫 번째 모델 자동 선택
            currentSettings.translateModel = $('#st-set-translate-model').val();
            saveToStorage();
        });
        $('#st-set-translate-model').on('change', function() {
            currentSettings.translateModel = $(this).val();
            saveToStorage();
        });
        $('#st-set-translate-prompt').on('input', function() {
            currentSettings.translatePrompt = $(this).val();
            saveToStorage();
        });
        $('#st-reset-translate-prompt').on('click', () => {
            if(confirm('번역 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.translatePrompt = defaultSettings.translatePrompt;
                $('#st-set-translate-prompt').val(currentSettings.translatePrompt);
                saveToStorage();
            }
        });

        // 내 메시지 번역 프롬프트 저장 및 초기화 리스너 추가
        $('#st-set-user-translate-prompt').on('input', function() {
            currentSettings.userTranslatePrompt = $(this).val();
            saveToStorage();
        });
$('#st-reset-user-translate-prompt').on('click', () => {
            if(confirm('내 메시지 번역 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.userTranslatePrompt = defaultSettings.userTranslatePrompt;
                $('#st-set-user-translate-prompt').val(currentSettings.userTranslatePrompt);
                saveToStorage();
            }
        });

        // ========== [NEW] 프롬프트 탭 이벤트 ==========

        // 깊이 설정 이벤트
        function updateDepth(key, value) {
            if (!currentSettings.promptDepth) {
                currentSettings.promptDepth = { ...defaultSettings.promptDepth };
            }
            currentSettings.promptDepth[key] = parseInt(value) || 0;
            saveToStorage();
        }

        $('#st-depth-sms').on('change', function() { updateDepth('smsSystemPrompt', $(this).val()); });
        $('#st-depth-group').on('change', function() { updateDepth('groupChatPrompt', $(this).val()); });
        $('#st-depth-phone-pickup').on('change', function() { updateDepth('phonePickupPrompt', $(this).val()); });
        $('#st-depth-phone-call').on('change', function() { updateDepth('phoneCallPrompt', $(this).val()); });
        $('#st-depth-camera').on('change', function() { updateDepth('cameraPrompt', $(this).val()); });
        $('#st-depth-photo-msg').on('change', function() { updateDepth('photoMessagePrompt', $(this).val()); });

        $('#st-set-persist').on('change', function() {
            currentSettings.persistSettings = $(this).is(':checked');
            saveToStorage();
            if (currentSettings.persistSettings) {
                toastr.success('✅ 설정이 모든 채팅에서 유지됩니다');
            }
        });

        // 문자 프롬프트
        $('#st-prompt-sms').on('input', function() { currentSettings.smsSystemPrompt = $(this).val(); saveToStorage(); });
        $('#st-reset-sms-prompt').on('click', () => {
            if(confirm('문자 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.smsSystemPrompt = defaultSettings.smsSystemPrompt;
                $('#st-prompt-sms').val(currentSettings.smsSystemPrompt);
                saveToStorage();
            }
        });

        // 그룹 채팅 프롬프트
        $('#st-prompt-group').on('input', function() { currentSettings.groupChatPrompt = $(this).val(); saveToStorage(); });
        $('#st-reset-group-prompt').on('click', () => {
            if(confirm('그룹 채팅 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.groupChatPrompt = defaultSettings.groupChatPrompt;
                $('#st-prompt-group').val(currentSettings.groupChatPrompt);
                saveToStorage();
            }
        });

        // 전화 수신 프롬프트
        $('#st-prompt-phone-pickup').on('input', function() { currentSettings.phonePickupPrompt = $(this).val(); saveToStorage(); });
        $('#st-reset-phone-pickup').on('click', () => {
            if(confirm('전화 수신 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.phonePickupPrompt = defaultSettings.phonePickupPrompt;
                $('#st-prompt-phone-pickup').val(currentSettings.phonePickupPrompt);
                saveToStorage();
            }
        });

        // 전화 대화 프롬프트
        $('#st-prompt-phone-call').on('input', function() { currentSettings.phoneCallPrompt = $(this).val(); saveToStorage(); });
        $('#st-reset-phone-call').on('click', () => {
            if(confirm('전화 대화 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.phoneCallPrompt = defaultSettings.phoneCallPrompt;
                $('#st-prompt-phone-call').val(currentSettings.phoneCallPrompt);
                saveToStorage();
            }
        });

        // 카메라 프롬프트
        $('#st-prompt-camera').on('input', function() { currentSettings.cameraPrompt = $(this).val(); saveToStorage(); });
        $('#st-reset-camera-prompt').on('click', () => {
            if(confirm('카메라 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.cameraPrompt = defaultSettings.cameraPrompt;
                $('#st-prompt-camera').val(currentSettings.cameraPrompt);
                saveToStorage();
            }
        });

        // 사진 메시지 프롬프트
        $('#st-prompt-photo-msg').on('input', function() { currentSettings.photoMessagePrompt = $(this).val(); saveToStorage(); });
        $('#st-reset-photo-msg').on('click', () => {
            if(confirm('사진 메시지 프롬프트를 기본값으로 되돌릴까요?')) {
                currentSettings.photoMessagePrompt = defaultSettings.photoMessagePrompt;
                $('#st-prompt-photo-msg').val(currentSettings.photoMessagePrompt);
                saveToStorage();
            }
        });

        // ========== 프롬프트 내보내기/불러오기 ==========
        $('#st-export-prompts').on('click', exportAllPrompts);
        $('#st-import-prompts').on('change', importAllPrompts);
    }

    // ========== 프롬프트 내보내기 함수 ==========
    function exportAllPrompts() {
        // 내보낼 프롬프트들만 추출
        const promptsToExport = {
            _exportInfo: {
                app: 'ST Phone System',
                version: '1.0.5',
                exportDate: new Date().toISOString(),
                type: 'prompts'
            },
            promptDepth: currentSettings.promptDepth || defaultSettings.promptDepth,
            smsSystemPrompt: currentSettings.smsSystemPrompt,
            groupChatPrompt: currentSettings.groupChatPrompt,
            phonePickupPrompt: currentSettings.phonePickupPrompt,
            phoneCallPrompt: currentSettings.phoneCallPrompt,
            cameraPrompt: currentSettings.cameraPrompt,
            photoMessagePrompt: currentSettings.photoMessagePrompt,
            translatePrompt: currentSettings.translatePrompt,
            userTranslatePrompt: currentSettings.userTranslatePrompt,
            prefill: currentSettings.prefill,
            // #IG_START
            instagramPrompt: currentSettings.instagramPrompt,
            instaAllInOnePrompt: currentSettings.instaAllInOnePrompt,
            instaCommentPrompt: currentSettings.instaCommentPrompt,
            // #IG_END
            // #FLING_START
            flingStreamPrompt: currentSettings.flingStreamPrompt
            // #FLING_END
        };

        // JSON 파일로 변환
        const jsonStr = JSON.stringify(promptsToExport, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // 다운로드 트리거
        const a = document.createElement('a');
        a.href = url;
        const date = new Date();
        const dateStr = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
        a.download = `st-phone-prompts_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toastr.success('📤 프롬프트가 내보내기 되었습니다!');
    }

    // ========== 프롬프트 불러오기 함수 ==========
    function importAllPrompts(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const imported = JSON.parse(e.target.result);

                // 유효성 검사
                if (!imported._exportInfo || imported._exportInfo.type !== 'prompts') {
                    toastr.error('❌ 유효하지 않은 프롬프트 파일입니다.');
                    return;
                }

                // 프롬프트들 적용
                let importedCount = 0;

                // 깊이 설정 불러오기
                if (imported.promptDepth) {
                    currentSettings.promptDepth = imported.promptDepth;
                    $('#st-depth-sms').val(imported.promptDepth.smsSystemPrompt || 0);
                    $('#st-depth-group').val(imported.promptDepth.groupChatPrompt || 0);
                    $('#st-depth-phone-pickup').val(imported.promptDepth.phonePickupPrompt || 0);
                    $('#st-depth-phone-call').val(imported.promptDepth.phoneCallPrompt || 0);
                    $('#st-depth-camera').val(imported.promptDepth.cameraPrompt || 0);
                    $('#st-depth-photo-msg').val(imported.promptDepth.photoMessagePrompt || 0);
                    importedCount++;
                }

                if (imported.smsSystemPrompt) {
                    currentSettings.smsSystemPrompt = imported.smsSystemPrompt;
                    $('#st-prompt-sms').val(imported.smsSystemPrompt);
                    importedCount++;
                }
                if (imported.groupChatPrompt) {
                    currentSettings.groupChatPrompt = imported.groupChatPrompt;
                    $('#st-prompt-group').val(imported.groupChatPrompt);
                    importedCount++;
                }
                if (imported.phonePickupPrompt) {
                    currentSettings.phonePickupPrompt = imported.phonePickupPrompt;
                    $('#st-prompt-phone-pickup').val(imported.phonePickupPrompt);
                    importedCount++;
                }
                if (imported.phoneCallPrompt) {
                    currentSettings.phoneCallPrompt = imported.phoneCallPrompt;
                    $('#st-prompt-phone-call').val(imported.phoneCallPrompt);
                    importedCount++;
                }
                if (imported.cameraPrompt) {
                    currentSettings.cameraPrompt = imported.cameraPrompt;
                    $('#st-prompt-camera').val(imported.cameraPrompt);
                    importedCount++;
                }
                if (imported.photoMessagePrompt) {
                    currentSettings.photoMessagePrompt = imported.photoMessagePrompt;
                    $('#st-prompt-photo-msg').val(imported.photoMessagePrompt);
                    importedCount++;
                }
                if (imported.translatePrompt) {
                    currentSettings.translatePrompt = imported.translatePrompt;
                    $('#st-set-translate-prompt').val(imported.translatePrompt);
                    importedCount++;
                }
                if (imported.userTranslatePrompt) {
                    currentSettings.userTranslatePrompt = imported.userTranslatePrompt;
                    $('#st-set-user-translate-prompt').val(imported.userTranslatePrompt);
                    importedCount++;
                }
                if (imported.prefill) {
                    currentSettings.prefill = imported.prefill;
                    $('#st-set-prefill').val(imported.prefill);
                    importedCount++;
                }
                // #IG_START
                if (imported.instagramPrompt) {
                    currentSettings.instagramPrompt = imported.instagramPrompt;
                    $('#st-prompt-instagram-tab').val(imported.instagramPrompt);
                    importedCount++;
                }
                if (imported.instaAllInOnePrompt) {
                    currentSettings.instaAllInOnePrompt = imported.instaAllInOnePrompt;
                    $('#st-prompt-insta-allinone-tab').val(imported.instaAllInOnePrompt);
                    importedCount++;
                }
                if (imported.instaCommentPrompt) {
                    currentSettings.instaCommentPrompt = imported.instaCommentPrompt;
                    $('#st-prompt-insta-comment-tab').val(imported.instaCommentPrompt);
                    importedCount++;
                }
                // #IG_END

                // #FLING_START
                if (imported.flingStreamPrompt !== undefined) {
                    currentSettings.flingStreamPrompt = imported.flingStreamPrompt;
                    $('#st-prompt-fling-stream').val(imported.flingStreamPrompt);
                    importedCount++;
                }
                // #FLING_END

                // 저장
                saveToStorage();

                toastr.success(`📥 ${importedCount}개의 프롬프트를 불러왔습니다!`);

                // 내보낸 날짜 표시
                if (imported._exportInfo.exportDate) {
                    const exportDate = new Date(imported._exportInfo.exportDate);
                    toastr.info(`📅 내보낸 날짜: ${exportDate.toLocaleDateString()}`);
                }

            } catch (err) {
                console.error('[Settings] 프롬프트 불러오기 실패:', err);
                toastr.error('❌ 파일을 읽는 중 오류가 발생했습니다.');
            }
        };

        reader.readAsText(file);

        // 파일 입력 초기화 (같은 파일 다시 선택 가능하도록)
        event.target.value = '';
    }

    function applyTheme() {
        const $phone = $('#st-phone-container');
        currentSettings.isDarkMode ? $phone.addClass('dark-mode') : $phone.removeClass('dark-mode');
    }
    function applyWallpaper() {
        // 테마 앱에서 배경을 설정한 경우 세팅의 배경화면은 무시
        if (window.STPhone.Apps?.Theme?.getCurrentTheme) {
            const theme = window.STPhone.Apps.Theme.getCurrentTheme();
            if (theme?.phone?.bgImage && theme.phone.bgImage.length > 0) {
                return; // 테마 앱 배경 우선
            }
        }
        $('.st-phone-screen').css({ background: currentSettings.wallpaper, backgroundSize: 'cover', backgroundPosition: 'center' });
    }
    function applyFont() {
        const fonts = { 'serif': "'Times New Roman', serif", 'mono': "'Courier New', monospace", 'default': "-apple-system, sans-serif" };
        $('#st-phone-container').css('--pt-font', fonts[currentSettings.fontFamily] || fonts['default']);
    }

    function init() {
        // 초기 로드
        loadFromStorage();

        // 자동 동기화가 켜져 있으면 SillyTavern에서 페르소나 정보 가져오기
        if (currentSettings.profileAutoSync !== false) {
            setTimeout(() => {
                syncFromSillyTavern();
            }, 500);
        }

        // 초기화 시 한번 로드
        setInterval(() => {
             // 채팅방 바뀔때 감지 로직 (기존과 동일)
             loadFromStorage();
             applyTheme(); applyWallpaper(); applyFont();
        }, 1000);
    }

    return { open, init, getSettings, getPromptDepth, updateSetting, syncFromSillyTavern, getBlockedContacts, blockContact, unblockContact, isBlocked };
})();

(function() {
    'use strict';

const EXTENSION_NAME = 'ST Phone System';
    const EXTENSION_FOLDER = 'st-phone-system';
    const BASE_PATH = `/scripts/extensions/third-party/${EXTENSION_FOLDER}`;

    // 타임스탬프 기능용 상태 추적
    let lastMessageWasHiddenLog = false;  // 마지막 메시지가 히든로그였는지
    let needsTimestampOnNextPhoneMsg = false;  // 다음 폰 메시지에 타임스탬프 필요한지

    function loadModule(fileName) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${BASE_PATH}/${fileName}`;
            script.onload = () => {
                console.log(`[${EXTENSION_NAME}] Loaded: ${fileName}`);
                resolve();
            };
            script.onerror = (e) => reject(e);
            document.head.appendChild(script);
        });
    }

    async function initialize() {
        console.log(`🚀 [${EXTENSION_NAME}] Starting initialization...`);

        try {
            // 1. Core 모듈 로드
            await loadModule('utils.js');

            // 2. Feature 모듈 로드
            await loadModule('ui.js');
            await loadModule('inputs.js');

            // 3. 기본 Apps 모듈 로드 (apps 폴더 내 파일들)
            await loadModule('apps/settings.js');
            await loadModule('apps/camera.js');
            await loadModule('apps/album.js');
            await loadModule('apps/contacts.js');
            await loadModule('apps/messages.js');
            await loadModule('apps/phone.js');

            // 4. 스토어 앱 로드
            await loadModule('apps/store.js');

            // 5. 스토어에서 설치 가능한 앱들 로드
            await loadModule('apps/store-apps/notes.js');
            await loadModule('apps/store-apps/weather.js');
            await loadModule('apps/store-apps/games.js');
            await loadModule('apps/store-apps/calendar.js');
            await loadModule('apps/store-apps/theme.js');
            await loadModule('apps/store-apps/bank.js');
            await loadModule('apps/store-apps/streaming.js');
            await loadModule('apps/store-apps/instagram.js');



            // 6. 모듈별 Init 실행
            if (window.STPhone.UI) {
                window.STPhone.UI.init({
                    utils: window.STPhone.Utils
                });
            }

            if (window.STPhone.Inputs) {
                window.STPhone.Inputs.init({
                    utils: window.STPhone.Utils,
                    ui: window.STPhone.UI
                });
            }

            // 6.5. 테마 앱 자동 초기화 (저장된 테마 불러오기)
            if (window.STPhone.Apps && window.STPhone.Apps.Theme) {
                window.STPhone.Apps.Theme.init();
            }

            // 7. 실리태번 옵션 메뉴에 폰 토글 버튼 추가
            addPhoneToggleButton();

            // 8. 브랜치 기록 복사 핸들러 설정
            setupBranchCopyHandler();

            console.log(`✅ [${EXTENSION_NAME}] All modules initialized! Press 'X' to toggle phone.`);

        } catch (error) {
            console.error(`❌ [${EXTENSION_NAME}] Initialization failed:`, error);
        }
    }

    // [NEW] 실리태번 옵션 메뉴에 폰 토글 버튼 추가
    function addPhoneToggleButton() {
        // 이미 추가되어 있으면 스킵
        if ($('#option_toggle_phone').length > 0) return;

        // 옵션 메뉴 (#options .options-content)에 폰 버튼 추가
        const $optionsContent = $('#options .options-content');
        if ($optionsContent.length > 0) {
            // Author's Note 항목 뒤에 추가
            const phoneOption = `
                <a id="option_toggle_phone">
                    <i class="fa-lg fa-solid fa-mobile-screen"></i>
                    <span>📱 Phone</span>
                </a>
            `;

            // option_toggle_AN 뒤에 삽입
            const $anOption = $('#option_toggle_AN');
            if ($anOption.length > 0) {
                $anOption.after(phoneOption);
            } else {
                // 못 찾으면 그냥 맨 앞에 추가
                $optionsContent.prepend(phoneOption);
            }

            // 클릭 이벤트 연결
            $('#option_toggle_phone').on('click', function() {
                // 옵션 메뉴 닫기
                $('#options').hide();

                // 폰 토글
                if (window.STPhone && window.STPhone.UI) {
                    window.STPhone.UI.togglePhone();
                }
            });

            console.log(`📱 [${EXTENSION_NAME}] Phone toggle button added to options menu.`);
        }
    }

    $(document).ready(function() {
        setTimeout(initialize, 500);

        // 메인 채팅 감시자 실행
       // 수정후 코드
        // 메인 채팅 감시자 실행
        setupChatObserver();

        // 캘린더 프롬프트 주입 이벤트 리스너
        setupCalendarPromptInjector();
    });

    // 감시자 함수 정의
/* ==============================================================
   수정후 코드 (index.js 하단부를 이걸로 완전히 교체하세요)
   ============================================================== */

    // [중요] 페이지 로드 시 기존 메시지도 검사하기 위해 Observer 시작 전 스캔 실행
    function applyHideLogicToAll() {
        const messages = document.querySelectorAll('.mes');
        messages.forEach(node => {
            hideSystemLogs(node); // 이미 있는 메시지 숨기기
        });
    }

    // 감시자 함수 정의 (Observer)
    function setupChatObserver() {
        // 채팅창(#chat)이 존재할 때까지 대기
        const target = document.querySelector('#chat');
        if (!target) {
            setTimeout(setupChatObserver, 1000);
            return;
        }

        // 1. [핵심] 챗이 로드되자마자 현재 화면에 있는 로그들을 싹 검사해서 숨김
        applyHideLogicToAll();

        // 2. 새 메시지가 추가되는지 감시
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // 노드가 추가될 때 (새 메시지, 혹은 채팅 로드)
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList.contains('mes')) {
                        // 순서 중요: 먼저 숨길 건지 판단하고 -> 그 다음 폰과 동기화
                        hideSystemLogs(node);
                        processSync(node);
                    }
                });
            });
        });

        observer.observe(target, { childList: true, subtree: true });
        console.log(`[${EXTENSION_NAME}] Chat Observer & Auto-Hider Started.`);
    }

    // [신규 기능] 폰 로그인지 검사하고 숨겨주는 함수
    function hideSystemLogs(node) {
        // 이미 처리된 건 스킵
        if (node.classList.contains('st-phone-hidden-log')) return;
        if (node.classList.contains('st-phone-log-processed')) return;

        const textDiv = node.querySelector('.mes_text');
        if (!textDiv) return;

        const text = textDiv.innerText;
        const html = textDiv.innerHTML;

        // [NEW] 은행 로그 패턴 (텍스트에서 제거용)
        const bankLogPatterns = [
            /\[💰[^\]]*\]/gi,                    // [💰 ...] 형식
            /\(거래\s*내역:[^)]*\)/gi,           // (거래 내역: ...) 형식
        ];

        // 은행 로그가 포함되어 있으면 해당 부분만 제거
        let hasBankLog = bankLogPatterns.some(p => p.test(text));
        if (hasBankLog) {
            let cleanedHtml = html;
            bankLogPatterns.forEach(pattern => {
                cleanedHtml = cleanedHtml.replace(pattern, '');
            });
            // 빈 줄 정리
            cleanedHtml = cleanedHtml.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
            cleanedHtml = cleanedHtml.replace(/^\s*<br\s*\/?>\s*/gi, '');
            textDiv.innerHTML = cleanedHtml;
            node.classList.add('st-phone-log-processed');
        }

        // [핵심 설명]
        // ^   : 문장의 시작을 의미
        // \s* : 앞에 띄어쓰기가 몇 칸 있든 상관없이 잡아냄

        const hiddenPatterns = [
            /^\s*\[📞/i,           // 통화 시작/진행 로그
            /^\s*\[❌/i,           // 통화 종료 로그
            /^\s*\[📩/i,           // 문자 수신 로그 (사진 포함)
            /^\s*\[📵/i,           // [🌟추가됨] 거절/부재중 로그 숨기기
            /^\s*\[⛔/i,           // [🌟추가됨] 차단됨 로그 숨기기
            /^\s*\[🚫/i,           // [NEW] 이거다. "읽씹(IGNORE)" 로그 숨기기 추가됨
            /^\s*\[📲/i,           // 에어드롭 거절 로그 숨기기
            /^\s*\[ts:/i,          // [NEW] 타임스탬프 로그 숨기기
            /^\s*\[⏰/i,           // [NEW] 타임스탬프 로그 숨기기 (Time Skip)
            /^\s*\[💰/i,          // [NEW] 은행 송금/잔액 로그 숨기기 (시작 부분)
            /^\s*\[📺/i,          // [NEW] Fling 스트리밍 로그 숨기기
            /^\s*\(System:/i,     // [NEW] 시스템 로그 메시지 숨기기 (읽씹/안읽씹 등)
        ];

        // 패턴 중 하나라도 맞으면 CSS 숨김 클래스 부여
        const shouldHide = hiddenPatterns.some(regex => regex.test(text));

        if (shouldHide) {
            node.classList.add('st-phone-hidden-log');
            // 혹시 모르니 style 속성으로도 이중 잠금
            node.style.display = 'none';
        }

        // [차단 해제 감지] - 확장 밖 채팅에서 캐릭터가 차단 해제 언급하면 자동 해제
        checkForUnblock(node, text);
    }

    // [NEW] 차단 해제 감지 함수
    function checkForUnblock(node, text) {
        // 유저 메시지는 무시 (캐릭터 메시지만 체크)
        if (node.classList.contains('mes-user')) return;

        // [UNBLOCK] 태그만 감지 (정확한 태그 사용 필수)
        if (!text.includes('[UNBLOCK]')) return;

        // 캐릭터 이름 추출
        const nameDiv = node.querySelector('.name_text');
        if (!nameDiv) return;
        const charName = nameDiv.innerText.trim();

        // 해당 캐릭터가 차단 목록에 있는지 확인
        const Settings = window.STPhone?.Apps?.Settings;
        if (!Settings || typeof Settings.getBlockedContacts !== 'function') return;

        const blocked = Settings.getBlockedContacts();
        const blockedContact = blocked.find(b => b.name === charName);

        if (blockedContact) {
            // 차단 해제
            Settings.unblockContact(blockedContact.id);
            toastr.success(`${charName}님이 차단을 해제했습니다. 이제 연락할 수 있습니다.`, '차단 해제');
            console.log(`✅ [Index] ${charName} 차단 해제 감지됨`);
        }
    }

// 메시지 분석 및 폰으로 전송 (동기화)
    function processSync(node) {
        if (window.STPhone.Apps.Settings && window.STPhone.Apps.Settings.getSettings) {
            const s = window.STPhone.Apps.Settings.getSettings();
            // chatToSms 값이 존재하고 false라면(꺼져있다면) 중단
            if (s.chatToSms === false) {
                return;
            }
        }

        // 히든로그인지 확인
        const isHiddenLog = node.classList.contains('st-phone-hidden-log') || node.style.display === 'none';

        // 타임스탬프 로직: 히든로그 -> 일반채팅 -> 히든로그 전환 감지
        if (isHiddenLog) {
            // 히든로그가 온 경우
            if (!lastMessageWasHiddenLog && needsTimestampOnNextPhoneMsg) {
                // 일반채팅 후 첫 히든로그 = 타임스탬프 필요 플래그 유지
            }
            lastMessageWasHiddenLog = true;
            return;  // 히든로그는 동기화 안 함
        } else {
            // 일반 채팅이 온 경우
            if (lastMessageWasHiddenLog) {
                // 히든로그에서 일반채팅으로 바뀜 = 다음 히든로그에 타임스탬프 필요
                needsTimestampOnNextPhoneMsg = true;
            }
            lastMessageWasHiddenLog = false;
        }

        // --- 여기서부터는 기존 로직과 동일 (외부 문자 인식용) ---
        // 예: 유저가 폰 앱을 안 쓰고 채팅창에 직접 "/send (SMS) 안녕" 이라고 쳤을 때를 대비함

        const textDiv = node.querySelector('.mes_text');
        if (!textDiv) return;

        const rawText = textDiv.innerText;

        // (SMS)로 시작하는데 아직 안 숨겨진 게 있다면? -> 유저가 직접 친 것
        // 혹은 다른 확장이 만든 것.
        const smsRegex = /^[\(\[]\s*(?:SMS|Text|MMS|Message|문자)\s*[\)\]][:：]?\s*(.*)/i;
        const match = rawText.match(smsRegex);

        if (match) {
            const cleanText = match[1].trim();
            const isUser = node.getAttribute('is_user') === 'true';

            if (window.STPhone && window.STPhone.Apps && window.STPhone.Apps.Messages) {
                const sender = isUser ? 'me' : 'them';
                // 폰 앱 내부로 전송
                window.STPhone.Apps.Messages.syncExternalMessage(sender, cleanText);
            }
        }
    }
// 수정후 코드
// 타임스탬프 플래그를 외부에서 접근 가능하게 노출
    window.STPhoneTimestamp = {
        needsTimestamp: function() {
            const needs = needsTimestampOnNextPhoneMsg;
            needsTimestampOnNextPhoneMsg = false;  // 사용 후 리셋
            return needs;
        }
    };

    let lastKnownChatId = null;
    let lastKnownCharacterId = null;

    function setupBranchCopyHandler() {
        const checkInterval = setInterval(() => {
            const ctx = window.SillyTavern?.getContext?.();
            if (!ctx?.eventSource || !ctx?.eventTypes) return;

            clearInterval(checkInterval);

            lastKnownChatId = ctx.chatId;
            lastKnownCharacterId = ctx.characterId;

            ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => {
                setTimeout(() => handleChatChanged(), 500);
            });
        }, 1000);
    }

    function handleChatChanged() {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return;

        const settings = window.STPhone.Apps?.Settings?.getSettings?.() || {};
        if (!settings.branchCopyRecords) return;

        const newChatId = ctx.chatId;
        const newCharacterId = ctx.characterId;
        const mainChat = ctx.chatMetadata?.main_chat;

        if (!newChatId) {
            lastKnownChatId = newChatId;
            lastKnownCharacterId = newCharacterId;
            return;
        }

        const isSameCharacter = lastKnownCharacterId === newCharacterId;
        const isDifferentChat = lastKnownChatId !== newChatId;

        if (isSameCharacter && isDifferentChat && mainChat) {
            copyRecordsToNewChat(mainChat, newChatId);
        }

        lastKnownChatId = newChatId;
        lastKnownCharacterId = newCharacterId;
    }

    function copyRecordsToNewChat(sourceChatId, targetChatId) {
        const keySuffixes = ['messages', 'groups', 'translations', 'timestamps', 'custom_timestamps', 'calls'];
        let copied = false;

        keySuffixes.forEach(suffix => {
            const sourceKey = `st_phone_${suffix}_${sourceChatId}`;
            const targetKey = `st_phone_${suffix}_${targetChatId}`;

            const sourceData = localStorage.getItem(sourceKey);
            if (sourceData && !localStorage.getItem(targetKey)) {
                localStorage.setItem(targetKey, sourceData);
                copied = true;
            }
        });

        if (copied) {
            toastr.info('브랜치에 문자/전화 기록이 복사되었습니다');
        }
    }

    function setupCalendarPromptInjector() {
        const checkInterval = setInterval(() => {
            const ctx = window.SillyTavern?.getContext?.();
            if (!ctx) return;

            clearInterval(checkInterval);

            const eventSource = ctx.eventSource;
            const eventTypes = ctx.eventTypes;

            if (eventSource && eventTypes) {
                eventSource.on(eventTypes.CHAT_COMPLETION_PROMPT_READY, (data) => {
                    injectCalendarPrompt(data);
                });

                eventSource.on(eventTypes.MESSAGE_RECEIVED, (messageId) => {
                    setTimeout(() => processCalendarResponse(), 300);
                });
            } else {
                setupCalendarResponseObserver();
            }
        }, 1000);
    }

    function injectCalendarPrompt(data) {
        // ==========================================================
        // [수정됨] 폰/전화 사용 감지 및 기념일/프리필 처리 (순서 및 중복 해결)
        // ==========================================================
        let skipDatePrompt = false;
        let isHangUpSituation = false; // 전화 끊음 상황인지 별도 체크

        // 1. 폰 앱(문자/전화)이 자체적으로 생성 중인지 확인
        if (window.STPhone?.isPhoneGenerating) {
            skipDatePrompt = true;
        }

        // 2. 전화 끊음/거절 시스템 메시지인지 확인 (메인 채팅)
        if (!skipDatePrompt && data && data.chat && data.chat.length > 0) {
            const lastMsg = data.chat[data.chat.length - 1];
            // 메시지 내용 안전하게 가져오기
            const text = lastMsg.mes || lastMsg.content || '';

            const phoneKeywords = ['hung up', 'disconnected', 'rejected', 'declined', 'call ended', '전화', '통화', '끊음', '거절', '종료'];
            // 대괄호 [ ] 나 소괄호 ( ) 로 시작하는지 확인 (시스템 메시지 특징)
            const isSystemMsg = /^[\[\(]/.test(text);
            const hasPhoneKeyword = phoneKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));

            if (isSystemMsg && hasPhoneKeyword) {
                skipDatePrompt = true;
                isHangUpSituation = true; // 프리필 주입을 위해 플래그 켜기
            }
        }

        // 3. 폰 사용 중이거나 전화 끊음 메시지라면? -> 날짜는 빼고 처리
        if (skipDatePrompt) {
            // (1) 기념일/일정 정보만 쏙 가져오기 (날짜 제외)
            const eventPrompt = window.STPhone?.Apps?.Calendar?.getEventsOnlyPrompt?.();

            // (2) 전화 끊음 상황이고 프리필 설정이 있다면 주입 (기념일보다 나중에 와야 함)
            // 주의: data.chat에 push하면 맨 뒤에 붙으므로, 기념일 넣기 전에 미리 위치를 잡아두거나,
            // 기념일을 넣고 나서 그 뒤에 넣어야 합니다. 여기서는 순차적으로 처리합니다.

            // 먼저 기념일 주입 시도
            if (eventPrompt && data && Array.isArray(data.chat)) {
                // [중복 방지] 이미 메시지 내역(시스템 프롬프트 등)에 기념일 내용이 포함되어 있다면 추가하지 않음
                const isAlreadyIncluded = data.chat.some(msg => msg.content && msg.content.includes(eventPrompt));

                if (!isAlreadyIncluded) {
                    console.log(`📅 [ST Phone] 날짜는 빼고 '기념일'만 주입: ${eventPrompt}`);

                    // [순서 보정] 마지막 메시지가 'assistant'(프리필)라면 그보다 '앞'에 넣어야 함
                    const lastMsg = data.chat[data.chat.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                        // 프리필 바로 앞에 삽입 (splice 사용)
                        data.chat.splice(data.chat.length - 1, 0, {
                            role: 'system',
                            content: eventPrompt
                        });
                    } else {
                        // 프리필이 없으면 맨 뒤에 추가
                        data.chat.push({
                            role: 'system',
                            content: eventPrompt
                        });
                    }
                } else {
                    console.log(`📅 [ST Phone] 기념일 정보가 이미 포함되어 있어 주입을 건너뜁니다.`);
                }
            }

            // (3) 전화 끊음 상황일 때 프리필 주입 (가장 마지막에 와야 함)
            if (isHangUpSituation) {
                const settings = window.STPhone?.Apps?.Settings?.getSettings?.() || {};
                if (settings.prefill) {
                    console.log(`📞 [ST Phone] 전화 끊음 감지 -> 프리필 주입: ${settings.prefill}`);
                    data.chat.push({
                        role: 'assistant',
                        content: settings.prefill
                    });
                }
            }

            console.log(`📅 [ST Phone] 기본 날짜 형식([YYYY년...])은 생략합니다.`);
            return; // 여기서 함수 종료! (아래의 기본 날짜 프롬프트 실행 안 됨)
        }
        // ==========================================================

        // [추가됨] 방송(Streaming) 중이면 캘린더 날짜 프롬프트 주입 스킵
        if (window.STPhone?.Apps?.Streaming?.isLive?.()) {
            console.log('📅 [ST Phone] Streaming is active - Skipping Calendar prompt injection');
            return;
        }

        // 캘린더 앱이 설치되어 있는지 확인
        const Store = window.STPhone?.Apps?.Store;
        if (!Store || !Store.isInstalled('calendar')) {
            return;
        }

        const Calendar = window.STPhone?.Apps?.Calendar;
        if (!Calendar || !Calendar.isCalendarEnabled()) {
            return;
        }

        const calendarPrompt = Calendar.getPrompt();
        if (!calendarPrompt) return;

        // data.chat 또는 data.messages에 프롬프트 주입
        if (data && data.chat && Array.isArray(data.chat)) {
            // 시스템 메시지로 주입
            data.chat.push({
                role: 'system',
                content: calendarPrompt
            });
            console.log(`📅 [${EXTENSION_NAME}] Calendar prompt injected`);
        }

        // [NEW] 은행 앱 프롬프트도 주입
        if (typeof injectBankPrompt === 'function') {
            injectBankPrompt(data);
        }
        
        // [NEW] 인스타그램 프롬프트 주입
        if (typeof injectInstagramPrompt === 'function') {
            injectInstagramPrompt(data);
        }
    }

    // [NEW] 은행 프롬프트 주입 함수
    function injectBankPrompt(data) {
        // 폰 앱에서 생성 중이면 스킵 (문자앱은 자체적으로 처리함)
        if (window.STPhone?.isPhoneGenerating) {
            return;
        }

        // [추가됨] 방송(Streaming) 중이면 은행 프롬프트 주입 스킵
        if (window.STPhone?.Apps?.Streaming?.isLive?.()) {
            console.log('📺 [ST Phone] Streaming is active - Skipping Bank prompt injection');
            return;
        }

        const Store = window.STPhone?.Apps?.Store;
        if (!Store || !Store.isInstalled('bank')) {
            return;
        }

        const Bank = window.STPhone?.Apps?.Bank;
        if (!Bank) {
            return;
        }

        try {
            // 전체 은행 시스템 프롬프트 주입 (잔액 표시 + 송금 형식 설명)
            const bankPrompt = Bank.generateBankSystemPrompt();
            if (bankPrompt && data && data.chat && Array.isArray(data.chat)) {
                data.chat.push({
                    role: 'system',
                    content: bankPrompt
                });
                console.log(`💰 [${EXTENSION_NAME}] Bank system prompt injected`);
            }
        } catch (e) {
            console.warn(`[${EXTENSION_NAME}] Bank prompt injection failed:`, e);
        }
    }

    // [NEW] 인스타그램 프롬프트 주입 함수
    function injectInstagramPrompt(data) {
        // 폰 앱에서 생성 중이면 스킵 (문자앱은 자체적으로 처리함)
        if (window.STPhone?.isPhoneGenerating) {
            return;
        }
        
        // 방송(Streaming) 중이면 스킵
        if (window.STPhone?.Apps?.Streaming?.isLive?.()) {
            console.log('📺 [ST Phone] Streaming is active - Skipping Instagram prompt injection');
            return;
        }
        
        const Store = window.STPhone?.Apps?.Store;
        const Settings = window.STPhone?.Apps?.Settings;
        const currentSettings = Settings?.getSettings?.() || {};
        
        // 인스타그램 앱 설치됨 + 자동 포스팅 활성화된 경우에만 프롬프트 주입
        if (!Store || !Store.isInstalled('instagram') || currentSettings.instagramPostEnabled === false) {
            return;
        }
        
        // [NEW] 선톡처럼 확률 체크 - 확률 미달이면 프롬프트 주입 안 함 (AI가 태그 안 쓰게)
        const chance = currentSettings.instagramPostChance || 15;
        if (chance === 0) {
            console.log(`📸 [${EXTENSION_NAME}] Instagram 확률 0% - 프롬프트 주입 스킵`);
            return;
        }
        
        const roll = Math.random() * 100;
        if (roll >= chance) {
            console.log(`📸 [${EXTENSION_NAME}] Instagram 확률 미달 (${roll.toFixed(0)}% >= ${chance}%) - 프롬프트 주입 스킵`);
            return;
        }
        
        console.log(`📸 [${EXTENSION_NAME}] Instagram 확률 통과 (${roll.toFixed(0)}% < ${chance}%) - 프롬프트 주입`);
        
        // 인스타그램 프롬프트 가져오기 (기본값 포함)
        let instagramPrompt = currentSettings.instagramPrompt;
        if (!instagramPrompt) {
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
        
        if (instagramPrompt && data && data.chat && Array.isArray(data.chat)) {
            data.chat.push({
                role: 'system',
                content: instagramPrompt
            });
            console.log(`📸 [${EXTENSION_NAME}] Instagram prompt injected`);
        }
    }


    // 수정후 코드
    function processCalendarResponse() {
        try {
            const ctx = window.SillyTavern?.getContext?.();
            if (!ctx || !ctx.chat || ctx.chat.length === 0) return;

            const lastMsg = ctx.chat[ctx.chat.length - 1];
            if (!lastMsg || lastMsg.is_user) return;

            const msgText = lastMsg.mes || '';
            if (!msgText) return;

            const Store = window.STPhone?.Apps?.Store;

            // 캘린더 처리
            if (Store && Store.isInstalled('calendar')) {
                const Calendar = window.STPhone?.Apps?.Calendar;
                if (Calendar) {
                    // 날짜 추출 및 처리
                    const processed = Calendar.processAiResponse(msgText);

                    // 날짜가 추출되었으면 메시지에서 날짜 부분 숨기기
                    if (processed !== msgText) {
                        // DOM에서 해당 메시지 찾아서 날짜 부분 숨기기
                        setTimeout(() => hideCalendarDateInChat(), 100);
                    }
                }
            }

            // [NEW] 은행 송금 패턴 처리
            if (Store && Store.isInstalled('bank')) {
                const Bank = window.STPhone?.Apps?.Bank;
                if (Bank && typeof Bank.parseTransferFromResponse === 'function') {
                    try {
                        // 캐릭터 이름 추출
                        const characterName = lastMsg.name || ctx.characterName || 'Unknown';
                        Bank.parseTransferFromResponse(msgText, characterName);
                    } catch (bankErr) {
                        console.warn(`[${EXTENSION_NAME}] Bank transfer parsing failed:`, bankErr);
                    }
                }
            }
        } catch (e) {
            console.error(`[${EXTENSION_NAME}] processCalendarResponse 에러:`, e);
        }
    }

// 수정후 코드
    function hideCalendarDateInChat() {
        try {
            // 마지막 AI 메시지에서 날짜 형식 숨기기
            const messages = document.querySelectorAll('.mes:not([is_user="true"]) .mes_text');
            if (!messages || messages.length === 0) return;

            const lastMsgEl = messages[messages.length - 1];
            if (!lastMsgEl) return;

            const html = lastMsgEl.innerHTML;
            if (!html) return;

            // [2024년 3월 15일 금요일] 형식을 숨김 처리
            const dateRegex = /\[(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)\]/g;

            // 이미 숨김 처리된 경우 스킵
            if (lastMsgEl.querySelector('.st-calendar-date-hidden')) return;

            if (dateRegex.test(html)) {
                // 정규식 재설정 (test 후 lastIndex가 변경되므로)
                const replaceRegex = /\[(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)\]/g;
                lastMsgEl.innerHTML = html.replace(replaceRegex, '<span class="st-calendar-date-hidden" style="display:none;">$&</span>');
            }
        } catch (e) {
            console.error(`[${EXTENSION_NAME}] hideCalendarDateInChat 에러:`, e);
        }
    }

    function setupCalendarResponseObserver() {
        // 폴백용: MutationObserver로 새 메시지 감시
        const checkChat = setInterval(() => {
            const chatEl = document.querySelector('#chat');
            if (!chatEl) return;

            clearInterval(checkChat);

            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList.contains('mes')) {
                            // AI 메시지인 경우에만 처리
                            if (node.getAttribute('is_user') !== 'true') {
                                setTimeout(() => processCalendarResponse(), 300);
                            }
                        }
                    });
                });
            });

            observer.observe(chatEl, { childList: true, subtree: true });
        }, 1000);
    }
})();

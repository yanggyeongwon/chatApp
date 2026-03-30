# ChatApp - 실시간 채팅 & Claude Code 통합 플랫폼

## 프로젝트 개요
실시간 채팅 애플리케이션 + Claude Code CLI를 채팅 UI로 사용할 수 있는 플랫폼

## 기술 스택
- **프론트/백엔드**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui (Base UI)
- **DB/Auth/Realtime**: Supabase (PostgreSQL + RLS + Realtime + Storage)
- **AI**: Claude Code CLI (`claude -p --output-format stream-json`)
- **배포**: Vercel (웹) / Electron (데스크톱 앱)

## 구현 완료 기능

### 1. 인증 (Google OAuth)
- [x] Google OAuth 로그인/로그아웃
- [x] 자동 프로필 생성 (Google 프로필 연동)
- [x] 미들웨어 기반 라우트 보호 (/chat, /profile)
- [x] AuthProvider 컨텍스트

### 2. 채팅 UI
- [x] 사이드바 + 메인 채팅 영역 레이아웃
- [x] 모바일 반응형 (사이드바 → Sheet 드로어)
- [x] 채팅방 목록 (last_message_at 기준 정렬)
- [x] 메시지 버블 (내 메시지 우측, 상대방 좌측)
- [x] 메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)
- [x] 빈 상태 UI ("대화를 선택하세요")

### 3. 채팅방 관리
- [x] 그룹 채팅방 생성 (이름, 설명)
- [x] 1:1 DM 생성 (유저 검색 → 찾기-또는-생성)
- [x] AI 채팅방 생성 (Claude Code 전용)
- [x] 방 목록 실시간 업데이트 (Supabase Realtime)

### 4. 실시간 메시징
- [x] Supabase Realtime 기반 메시지 송수신 (postgres_changes)
- [x] 메시지 INSERT/UPDATE 실시간 구독
- [x] 자동 스크롤 (새 메시지 도착 시)
- [x] 채팅 로그 영구 저장

### 5. Claude Code 채팅방
- [x] Claude Code CLI를 서버에서 실행 (`claude -p --output-format stream-json --verbose`)
- [x] 스트리밍 응답 → DB 실시간 업데이트 → Realtime 전파
- [x] 전용 AI 방 (모든 메시지에 자동 응답)
- [x] 그룹방 AI 어시스턴트 (`@claude` 멘션 시 응답)
- [x] 봇 프로필 시스템 (별도 시스템 유저)
- [x] Claude 구독 기반 실행 (API 키 불필요)
- [x] 채팅 내 온보딩 플로우 (CLI 미설치/미로그인/미구독 시 단계별 안내)
- [x] 대화형 셋업 봇 ("설치해줘"→자동설치, "로그인해줘"→브라우저 열기, "구독 알려줘"→링크, "확인"→상태 재체크)
- [x] 메시지 전송 시 Claude Code 가용성 체크 → 불가 시 채팅으로 안내

### 6. Webhook 연동
- [x] 공개 Webhook 수신 엔드포인트 (`/api/webhooks/[webhookId]`)
- [x] HMAC 서명 검증 (GitHub SHA-256, GitLab Token, Generic)
- [x] GitHub 이벤트 파서 (push, pull_request, issues, release)
- [x] GitLab 이벤트 파서 (push, merge_request, issue)
- [x] Generic JSON payload 파서
- [x] 이벤트 필터링 (특정 이벤트만 처리)
- [x] Webhook 관리 API (생성, 목록, 삭제)
- [x] 수신 로그 (webhook_logs 테이블)

### 7. Electron 데스크톱 앱
- [x] Electron 메인 프로세스 설정
- [x] Next.js 서버 내장
- [x] electron-builder 빌드 설정 (macOS dmg, Windows nsis, Linux AppImage)

## DB 스키마
| 테이블 | 용도 |
|--------|------|
| profiles | 유저 프로필 (auth.users 연동, 자동 생성 트리거) |
| rooms | 채팅방 (dm/group/ai 타입, has_bot 플래그) |
| room_members | 방 참여자 (role: owner/admin/member) |
| messages | 메시지 (type: text/image/file/system, is_streaming) |
| message_attachments | 파일 첨부 메타데이터 |
| bots | AI 봇 설정 (profile_id, model, system_prompt) |
| bot_room_configs | 방별 봇 동작 (invocation_mode: always/mention) |
| webhooks | 외부 서비스 Webhook 설정 |
| webhook_logs | Webhook 수신 로그 |

## 프로젝트 구조
```
chat-app/
├── app/
│   ├── api/
│   │   ├── ai/chat/route.ts          # Claude Code CLI 실행 (셋업 봇 + 정상 모드)
│   │   ├── ai/rooms/route.ts         # AI 방 생성 (상태 체크 + 온보딩 메시지)
│   │   ├── ai/check/route.ts         # Claude Code CLI 설치/인증 체크
│   │   ├── ai/skills/route.ts        # 스킬 목록 API
│   │   ├── ai/files/route.ts         # 파일 탐색 API (@ 자동완성)
│   │   ├── rooms/dm/route.ts         # DM 찾기-또는-생성
│   │   ├── rooms/group/route.ts      # 그룹방 생성
│   │   ├── rooms/[roomId]/webhooks/  # Webhook 관리
│   │   └── webhooks/[webhookId]/     # Webhook 수신
│   ├── auth/callback/route.ts        # Google OAuth 콜백
│   ├── chat/
│   │   ├── layout.tsx                # 사이드바 + 메인 레이아웃
│   │   ├── page.tsx                  # 빈 상태
│   │   └── [roomId]/page.tsx         # 채팅방 뷰
│   ├── login/page.tsx                # 로그인 페이지
│   └── layout.tsx                    # 루트 레이아웃 (AuthProvider)
├── components/
│   ├── ai/                           # AI 관련 (스킬 패널, AI방 버튼)
│   ├── auth/                         # 로그인 폼
│   ├── chat/                         # 채팅 UI 컴포넌트
│   ├── providers/                    # AuthProvider
│   ├── ui/                           # shadcn/ui 컴포넌트
│   └── webhooks/                     # Webhook 관리 UI
├── lib/
│   ├── ai/
│   │   ├── claude-code.ts            # Claude Code CLI 실행 모듈
│   │   ├── context-builder.ts        # 메시지 컨텍스트 빌더
│   │   └── rate-limiter.ts           # 요청 제한
│   ├── hooks/                        # 커스텀 훅 (use-auth, use-skill-context)
│   ├── supabase/                     # Supabase 클라이언트 (client/server/middleware)
│   ├── types/chat.ts                 # TypeScript 타입 정의
│   ├── webhooks/                     # Webhook 서명 검증 + 파서
│   └── utils.ts                      # cn() 유틸
├── electron/main.js                  # Electron 메인 프로세스
├── supabase/migrations/              # DB 마이그레이션 SQL (10개 파일)
├── middleware.ts                     # 인증 + 라우트 보호
└── .env.local                        # 환경변수
```

## 실행 방법

### 웹 개발 서버
```bash
npm run dev
# → http://localhost:3000
```

### Electron 데스크톱 (개발)
```bash
npm run dev          # 터미널 1
npm run electron:dev # 터미널 2
```

### Electron 빌드 (.dmg/.exe)
```bash
npm run electron:build
```

## 사전 요구사항
1. **Supabase 프로젝트** - URL, Anon Key → `.env.local`
2. **Google OAuth** - Cloud Console에서 클라이언트 ID/Secret → Supabase Auth에 설정
3. **Claude Code CLI** - `npm install -g @anthropic-ai/claude-code` + Claude Pro/Max 구독
4. **DB 마이그레이션** - `supabase/migrations/` 파일들을 SQL Editor에서 실행
5. **봇 프로필** - Auth에 봇 유저 생성 → profiles + bots 테이블에 시드 데이터

### 8. 추가 구현 (2차)
- [x] 컨텍스트/사용량 프로그레스바 (AI 채팅 우측 상단, 토큰 사용량 + 비용 툴팁)
- [x] Claude 구독 체크 (`/api/ai/check` → CLI 설치 및 인증 확인, 미가입자 안내)
- [x] 채팅방 나가기 (X 버튼 → 멤버십 삭제, DB 채팅 로그 유지, 리스트 즉시 반영)
- [x] 히스토리 MD 다운로드 (방 메뉴 → 전체 메시지를 마크다운으로 다운로드)
- [x] 채팅방 검색 LIKE 패턴 (사이드바 검색창에 부분 문자열 매칭)
- [x] 이미지 Ctrl+V 붙여넣기 (클립보드 이미지 감지 → 미리보기 → Supabase Storage 업로드)
- [x] 파일 첨부 버튼 (이미지 파일 선택 → 미리보기 → 업로드)
- [x] 더블클릭 방 이름 변경 (사이드바 방 목록에서 더블클릭 → 인라인 편집)
- [x] 병렬 AI 채팅방 ("새 Claude Code 채팅" 버튼 → 클릭마다 새 방 생성)
- [x] 유저 프로필 편집 페이지 (`/profile` → 유저명, 이름, 상태메시지 수정)
- [x] 마크다운 렌더링 (봇 응답에 react-markdown + remark-gfm 적용)
- [x] Webhook 메시지 표시 (시스템 메시지에 마크다운 카드 렌더링)
- [x] Claude Code 타임아웃 (2분 제한, 초과 시 프로세스 종료)

### 9. 추가 구현 (3차)
- [x] 스킬 패널 (채팅 우측에 VSCode 확장프로그램 형태로 Claude Code 슬래시 커맨드 탐색)
  - [x] 카테고리 필터 (코드, 문서, 프론트엔드, 개발, 파일, 유틸리티, 디자인)
  - [x] 검색 기능
  - [x] 클릭 시 채팅 입력창에 자동 입력
  - [x] ⚡ 번개 토글 버튼 (전송 버튼 오른쪽)
- [x] 스트리밍 상태 표시 개선 (버블: "입력중...", 하단: 경과시간 + 토큰 수 실시간)
- [x] 완료 후 토큰 수 표시 (↓ 350 tokens)
- [x] 컨텍스트 프로그레스바 개선 (사용률 색상 변화 + 상세 툴팁)
- [x] 컨텍스트 비우기 버튼 (🗑 클릭 → 시스템 메시지 + usage 초기화)
- [x] 메시지 복사 버튼 (버블 hover 시 우측 상단에 표시, 복사 시 ✅ 체크마크)
- [x] 한글 IME 입력 버그 수정 (조합 중 Enter 무시, 전송 후 잔여 텍스트 제거)
- [x] 로그아웃 시 /login 리다이렉트
- [x] 프로필 이미지 변경 (아바타 클릭 → 파일 선택 → Supabase Storage 업로드)

### 10. 추가 구현 (4차)
- [x] `@` 파일 자동완성 (입력창에 `@` 입력 → 파일/폴더 목록 팝업)
  - [x] 홈 디렉토리 기준 탐색 (프로젝트가 아닌 사용자 컴퓨터 전체)
  - [x] 폴더 드릴다운 (폴더 선택 시 하위 항목으로 진입, 누적 없이 교체)
  - [x] ↑↓ 방향키 이동 + 선택 항목 자동 스크롤
  - [x] Enter/Tab 선택, Esc 닫기
  - [x] 파일 📄 / 폴더 📁 아이콘 구분
- [x] 작업 디렉토리 표시 (AI 채팅방 헤더 하단에 📁 경로 상시 표시)
  - [x] 클릭하여 인라인 편집으로 경로 변경
  - [x] 권한 설정에서 지정한 경로 자동 반영
- [x] 파일 접근 권한 플로우 (AI 채팅방 생성 시)
  - [x] "승인" → 전체 파일 접근 허용
  - [x] "거부" → 파일 작업 차단, 일반 대화만
  - [x] "경로 변경" → 특정 폴더만 접근 허용
  - [x] 거부 후 재승인 가능 ("승인" 입력)
  - [x] 절대 경로 직접 입력 지원 (`/path` 또는 `~/path`)
- [x] Claude Code 세션 유지 (`--resume` session_id로 대화 맥락 이어하기)
- [x] 작업 디렉토리 기반 Claude Code 실행 (권한에서 설정한 경로가 `cwd`로 전달)
- [x] Claude Code 응답 usage 추적 (result 이벤트에서 input/output 토큰 + 비용 추출)
- [x] `startClaudeCode()` 리팩토링 (sendInput/kill 제공, 향후 권한 UI 확장 가능)

### 11. 추가 구현 (5차)
- [x] API 과금 방지 (ANTHROPIC_API_KEY 제거, 구독 모드 전용으로 전환)
  - [x] `.env.local`에서 API 키 비활성화
  - [x] `--dangerously-skip-permissions` → `--allowedTools`로 교체
  - [x] `--max-budget-usd` 제거 (구독 모드에서 불필요)
  - [x] 자식 프로세스 env에서 API 키 삭제 유지
- [x] prompt stdin 전달 (`--allowedTools` 플래그와 positional arg 충돌 해결)
- [x] Claude Code 세션 이어하기 (`--resume`으로 대화 맥락 유지)
  - [x] 이전 봇 메시지에서 session_id 조회
  - [x] 후속 메시지에 `--resume <session_id>` 자동 전달
- [x] 스트리밍 진행 로그 누적 표시
  - [x] tool_use 이벤트 실시간 로그 (🔧 Read, Write, Edit 등 + 파일 경로)
  - [x] 작업 중 "⏳ 작업 중..." 표시, 완료 시 결과 텍스트로 교체
  - [x] 최종 메시지에 진행 로그 + 구분선 + 결과 포함
- [x] Realtime UPDATE 이벤트 수정
  - [x] `REPLICA IDENTITY FULL` 마이그레이션 추가 (room_id 필터 작동)
  - [x] 스트리밍 메시지 폴링 fallback (1.5초 간격, Realtime 미수신 시 DB 직접 조회)
- [x] Syntax Highlighting (코드 블록)
  - [x] `rehype-highlight` + GitHub Dark 테마 적용
  - [x] 어두운 배경(`#0d1117`) + 언어별 구문 색상
  - [x] 인라인 코드는 보라색 배경 유지
- [x] 코드 블록 복사 버튼 (hover 시 우측 상단에 "복사" 버튼, 코드 텍스트만 복사)
- [x] stderr 로그 수집 (Claude Code CLI 에러 디버깅)

## 미구현 / TODO
- [ ] 온라인/오프라인 상태
- [ ] 읽지 않은 메시지 카운트
- [ ] 메시지 무한 스크롤 (이전 메시지 로드)
- [ ] Webhook 관리 UI (컴포넌트는 있으나 페이지 미연결)
- [ ] Claude Code 권한 요청 UI (승인/거부 버튼 인라인 표시)
- [ ] Vercel 배포
- [ ] 수익화 모델 논의

## 수익화 아이디어
- Claude Code 사용량 기반 유료 플랜
- 팀/기업용 SaaS (Slack 대안 + AI 내장)
- Webhook 마켓플레이스 (다양한 서비스 연동 템플릿)
- 프리미엄 기능 (파일 용량 확대, 커스텀 테마, 고급 검색)

## 향후 개발 계획

### 12. RAG (검색 증강 생성) 시스템
- [x] 하이브리드 RAG 전략 (토큰 수 < 50K → context stuffing, >= 50K → 벡터화)
- [x] 문서 업로드 및 파싱 (PDF: pdf-parse, TXT/MD: UTF-8 직접 읽기)
  - [x] 업로드 API (`/api/ai/rag/upload`) — Storage 저장 → 파싱 → 전략 판단
  - [x] 문서 목록 API (`/api/ai/rag/documents`) — GET/DELETE
  - [x] 청킹 (500토큰 단위, 50토큰 오버랩, 마크다운 헤딩 경계 존중)
- [x] RAG 검색 + 프롬프트 주입
  - [x] 키워드 매칭 기반 유사도 검색 (MVP, 벡터 임베딩 스키마 준비됨)
  - [x] context stuffing 문서: 전체 텍스트 프롬프트에 포함
  - [x] vectorized 문서: 상위 청크만 프롬프트에 포함
  - [x] `<documents>` + `<instructions>` 태그로 프롬프트 구성
- [x] RAG 문서 패널 (사이드바↔채팅 사이, w-64, 접기/펼치기)
  - [x] 문서 카드 (파일 아이콘, 이름, 크기, 전략 뱃지, 상태, 삭제)
  - [x] 문서 없으면 패널 숨김
- [x] RAG 업로드 버튼 (📖 아이콘, 파일첨부 옆, .pdf/.txt/.md)
- [x] 3개 프로그레스바 (키워드 일치율 / 문서 활용도 / 종합 신뢰도)
  - [x] 키워드: 한/영 동의어 포함 매칭률 (초록)
  - [x] 활용도: 검색된 문서 토큰 양 기반 (파랑)
  - [x] 신뢰도: 가중 평균 종합 점수 (보라)
  - [x] 출처 파일명 + 페이지 번호 표시 (`p.85, 86, 299`)
  - [x] 인용 내용 미리보기 (참조한 청크의 첫 120자)
  - [x] 👍/👎 피드백 버튼
- [x] RAG 업로드 메뉴 (파일/URL 선택 팝오버)
  - [x] 파일 업로드: PDF, TXT, MD (클라이언트 → Storage 직접 업로드 → 서버 파싱)
  - [x] URL 입력: 실시간 스크래핑 (Jina Reader API + API 패턴 감지)
  - [x] 대용량 PDF 지원 (Storage 직접 업로드로 10MB 제한 우회)
- [x] URL RAG — 질문 시 실시간 스크래핑
  - [x] Jina Reader API로 JS 렌더링 페이지 지원
  - [x] spring.io API 등 알려진 사이트 API 직접 호출
  - [x] 질문 관련 하위 링크 자동 탐색 (최대 3개)
- [x] PDF 페이지별 텍스트 추출 (pdfjs-dist 직접 사용)
- [x] RAG 패널 토글 버튼 (문서 수 뱃지, 접기/펼치기)
- [x] RAG 검색 중 표시 (패널에 "RAG 검색 중..." 인디케이터)
- [x] RAG 업로드 프로그레스바 (전체 화면 토스트, 단계별 진행률)
  - [x] 파일 업로드 → 텍스트 추출 → 벡터화 → 완료 (0~100%)
- [x] 일반 지식 답변 승인 요청 (RAG 문서에 없으면 "일반 지식 기반으로 답변해드릴까요?")
- [x] RAG 분석 로그 저장 (`rag_query_logs` 테이블: 쿼리, 점수, 피드백)
- [x] DB: pgvector 확장 + rag_documents/rag_chunks/rag_query_logs 테이블
- [x] Storage: `rag-documents` 버킷
- [x] RLS 정책 수정 (봇 메시지 UPDATE/DELETE 허용)

### 13. 추가 구현 (6차)
- [x] 메시지 실시간 표시 개선
  - [x] `/api/ai/chat` 비동기 백그라운드 실행 (즉시 200 응답 → 서버 블로킹 방지)
  - [x] 폴링 `/api/ai/messages` API route (GET: 목록, POST: 전송)
  - [x] 봇 메시지 UPDATE RLS 우회 (`updateBotMessage` DELETE+INSERT fallback)
  - [x] Supabase SDK lock 문제 우회 (메시지 INSERT를 fetch API route 경유로 변경)
- [x] 메시지 전송 즉시 표시 (3초 안전장치 타이머, sending 고착 방지)
- [x] URL 링크 자동 감지 (봇: `target="_blank"` 새 탭, 일반: Linkify 컴포넌트)
- [x] Syntax Highlighting 코드 블록 복사 버튼
- [x] 채팅방 나가기 시 RAG Storage 파일 + DB 정리
- [x] 채팅방 입장/새로고침 시 맨 아래 자동 스크롤
- [x] auth-provider try/catch (Supabase lock 에러 방어)
- [x] RAG 키워드 검색 — 문서 언어 자동 감지
  - [x] 영문 문서: 한글 쿼리 → 한/영 사전으로 영문 변환 후 검색
  - [x] 한글 문서: 한글 쿼리 그대로 검색
  - [x] 불용어 제거 ("해줘", "알려줘", "대해서", "언제" 등)
  - [x] 한/영 변환 사전 50개+ 매핑 (스프링부트, 어노테이션, 트랜잭션 등)
- [x] RAG 프롬프트 개선
  - [x] 출처/chunk 번호 답변에 포함 금지 (시스템이 자동 표시)
  - [x] 문서에 없으면 일반 지식 사용 전 승인 요청
- [x] PDF 페이지 번호 자동 감지
  - [x] `pdf-parse-new`의 `pagerender` 콜백으로 페이지별 텍스트 추출
  - [x] 페이지 텍스트 끝의 숫자를 읽어 물리 페이지 ↔ 표시 페이지 오프셋 자동 보정
  - [x] 페이지 번호 없는 문서: 참조 내용 영역 숨김, 출처에 파일명만 표시
  - [x] 페이지 번호 있는 문서: `(p.62, 63, 71)` + 참조 내용 미리보기 표시
- [x] `pdf-parse-new`를 `serverExternalPackages`로 설정 (webpack 번들링 우회)
- [x] 대용량 PDF 청킹 안전장치 (5000 청크 상한, 무한 루프 방지)

## 미구현 / TODO
- [ ] 벡터 임베딩 교체 (키워드 → voyage 모델, HNSW 인덱스 활용)
- [ ] RAG 모델링 분석 대시보드
- [ ] 온라인/오프라인 상태
- [ ] 읽지 않은 메시지 카운트
- [ ] 메시지 무한 스크롤 (이전 메시지 로드)


### 14. 추가 구현 (7차)
- [x] 채팅방 생성 플로우 개선
  - [x] 방 생성 API 최적화 (즉시 roomId 반환 → 채팅방 바로 열림)
  - [x] 연결 확인은 백그라운드 ("Claude Code 연결 확인 중..." → 결과 메시지)
  - [x] 미설치/미인증 시 설치 가이드 + 구독 링크 안내
  - [x] 인증 확인 간소화 (`--version`만 체크, 30초 auth test 제거)
- [x] RAG 채팅방 격리 확인
  - [x] 방 이동 시 RAG 패널 자동 갱신 (roomId 변경 감지)
  - [x] 방 삭제 시 RAG 문서 + Storage 파일 정리
- [x] 채팅방 여러 개 유지
  - [x] "새 Claude Code 채팅" 클릭 시 매번 새 방 생성 (기존 방 유지)
  - [x] 방 이름 자동 번호 부여 ("Claude Code", "Claude Code 2", ...)
  - [x] 방 리스트 5초 폴링으로 확실한 갱신 (Realtime 대신)
- [x] 메시지 SSE (Server-Sent Events) 전환
  - [x] `/api/ai/messages/stream` SSE 엔드포인트 (1.5초 간격 변경 감지)
  - [x] 클라이언트 `EventSource` 연결 + 자동 재연결
  - [x] 폴링 제거, 서버 push 방식으로 변경
- [x] 방 나가기/삭제 API 통합 (`/api/ai/rooms/leave`)
  - [x] RAG Storage + DB 삭제 + 멤버십 삭제 한 번에 처리
  - [x] room-item X 버튼 + room-header 나가기 모두 API route 경유
  - [x] Supabase SDK lock 문제 우회
  - [x] 방 삭제 시 RAG 패널 즉시 닫기 + 상태 초기화





## 향후 개발 계획

### 15. 사용자 간 채팅 개선 (구현 완료)
- [x] DM 방 이름에 상대방 이름 + 아바타 표시
  - [x] room-list에서 DM 파트너 프로필 조회
  - [x] "Direct Message" 대신 상대방 유저명 표시
  - [x] DM 파트너 아바타 이미지 표시
- [x] 그룹 채팅방 멤버 초대 (`/api/rooms/[roomId]/members`)
  - [x] POST: 유저 검색 → 멀티 선택 → 초대
  - [x] GET: 멤버 목록 조회 (프로필 + 역할)
  - [x] DELETE: 멤버 강퇴 (owner/admin만)
  - [x] 초대 시 시스템 메시지 자동 생성
  - [x] 중복 초대 방지
- [x] 멤버 목록 패널 (채팅 영역 우측)
  - [x] 멤버 아바타, 이름, 역할 뱃지 (방장/관리자)
  - [x] 온라인 상태 표시
  - [x] 초대 버튼 (owner/admin만 표시)
  - [x] 강퇴 버튼 (hover 시, owner/admin만)
- [x] 초대 다이얼로그
  - [x] 유저명 검색 → 멀티 선택 → 초대

### 16. 앱 형태 전환
- [x] 데스크톱 앱 (Electron)
  - [x] 시스템 트레이 (ChatApp 열기, 새 채팅, 종료)
  - [x] 트레이 아이콘 클릭 시 앱 표시/포커스
  - [x] 창 닫기 시 트레이로 숨기기 (백그라운드 실행)
  - [x] 알림 (Notification API, 클릭 시 앱 포커스)
  - [x] 자동 업데이트 (electron-updater, GitHub Releases)
  - [x] 중복 실행 방지 (requestSingleInstanceLock)
  - [x] 외부 링크 브라우저에서 열기
  - [x] macOS hiddenInset 타이틀바 + 드래그 영역 (Electron 전용)
  - [x] 빌드 설정: macOS (dmg+zip) / Windows (nsis) / Linux (AppImage+deb)
- [x] PWA (Progressive Web App) — 웹에서 앱처럼 설치
  - [x] manifest.json (앱 이름, 아이콘, standalone 모드)
  - [x] Service Worker (네트워크 우선, 오프라인 fallback)
  - [x] 브라우저 "앱 설치" 버튼으로 바탕화면에 추가
  - [x] Electron 드래그 바 — 웹 브라우저에서는 자동 숨김
- [ ] 모바일 앱 (React Native 또는 Capacitor)
  - [ ] iOS / Android 네이티브 빌드
  - [ ] 푸시 알림 (FCM/APNs)
  - [ ] 모바일 반응형 UI 최적화
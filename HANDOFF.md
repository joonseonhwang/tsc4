# TSC 4급 13주 앱 — VS Code 인계 문서

> 이 폴더(`tsc4-app`)를 VS Code로 열고, 아래 **0. 바로 할 일**부터 진행하면 됩니다.
> Claude Code(VS Code 확장)를 쓴다면 맨 아래 **8. Claude Code에 붙여넣을 프롬프트**를 그대로 붙여넣으세요.

---

## 0. 바로 할 일 (남은 작업)

| # | 작업 | 상태 |
|---|---|---|
| 1 | 앱 파일 빌드 (26개 + 이 문서) | ✅ 완료 |
| 2 | 로컬 테스트 (서비스워커 동작, 오디오 구간 재생, 콘솔 오류 없음) | ✅ 완료 |
| 3 | GitHub 공개 저장소 생성 + 파일 push | ⏳ **남음** |
| 4 | GitHub Pages 켜기 (main / root) | ⏳ **남음** |
| 5 | 갤럭시에서 접속 → 홈 화면에 설치 | ⏳ **남음** |

막혔던 이유: Claude 세션에서 GitHub 새 저장소를 만들 권한이 없었고, PC Chrome에 GitHub 로그인이 안 되어 있었습니다. VS Code 터미널에서는 본인 계정으로 바로 할 수 있습니다.

---

## 1. 배포 방법 (VS Code 터미널)

### 방법 A — GitHub CLI(`gh`) 사용 (추천, 3줄)

```bash
# 최초 1회: gh 설치 후 로그인 (https://cli.github.com)
gh auth login

# 이 폴더에서 실행
git init -b main
git add .
git commit -m "TSC 4급 13주 PWA 첫 배포"
gh repo create tsc4 --public --source . --push

# Pages 켜기 (main 브랜치 루트)
gh api -X POST repos/:owner/tsc4/pages -f "source[branch]=main" -f "source[path]=/"
```

1~2분 뒤 접속: `https://joonseonhwang.github.io/tsc4/`

### 방법 B — 웹에서 직접

1. github.com/new → 이름 `tsc4`, **Public** → Create repository
2. "uploading an existing file" 클릭 → 이 폴더 파일 전부 드래그 (한 번에 100개, 파일당 25MB 이하라 문제없음)
3. Settings → Pages → Source: Deploy from a branch → Branch `main` / `(root)` → Save

### 방법 C — 기존 저장소 하위 폴더 (People Book과 같은 방식)

`joonseonhwang/joonseonhwang` 저장소의 `gh-pages` 브랜치에 `tsc4/` 폴더로 넣으면
`https://joonseonhwang.github.io/joonseonhwang/tsc4/` 로 열립니다. 루트의 People Book 파일은 건드리지 말 것. 루트에 `.nojekyll` 있어야 함.

---

## 2. 갤럭시 설치

1. 폰 **Chrome**으로 배포 주소 열기 (카톡·Claude 안의 미니 브라우저는 설치 메뉴 없음 → ⋮ → 'Chrome에서 열기')
2. Chrome ⋮ → **홈 화면에 추가** → **설치**
3. 처음 한 번 온라인에서 각 탭(특히 단어·발음)을 열어두면 음성·획순 데이터가 캐시되어 이후 오프라인 동작
4. 설치 앱은 주소창(상단바) 없이 전체 화면으로 열림

---

## 3. 파일 구성

```
index.html            앱 전체 (HTML+CSS+JS 한 파일, 약 250KB)
manifest.webmanifest  PWA 설정 (start_url/scope = "./" 상대경로 → 하위 폴더 배포도 OK)
sw.js                 서비스워커 (캐시 우선 + mp3 Range 요청 206 응답 지원)
icon-192.png  icon-512.png  maskable-512.png
strokes.json          획순 데이터 (hanzi-writer-data 발췌, 1.5MB)
chars.json            한자 구성·유래·한국 한자음 (makemeahanzi + hanja, 100KB)
{m,f}-core.mp3        핵심 단어 음성 스프라이트 (남/여)
{m,f}-h1/h2/h3.mp3    HSK 1~3급 단어 음성 스프라이트
{m,f}-pron.mp3        발음 탭 (성조·병음) 음성
{m,f}-sent.mp3        템플릿·예상문제 문장 음성
f-ex1~ex5.mp3         HSK 예문 음성 (CosyVoice, 여성만)
README.md             저장소 소개
HANDOFF.md            이 문서
```

총 약 19MB. 외부 의존성은 `hanzi-writer@3.7.3` (jsdelivr CDN) 하나뿐이며, 첫 로드 때 서비스워커가 캐시합니다.

---

## 4. 앱 구조 (index.html 내부)

**탭**: 계획(plan) · 발음(pron) · 실전 시뮬(sim) · 템플릿(tpl) · 예상문제(qs) · 단어(words) · 오늘(day)

**주요 상수/함수**

| 이름 | 역할 |
|---|---|
| `START` | 공부 시작일. `localStorage["tsc-start"]` |
| `WEEKS` | 13주 주차별 할 일 목록 |
| `HSK` | HSK 1~3급 단어 (한자, 병음, 한국어 뜻) |
| `EXS` / `WEX` | 단어별 예문 매핑 |
| `WSPR` | 텍스트 → `[그룹, 시작초, 길이초]` 스프라이트 인덱스 |
| `AUDIO` | (PWA 빌드에선 `{}`) 개별 음성 파일 매핑 — 아티팩트 버전에서만 사용 |
| `ttsSpeak(text)` | `WSPR`에 있으면 `playSprite`, 없으면 `AUDIO` |
| `playSprite` | 오디오 1개 + 타이머로 구간 재생. URL: `${(male && !g.startsWith("ex")) ? "m" : "f"}-${g}.mp3` |
| 재생 속도 | 예문·문장(ex*, sent): 1 / 느리게 0.75 · 단어: 0.85 / 느리게 0.65 |
| `startWordQuiz` | 단어 시험 (쓰기 연습의 `startQuiz`와 이름 충돌 피하려고 분리) |
| `wsBlind` | 쓰기 연습 "자국 안 보기" 모드 |
| `fitPad()` | 긴 문장 따라쓰기 패드 크기 자동 조정 |

**저장 데이터**: 진행 체크, 틀린 단어, 설정(남/여 음성 등)은 폰 브라우저 `localStorage`에만 저장. 서버 전송 없음.

**AI 문법 분석·AI 한자 설명**: Claude 아티팩트 안에서만 동작 → PWA 버전에서는 버튼이 숨겨짐.

---

## 5. 수정·재배포 규칙

1. `index.html` 등 수정
2. **`sw.js`의 `VER`를 반드시 올리기** (`"tsc4-v1"` → `"tsc4-v2"`) — 안 올리면 폰에 옛 버전이 캐시로 남음
3. 새 파일을 추가했으면 `sw.js`의 `CORE` 목록 확인
4. `git add . && git commit -m "..." && git push` → 1분 뒤 반영, 앱 두 번 껐다 켜면 갱신

**로컬 테스트**

```bash
python -m http.server 8000
# http://localhost:8000 접속 (서비스워커는 localhost에서 동작)
# DevTools → Application → Service Workers / Cache Storage 확인
# 모바일 확인: DevTools 기기 툴바 → 360×780 (갤럭시 S24)
```

---

## 6. 주의 사항

- **개인정보 포함**: 템플릿·예상문제 답변에 본명(黄俊善), 생일(1995.3.21), 회사·직무, 가족 이야기가 텍스트와 음성(`*-sent.mp3`)으로 들어 있음. 공개 저장소에 올리면 누구나 볼 수 있음.
  - 그대로 둬도 되면 그냥 배포
  - 빼려면: `index.html`에서 해당 문장을 ○○ 형태로 바꾸고, `WSPR`에서 그 문장 키를 지우면 음성 버튼은 사라짐 (mp3 안의 음성은 남으므로 완전히 지우려면 sent 스프라이트 재생성 필요)
- **음성 출처**: 단어·문장 음성은 sherpa-onnx `matcha-icefall-zh-baker` + vocos로 생성, 남성 음성은 피치 시프트. 발음은 paraformer-zh 음성인식으로 성조까지 검증함.
- **원본 빌드 환경**: 원본 소스(`tsc-4.html`, 아티팩트 버전)와 빌드 스크립트(`build_pwa.py`, 음성 생성 스크립트)는 Claude 세션 작업공간에 있음. 음성을 새로 만들 일이 없으면 이 폴더만으로 유지보수 가능.
- 아티팩트 버전(claude.ai)은 그대로 살아 있음. 두 버전은 별개라 수정하면 따로 반영해야 함.

---

## 7. 라이선스·출처

- 예문·예문 음성: hsk-sentences-audio (CC BY-SA 4.0) — https://github.com/no7z/hsk-sentences-audio
- 획순: hanzi-writer / hanzi-writer-data (MIT / Arphic Public License)
- 한자 구성·유래: Make Me a Hanzi (Arphic Public License / LGPL)
- HSK 단어 목록: @leonsilicon/hsk2.0

---

## 8. Claude Code에 붙여넣을 프롬프트

```
이 폴더는 중국어 TSC 4급 공부용 PWA 앱이야. HANDOFF.md 먼저 읽어.
1) gh로 로그인 상태 확인하고, 공개 저장소 tsc4를 만들어 이 폴더를 main에 push해줘.
2) GitHub Pages를 main / root로 켜고, 배포 주소가 열리는지 확인해줘.
3) 끝나면 배포 주소랑 갤럭시 설치 방법 알려줘.
수정할 때는 항상 sw.js의 VER를 올리고 커밋해.
```

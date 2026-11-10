import './style.css'
import { apiKey, MODEL, sendChat } from './openai.js'

document.querySelector('#app').innerHTML = `
<main class="chat">
  <header class="chat-header">
    <div>
      <h1>Chatbot</h1>
      <p class="model">Responses API · ${MODEL}</p>
    </div>
    <div class="header-actions">
      <span id="status" class="status"></span>
      <button id="reset" type="button" class="btn-ghost">대화 초기화</button>
    </div>
  </header>

  <p id="status-detail" class="status-detail" hidden></p>

  <section id="messages" class="messages" aria-live="polite"></section>

  <form id="form" class="composer">
    <textarea id="input" rows="1" placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"></textarea>
    <button id="send" type="submit" class="btn-primary">전송</button>
  </form>
</main>
`

const $status = document.querySelector('#status')
const $statusDetail = document.querySelector('#status-detail')
const $messages = document.querySelector('#messages')
const $form = document.querySelector('#form')
const $input = document.querySelector('#input')
const $send = document.querySelector('#send')
const $reset = document.querySelector('#reset')

// 요청에 함께 보낼 대화 기록
let history = []
let isLoading = false

// ---------- API 상태 ----------
const STATUS = {
  missing: { label: '키 미설정', className: 'is-missing' },
  unverified: { label: '연결 미확인', className: 'is-unverified' },
  ok: { label: '요청 성공', className: 'is-ok' },
  error: { label: '요청 실패', className: 'is-error' },
}

function setStatus(key, detail = '') {
  const { label, className } = STATUS[key]
  $status.textContent = label
  $status.className = `status ${className}`
  $statusDetail.textContent = detail
  $statusDetail.hidden = !detail
}

// ---------- 메시지 표시 ----------
function addMessage(role, text) {
  const el = document.createElement('div')
  el.className = `message ${role}`
  el.textContent = text // textContent로 넣어 HTML이 실행되지 않도록 함
  $messages.append(el)
  $messages.scrollTop = $messages.scrollHeight
  return el
}

function showEmpty() {
  $messages.innerHTML = ''
  const el = document.createElement('p')
  el.className = 'empty'
  el.textContent = apiKey
    ? '무엇이든 물어보세요.'
    : '.env.local 파일에 VITE_OPENAI_API_KEY를 입력한 뒤 개발 서버를 재시작해 주세요.'
  $messages.append(el)
}

function setLoading(value) {
  isLoading = value
  $send.disabled = value || !apiKey
  $input.disabled = value || !apiKey
  $reset.disabled = value
  $send.textContent = value ? '응답 대기 중…' : '전송'
}

// ---------- 전송 ----------
async function handleSubmit(event) {
  event.preventDefault()
  const text = $input.value.trim()
  if (!text || isLoading || !apiKey) return // 중복 전송 방지

  $messages.querySelector('.empty')?.remove()
  addMessage('user', text)
  history.push({ role: 'user', content: text })
  $input.value = ''
  autoResize()

  setLoading(true)
  const loadingEl = addMessage('assistant loading', '답변을 생성하고 있습니다')

  try {
    const { text: reply } = await sendChat(history)
    loadingEl.remove()
    addMessage('assistant', reply)
    history.push({ role: 'assistant', content: reply })
    setStatus('ok')
  } catch (error) {
    loadingEl.remove()
    addMessage('error', error.message)
    // 실패한 질문은 기록에서 빼고 입력창에 되돌려 다시 보낼 수 있게 함
    history.pop()
    $input.value = text
    setStatus('error', error.message.split('\n')[0])
  } finally {
    setLoading(false)
    $input.focus()
  }
}

function handleReset() {
  if (isLoading) return
  history = []
  showEmpty()
  $input.value = ''
  autoResize()
  $input.focus()
}

function autoResize() {
  $input.style.height = 'auto'
  $input.style.height = `${Math.min($input.scrollHeight, 160)}px`
}

$form.addEventListener('submit', handleSubmit)
$reset.addEventListener('click', handleReset)
$input.addEventListener('input', autoResize)
$input.addEventListener('keydown', (event) => {
  // 한글 조합 중 Enter는 무시
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    $form.requestSubmit()
  }
})

// ---------- 초기화 ----------
// 키가 있다는 것만으로는 연결 성공이 아니므로, 첫 요청 전에는 '연결 미확인'
setStatus(apiKey ? 'unverified' : 'missing')
setLoading(false)
showEmpty()

// OpenAI Responses API 호출 모듈
// 문서: https://developers.openai.com/api/docs/guides/text

const API_URL = 'https://api.openai.com/v1/responses'
export const MODEL = 'gpt-6-luna'

const INSTRUCTIONS = '당신은 친절한 한국어 도우미입니다. 간결하고 정확하게 답하세요.'

// .env.local의 VITE_OPENAI_API_KEY 값 (없으면 빈 문자열)
export const apiKey = (import.meta.env.VITE_OPENAI_API_KEY ?? '').trim()

// history: [{ role: 'user' | 'assistant', content: '...' }, ...]
// 대화 전체를 input 배열로 보내서 이전 맥락을 이어갑니다.
export async function sendChat(history) {
  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS,
        input: history,
        store: false, // 대화 기록은 브라우저에서 직접 관리하므로 서버에 저장하지 않음
      }),
    })
  } catch {
    throw new Error('네트워크에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.')
  }

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(explainError(res.status, data?.error))
  }

  const text = extractText(data)
  if (!text) {
    if (data?.status === 'incomplete') {
      throw new Error(`응답이 중간에 끊겼습니다. (이유: ${data.incomplete_details?.reason ?? '알 수 없음'})`)
    }
    throw new Error('응답은 받았지만 표시할 텍스트가 없습니다.')
  }

  return { text, usage: data.usage }
}

// output 배열에는 reasoning 등 여러 항목이 섞일 수 있으므로
// type이 'message'인 항목의 output_text만 모아서 합칩니다.
function extractText(data) {
  return (data?.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .map((part) => (part.type === 'output_text' ? part.text : part.type === 'refusal' ? part.refusal : ''))
    .join('')
    .trim()
}

function explainError(status, error) {
  const code = error?.code ?? ''
  const detail = error?.message ? `\n(원본 메시지: ${error.message})` : ''

  let message
  if (status === 401) {
    message = 'API Key가 올바르지 않습니다. .env.local의 키에 오타나 공백이 없는지 확인해 주세요.'
  } else if (status === 403) {
    message = '접근이 거부되었습니다. 지원되지 않는 지역이거나 이 키에 권한이 없습니다.'
  } else if (status === 404) {
    message = `모델(${MODEL})을 찾을 수 없거나 이 계정에서 사용할 수 없습니다.`
  } else if (status === 429 && /quota|credit|spend|usage_limit/.test(`${code} ${error?.type ?? ''}`)) {
    message = '크레딧이나 사용 한도가 부족합니다. OpenAI 대시보드에서 결제·한도를 확인해 주세요.'
  } else if (status === 429) {
    message = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  } else if (status === 400) {
    message = '요청 형식이 잘못되었습니다.'
  } else if (status >= 500) {
    message = 'OpenAI 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.'
  } else {
    message = `알 수 없는 오류가 발생했습니다. (HTTP ${status})`
  }
  return message + detail
}

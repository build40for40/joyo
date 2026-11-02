import { onBeforeUnmount, ref } from 'vue'

/** The parts of the Web Speech API this uses. TypeScript's DOM types don't include it yet. */
interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
}

type RecognitionConstructor = new () => Recognition

function recognitionConstructor(): RecognitionConstructor | undefined {
  const scope = globalThis as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

/** Browser speech-to-text. Each finished phrase is passed to onText. */
export function useDictation(onText: (text: string) => void) {
  const Constructor = recognitionConstructor()
  const supported = Constructor !== undefined
  const listening = ref(false)
  const error = ref<string | null>(null)
  let recognition: Recognition | null = null

  function start() {
    if (!Constructor || listening.value) return
    error.value = null
    recognition = new Constructor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = navigator.language
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index]
        if (result?.isFinal) onText(result[0].transcript.trim())
      }
    }
    recognition.onerror = (event) => {
      error.value =
        event.error === 'not-allowed'
          ? 'Joyo needs your permission to use the microphone.'
          : "We couldn't hear that. Try again, or type instead."
    }
    recognition.onend = () => {
      listening.value = false
    }
    recognition.start()
    listening.value = true
  }

  function stop() {
    recognition?.stop()
  }

  onBeforeUnmount(stop)

  return { supported, listening, error, start, stop }
}

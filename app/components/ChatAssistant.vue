<!--
  Markup for the ARC Inquiry Assistant. Behaviour (open/close, sending
  messages to /api/chatbot/message, rendering answers) is bound by the legacy
  script through the element ids, so the ids must stay unchanged.
-->
<template>
  <div class="chat-assistant">
    <button
      id="chatLaunch"
      class="btn btn-primary fixed right-4 bottom-4 z-50 h-12 gap-2 rounded-full px-5 shadow-lg shadow-primary/25 sm:right-6 sm:bottom-6"
      type="button"
      aria-controls="chatBox"
      aria-expanded="false"
    >
      <AppIcon name="message-circle" />
      <span>Ask ARC Assistant</span>
    </button>

    <section
      id="chatBox"
      class="chat-panel fixed inset-x-3 bottom-3 z-50 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      role="dialog"
      aria-labelledby="chatTitle"
    >
      <div class="flex h-full max-h-[min(36rem,calc(100dvh-1.5rem))] flex-col">
        <header class="flex items-center gap-3 bg-primary px-4 py-3 text-primary-content">
          <span class="grid size-9 place-items-center rounded-full bg-white/15">
            <AppIcon name="message-square-text" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 id="chatTitle" class="text-sm font-semibold">ARC Inquiry Assistant</h2>
            <p class="text-xs text-primary-content/75">Answers from the farm FAQs</p>
          </div>
          <button id="chatClose" class="btn btn-square btn-ghost btn-sm text-primary-content hover:bg-white/15" type="button" aria-label="Close assistant">
            <AppIcon name="x" />
          </button>
        </header>

        <div id="chatBody" class="min-h-48 flex-1 space-y-1 overflow-y-auto bg-base-200 p-4" aria-live="polite">
          <div class="chat chat-start">
            <div class="chat-bubble bg-base-100 text-sm text-base-content">
              Hi! Ask me about crayfish prices and other topics covered by the farm FAQs.
            </div>
          </div>
        </div>

        <form id="chatForm" class="flex gap-2 border-t border-base-300 p-3">
          <label for="chatText" class="sr-only">Ask a question</label>
          <input
            id="chatText"
            class="input input-sm h-10 flex-1"
            placeholder="Ask about crayfish prices…"
            maxlength="1000"
            autocomplete="off"
            required
          >
          <button class="btn btn-primary btn-square h-10 w-10" type="submit" aria-label="Send message">
            <AppIcon name="send" size="size-4" />
          </button>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.chat-panel {
  display: none;
}
</style>

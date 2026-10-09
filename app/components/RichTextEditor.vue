<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import TextAlign from '@tiptap/extension-text-align'

withDefaults(defineProps<{
  editable?: boolean
  placeholder?: string
}>(), {
  editable: true,
  placeholder: undefined
})

const model = defineModel<Record<string, unknown> | null | undefined>()

const extensions = [TextAlign.configure({ types: ['heading', 'paragraph'] })]

const items: EditorToolbarItem[][] = [
  [
    { kind: 'heading', level: 1, icon: 'i-lucide-heading-1' },
    { kind: 'heading', level: 2, icon: 'i-lucide-heading-2' },
    { kind: 'heading', level: 3, icon: 'i-lucide-heading-3' }
  ],
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold' },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic' },
    { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline' },
    { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough' },
    { kind: 'mark', mark: 'code', icon: 'i-lucide-code' }
  ],
  [
    { kind: 'bulletList', icon: 'i-lucide-list' },
    { kind: 'orderedList', icon: 'i-lucide-list-ordered' },
    { kind: 'blockquote', icon: 'i-lucide-text-quote' }
  ],
  [
    { kind: 'textAlign', align: 'left', icon: 'i-lucide-align-left' },
    { kind: 'textAlign', align: 'center', icon: 'i-lucide-align-center' },
    { kind: 'textAlign', align: 'right', icon: 'i-lucide-align-right' },
    { kind: 'textAlign', align: 'justify', icon: 'i-lucide-align-justify' }
  ],
  [
    { kind: 'link', icon: 'i-lucide-link' }
  ]
]
</script>

<template>
  <UEditor
    v-slot="{ editor }"
    v-model="model"
    content-type="json"
    :editable="editable"
    :extensions="extensions"
    :placeholder="placeholder"
    :class="editable ? 'min-h-40 rounded-md border border-default' : ''"
    :ui="{ base: editable ? 'px-4 py-3 sm:px-4' : 'p-0 sm:px-0' }"
  >
    <UEditorToolbar
      v-if="editable"
      :editor="editor"
      :items="items"
      class="overflow-x-auto border-b border-default px-2 py-1.5"
    />
  </UEditor>
</template>

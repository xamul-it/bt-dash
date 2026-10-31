<template>
  <div class="markdown-notes" v-html="html" />
</template>

<script>
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const markdown = new MarkdownIt({ html: false, breaks: true });
// Notes are text; avoid loading external images when opening a run.
markdown.disable('image');

export default {
  props: { text: { type: String, default: '' } },
  computed: {
    html() {
      return DOMPurify.sanitize(markdown.render(this.text));
    },
  },
};
</script>

<style scoped>
.markdown-notes {
  overflow-wrap: anywhere;
  white-space: normal;
  max-width: 100%;
}
.markdown-notes :deep(pre) { overflow: auto; background: #f3f6fa; padding: 8px; }
.markdown-notes :deep(p:last-child) { margin-bottom: 0; }
.markdown-notes :deep(table) { border-collapse: collapse; }
.markdown-notes :deep(th), .markdown-notes :deep(td) { border: 1px solid #ccc; padding: 4px 8px; }
</style>

<template><div class="knowledge-markdown" v-html="html" /></template>
<script setup>
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { knowledgeHeadingId } from '../utils/knowledge.mjs'
const props = defineProps({ text: { type: String, default: '' }, references: { type: Object, default: () => ({}) } })
const html = computed(() => {
  const md = new MarkdownIt({ html: false, breaks: false })
  md.disable('image')
  const escape = md.utils.escapeHtml
  const keys = Object.keys(props.references).sort((a, b) => b.length - a.length)
  const pattern = keys.length ? new RegExp(keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null
  const anchor = key => { const r = props.references[key]; return `<a href="/${escape(r.path)}${r.anchor ? '#' + escape(r.anchor) : ''}" data-source="${escape(r.path)}" data-line="${r.line || 1}">${escape(key)}</a>` }
  md.renderer.rules.text = (tokens, index, options, env) => {
    const text = tokens[index].content
    if (!pattern || env.linkDepth) return escape(text)
    let out = '', last = 0
    for (const match of text.matchAll(pattern)) { out += escape(text.slice(last, match.index)) + anchor(match[0]); last = match.index + match[0].length }
    return out + escape(text.slice(last))
  }
  md.renderer.rules.code_inline = (tokens, index, options, env) => {
    const text = tokens[index].content
    return `<code>${!env.linkDepth && props.references[text] ? anchor(text) : escape(text)}</code>`
  }
  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    env.linkDepth = (env.linkDepth || 0) + 1
    const reference = props.references[tokens[index].attrGet('href')]
    if (reference) { tokens[index].attrSet('data-source', reference.path); tokens[index].attrSet('data-line', String(reference.line || 1)) }
    return renderer.renderToken(tokens, index, options)
  }
  md.renderer.rules.link_close = (tokens, index, options, env, renderer) => { env.linkDepth = Math.max(0, (env.linkDepth || 0) - 1); return renderer.renderToken(tokens, index, options) }
  md.renderer.rules.heading_open = (tokens, index, options, env, renderer) => {
    const base = knowledgeHeadingId(tokens[index + 1]?.content || '')
    env.headings ||= {}; const count = env.headings[base] || 0; env.headings[base] = count + 1
    tokens[index].attrSet('id', base + (count ? `-${count}` : ''))
    return renderer.renderToken(tokens, index, options)
  }
  return DOMPurify.sanitize(md.render(props.text, {}), { ADD_ATTR: ['data-source', 'data-line'] })
})
</script>
<style scoped>
.knowledge-markdown { font: 14px/1.65 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow-wrap: anywhere; color: #24292e; }
.knowledge-markdown :deep(h1), .knowledge-markdown :deep(h2), .knowledge-markdown :deep(h3), .knowledge-markdown :deep(h4), .knowledge-markdown :deep(h5), .knowledge-markdown :deep(h6) { line-height: 1.35; font-weight: 600; letter-spacing: normal; margin: 1.2em 0 .6em; scroll-margin-top: 12px; }
.knowledge-markdown :deep(h1) { font-size: 1.75em; border-bottom: 1px solid #ddd; padding-bottom: .25em; }
.knowledge-markdown :deep(h2) { font-size: 1.45em; border-bottom: 1px solid #eee; padding-bottom: .2em; }
.knowledge-markdown :deep(h3) { font-size: 1.2em; }
.knowledge-markdown :deep(h4) { font-size: 1.05em; }
.knowledge-markdown :deep(h5), .knowledge-markdown :deep(h6) { font-size: 1em; }
.knowledge-markdown :deep(p), .knowledge-markdown :deep(ul), .knowledge-markdown :deep(ol) { margin: 0 0 1em; }
.knowledge-markdown :deep(pre) { background: #f0f0f0; border: 1px solid #e3e3e3; border-radius: 4px; padding: 12px 16px; overflow-x: auto; line-height: 1.5; }
.knowledge-markdown :deep(code) { font: .9em/1.5 'SFMono-Regular', Consolas, monospace; background: #ededed; border-radius: 3px; padding: 2px 4px; }
.knowledge-markdown :deep(pre code) { background: transparent; padding: 0; white-space: pre; }
.knowledge-markdown :deep(blockquote) { border-left: 4px solid #ddd; background: #fafafa; margin: 1em 0; padding: 8px 16px; color: #555; }
.knowledge-markdown :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 1em 0; }
.knowledge-markdown :deep(th), .knowledge-markdown :deep(td) { border: 1px solid #ddd; padding: 6px 12px; }
.knowledge-markdown :deep(th), .knowledge-markdown :deep(tr:nth-child(even)) { background: #f4f4f4; }
.knowledge-markdown :deep(a) { color: #0969da; text-decoration: underline; cursor: pointer; }
.knowledge-markdown :deep(hr) { border: 0; border-top: 1px solid #ddd; margin: 1.5em 0; }
</style>

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import s from './Markdown.module.css'

export function Markdown({ children }: { children: string }) {
  return (
    <div className={s.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: content }) => (
            <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              {content}
            </a>
          ),
          table: ({ children: rows }) => (
            <div className={s.tableScroll}>
              <table>{rows}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

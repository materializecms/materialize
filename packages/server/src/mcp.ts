import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type ApiCall, PAGE_GUIDE, type SiteTool, siteTools, ToolError } from './tools.ts'

/** What an MCP client is told about the site when it connects. */
const INSTRUCTIONS = `This server edits a website built with Materialize, a CMS with a visual page editor.
Start with get_site to see the collections and their fields; list_entries and get_entry read content.
Pages built on the canvas are edited with get_page (outline) and edit_page (operations). Changes are saved as drafts: publish_entry puts them online, so publish only when asked.
${PAGE_GUIDE}`

/** Results as text the model reads: strings as they are, the rest as JSON. */
const asText = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value, null, 1))

/** Registers the site's tools on an MCP server; each call runs as the person behind `call`. */
export function registerTools(server: McpServer, tools: SiteTool[]) {
  for (const t of tools) {
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.input,
        annotations: { readOnlyHint: !!t.readOnly, destructiveHint: !t.readOnly && /remove|unpublish/.test(t.name) },
      },
      async (input: unknown) => {
        try {
          return { content: [{ type: 'text' as const, text: asText(await t.run(input as never)) }] }
        } catch (error) {
          if (!(error instanceof ToolError)) console.error(error)
          const message = error instanceof Error ? error.message : String(error)
          return { content: [{ type: 'text' as const, text: message }], isError: true }
        }
      },
    )
  }
}

/** A fresh MCP server for one request (stateless): the tools act as the person who sent it. */
export function createMcpServer(call: ApiCall, version: string): McpServer {
  const server = new McpServer({ name: 'materialize', title: 'Materialize', version }, { instructions: INSTRUCTIONS })
  registerTools(server, siteTools(call))
  return server
}

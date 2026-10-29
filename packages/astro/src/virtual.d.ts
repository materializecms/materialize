declare module 'virtual:materialize/site' {
  /** Block components by block name: src/blocks/ProjectsGrid.astro renders blocks named "projectsGrid". */
  export const blocks: Record<string, (props: Record<string, unknown>) => unknown>
  /** The site layout (src/layouts/Site.astro), also used to preview drafts on the editor canvas. */
  export const Layout: (props: Record<string, unknown>) => unknown
}

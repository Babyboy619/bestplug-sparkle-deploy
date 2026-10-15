<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Preserve TanStack file routing and integration-managed Cloud clients; uploaded projects must not overwrite runtime configuration or generated integrations.
- Keep shared branding in SiteFrame and semantic styling in src/styles.css so all marketplace pages remain consistent.
- Own the browser session subscription in AuthProvider, and keep payment credentials and settlement operations server-only for consistent authentication and safe wallet updates.

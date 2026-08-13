begin;

create function public.import_article_drafts(
  p_articles jsonb,
  p_source text
)
returns table(id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  article jsonb;
  inserted public.content_entries%rowtype;
  source_label text := trim(coalesce(p_source, ''));
begin
  if actor_id is null or not public.is_admin() then
    raise exception 'UNAUTHORISED';
  end if;
  if p_articles is null
     or jsonb_typeof(p_articles) is distinct from 'array'
     or jsonb_array_length(p_articles) not between 1 and 100 then
    raise exception 'INVALID_ARTICLE_IMPORT_BATCH';
  end if;
  if source_label <> 'reviewed editorial import' then
    raise exception 'INVALID_ARTICLE_IMPORT_SOURCE';
  end if;

  for article in select value from jsonb_array_elements(p_articles)
  loop
    if article->>'kind' <> 'article'
       or article->>'status' <> 'draft'
       or (article ? 'publishedAt' and article->'publishedAt' <> 'null'::jsonb)
       or jsonb_typeof(article->'sections') <> 'array'
       or jsonb_typeof(article->'metadata') <> 'object' then
      raise exception 'INVALID_ARTICLE_DRAFT:%', coalesce(article->>'slug', '[missing]');
    end if;
    if exists (
      select 1 from public.content_entries entry
      where entry.kind = 'article'::public.content_kind
        and entry.slug = article->>'slug'
    ) then
      raise exception 'ARTICLE_IMPORT_COLLISION:%', article->>'slug';
    end if;
  end loop;

  for article in select value from jsonb_array_elements(p_articles)
  loop
    insert into public.content_entries (
      kind, slug, title, excerpt, sections, metadata, seo_title,
      seo_description, status, published_at, author_id
    ) values (
      'article'::public.content_kind,
      article->>'slug',
      article->>'title',
      article->>'excerpt',
      article->'sections',
      article->'metadata',
      article->>'seoTitle',
      article->>'seoDescription',
      'draft'::public.publication_status,
      null,
      actor_id
    ) returning * into inserted;

    insert into public.admin_audit_log (
      actor_id, action, entity_type, entity_id, detail
    ) values (
      actor_id,
      'import_draft',
      'article',
      inserted.id::text,
      jsonb_build_object(
        'kind', 'article',
        'slug', inserted.slug,
        'status', 'draft',
        'source', source_label
      )
    );

    id := inserted.id;
    slug := inserted.slug;
    return next;
  end loop;
end
$$;

revoke all on function public.import_article_drafts(jsonb,text)
from public, anon, authenticated, service_role;

grant execute on function public.import_article_drafts(jsonb,text)
to authenticated;

commit;

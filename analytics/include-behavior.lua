-- Excluded pages retain their original header and analytics assets.
function Meta(meta)
  local input = quarto.doc.input_file:gsub('\\', '/')
  if input:match('/projects/us%-migration/') or input:match('/projects/us%-migration%.qmd$') then
    return meta
  end
  if quarto.doc.is_format('html') then
    local headers = meta['header-includes'] or pandoc.MetaList({})
    headers:insert(pandoc.MetaBlocks({pandoc.RawBlock('html',
      '<script defer src="https://kennethlow.com/analytics/behavior.js"></script>')}))
    meta['header-includes'] = headers
  end
  return meta
end

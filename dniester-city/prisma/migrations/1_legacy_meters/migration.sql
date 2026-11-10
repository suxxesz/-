-- Перенос показаний v0.1 (без счётчика) на автоматически созданный счётчик «из истории».
-- На новой базе ничего не делает; на старой — идемпотентно.
INSERT INTO records(id,kind,owner_id,organization_id,data)
SELECT 'legacy:'||md5(owner_id||':'||(data->>'address')||':'||(data->>'category')),
 'meter',owner_id,organization_id,
 jsonb_build_object('id','legacy:'||md5(owner_id||':'||(data->>'address')||':'||(data->>'category')),
 'address',data->>'address','category',data->>'category','name','Счётчик из истории',
 'serial','Номер не указан','account','','initialValue',min((data->>'previous')::numeric),'created',min(data->>'created'))
FROM records WHERE kind='reading' AND owner_id IS NOT NULL AND NOT(data ? 'meterId')
GROUP BY owner_id,organization_id,data->>'address',data->>'category'
ON CONFLICT(id) DO NOTHING;
UPDATE records SET data=jsonb_set(data,'{meterId}',to_jsonb('legacy:'||md5(owner_id||':'||(data->>'address')||':'||(data->>'category'))))
WHERE kind='reading' AND owner_id IS NOT NULL AND NOT(data ? 'meterId');
